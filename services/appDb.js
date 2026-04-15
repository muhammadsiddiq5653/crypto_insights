'use strict';

/**
 * appDb.js — Platform / SaaS database
 *
 * Stores everything related to the business:
 *   users, sessions, waitlist, plan management, admin audit
 *
 * File: data/app.db
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.APP_DB_PATH
  || path.join(__dirname, '..', 'data', 'app.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { verbose: null });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('cache_size = -16000'); // 16 MB
    initTables();
    runMigrations();
  }
  return _db;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

function initTables() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      username             TEXT UNIQUE NOT NULL,
      email                TEXT UNIQUE NOT NULL,
      password_hash        TEXT NOT NULL,
      role                 TEXT NOT NULL DEFAULT 'user',
      plan                 TEXT NOT NULL DEFAULT 'free',
      plan_expires_at      INTEGER,
      plan_upgraded_by     INTEGER,
      plan_upgraded_at     INTEGER,
      stripe_customer_id   TEXT,
      stripe_subscription_id TEXT,
      suspended            INTEGER NOT NULL DEFAULT 0,
      suspend_reason       TEXT,
      created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login           INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id   INTEGER NOT NULL,
      action     TEXT NOT NULL,
      target_id  INTEGER,
      details    TEXT,
      ts         INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_audit_admin_ts ON admin_audit_log(admin_id, ts DESC);

    CREATE TABLE IF NOT EXISTS waitlist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT UNIQUE NOT NULL,
      source      TEXT DEFAULT 'landing',
      signed_up_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    INSERT OR IGNORE INTO settings(key, value) VALUES
      ('registration_open', 'true'),
      ('app_version',        '2.0.0'),
      ('maintenance_mode',   'false');
  `);
}

function runMigrations() {
  // Safe ALTER TABLE — each column addition is idempotent
  const cols = [
    `ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'`,
    `ALTER TABLE users ADD COLUMN plan_expires_at INTEGER`,
    `ALTER TABLE users ADD COLUMN plan_upgraded_by INTEGER`,
    `ALTER TABLE users ADD COLUMN plan_upgraded_at INTEGER`,
    `ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`,
    `ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`,
    `ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN suspend_reason TEXT`,
  ];
  for (const sql of cols) {
    try { _db.exec(sql); } catch (_) { /* already exists — safe */ }
  }
  // Admin always has pro+ access
  _db.exec(`UPDATE users SET plan = 'pro' WHERE role = 'admin' AND plan = 'free'`);
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = {
  free: {
    label:   'Free',
    price:   0,
    coins:   3,
    mtf:     false,
    ai:      false,
    poly:    false,
    kelly:   false,
    macro:   false,
    onchain: false,
    seats:   1,
  },
  pro: {
    label:   'Pro',
    price:   20,
    coins:   10,
    mtf:     true,
    ai:      true,
    poly:    true,
    kelly:   true,
    macro:   true,
    onchain: true,
    seats:   1,
  },
  team: {
    label:   'Team',
    price:   49,
    coins:   10,
    mtf:     true,
    ai:      true,
    poly:    true,
    kelly:   true,
    macro:   true,
    onchain: true,
    seats:   5,
  },
};

// ─── Users ────────────────────────────────────────────────────────────────────

function createUser(username, email, passwordHash, role = 'user') {
  const result = getDb().prepare(
    `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`
  ).run(username, email, passwordHash, role);
  return result.lastInsertRowid;
}

function getUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserById(id) {
  return getDb().prepare(
    'SELECT id, username, email, role, plan, suspended, created_at, last_login FROM users WHERE id = ?'
  ).get(id);
}

function updateLastLogin(userId) {
  getDb().prepare('UPDATE users SET last_login = unixepoch() WHERE id = ?').run(userId);
}

function getAllUsers() {
  return getDb().prepare(
    'SELECT id, username, email, role, plan, suspended, created_at, last_login FROM users ORDER BY created_at DESC'
  ).all();
}

// ─── Plan management ──────────────────────────────────────────────────────────

function getUserPlan(userId) {
  const db = getDb();
  const user = db.prepare('SELECT plan, plan_expires_at, suspended FROM users WHERE id = ?').get(userId);
  if (!user) return 'free';
  if (user.suspended) return 'suspended';
  if (user.plan === 'pro' || user.plan === 'team') {
    if (user.plan_expires_at && user.plan_expires_at < Math.floor(Date.now() / 1000)) {
      db.prepare("UPDATE users SET plan = 'free' WHERE id = ?").run(userId);
      return 'free';
    }
    return user.plan;
  }
  return user.plan || 'free';
}

function upgradePlan(userId, plan, adminId, expiresAt = null) {
  const db = getDb();
  db.prepare(`
    UPDATE users SET
      plan = ?,
      plan_expires_at = ?,
      plan_upgraded_by = ?,
      plan_upgraded_at = ?
    WHERE id = ?
  `).run(plan, expiresAt, adminId, Math.floor(Date.now() / 1000), userId);
  auditLog(adminId, 'upgrade_plan', userId, JSON.stringify({ plan, expiresAt }));
}

function suspendUser(userId, reason, adminId) {
  getDb().prepare('UPDATE users SET suspended = 1, suspend_reason = ? WHERE id = ?')
    .run(reason || 'Suspended by admin', userId);
  if (adminId) auditLog(adminId, 'suspend_user', userId, reason);
}

function unsuspendUser(userId, adminId) {
  getDb().prepare("UPDATE users SET suspended = 0, suspend_reason = NULL WHERE id = ?").run(userId);
  if (adminId) auditLog(adminId, 'unsuspend_user', userId, null);
}

function getAdminUserList() {
  return getDb().prepare(`
    SELECT id, username, email, role, plan, plan_expires_at, plan_upgraded_at,
           suspended, suspend_reason, created_at, last_login,
           stripe_customer_id, stripe_subscription_id
    FROM users ORDER BY created_at DESC
  `).all();
}

function getRevenueStats() {
  const db = getDb();
  const total       = db.prepare("SELECT COUNT(*) as n FROM users").get().n;
  const pro         = db.prepare("SELECT COUNT(*) as n FROM users WHERE plan = 'pro'  AND suspended = 0").get().n;
  const team        = db.prepare("SELECT COUNT(*) as n FROM users WHERE plan = 'team' AND suspended = 0").get().n;
  const free        = db.prepare("SELECT COUNT(*) as n FROM users WHERE plan = 'free'").get().n;
  const suspended   = db.prepare("SELECT COUNT(*) as n FROM users WHERE suspended = 1").get().n;
  const since30d    = Math.floor(Date.now() / 1000) - 30 * 86400;
  const since7d     = Math.floor(Date.now() / 1000) - 7  * 86400;
  const new30d      = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at > ?").get(since30d).n;
  const new7d       = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at > ?").get(since7d).n;

  const MRR = (pro * 20) + (team * 49);
  const ARR = MRR * 12;

  return {
    totalUsers: total, proUsers: pro, teamUsers: team,
    freeUsers: free, suspendedUsers: suspended,
    newUsers30d: new30d, newUsers7d: new7d,
    MRR, ARR,
  };
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

function addToWaitlist(email, source = 'landing') {
  try {
    getDb().prepare('INSERT OR IGNORE INTO waitlist (email, source) VALUES (?, ?)')
      .run(email.toLowerCase().trim(), source);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getWaitlist() {
  return getDb().prepare('SELECT * FROM waitlist ORDER BY signed_up_at DESC').all();
}

// ─── Admin audit log ──────────────────────────────────────────────────────────

function auditLog(adminId, action, targetId, details) {
  getDb().prepare(
    `INSERT INTO admin_audit_log (admin_id, action, target_id, details) VALUES (?, ?, ?, ?)`
  ).run(adminId, action, targetId || null, details || null);
}

function getAuditLog(limit = 100) {
  return getDb().prepare(`
    SELECT a.*, u.username as admin_username
    FROM admin_audit_log a
    LEFT JOIN users u ON u.id = a.admin_id
    ORDER BY a.ts DESC LIMIT ?
  `).all(limit);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare(
    `INSERT OR REPLACE INTO settings(key, value, updated_at) VALUES (?, ?, unixepoch())`
  ).run(key, String(value));
}

// ─── DB stats ─────────────────────────────────────────────────────────────────

function getDbStats() {
  const db = getDb();
  const stats = {};
  for (const t of ['users', 'waitlist', 'admin_audit_log', 'settings']) {
    try {
      stats[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n;
    } catch (_) { stats[t] = 0; }
  }
  stats._file = DB_PATH;
  return stats;
}

// ─── Graceful close ───────────────────────────────────────────────────────────

process.on('exit', () => { if (_db) _db.close(); });

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getDb,
  PLANS,
  // Users
  createUser, getUserByEmail, getUserByUsername, getUserById,
  updateLastLogin, getAllUsers,
  // Plan management
  getUserPlan, upgradePlan, suspendUser, unsuspendUser,
  getAdminUserList, getRevenueStats,
  // Waitlist
  addToWaitlist, getWaitlist,
  // Audit
  auditLog, getAuditLog,
  // Settings
  getSetting, setSetting,
  // Stats
  getDbStats,
};

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

const IS_VERCEL = process.env.VERCEL === '1';
const DEFAULT_DB_DIR = IS_VERCEL
  ? path.join('/tmp', 'traderpro')
  : path.join(__dirname, '..', 'data');

const DB_PATH = process.env.APP_DB_PATH
  || path.join(DEFAULT_DB_DIR, 'app.db');

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

    -- ── Phase 5: Per-user trader data ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_api_keys (
      user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      openrouter_key  TEXT,
      fred_key        TEXT,
      slack_webhook   TEXT,
      binance_api_key TEXT,
      binance_secret  TEXT,
      updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_alerts (
      id         TEXT NOT NULL,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      symbol     TEXT NOT NULL,
      condition  TEXT NOT NULL,
      value      TEXT NOT NULL,
      label      TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      fired_at   INTEGER,
      PRIMARY KEY (id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_alerts(user_id, active);

    CREATE TABLE IF NOT EXISTS user_journal (
      id          TEXT NOT NULL,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json   TEXT NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_journal_user ON user_journal(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS user_portfolio (
      id          TEXT NOT NULL,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json   TEXT NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_portfolio_user ON user_portfolio(user_id);

    -- ── Signal broadcasts (admin-generated + auto-engine) ─────────────
    CREATE TABLE IF NOT EXISTS signal_broadcasts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol       TEXT NOT NULL,
      direction    TEXT NOT NULL,
      asset_type   TEXT NOT NULL DEFAULT 'Crypto',
      entry        REAL,
      tp1          REAL,
      tp2          REAL,
      sl           REAL,
      confidence   TEXT,
      timeframe    TEXT,
      notes        TEXT,
      source       TEXT NOT NULL DEFAULT 'manual',
      outcome      TEXT,
      outcome_at   INTEGER,
      outcome_note TEXT,
      broadcast_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_sb_symbol ON signal_broadcasts(symbol, broadcast_at DESC);

    -- ── Password reset tokens ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
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
    `ALTER TABLE users ADD COLUMN totp_secret TEXT`,
    `ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`,
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

const USER_LOGIN_COLS = 'id, username, email, password_hash, role, plan, suspended, totp_secret, totp_enabled, created_at, last_login';

function getUserByEmail(email) {
  return getDb().prepare(`SELECT ${USER_LOGIN_COLS} FROM users WHERE email = ?`).get(email);
}

function getUserByUsername(username) {
  return getDb().prepare(`SELECT ${USER_LOGIN_COLS} FROM users WHERE username = ?`).get(username);
}

function getUserById(id) {
  return getDb().prepare(
    `SELECT id, username, email, role, plan, plan_expires_at,
            stripe_customer_id, suspended, created_at, last_login
     FROM users WHERE id = ?`
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

function stripeActivatePlan(userId, { customerId, subscriptionId, plan = 'pro', expiresAt = null }) {
  const db = getDb();
  db.prepare(`
    UPDATE users SET
      plan = ?,
      plan_expires_at = ?,
      plan_upgraded_at = ?,
      stripe_customer_id = ?,
      stripe_subscription_id = ?
    WHERE id = ?
  `).run(plan, expiresAt, Math.floor(Date.now() / 1000), customerId, subscriptionId, userId);
  auditLog('stripe', 'stripe_activate', userId, JSON.stringify({ plan, customerId, subscriptionId }));
}

function stripeDeactivatePlan(userId) {
  const db = getDb();
  db.prepare(`UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?`).run(userId);
  auditLog('stripe', 'stripe_deactivate', userId, null);
}

function getUserByStripeCustomer(customerId) {
  return getDb().prepare(`SELECT ${USER_LOGIN_COLS} FROM users WHERE stripe_customer_id = ?`).get(customerId);
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

// ─── User API Keys ────────────────────────────────────────────────────────────

function getUserKeys(userId) {
  return getDb().prepare('SELECT * FROM user_api_keys WHERE user_id = ?').get(userId) || {};
}

function setUserKeys(userId, keys) {
  const allowed = ['openrouter_key','fred_key','slack_webhook','binance_api_key','binance_secret'];
  const existing = getUserKeys(userId);
  const merged = { ...existing, ...Object.fromEntries(
    Object.entries(keys).filter(([k]) => allowed.includes(k))
  )};
  getDb().prepare(`
    INSERT OR REPLACE INTO user_api_keys
      (user_id, openrouter_key, fred_key, slack_webhook, binance_api_key, binance_secret, updated_at)
    VALUES (?,?,?,?,?,?, unixepoch())
  `).run(userId,
    merged.openrouter_key  || null, merged.fred_key       || null,
    merged.slack_webhook   || null, merged.binance_api_key|| null,
    merged.binance_secret  || null,
  );
}

// ─── User Alerts ──────────────────────────────────────────────────────────────

function getUserAlerts(userId) {
  return getDb().prepare('SELECT * FROM user_alerts WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function upsertUserAlert(userId, alert) {
  getDb().prepare(`
    INSERT OR REPLACE INTO user_alerts
      (id, user_id, type, symbol, condition, value, label, active, created_at, fired_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(alert.id, userId, alert.type, alert.symbol, alert.condition,
    String(alert.value), alert.label,
    alert.active ? 1 : 0,
    Math.floor((alert.createdAt || Date.now()) / 1000),
    alert.firedAt ? Math.floor(alert.firedAt / 1000) : null,
  );
}

function deleteUserAlert(userId, alertId) {
  getDb().prepare('DELETE FROM user_alerts WHERE id = ? AND user_id = ?').run(alertId, userId);
}

function markAlertFired(userId, alertId) {
  getDb().prepare(`
    UPDATE user_alerts SET active = 0, fired_at = unixepoch() WHERE id = ? AND user_id = ?
  `).run(alertId, userId);
}

function getActiveAlertsAll() {
  return getDb().prepare(`
    SELECT ua.*, uk.slack_webhook
    FROM user_alerts ua
    LEFT JOIN user_api_keys uk ON uk.user_id = ua.user_id
    WHERE ua.active = 1 AND ua.type IN ('price','rsi')
  `).all();
}

// ─── User Journal ─────────────────────────────────────────────────────────────

function getUserJournal(userId) {
  const rows = getDb().prepare('SELECT data_json FROM user_journal WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  return rows.map(r => { try { return JSON.parse(r.data_json); } catch { return null; } }).filter(Boolean);
}

function upsertJournalTrade(userId, trade) {
  getDb().prepare(`
    INSERT OR REPLACE INTO user_journal (id, user_id, data_json, updated_at)
    VALUES (?,?,?, unixepoch())
  `).run(trade.id, userId, JSON.stringify(trade));
}

function deleteJournalTrade(userId, tradeId) {
  getDb().prepare('DELETE FROM user_journal WHERE id = ? AND user_id = ?').run(tradeId, userId);
}

// ─── User Portfolio ───────────────────────────────────────────────────────────

function getUserPortfolio(userId) {
  const rows = getDb().prepare('SELECT data_json FROM user_portfolio WHERE user_id = ?').all(userId);
  return rows.map(r => { try { return JSON.parse(r.data_json); } catch { return null; } }).filter(Boolean);
}

function upsertPortfolioHolding(userId, holding) {
  getDb().prepare(`
    INSERT OR REPLACE INTO user_portfolio (id, user_id, data_json, updated_at)
    VALUES (?,?,?, unixepoch())
  `).run(holding.id, userId, JSON.stringify(holding));
}

function deletePortfolioHolding(userId, holdingId) {
  getDb().prepare('DELETE FROM user_portfolio WHERE id = ? AND user_id = ?').run(holdingId, userId);
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

// ─── Signal broadcasts ────────────────────────────────────────────────────────

function insertSignalBroadcast(signal) {
  return getDb().prepare(
    `INSERT INTO signal_broadcasts (symbol, direction, asset_type, entry, tp1, tp2, sl, confidence, timeframe, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    signal.symbol, signal.direction, signal.assetType || 'Crypto',
    signal.entry || null, signal.tp1 || null, signal.tp2 || null, signal.sl || null,
    signal.confidence || null, signal.timeframe || null, signal.notes || null,
    signal.source || 'manual'
  );
}

function getSignalBroadcasts({ limit = 100, symbol = null } = {}) {
  if (symbol) {
    return getDb().prepare(
      `SELECT * FROM signal_broadcasts WHERE symbol = ? ORDER BY broadcast_at DESC LIMIT ?`
    ).all(symbol, limit);
  }
  return getDb().prepare(
    `SELECT * FROM signal_broadcasts ORDER BY broadcast_at DESC LIMIT ?`
  ).all(limit);
}

function updateSignalOutcome(id, outcome, note = null) {
  return getDb().prepare(
    `UPDATE signal_broadcasts SET outcome = ?, outcome_at = unixepoch(), outcome_note = ? WHERE id = ?`
  ).run(outcome, note || null, id);
}

function getSignalStats() {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as n FROM signal_broadcasts`).get().n;
  const outcomes = db.prepare(
    `SELECT outcome, COUNT(*) as n FROM signal_broadcasts WHERE outcome IS NOT NULL GROUP BY outcome`
  ).all();
  const bySymbol = db.prepare(
    `SELECT symbol, COUNT(*) as total,
      SUM(CASE WHEN outcome IN ('TP1_HIT','TP2_HIT') THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'SL_HIT' THEN 1 ELSE 0 END) as losses
     FROM signal_broadcasts WHERE outcome IS NOT NULL GROUP BY symbol ORDER BY total DESC LIMIT 10`
  ).all();
  return { total, outcomes, bySymbol };
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
  return stats;
}

// ─── Password reset tokens ────────────────────────────────────────────────────

function createResetToken(userId, token) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  getDb().prepare(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(token, userId, expires);
}

// Atomically marks the token used and returns the row in one statement.
// Returns the row if the token was valid and unused; null if already used or expired.
// This eliminates the TOCTOU race condition between getResetToken + markResetTokenUsed.
function consumeResetToken(token) {
  const now = Math.floor(Date.now() / 1000);
  const row = getDb().prepare(
    `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?`
  ).get(token, now);
  if (!row) return null;
  const result = getDb().prepare(
    `UPDATE password_reset_tokens SET used = 1 WHERE token = ? AND used = 0`
  ).run(token);
  // If another request beat us to it, changedRows will be 0
  return result.changes > 0 ? row : null;
}

function getResetToken(token) {
  return getDb().prepare(
    `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > unixepoch()`
  ).get(token);
}

function markResetTokenUsed(token) {
  getDb().prepare(`UPDATE password_reset_tokens SET used = 1 WHERE token = ?`).run(token);
}

function deleteExpiredResetTokens() {
  getDb().prepare(`DELETE FROM password_reset_tokens WHERE expires_at <= unixepoch() OR used = 1`).run();
}

// ─── 2FA helpers ──────────────────────────────────────────────────────────────

function setTotpSecret(userId, secret) {
  getDb().prepare(`UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`).run(secret, userId);
}

function enableTotp(userId) {
  getDb().prepare(`UPDATE users SET totp_enabled = 1 WHERE id = ?`).run(userId);
}

function disableTotp(userId) {
  getDb().prepare(`UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`).run(userId);
}

function getTotpRow(userId) {
  return getDb().prepare(`SELECT totp_secret, totp_enabled FROM users WHERE id = ?`).get(userId);
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
  getUserPlan, upgradePlan,
  stripeActivatePlan, stripeDeactivatePlan, getUserByStripeCustomer,
  suspendUser, unsuspendUser,
  getAdminUserList, getRevenueStats,
  // Waitlist
  addToWaitlist, getWaitlist,
  // Audit
  auditLog, getAuditLog,
  // Settings
  getSetting, setSetting,
  // Signal broadcasts
  insertSignalBroadcast, getSignalBroadcasts, updateSignalOutcome, getSignalStats,
  // User API keys
  getUserKeys, setUserKeys,
  // User alerts
  getUserAlerts, upsertUserAlert, deleteUserAlert, markAlertFired, getActiveAlertsAll,
  // User journal
  getUserJournal, upsertJournalTrade, deleteJournalTrade,
  // User portfolio
  getUserPortfolio, upsertPortfolioHolding, deletePortfolioHolding,
  // Password reset
  createResetToken, getResetToken, markResetTokenUsed, consumeResetToken, deleteExpiredResetTokens,
  // 2FA / TOTP
  setTotpSecret, enableTotp, disableTotp, getTotpRow,
  // Stats
  getDbStats,
};

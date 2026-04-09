'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'trader_portal.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { verbose: null });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -32000'); // 32MB cache
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login INTEGER
    );

    -- Price history for all tracked symbols
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      volume_24h REAL,
      market_cap REAL,
      price_change_24h REAL,
      high_24h REAL,
      low_24h REAL,
      source TEXT DEFAULT 'binance',
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_symbol_ts
      ON price_history(symbol, timestamp DESC);

    -- Order book snapshots (top levels)
    CREATE TABLE IF NOT EXISTS order_book_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      best_bid REAL,
      best_ask REAL,
      bid_depth_1pct REAL,
      ask_depth_1pct REAL,
      spread_pct REAL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_ob_snapshots_symbol_ts
      ON order_book_snapshots(symbol, timestamp DESC);

    -- News cache
    CREATE TABLE IF NOT EXISTS news_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT UNIQUE,
      source TEXT,
      summary TEXT,
      sentiment_score REAL DEFAULT 0,
      published_at INTEGER,
      fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_news_fetched
      ON news_cache(fetched_at DESC);

    -- Trade signals from ML/analysis
    CREATE TABLE IF NOT EXISTS trade_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      signal TEXT NOT NULL,
      confidence REAL,
      price_at_signal REAL,
      indicators_json TEXT,
      source TEXT DEFAULT 'ml',
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_trade_signals_symbol_ts
      ON trade_signals(symbol, timestamp DESC);

    -- Portfolio snapshots per user
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      holdings_json TEXT,
      total_value_usd REAL,
      pnl_24h REAL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_user_ts
      ON portfolio_snapshots(user_id, timestamp DESC);

    -- Backtest results
    CREATE TABLE IF NOT EXISTS backtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      strategy TEXT NOT NULL,
      symbol TEXT,
      params_json TEXT,
      metrics_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Arbitrage opportunities log
    CREATE TABLE IF NOT EXISTS arbitrage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      buy_exchange TEXT,
      sell_exchange TEXT,
      buy_price REAL,
      sell_price REAL,
      spread_pct REAL,
      est_profit_pct REAL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_arb_symbol_ts
      ON arbitrage_log(symbol, timestamp DESC);

    -- Liquidation events
    CREATE TABLE IF NOT EXISTS liquidation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      side TEXT,
      quantity REAL,
      price REAL,
      open_interest REAL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_liq_symbol_ts
      ON liquidation_events(symbol, timestamp DESC);

    -- On-chain metrics
    CREATE TABLE IF NOT EXISTS onchain_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL DEFAULT 'BTC',
      mvrv_ratio REAL,
      sopr REAL,
      nvt_ratio REAL,
      hash_rate REAL,
      difficulty REAL,
      active_addresses INTEGER,
      net_exchange_flow REAL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_onchain_ts
      ON onchain_metrics(symbol, timestamp DESC);

    -- System settings / key-value store
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Insert default settings if not present
    INSERT OR IGNORE INTO settings(key, value) VALUES
      ('data_collection_interval', '300'),
      ('max_price_history_days', '365'),
      ('app_version', '2.0.0'),
      ('registration_open', 'true');
  `);
}

// ─── User queries ───────────────────────────────────────────────────────────

function createUser(username, email, passwordHash, role = 'user') {
  const stmt = getDb().prepare(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (?, ?, ?, ?)`
  );
  const result = stmt.run(username, email, passwordHash, role);
  return result.lastInsertRowid;
}

function getUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserById(id) {
  return getDb().prepare('SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?').get(id);
}

function updateLastLogin(userId) {
  getDb().prepare('UPDATE users SET last_login = unixepoch() WHERE id = ?').run(userId);
}

function getAllUsers() {
  return getDb().prepare('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY created_at DESC').all();
}

// ─── Price history queries ───────────────────────────────────────────────────

function insertPriceHistory(symbol, price, volume24h, marketCap, priceChange24h, high24h, low24h, source = 'binance') {
  getDb().prepare(
    `INSERT INTO price_history (symbol, price, volume_24h, market_cap, price_change_24h, high_24h, low_24h, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(symbol, price, volume24h, marketCap, priceChange24h, high24h, low24h, source);
}

function getPriceHistory(symbol, hours = 24) {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return getDb().prepare(
    `SELECT symbol, price, volume_24h, price_change_24h, timestamp
     FROM price_history
     WHERE symbol = ? AND timestamp >= ?
     ORDER BY timestamp ASC`
  ).all(symbol, since);
}

function getLatestPrice(symbol) {
  return getDb().prepare(
    `SELECT * FROM price_history WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1`
  ).get(symbol);
}

function getPriceStats(symbol, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return getDb().prepare(
    `SELECT
       MIN(price) as min_price,
       MAX(price) as max_price,
       AVG(price) as avg_price,
       COUNT(*) as data_points,
       MIN(timestamp) as from_ts,
       MAX(timestamp) as to_ts
     FROM price_history
     WHERE symbol = ? AND timestamp >= ?`
  ).get(symbol, since);
}

// ─── Trade signals ───────────────────────────────────────────────────────────

function insertTradeSignal(symbol, signal, confidence, priceAtSignal, indicatorsJson, source = 'ml') {
  getDb().prepare(
    `INSERT INTO trade_signals (symbol, signal, confidence, price_at_signal, indicators_json, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(symbol, signal, confidence, priceAtSignal, JSON.stringify(indicatorsJson), source);
}

function getRecentSignals(symbol, limit = 20) {
  return getDb().prepare(
    `SELECT * FROM trade_signals WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?`
  ).all(symbol, limit);
}

// ─── News cache ──────────────────────────────────────────────────────────────

function upsertNews(title, url, source, summary, sentimentScore, publishedAt) {
  getDb().prepare(
    `INSERT OR REPLACE INTO news_cache (title, url, source, summary, sentiment_score, published_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(title, url, source, summary, sentimentScore, publishedAt);
}

function getRecentNews(limit = 50) {
  return getDb().prepare(
    `SELECT * FROM news_cache ORDER BY fetched_at DESC LIMIT ?`
  ).all(limit);
}

// ─── Arbitrage log ───────────────────────────────────────────────────────────

function insertArbitrageOpp(symbol, buyExchange, sellExchange, buyPrice, sellPrice, spreadPct, estProfitPct) {
  getDb().prepare(
    `INSERT INTO arbitrage_log (symbol, buy_exchange, sell_exchange, buy_price, sell_price, spread_pct, est_profit_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(symbol, buyExchange, sellExchange, buyPrice, sellPrice, spreadPct, estProfitPct);
}

function getArbitrageHistory(symbol, hours = 24) {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return getDb().prepare(
    `SELECT * FROM arbitrage_log WHERE symbol = ? AND timestamp >= ? ORDER BY timestamp DESC`
  ).all(symbol, since);
}

// ─── On-chain metrics ────────────────────────────────────────────────────────

function insertOnchainMetrics(symbol, data) {
  getDb().prepare(
    `INSERT INTO onchain_metrics (symbol, mvrv_ratio, sopr, nvt_ratio, hash_rate, difficulty, active_addresses, net_exchange_flow)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    symbol,
    data.mvrvRatio || null,
    data.sopr || null,
    data.nvtRatio || null,
    data.hashRate || null,
    data.difficulty || null,
    data.activeAddresses || null,
    data.netExchangeFlow || null
  );
}

function getOnchainHistory(symbol, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return getDb().prepare(
    `SELECT * FROM onchain_metrics WHERE symbol = ? AND timestamp >= ? ORDER BY timestamp ASC`
  ).all(symbol, since);
}

// ─── Order book snapshots ────────────────────────────────────────────────────

function insertOrderBookSnapshot(symbol, bestBid, bestAsk, bidDepth, askDepth, spreadPct) {
  getDb().prepare(
    `INSERT INTO order_book_snapshots (symbol, best_bid, best_ask, bid_depth_1pct, ask_depth_1pct, spread_pct)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(symbol, bestBid, bestAsk, bidDepth, askDepth, spreadPct);
}

// ─── Portfolio snapshots ─────────────────────────────────────────────────────

function savePortfolioSnapshot(userId, holdingsJson, totalValue, pnl24h) {
  getDb().prepare(
    `INSERT INTO portfolio_snapshots (user_id, holdings_json, total_value_usd, pnl_24h)
     VALUES (?, ?, ?, ?)`
  ).run(userId, JSON.stringify(holdingsJson), totalValue, pnl24h);
}

function getPortfolioHistory(userId, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return getDb().prepare(
    `SELECT * FROM portfolio_snapshots WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp ASC`
  ).all(userId, since);
}

// ─── Backtest results ────────────────────────────────────────────────────────

function saveBacktestResult(userId, strategy, symbol, paramsJson, metricsJson) {
  const result = getDb().prepare(
    `INSERT INTO backtest_results (user_id, strategy, symbol, params_json, metrics_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, strategy, symbol, JSON.stringify(paramsJson), JSON.stringify(metricsJson));
  return result.lastInsertRowid;
}

function getBacktestHistory(userId) {
  return getDb().prepare(
    `SELECT * FROM backtest_results WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId);
}

// ─── Settings ────────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare(
    `INSERT OR REPLACE INTO settings(key, value, updated_at) VALUES (?, ?, unixepoch())`
  ).run(key, String(value));
}

// ─── Cleanup old data ────────────────────────────────────────────────────────

function purgeOldData() {
  const maxDays = parseInt(getSetting('max_price_history_days') || '365');
  const cutoff = Math.floor(Date.now() / 1000) - maxDays * 86400;
  const db = getDb();

  const p = db.prepare('DELETE FROM price_history WHERE timestamp < ?').run(cutoff);
  const o = db.prepare('DELETE FROM order_book_snapshots WHERE timestamp < ?').run(cutoff);
  const n = db.prepare('DELETE FROM news_cache WHERE fetched_at < ?').run(cutoff);
  const a = db.prepare('DELETE FROM arbitrage_log WHERE timestamp < ?').run(cutoff);

  return { priceRows: p.changes, obRows: o.changes, newsRows: n.changes, arbRows: a.changes };
}

// ─── Database stats ──────────────────────────────────────────────────────────

function getDbStats() {
  const db = getDb();
  const tables = ['users', 'price_history', 'trade_signals', 'news_cache', 'arbitrage_log', 'onchain_metrics', 'order_book_snapshots'];
  const stats = {};
  for (const t of tables) {
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get();
    stats[t] = row.cnt;
  }
  return stats;
}

// Close db gracefully on process exit
process.on('exit', () => { if (db) db.close(); });
process.on('SIGINT', () => { if (db) db.close(); process.exit(0); });
process.on('SIGTERM', () => { if (db) db.close(); process.exit(0); });

module.exports = {
  getDb,
  // Users
  createUser, getUserByEmail, getUserByUsername, getUserById, updateLastLogin, getAllUsers,
  // Prices
  insertPriceHistory, getPriceHistory, getLatestPrice, getPriceStats,
  // Signals
  insertTradeSignal, getRecentSignals,
  // News
  upsertNews, getRecentNews,
  // Arbitrage
  insertArbitrageOpp, getArbitrageHistory,
  // On-chain
  insertOnchainMetrics, getOnchainHistory,
  // Order book
  insertOrderBookSnapshot,
  // Portfolio
  savePortfolioSnapshot, getPortfolioHistory,
  // Backtest
  saveBacktestResult, getBacktestHistory,
  // Settings
  getSetting, setSetting,
  // Maintenance
  purgeOldData, getDbStats
};

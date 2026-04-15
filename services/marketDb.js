'use strict';

/**
 * marketDb.js — Market / trading data database
 *
 * Stores everything related to crypto market data:
 *   price history, trade signals, news cache, arbitrage,
 *   on-chain metrics, order book snapshots, portfolio snapshots,
 *   backtest results
 *
 * File: data/market.db
 *
 * Completely independent of appDb.js — can be wiped, archived,
 * or replaced with a faster store (Redis/TimescaleDB) without
 * touching user accounts.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.MARKET_DB_PATH
  || path.join(__dirname, '..', 'data', 'market.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { verbose: null });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = OFF'); // no cross-DB foreign keys
    _db.pragma('cache_size = -32000'); // 32 MB — market data is read-heavy
    initTables();
  }
  return _db;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

function initTables() {
  _db.exec(`
    -- Price history for all tracked symbols
    CREATE TABLE IF NOT EXISTS price_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol          TEXT NOT NULL,
      price           REAL NOT NULL,
      volume_24h      REAL,
      market_cap      REAL,
      price_change_24h REAL,
      high_24h        REAL,
      low_24h         REAL,
      source          TEXT DEFAULT 'binance',
      timestamp       INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_ph_symbol_ts ON price_history(symbol, timestamp DESC);

    -- OHLCV kline cache (to reduce Binance API calls)
    CREATE TABLE IF NOT EXISTS kline_cache (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol    TEXT NOT NULL,
      interval  TEXT NOT NULL,
      open_time INTEGER NOT NULL,
      open      REAL, high REAL, low REAL, close REAL,
      volume    REAL,
      cached_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(symbol, interval, open_time)
    );
    CREATE INDEX IF NOT EXISTS idx_kline_sym_int_ts ON kline_cache(symbol, interval, open_time DESC);

    -- Order book snapshots (top levels)
    CREATE TABLE IF NOT EXISTS order_book_snapshots (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol         TEXT NOT NULL,
      best_bid       REAL,
      best_ask       REAL,
      bid_depth_1pct REAL,
      ask_depth_1pct REAL,
      spread_pct     REAL,
      timestamp      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_ob_symbol_ts ON order_book_snapshots(symbol, timestamp DESC);

    -- News cache
    CREATE TABLE IF NOT EXISTS news_cache (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL,
      url             TEXT UNIQUE,
      source          TEXT,
      summary         TEXT,
      sentiment_score REAL DEFAULT 0,
      published_at    INTEGER,
      fetched_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_news_fetched ON news_cache(fetched_at DESC);

    -- Trade signals from ML/analysis
    CREATE TABLE IF NOT EXISTS trade_signals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol           TEXT NOT NULL,
      signal           TEXT NOT NULL,
      confidence       REAL,
      price_at_signal  REAL,
      indicators_json  TEXT,
      source           TEXT DEFAULT 'ml',
      timestamp        INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_ts_symbol_ts ON trade_signals(symbol, timestamp DESC);

    -- Portfolio snapshots (keyed by user_id from appDb)
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      holdings_json  TEXT,
      total_value_usd REAL,
      pnl_24h        REAL,
      timestamp      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_port_user_ts ON portfolio_snapshots(user_id, timestamp DESC);

    -- Backtest results
    CREATE TABLE IF NOT EXISTS backtest_results (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      strategy     TEXT NOT NULL,
      symbol       TEXT,
      params_json  TEXT,
      metrics_json TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_bt_user_ts ON backtest_results(user_id, created_at DESC);

    -- Arbitrage opportunities log
    CREATE TABLE IF NOT EXISTS arbitrage_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol         TEXT NOT NULL,
      buy_exchange   TEXT,
      sell_exchange  TEXT,
      buy_price      REAL,
      sell_price     REAL,
      spread_pct     REAL,
      est_profit_pct REAL,
      timestamp      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_arb_symbol_ts ON arbitrage_log(symbol, timestamp DESC);

    -- Liquidation events
    CREATE TABLE IF NOT EXISTS liquidation_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol        TEXT NOT NULL,
      side          TEXT,
      quantity      REAL,
      price         REAL,
      open_interest REAL,
      timestamp     INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_liq_symbol_ts ON liquidation_events(symbol, timestamp DESC);

    -- On-chain metrics
    CREATE TABLE IF NOT EXISTS onchain_metrics (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol            TEXT NOT NULL DEFAULT 'BTC',
      mvrv_ratio        REAL,
      sopr              REAL,
      nvt_ratio         REAL,
      hash_rate         REAL,
      difficulty        REAL,
      active_addresses  INTEGER,
      net_exchange_flow REAL,
      timestamp         INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_onchain_sym_ts ON onchain_metrics(symbol, timestamp DESC);
  `);
}

// ─── Price history ────────────────────────────────────────────────────────────

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
     FROM price_history WHERE symbol = ? AND timestamp >= ? ORDER BY timestamp ASC`
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
    `SELECT MIN(price) as min_price, MAX(price) as max_price, AVG(price) as avg_price,
            COUNT(*) as data_points, MIN(timestamp) as from_ts, MAX(timestamp) as to_ts
     FROM price_history WHERE symbol = ? AND timestamp >= ?`
  ).get(symbol, since);
}

// ─── Kline cache ──────────────────────────────────────────────────────────────

function upsertKlines(symbol, interval, klines) {
  const stmt = getDb().prepare(
    `INSERT OR REPLACE INTO kline_cache (symbol, interval, open_time, open, high, low, close, volume)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insert = getDb().transaction((rows) => {
    for (const k of rows) {
      stmt.run(symbol, interval, k[0], k[1], k[2], k[3], k[4], k[5]);
    }
  });
  insert(klines);
}

function getKlines(symbol, interval, limit = 200) {
  return getDb().prepare(
    `SELECT open_time, open, high, low, close, volume
     FROM kline_cache WHERE symbol = ? AND interval = ?
     ORDER BY open_time DESC LIMIT ?`
  ).all(symbol, interval, limit).reverse();
}

// ─── Trade signals ────────────────────────────────────────────────────────────

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

// ─── News cache ───────────────────────────────────────────────────────────────

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

// ─── Arbitrage log ────────────────────────────────────────────────────────────

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

// ─── On-chain metrics ─────────────────────────────────────────────────────────

function insertOnchainMetrics(symbol, data) {
  getDb().prepare(
    `INSERT INTO onchain_metrics (symbol, mvrv_ratio, sopr, nvt_ratio, hash_rate, difficulty, active_addresses, net_exchange_flow)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    symbol,
    data.mvrvRatio ?? null, data.sopr ?? null, data.nvtRatio ?? null,
    data.hashRate  ?? null, data.difficulty ?? null,
    data.activeAddresses ?? null, data.netExchangeFlow ?? null
  );
}

function getOnchainHistory(symbol, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return getDb().prepare(
    `SELECT * FROM onchain_metrics WHERE symbol = ? AND timestamp >= ? ORDER BY timestamp ASC`
  ).all(symbol, since);
}

// ─── Order book snapshots ─────────────────────────────────────────────────────

function insertOrderBookSnapshot(symbol, bestBid, bestAsk, bidDepth, askDepth, spreadPct) {
  getDb().prepare(
    `INSERT INTO order_book_snapshots (symbol, best_bid, best_ask, bid_depth_1pct, ask_depth_1pct, spread_pct)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(symbol, bestBid, bestAsk, bidDepth, askDepth, spreadPct);
}

// ─── Portfolio snapshots ──────────────────────────────────────────────────────

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

// ─── Backtest results ─────────────────────────────────────────────────────────

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

// ─── Maintenance ──────────────────────────────────────────────────────────────

function purgeOldData(maxDays = 365) {
  const cutoff = Math.floor(Date.now() / 1000) - maxDays * 86400;
  const db = getDb();
  return {
    priceRows: db.prepare('DELETE FROM price_history WHERE timestamp < ?').run(cutoff).changes,
    klineRows: db.prepare('DELETE FROM kline_cache WHERE cached_at < ?').run(cutoff).changes,
    obRows:    db.prepare('DELETE FROM order_book_snapshots WHERE timestamp < ?').run(cutoff).changes,
    newsRows:  db.prepare('DELETE FROM news_cache WHERE fetched_at < ?').run(cutoff).changes,
    arbRows:   db.prepare('DELETE FROM arbitrage_log WHERE timestamp < ?').run(cutoff).changes,
  };
}

function getDbStats() {
  const db = getDb();
  const tables = [
    'price_history', 'kline_cache', 'order_book_snapshots',
    'news_cache', 'trade_signals', 'arbitrage_log',
    'liquidation_events', 'onchain_metrics',
    'portfolio_snapshots', 'backtest_results',
  ];
  const stats = {};
  for (const t of tables) {
    try { stats[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n; }
    catch (_) { stats[t] = 0; }
  }
  stats._file = DB_PATH;
  return stats;
}

// ─── Graceful close ───────────────────────────────────────────────────────────

process.on('exit', () => { if (_db) _db.close(); });

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getDb,
  // Price history
  insertPriceHistory, getPriceHistory, getLatestPrice, getPriceStats,
  // Kline cache
  upsertKlines, getKlines,
  // Trade signals
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
  // Maintenance
  purgeOldData, getDbStats,
};

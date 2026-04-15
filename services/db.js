'use strict';

/**
 * db.js — Backwards-compatible re-export shim
 *
 * The database has been split into two focused modules:
 *
 *   appDb.js    — Users, auth, plans, waitlist, admin audit  (data/app.db)
 *   marketDb.js — Prices, signals, news, on-chain, klines    (data/market.db)
 *
 * This file re-exports everything from both so that any existing
 * require('../services/db') continues to work without change.
 * New code should import directly from appDb or marketDb.
 */

const appDb    = require('./appDb');
const marketDb = require('./marketDb');

module.exports = {
  // ── appDb ──────────────────────────────────────────────────────────────────
  getDb: appDb.getDb,          // backward compat — returns app DB
  PLANS: appDb.PLANS,

  // Users
  createUser:       appDb.createUser,
  getUserByEmail:   appDb.getUserByEmail,
  getUserByUsername:appDb.getUserByUsername,
  getUserById:      appDb.getUserById,
  updateLastLogin:  appDb.updateLastLogin,
  getAllUsers:       appDb.getAllUsers,

  // Plan management
  getUserPlan:       appDb.getUserPlan,
  upgradePlan:       appDb.upgradePlan,
  suspendUser:       appDb.suspendUser,
  unsuspendUser:     appDb.unsuspendUser,
  getAdminUserList:  appDb.getAdminUserList,
  getRevenueStats:   appDb.getRevenueStats,

  // Waitlist
  addToWaitlist: appDb.addToWaitlist,
  getWaitlist:   appDb.getWaitlist,

  // Audit
  auditLog:    appDb.auditLog,
  getAuditLog: appDb.getAuditLog,

  // Settings
  getSetting: appDb.getSetting,
  setSetting: appDb.setSetting,

  // App DB stats
  getDbStats: () => ({
    app:    appDb.getDbStats(),
    market: marketDb.getDbStats(),
  }),

  // ── marketDb ───────────────────────────────────────────────────────────────
  // Prices
  insertPriceHistory: marketDb.insertPriceHistory,
  getPriceHistory:    marketDb.getPriceHistory,
  getLatestPrice:     marketDb.getLatestPrice,
  getPriceStats:      marketDb.getPriceStats,

  // Klines
  upsertKlines: marketDb.upsertKlines,
  getKlines:    marketDb.getKlines,

  // Signals
  insertTradeSignal: marketDb.insertTradeSignal,
  getRecentSignals:  marketDb.getRecentSignals,

  // News
  upsertNews:    marketDb.upsertNews,
  getRecentNews: marketDb.getRecentNews,

  // Arbitrage
  insertArbitrageOpp: marketDb.insertArbitrageOpp,
  getArbitrageHistory:marketDb.getArbitrageHistory,

  // On-chain
  insertOnchainMetrics: marketDb.insertOnchainMetrics,
  getOnchainHistory:    marketDb.getOnchainHistory,

  // Order book
  insertOrderBookSnapshot: marketDb.insertOrderBookSnapshot,

  // Portfolio
  savePortfolioSnapshot: marketDb.savePortfolioSnapshot,
  getPortfolioHistory:   marketDb.getPortfolioHistory,

  // Backtest
  saveBacktestResult:  marketDb.saveBacktestResult,
  getBacktestHistory:  marketDb.getBacktestHistory,

  // Maintenance
  purgeOldData: marketDb.purgeOldData,
};

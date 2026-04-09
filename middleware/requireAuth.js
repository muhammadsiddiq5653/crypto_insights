'use strict';

const db = require('../services/db');

/**
 * Middleware: require authenticated session
 * Returns 401 JSON if not logged in
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }
  // Attach user to request (lightweight — no DB hit for every request)
  req.userId = req.session.userId;
  req.userRole = req.session.userRole;
  req.username = req.session.username;
  next();
}

/**
 * Middleware: require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }
  req.userId = req.session.userId;
  req.userRole = req.session.userRole;
  req.username = req.session.username;
  next();
}

/**
 * Middleware: optionally load user if logged in (no redirect)
 */
function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    req.userRole = req.session.userRole;
    req.username = req.session.username;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };

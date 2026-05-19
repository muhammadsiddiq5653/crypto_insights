'use strict';

/**
 * csrf.js — Lightweight double-submit CSRF protection
 *
 * Strategy:
 *   1. On every authenticated request, ensure req.session.csrfToken exists.
 *   2. GET /api/auth/csrf returns it so the SPA can store it in memory.
 *   3. All state-changing requests (POST/PUT/DELETE/PATCH) must include it as
 *      the X-CSRF-Token header.  Auth endpoints (login/register/reset) are
 *      exempt because the session doesn't exist yet at that point.
 *
 * This stops cross-site form attacks even if SameSite=lax is insufficient.
 */

const crypto = require('crypto');

// Routes that are exempt from the CSRF check (no active session exists yet)
const EXEMPT = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/waitlist',
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Middleware — attaches csrfToken to session and validates it on mutations.
 */
function csrfMiddleware(req, res, next) {
  // Safe HTTP verbs never mutate state — skip
  if (SAFE_METHODS.has(req.method)) return next();

  // Explicitly exempted endpoints — no session yet
  if (EXEMPT.has(req.path)) return next();

  // Ensure a token exists for this session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  const incoming = req.headers['x-csrf-token'] || req.body?._csrf;
  if (!incoming || incoming !== req.session.csrfToken) {
    return res.status(403).json({ success: false, error: 'Invalid CSRF token' });
  }

  next();
}

/**
 * Ensure a CSRF token is generated for the session (call after requireAuth).
 */
function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

module.exports = { csrfMiddleware, ensureCsrfToken };

'use strict';

const db = require('../services/db');

// ── Plan hierarchy ────────────────────────────────────────────────────
// admin > team > pro > free
const PLAN_RANK = { free: 0, pro: 1, team: 2, admin: 99 };

function planRank(plan, role) {
  if (role === 'admin') return 99;
  return PLAN_RANK[plan] ?? 0;
}

// ── requireAuth ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }
  req.userId   = req.session.userId;
  req.userRole = req.session.userRole;
  req.username = req.session.username;
  req.userPlan = req.session.userPlan || 'free';
  next();
}

// ── requireAdmin ──────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }
  req.userId   = req.session.userId;
  req.userRole = req.session.userRole;
  req.username = req.session.username;
  req.userPlan = 'pro'; // admins always have full access
  next();
}

// ── requirePlan(minPlan) ──────────────────────────────────────────────
/**
 * Factory: returns middleware that requires user to have at least `minPlan`.
 * Admins always pass. Suspended users always fail.
 *
 * Usage:
 *   app.get('/api/signals/mtf', requireAuth, requirePlan('pro'), handler)
 */
function requirePlan(minPlan) {
  return function planGate(req, res, next) {
    // Must be authenticated first (requireAuth should precede this)
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    }

    // Admins bypass plan checks
    if (req.userRole === 'admin') return next();

    // Live DB check (catches plan changes/suspensions without re-login)
    const actualPlan = db.getUserPlan(req.userId);

    if (actualPlan === 'suspended') {
      return res.status(403).json({
        error: 'Your account has been suspended. Contact support.',
        code: 'SUSPENDED',
      });
    }

    // Sync plan to session so it stays fresh
    req.session.userPlan = actualPlan;
    req.userPlan = actualPlan;

    if (planRank(actualPlan, req.userRole) < planRank(minPlan, 'user')) {
      return res.status(402).json({
        error: `This feature requires the ${minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} plan.`,
        code: 'UPGRADE_REQUIRED',
        requiredPlan: minPlan,
        currentPlan: actualPlan,
        upgradeUrl: '/landing#pricing',
      });
    }

    next();
  };
}

// ── optionalAuth ──────────────────────────────────────────────────────
function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.userId   = req.session.userId;
    req.userRole = req.session.userRole;
    req.username = req.session.username;
    req.userPlan = req.session.userPlan || 'free';
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requirePlan, optionalAuth };

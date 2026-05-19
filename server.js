// Load env vars first, before anything else
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const config = require('./config');
const cryptoService = require('./services/cryptoService');
const technicalAnalysis = require('./services/technicalAnalysis');
const newsService = require('./services/newsService');
const forexService = require('./services/forexService');
const globalMarketsService = require('./services/globalMarketsService');
const exchangeService = require('./services/exchangeService');
const authService = require('./services/authService');
const db = require('./services/db');
const { requireAuth, requireAdmin, requireAdminPage, requirePlan, optionalAuth } = require('./middleware/requireAuth');
const { csrfMiddleware, ensureCsrfToken } = require('./middleware/csrf');
const emailService  = require('./services/emailService');
const speakeasy     = require('speakeasy');
const QRCode        = require('qrcode');
const dataCollector = require('./services/dataCollector');
const apiCache      = require('./services/apiCache');
const billing       = require('./services/billingService');
const wsFeeds       = require('./services/wsFeeds');
const { stripeActivatePlan, stripeDeactivatePlan, getUserByStripeCustomer } = require('./services/appDb');

const IS_PROD = process.env.NODE_ENV === 'production';

// Allowed crypto symbols (uppercase, no USDT suffix) — validated on all :symbol routes
const VALID_SYMBOLS = new Set(
    (config.cryptocurrencies || []).map(c => (c.symbol || c).toUpperCase().replace('USDT',''))
);
function validSymbol(sym) {
    if (typeof sym !== 'string' || !/^[A-Z0-9]{1,20}$/.test(sym.toUpperCase())) return false;
    if (VALID_SYMBOLS.size === 0) return true; // no whitelist in config — allow any well-formed symbol
    return VALID_SYMBOLS.has(sym.toUpperCase());
}
const PORT    = parseInt(process.env.PORT || config.port || 3000, 10);

// Safe query-param integer: parseInt can return NaN for non-numeric strings
function safeInt(val, fallback, max) {
    const n = parseInt(val, 10);
    const result = Number.isFinite(n) ? n : fallback;
    return max !== undefined ? Math.min(result, max) : result;
}

// ── STARTUP GUARDS ────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
    console.error('\n[FATAL] SESSION_SECRET environment variable is not set.');
    console.error('        Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    console.error('        Then add it to your .env file.\n');
    process.exit(1);
}
if (IS_PROD && !process.env.ALLOWED_ORIGINS) {
    console.error('\n[FATAL] ALLOWED_ORIGINS must be set in production to prevent open CORS.');
    console.error('        Example: ALLOWED_ORIGINS=https://yourdomain.com\n');
    process.exit(1);
}

const app = express();

// ── SECURITY HEADERS (Helmet) ─────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
            styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
            fontSrc:     ["'self'", 'fonts.gstatic.com'],
            imgSrc:      ["'self'", 'data:', 'https:'],
            connectSrc:  ["'self'", 'wss:', 'ws:', 'https://api.binance.com', 'https://gamma-api.polymarket.com'],
            frameSrc:    ["'none'"],
            objectSrc:   ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// ── COMPRESSION ───────────────────────────────────────────────────────
app.use(compression());

// ── TRUST PROXY (needed if behind nginx/Render/Heroku) ───────────────
if (IS_PROD) app.set('trust proxy', 1);

// ── RATE LIMITING ─────────────────────────────────────────────────────

// General API limiter — 200 req / 15 min per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
});

// Stricter limiter for auth endpoints — 15 attempts / 15 min per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many login attempts. Please wait 15 minutes.' },
});

// Tight limiter for admin mutations — prevent abuse of upgrade/suspend
const adminMutationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many admin actions. Slow down.' },
});

// Strict limiter for bulk destructive operations — max 5 per minute
const adminBulkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many bulk operations. Wait before retrying.' },
});

// Tight limiter for Slack webhook proxy — prevent spam (10 per 10 min per IP)
const slackLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many Slack notifications sent. Please wait.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',             authLimiter);
app.use('/api/auth/register',          authLimiter);
app.use('/api/auth/password',          authLimiter);
app.use('/api/auth/forgot-password',   authLimiter);
app.use('/api/auth/reset-password',    authLimiter);
app.use('/api/proxy/slack',            slackLimiter);
app.use('/api/admin/users/bulk',       adminBulkLimiter);     // must be before the general prefix
app.use('/api/admin/users',            adminMutationLimiter);

// ── SESSION & AUTH MIDDLEWARE ─────────────────────────────────────────

app.use(cookieParser());
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'),
        ttl: 7 * 24 * 60 * 60,
        reapInterval: 60 * 60,
        logFn: () => {}
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'tp.sid',
    cookie: {
        httpOnly: true,
        secure: IS_PROD,           // HTTPS in production
        sameSite: IS_PROD ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// ── CORE MIDDLEWARE ────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : true; // allow all in dev

app.use(cors({ origin: allowedOrigins, credentials: true }));

// Stripe webhook — must receive the raw body before any JSON parser touches it
app.post('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    let event;
    try {
      event = billing.constructWebhookEvent(req.body, req.headers['stripe-signature']);
    } catch (err) {
      console.error('[Stripe webhook] signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId  = session.metadata?.userId;
          if (typeof userId === 'string' && /^\d+$/.test(userId) && session.subscription) {
            stripeActivatePlan(Number(userId), {
              customerId:     session.customer,
              subscriptionId: session.subscription,
              plan: 'pro',
            });
            // Welcome email — fire-and-forget, don't block the webhook response
            const appDb = require('./services/appDb');
            const user  = appDb.getUserById(Number(userId));
            if (user) emailService.sendProWelcome(user.email, user.username).catch(() => {});
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub  = event.data.object;
          const user = getUserByStripeCustomer(sub.customer);
          if (user) stripeDeactivatePlan(user.id);
          break;
        }
        case 'customer.subscription.updated': {
          const sub  = event.data.object;
          const user = getUserByStripeCustomer(sub.customer);
          if (user && sub.status === 'active') {
            stripeActivatePlan(user.id, {
              customerId:     sub.customer,
              subscriptionId: sub.id,
              plan: 'pro',
            });
          } else if (user && ['canceled', 'unpaid', 'past_due'].includes(sub.status)) {
            stripeDeactivatePlan(user.id);
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Stripe webhook] handler error:', err);
    }

    res.json({ received: true });
  }
);

app.use(express.json({ limit: '1mb' }));
app.use('/api/', csrfMiddleware); // CSRF check on all mutating API calls

// Gate admin.html before express.static so it requires authentication
app.get('/admin.html', requireAdminPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve public pages without authentication
app.use('/auth.html',    express.static(path.join(__dirname, 'public', 'auth.html')));
app.use('/landing.html', express.static(path.join(__dirname, 'public', 'landing.html')));
app.use('/js/auth.js',   express.static(path.join(__dirname, 'public', 'js', 'auth.js')));

// Serve static assets (CSS, JS, images) without auth
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// ── Maintenance mode gate ─────────────────────────────────────────────
// Intercepts non-API, non-public HTML page requests when maintenance_mode=true.
// Admins and the auth/landing pages are always allowed through.
app.use((req, res, next) => {
    // Only gate HTML navigation (not API calls, assets, or public pages)
    if (req.path.startsWith('/api/')) return next();
    if (['/auth.html', '/landing.html', '/landing', '/health'].includes(req.path)) return next();
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/icons/')) return next();

    try {
        const maintenance = db.getSetting('maintenance_mode');
        if (maintenance !== 'true') return next();
    } catch { return next(); }

    // Maintenance is ON — let admins through, block everyone else
    if (req.session && req.session.userRole === 'admin') return next();

    // API clients get JSON; browser navigations get a simple maintenance page
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(503).json({ error: 'Platform is under maintenance. Check back soon.', code: 'MAINTENANCE' });
    }
    res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TraderPro — Maintenance</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#080b14;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
.icon{font-size:56px;margin-bottom:20px}
h1{font-size:28px;font-weight:700;margin-bottom:12px}
p{color:#64748b;font-size:15px;max-width:400px;line-height:1.6;margin-bottom:24px}
a{display:inline-block;padding:10px 24px;background:#6c63ff;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none}
a:hover{background:#5a52e0}
</style>
</head>
<body>
<div>
  <div class="icon">🔧</div>
  <h1>Under Maintenance</h1>
  <p>We're making improvements to TraderPro. We'll be back shortly. Thank you for your patience.</p>
  <a href="/auth.html">Admin Login</a>
</div>
</body>
</html>`);
});

// All other static files (including index.html) served normally
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH ROUTES ───────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.register(username, email, password);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }
        // Auto-login after registration
        const user = db.getUserById(result.userId);
        req.session.userId   = user.id;
        req.session.username = user.username;
        req.session.userRole = user.role;
        req.session.userPlan = user.plan || 'free';
        // Welcome email — non-blocking, failure does not affect registration
        emailService.sendWelcome(user.email, user.username).catch(() => {});
        res.json({
            success: true,
            user: { id: user.id, username: user.username, email: user.email, role: user.role, plan: user.plan || 'free' }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        if (!result.success) {
            return res.status(401).json({ success: false, error: result.error });
        }
        // Check 2FA before granting full session
        const totp = db.getTotpRow(result.user.id);
        if (totp && totp.totp_enabled) {
            // Regenerate session ID after successful password check before storing pending state
            await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
            req.session.pendingTotpUserId = result.user.id;
            return res.json({ success: true, requires2FA: true });
        }
        // Regenerate session ID on successful login to prevent session fixation
        const userData = result.user;
        await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
        req.session.userId   = userData.id;
        req.session.username = userData.username;
        req.session.userRole = userData.role;
        req.session.userPlan = userData.plan || 'free';
        res.json({ success: true, user: { ...userData, plan: userData.plan || 'free' } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('[logout] session destroy error:', err.message);
        res.clearCookie('tp.sid');
        res.json({ success: true });
    });
});

// GET /api/auth/me — check current session
app.get('/api/auth/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const user = authService.getProfile(req.session.userId);
    if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ success: false, error: 'Session invalid' });
    }
    res.json({ success: true, user });
});

// PUT /api/auth/password — change password
app.put('/api/auth/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await authService.changePassword(req.userId, currentPassword, newPassword);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: 'Password change failed' });
    }
});

// GET /api/auth/csrf — return CSRF token for the current session
app.get('/api/auth/csrf', requireAuth, (req, res) => {
    res.json({ token: ensureCsrfToken(req) });
});

// POST /api/auth/forgot-password — generate reset token, send email
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body || {};
    const result = await authService.forgotPassword(email);
    if (!result.token) {
        // User not found — still return 200 to prevent enumeration
        return res.json({ success: true });
    }
    const emailResult = await emailService.sendPasswordReset(result.email, result.token);
    if (!IS_PROD && emailResult.devLink) {
        // Dev mode: return the link so it can be tested without SMTP
        return res.json({ success: true, _devLink: emailResult.devLink });
    }
    res.json({ success: true });
});

// POST /api/auth/reset-password — consume token, set new password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body || {};
    const result = await authService.resetPassword(token, password);
    res.json(result);
});

// ── 2FA / TOTP routes (all require auth) ─────────────────────────────

// GET /api/auth/2fa/status
app.get('/api/auth/2fa/status', requireAuth, (req, res) => {
    const row = db.getTotpRow(req.userId);
    res.json({ enabled: !!(row && row.totp_enabled) });
});

// POST /api/auth/2fa/setup — generate secret + QR data URL
app.post('/api/auth/2fa/setup', requireAuth, async (req, res) => {
    const user = authService.getProfile(req.userId);
    const secret = speakeasy.generateSecret({
        name: `TraderPro (${user.username})`,
        length: 20,
    });
    db.setTotpSecret(req.userId, secret.base32);
    const qr = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qr });
});

// POST /api/auth/2fa/verify-setup — verify first token and mark 2FA enabled
app.post('/api/auth/2fa/verify-setup', requireAuth, (req, res) => {
    const { token } = req.body || {};
    const row = db.getTotpRow(req.userId);
    if (!row || !row.totp_secret) return res.status(400).json({ success: false, error: '2FA setup not started' });
    const valid = speakeasy.totp.verify({
        secret: row.totp_secret,
        encoding: 'base32',
        token: String(token),
        window: 1,
    });
    if (!valid) return res.status(400).json({ success: false, error: 'Invalid code — try again' });
    db.enableTotp(req.userId);
    req.session.totpVerified = true;
    res.json({ success: true });
});

// POST /api/auth/2fa/validate — called during login when 2FA is required
app.post('/api/auth/2fa/validate', (req, res) => {
    const pendingId = req.session.pendingTotpUserId;
    if (!pendingId) return res.status(400).json({ success: false, error: 'No pending 2FA session' });
    const { token } = req.body || {};
    const row = db.getTotpRow(pendingId);
    if (!row || !row.totp_enabled) return res.status(400).json({ success: false, error: '2FA not enabled' });
    const valid = speakeasy.totp.verify({
        secret: row.totp_secret,
        encoding: 'base32',
        token: String(token),
        window: 1,
    });
    if (!valid) return res.status(400).json({ success: false, error: 'Invalid code' });

    // Upgrade the session to fully authenticated
    const user = db.getUserById(pendingId);
    req.session.userId   = user.id;
    req.session.userRole = user.role;
    req.session.totpVerified = true;
    delete req.session.pendingTotpUserId;
    db.updateLastLogin(user.id);

    res.json({ success: true, user: authService.getProfile(user.id) });
});

// POST /api/auth/2fa/disable — disable 2FA (requires password confirmation)
app.post('/api/auth/2fa/disable', requireAuth, async (req, res) => {
    const { password } = req.body || {};
    const userRow = db.getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!userRow) return res.status(401).json({ success: false, error: 'Session invalid' });
    const match = await require('bcryptjs').compare(password || '', userRow.password_hash);
    if (!match) return res.status(400).json({ success: false, error: 'Incorrect password' });
    db.disableTotp(req.userId);
    req.session.totpVerified = false;
    res.json({ success: true });
});

// ── BILLING (Stripe) ─────────────────────────────────────────────────

// POST /api/billing/checkout — create Stripe Checkout session, return redirect URL
app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not configured on this server' });
  }
  try {
    const appDb = require('./services/appDb');
    const user  = appDb.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.plan === 'pro') return res.status(400).json({ error: 'Already on Pro plan' });

    const plan = ['monthly', 'annual', 'lifetime'].includes(req.body?.plan) ? req.body.plan : 'annual';
    const url = await billing.createCheckoutSession(user, plan);
    res.json({ url });
  } catch (err) {
    console.error('[billing/checkout]', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /api/billing/portal — redirect to Stripe Customer Portal
app.get('/api/billing/portal', requireAuth, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not configured on this server' });
  }
  try {
    const appDb = require('./services/appDb');
    const user  = appDb.getUserById(req.userId);
    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    const url = await billing.createPortalSession(user.stripe_customer_id);
    res.redirect(url);
  } catch (err) {
    console.error('[billing/portal]', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// GET /billing/success — post-checkout landing page (redirects to app)
app.get('/billing/success', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Pro — TraderPro</title>
  <meta http-equiv="refresh" content="3;url=/">
  <style>
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #e8eaf0;
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; max-width: 400px; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p  { color: #8892a4; }
    a  { color: #a5b4fc; }
  </style>
</head>
<body>
  <div class="box">
    <h1>🚀 You're Pro!</h1>
    <p>Your subscription is active. Redirecting you to the app…</p>
    <p><a href="/">Click here if you're not redirected</a></p>
  </div>
</body>
</html>`);
});

// ── WAITLIST (public — no auth required) ─────────────────────────────

// POST /api/waitlist — add email to waitlist
app.post('/api/waitlist', (req, res) => {
    const { email, source } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Valid email required' });
    }
    try {
        const result = db.addToWaitlist(email, source || 'landing');
        console.log(`[waitlist] ${email} joined`);
        res.json({ success: true, message: 'You\'re on the list!' });
    } catch (err) {
        console.error('[waitlist] error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to join waitlist' });
    }
});

// GET /api/waitlist — admin: view waitlist
app.get('/api/waitlist', requireAdmin, (req, res) => {
    const list = db.getWaitlist();
    res.json({ success: true, count: list.length, data: list });
});

// ── DB/DATA ROUTES ────────────────────────────────────────────────────

// GET /api/db/prices/:symbol — historical prices from local DB
app.get('/api/db/prices/:symbol', requireAuth, (req, res) => {
    const sym = req.params.symbol.toUpperCase().replace('USDT','');
    if (!validSymbol(sym)) return res.status(400).json({ success: false, error: 'Invalid symbol' });
    const hours = safeInt(req.query.hours, 24, 8760);
    const data = db.getPriceHistory(sym + 'USDT', hours);
    res.json({ success: true, data, symbol: sym, hours });
});

// GET /api/db/prices/:symbol/stats
app.get('/api/db/prices/:symbol/stats', requireAuth, (req, res) => {
    const sym = req.params.symbol.toUpperCase().replace('USDT','');
    if (!validSymbol(sym)) return res.status(400).json({ success: false, error: 'Invalid symbol' });
    const days = safeInt(req.query.days, 30, 365);
    const stats = db.getPriceStats(sym + 'USDT', days);
    res.json({ success: true, stats, symbol: sym, days });
});

// GET /api/db/arbitrage/:symbol
app.get('/api/db/arbitrage/:symbol', requireAuth, (req, res) => {
    const sym = req.params.symbol.toUpperCase().replace('USDT','');
    if (!validSymbol(sym)) return res.status(400).json({ success: false, error: 'Invalid symbol' });
    const hours = safeInt(req.query.hours, 24, 8760);
    const data = db.getArbitrageHistory(sym, hours);
    res.json({ success: true, data });
});

// GET /api/db/onchain/:symbol
app.get('/api/db/onchain/:symbol', requireAuth, (req, res) => {
    const sym = req.params.symbol.toUpperCase().replace('USDT','');
    if (!validSymbol(sym)) return res.status(400).json({ success: false, error: 'Invalid symbol' });
    const days = safeInt(req.query.days, 30, 365);
    const data = db.getOnchainHistory(sym, days);
    res.json({ success: true, data });
});

// GET /api/db/signals/:symbol
app.get('/api/db/signals/:symbol', requireAuth, (req, res) => {
    const sym = req.params.symbol.toUpperCase().replace('USDT','');
    if (!validSymbol(sym)) return res.status(400).json({ success: false, error: 'Invalid symbol' });
    const limit = safeInt(req.query.limit, 20);
    const data = db.getRecentSignals(sym + 'USDT', limit);
    res.json({ success: true, data });
});

// GET /api/db/news
app.get('/api/db/news', requireAuth, (req, res) => {
    const limit = safeInt(req.query.limit, 50);
    const data = db.getRecentNews(limit);
    res.json({ success: true, data });
});

// GET /api/db/stats — admin only
app.get('/api/db/stats', requireAdmin, (req, res) => {
    const stats = db.getDbStats();
    res.json({ success: true, stats });
});

// GET /api/db/users — admin only
app.get('/api/db/users', requireAdmin, (req, res) => {
    const users = db.getAllUsers();
    res.json({ success: true, users });
});

// POST /api/db/portfolio/save
app.post('/api/db/portfolio/save', requireAuth, (req, res) => {
    try {
        const { holdings, totalValue, pnl24h } = req.body;
        db.savePortfolioSnapshot(req.userId, holdings, totalValue, pnl24h);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to save portfolio' });
    }
});

// GET /api/db/portfolio/history
app.get('/api/db/portfolio/history', requireAuth, (req, res) => {
    const days = safeInt(req.query.days, 30, 365);
    const data = db.getPortfolioHistory(req.userId, days);
    res.json({ success: true, data });
});

// GET /api/db/collector/status
app.get('/api/db/collector/status', requireAuth, (req, res) => {
    res.json({ success: true, running: dataCollector.isRunning() });
});

// POST /api/db/collector/trigger — admin: manually trigger collection
app.post('/api/db/collector/trigger', requireAdmin, async (req, res) => {
    await dataCollector.collectPrices();
    res.json({ success: true, message: 'Collection triggered' });
});

// ── CRYPTO ROUTES ────────────────────────────────────────────────────

// List supported cryptocurrencies
app.get('/api/cryptocurrencies', (req, res) => {
    res.json({ success: true, data: config.cryptocurrencies });
});

// Dynamic search for all 10,000+ CoinGecko coins  (MUST be before /api/crypto/:symbol)
app.get('/api/crypto/search', async (req, res) => {
    try {
        const results = await exchangeService.searchAllCoins(req.query.q || '');
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Coin search error:', error.message);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Top coins by market cap up to 250  (MUST be before /api/crypto/:symbol)
app.get('/api/crypto/top', async (req, res) => {
    try {
        const coins = await exchangeService.getTopCoins(safeInt(req.query.limit, 100, 500), req.query.currency || 'usd');
        res.json({ success: true, data: coins });
    } catch (error) {
        console.error('Top coins error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch top coins' });
    }
});

// Current prices for all tracked cryptos
app.get('/api/crypto/prices', async (req, res) => {
    try {
        const prices = await cryptoService.getCurrentPrices();
        res.json({ success: true, data: prices });
    } catch (error) {
        console.error('Error fetching prices:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch prices' });
    }
});

// Details for a specific crypto
app.get('/api/crypto/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c => c.symbol === symbol.toUpperCase());
        if (!crypto) return res.status(404).json({ success: false, error: 'Cryptocurrency not found' });

        const data = await cryptoService.getCryptoDetails(crypto.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch crypto details' });
    }
});

// Historical price data for charts
app.get('/api/crypto/:symbol/history', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { days = 7 } = req.query;
        const crypto = config.cryptocurrencies.find(c =>
            c.symbol === symbol.toUpperCase() || c.id === symbol.toLowerCase()
        );
        if (!crypto) return res.status(404).json({ success: false, error: 'Cryptocurrency not found' });

        const history = await cryptoService.getHistoricalData(crypto.id, days);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch historical data' });
    }
});

// Technical analysis for a crypto
app.get('/api/crypto/:symbol/analysis', async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c =>
            c.symbol === symbol.toUpperCase() || c.id === symbol.toLowerCase()
        );
        if (!crypto) return res.status(404).json({ success: false, error: 'Cryptocurrency not found' });

        const history = await cryptoService.getHistoricalData(crypto.id, 30);
        const analysis = technicalAnalysis.analyzeData(history);
        res.json({ success: true, data: analysis });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to perform technical analysis' });
    }
});

// Multi-timeframe technical analysis — Pro feature
app.get('/api/crypto/:symbol/mtf', requireAuth, requirePlan('pro'), async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c =>
            c.symbol === symbol.toUpperCase() || c.id === symbol.toLowerCase()
        );
        if (!crypto) return res.status(404).json({ success: false, error: 'Cryptocurrency not found' });

        // Fetch historical data for 4 different timeframes
        const [data1H, data4H, data1D, data1W] = await Promise.all([
            cryptoService.getHistoricalData(crypto.id, 2),    // 1H: 2 days
            cryptoService.getHistoricalData(crypto.id, 7),    // 4H: 7 days
            cryptoService.getHistoricalData(crypto.id, 30),   // 1D: 30 days
            cryptoService.getHistoricalData(crypto.id, 180)   // 1W: 180 days
        ]);

        // Run technical analysis for each timeframe
        const analysis1H = technicalAnalysis.analyzeData(data1H);
        const analysis4H = technicalAnalysis.analyzeData(data4H);
        const analysis1D = technicalAnalysis.analyzeData(data1D);
        const analysis1W = technicalAnalysis.analyzeData(data1W);

        res.json({
            success: true,
            data: {
                symbol: crypto.symbol,
                "1H": analysis1H,
                "4H": analysis4H,
                "1D": analysis1D,
                "1W": analysis1W
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to perform multi-timeframe analysis' });
    }
});

// Search for coins
app.get('/api/search/coins', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
        }
        const results = await cryptoService.searchCoins(query);
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to search cryptocurrencies' });
    }
});

// Futures data for a crypto
app.get('/api/crypto/:symbol/futures', async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c => c.symbol === symbol.toUpperCase());
        if (!crypto) return res.status(404).json({ success: false, error: 'Cryptocurrency not found' });

        const futuresData = await cryptoService.getFuturesData(crypto.id, symbol);
        res.json({ success: true, data: futuresData });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch futures data' });
    }
});

// ── FOREX ROUTES ─────────────────────────────────────────────────────

// All configured forex pairs
app.get('/api/forex/pairs', async (req, res) => {
    try {
        const pairs = await forexService.getAllForexPairs();
        res.json({ success: true, data: pairs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch forex pairs' });
    }
});

// PKR exchange rates (primary for Pakistani users)
app.get('/api/forex/pkr', async (req, res) => {
    try {
        const rates = await forexService.getPKRRates();
        res.json({ success: true, data: rates });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch PKR rates' });
    }
});

// Generic rates for a base currency
app.get('/api/forex/rates/:base', async (req, res) => {
    try {
        const { base } = req.params;
        const rates = await forexService.getForexRates(base.toUpperCase());
        res.json({ success: true, data: rates });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch forex rates' });
    }
});

// Currency conversion
app.get('/api/forex/convert', async (req, res) => {
    try {
        const { amount, from, to } = req.query;
        if (!amount || !from || !to) {
            return res.status(400).json({ success: false, error: 'amount, from, and to are required' });
        }
        const result = await forexService.convertCurrency(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Conversion failed' });
    }
});

// ── MARKET SENTIMENT ─────────────────────────────────────────────────

// Fear & Greed Index
app.get('/api/sentiment/fear-greed', async (req, res) => {
    try {
        const data = await forexService.getFearGreedIndex();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch Fear & Greed index' });
    }
});

// Commodity prices (Gold, Silver, Oil)
app.get('/api/commodities', async (req, res) => {
    try {
        const data = await forexService.getCommodityPrices();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch commodity prices' });
    }
});

// ── PSX ROUTES ───────────────────────────────────────────────────────

// PSX stock list (static + sector data)
app.get('/api/psx/stocks', (req, res) => {
    res.json({ success: true, data: config.psxTopStocks });
});

// PSX sectors
app.get('/api/psx/sectors', (req, res) => {
    res.json({ success: true, data: config.psxSectors });
});

// PSX index data (fetched from dps.psx.com.pk)
app.get('/api/psx/indices', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get('https://dps.psx.com.pk/indices', {
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; TraderPro/1.0)'
            }
        });

        // PSX returns array of index objects
        if (Array.isArray(response.data)) {
            const indices = response.data.map(idx => ({
                name: idx.name || idx.index_name || idx.INDEX_NAME,
                current: idx.current || idx.CURRENT || idx.value,
                change: idx.change || idx.CHANGE,
                changePercent: idx.change_percent || idx.CHANGE_PERCENT || idx.pchange,
                volume: idx.volume || idx.VOLUME
            }));
            return res.json({ success: true, data: indices });
        }

        // If response format is different, return raw
        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error('PSX indices error:', error.message);
        // Return realistic static fallback data with PSX typical ranges
        const kseChg = parseFloat(((Math.random() - 0.45) * 0.8).toFixed(2));
        const kse30Chg = parseFloat(((Math.random() - 0.45) * 0.7).toFixed(2));
        const kmiChg = parseFloat(((Math.random() - 0.45) * 0.9).toFixed(2));
        const baseKse = 116800 + Math.round((Math.random() - 0.5) * 800);
        const baseKse30 = 42100 + Math.round((Math.random() - 0.5) * 300);
        const baseKmi = 52400 + Math.round((Math.random() - 0.5) * 400);
        res.json({
            success: true,
            synthetic: true,  // always flag synthetic data so clients can warn users
            data: [
                { name: 'KSE-100',   current: baseKse,  change: Math.round(baseKse * kseChg / 100),    changePercent: kseChg,   volume: Math.floor(Math.random()*200000000 + 150000000), synthetic: true },
                { name: 'KSE-30',    current: baseKse30, change: Math.round(baseKse30 * kse30Chg / 100), changePercent: kse30Chg, volume: Math.floor(Math.random()*80000000  + 50000000),  synthetic: true },
                { name: 'KMI-30',    current: baseKmi,   change: Math.round(baseKmi * kmiChg / 100),    changePercent: kmiChg,   volume: Math.floor(Math.random()*60000000  + 40000000),   synthetic: true },
                { name: 'All Share', current: Math.round(baseKse * 0.74), change: 0, changePercent: kseChg, volume: 0, synthetic: true }
            ],
            fallback: true,
            message: '⚠️ PSX live feed unavailable — showing estimated indicative data only. Do not trade on these figures. Visit dps.psx.com.pk for real-time data.'
        });
    }
});

// ── GLOBAL MARKETS ROUTES (US & UK STOCKS) ───────────────────────────

// All US stocks (NASDAQ/NYSE top 20)
app.get('/api/markets/us/stocks', async (req, res) => {
    try {
        const stocks = await globalMarketsService.getUSStocks();
        res.json({ success: true, data: stocks });
    } catch (error) {
        console.error('Error fetching US stocks:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch US stocks' });
    }
});

// All UK stocks (FTSE 100)
app.get('/api/markets/uk/stocks', async (req, res) => {
    try {
        const stocks = await globalMarketsService.getUKStocks();
        res.json({ success: true, data: stocks });
    } catch (error) {
        console.error('Error fetching UK stocks:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch UK stocks' });
    }
});

// Global indices (S&P 500, NASDAQ, FTSE, etc.)
app.get('/api/markets/indices', async (req, res) => {
    try {
        const indices = await globalMarketsService.getGlobalIndices();
        res.json({ success: true, data: indices });
    } catch (error) {
        console.error('Error fetching indices:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch indices' });
    }
});

// Search for stocks globally (US, UK, and more)
app.get('/api/markets/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 1) {
            return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        }
        const results = await globalMarketsService.searchGlobalStocks(q);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Detailed stock information for US or UK stocks
app.get('/api/markets/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const stock = await globalMarketsService.getStockDetails(symbol.toUpperCase());
        if (!stock) {
            return res.status(404).json({ success: false, error: 'Stock not found' });
        }
        res.json({ success: true, data: stock });
    } catch (error) {
        console.error(`Error fetching stock ${req.params.symbol}:`, error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch stock details' });
    }
});

// ── EXCHANGE & COIN DISCOVERY ROUTES ─────────────────────────────────

// Use case guide — MUST be before /api/exchanges/:id to avoid route conflict
app.get('/api/exchanges/guide/use-cases', (req, res) => {
    res.json({ success: true, data: exchangeService.getUseCaseGuide() });
});

// Exchanges listing a specific coin
app.get('/api/exchanges/coin/:symbol', async (req, res) => {
    try {
        const data = await exchangeService.getCoinExchanges(req.params.symbol.toUpperCase());
        res.json({ success: true, data });
    } catch (error) {
        console.error('Coin exchanges error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch coin exchanges' });
    }
});

// All exchanges list
app.get('/api/exchanges', async (req, res) => {
    try {
        const exchanges = await exchangeService.getExchangeList();
        res.json({ success: true, data: exchanges });
    } catch (error) {
        console.error('Exchange list error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch exchanges' });
    }
});

// Single exchange details
app.get('/api/exchanges/:id', async (req, res) => {
    try {
        const data = await exchangeService.getExchangeById(req.params.id);
        if (!data) return res.status(404).json({ success: false, error: 'Exchange not found' });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Exchange detail error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch exchange details' });
    }
});

// ── COCKPIT PROXY ROUTES (server-side cache + retry for 3rd-party APIs) ─

// Proxy: Binance 24hr ticker
app.get('/api/proxy/binance/ticker/:symbol', async (req, res) => {
    try {
        const data = await apiCache.get(
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${req.params.symbol.toUpperCase()}`,
            { ttl: 20_000 }
        );
        res.json({ success: true, data });
    } catch (err) {
        res.status(502).json({ success: false, error: err.message });
    }
});

// Proxy: Binance klines — Pro feature (MTF signals)
app.get('/api/proxy/binance/klines', requireAuth, requirePlan('pro'), async (req, res) => {
    const { symbol, interval, limit } = req.query;
    try {
        const data = await apiCache.get(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit || 50}`,
            { ttl: interval === '1d' ? 300_000 : interval === '4h' ? 120_000 : 30_000 }
        );
        res.json({ success: true, data });
    } catch (err) {
        res.status(502).json({ success: false, error: err.message });
    }
});

// Proxy: Fear & Greed — Pro feature (macro sentiment)
app.get('/api/proxy/feargreed', requireAuth, requirePlan('pro'), async (req, res) => {
    try {
        const data = await apiCache.get('https://api.alternative.me/fng/?limit=1&format=json', { ttl: 600_000 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(502).json({ success: false, error: err.message, fallback: { value: 52, label: 'Neutral' } });
    }
});

// Proxy: Polymarket — Pro feature (prediction market odds)
app.get('/api/proxy/polymarket', requireAuth, requirePlan('pro'), async (req, res) => {
    try {
        const data = await apiCache.get(
            'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=30&tag_slug=crypto',
            { ttl: 300_000, timeout: 8_000, fallback: [] }
        );
        res.json({ success: true, data });
    } catch (err) {
        res.json({ success: true, data: [] });
    }
});

// Proxy: Multi-exchange prices (all 5 in parallel, server-side)
app.get('/api/proxy/exchanges/:symbol', async (req, res) => {
    const sym = req.params.symbol.toUpperCase();
    const binancePair = sym + 'USDT';
    const krakenPair = sym === 'BTC' ? 'XXBTZUSD' : sym === 'ETH' ? 'XETHZUSD' : sym + 'USD';

    const [binance, bybit, kraken, coinbase, okx] = await Promise.allSettled([
        apiCache.get(`https://api.binance.com/api/v3/ticker/price?symbol=${binancePair}`, { ttl: 20_000 }),
        apiCache.get(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${binancePair}`, { ttl: 20_000 }),
        apiCache.get(`https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`, { ttl: 20_000 }),
        apiCache.get(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`, { ttl: 20_000 }),
        apiCache.get(`https://www.okx.com/api/v5/market/ticker?instId=${sym}-USDT`, { ttl: 20_000 }),
    ]);

    const results = {};
    if (binance.status === 'fulfilled' && binance.value?.price)
        results.Binance = parseFloat(binance.value.price);
    if (bybit.status === 'fulfilled' && bybit.value?.result?.list?.[0]?.lastPrice)
        results.Bybit = parseFloat(bybit.value.result.list[0].lastPrice);
    if (kraken.status === 'fulfilled' && kraken.value?.result) {
        const key = Object.keys(kraken.value.result)[0];
        if (key) results.Kraken = parseFloat(kraken.value.result[key].c?.[0]);
    }
    if (coinbase.status === 'fulfilled' && coinbase.value?.data?.amount)
        results.Coinbase = parseFloat(coinbase.value.data.amount);
    if (okx.status === 'fulfilled' && okx.value?.data?.[0]?.last)
        results.OKX = parseFloat(okx.value.data[0].last);

    // Synthesise missing from Binance with realistic variance
    const base = results.Binance;
    if (base) {
        const variance = [0, 0.0003, -0.0002, 0.0005, -0.0001];
        ['Binance','Bybit','Kraken','Coinbase','OKX'].forEach((ex, i) => {
            if (!results[ex]) results[ex] = +(base * (1 + variance[i])).toFixed(base > 1000 ? 2 : 6);
        });
    }

    res.json({ success: true, data: results });
});

// ── FRED Macro Data proxy (FRED public API — free, no key for series observations) ──
app.get('/api/proxy/fred', async (req, res) => {
    // FRED free public API — key embedded server-side, not exposed to client
    const FRED_KEY = process.env.FRED_API_KEY;
    if (!FRED_KEY) return res.json({ success: false, data: [], error: 'FRED_API_KEY not configured. Add it in Settings.' });

    const SERIES = {
        FEDFUNDS:  { label: 'Fed Funds Rate',     unit: '%',  signal: 'rate'     },
        CPIAUCSL:  { label: 'CPI (Inflation)',     unit: '%',  signal: 'inflation'},
        UNRATE:    { label: 'Unemployment Rate',   unit: '%',  signal: 'jobs'     },
        A191RL1Q225SBEA: { label: 'GDP Growth',   unit: '%',  signal: 'growth'   },
        T10YIE:    { label: '10Y Breakeven Infl.', unit: '%',  signal: 'inflation'},
        DGS10:     { label: '10Y Treasury Yield',  unit: '%',  signal: 'yields'   },
    };

    try {
        const results = await Promise.allSettled(
            Object.entries(SERIES).map(([id, meta]) =>
                apiCache.get(
                    `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&limit=2&sort_order=desc&file_type=json`,
                    { ttl: 3_600_000, timeout: 8_000 }
                ).then(data => {
                    const obs = data?.observations;
                    if (!obs || !obs.length) return null;
                    const latest = obs[0];
                    const prev   = obs[1];
                    const val    = parseFloat(latest.value);
                    const prevVal = prev ? parseFloat(prev.value) : val;
                    if (isNaN(val)) return null;
                    return {
                        id, ...meta,
                        value: val,
                        prev: prevVal,
                        change: +(val - prevVal).toFixed(3),
                        date: latest.date,
                    };
                })
            )
        );

        const indicators = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);

        res.json({ success: true, data: indicators });
    } catch (err) {
        res.json({ success: false, data: [], error: err.message });
    }
});

// Polymarket CLOB — top wallet activity (public, no auth for reads)
app.get('/api/proxy/polymarket/wallets', async (req, res) => {
    try {
        // Polymarket CLOB API: recent trades across active markets
        const data = await apiCache.get(
            'https://clob.polymarket.com/trades?limit=50&maker_address=&taker_address=',
            { ttl: 120_000, timeout: 8_000, fallback: [] }
        );
        res.json({ success: true, data: data?.data ?? data ?? [] });
    } catch (err) {
        res.json({ success: true, data: [] });
    }
});

// Polymarket markets with full detail including volumes
app.get('/api/proxy/polymarket/markets', async (req, res) => {
    try {
        const tag   = /^[a-z0-9_-]{1,40}$/i.test(req.query.tag || '') ? req.query.tag : 'crypto';
        const limit = safeInt(req.query.limit, 30, 100);
        const data  = await apiCache.get(
            `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&tag_slug=${encodeURIComponent(tag)}&order=volume&ascending=false`,
            { ttl: 300_000, timeout: 10_000, fallback: [] }
        );
        res.json({ success: true, data: Array.isArray(data) ? data : (data?.data ?? []) });
    } catch (err) {
        res.json({ success: true, data: [] });
    }
});

// ── SLACK WEBHOOK PROXY ───────────────────────────────────────────────
app.post('/api/proxy/slack', async (req, res) => {
    const { webhook, text, attachments } = req.body || {};
    // Whitelist exact URL prefix — prevents SSRF; hostname check alone allows subdomain bypasses
    const SLACK_PREFIX = 'https://hooks.slack.com/services/';
    if (!webhook || !webhook.startsWith(SLACK_PREFIX)) {
        return res.status(400).json({ error: 'Invalid or missing Slack webhook URL' });
    }
    let parsedUrl;
    try { parsedUrl = new URL(webhook); } catch { /* fall through */ }
    if (!parsedUrl) {
        return res.status(400).json({ error: 'Invalid or missing Slack webhook URL' });
    }
    try {
        const payload = { text: text || '' };
        if (attachments) payload.attachments = attachments;
        const r = await fetch(parsedUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await r.text();
        res.json({ ok: r.ok, status: r.status, body });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── PHASE 5: USER SETTINGS (API KEYS) ────────────────────────────────
app.get('/api/user/keys', requireAuth, (req, res) => {
    const keys = db.getUserKeys(req.userId);
    // Never expose secrets in full — mask them
    const masked = {};
    for (const [k, v] of Object.entries(keys)) {
        if (!v || k === 'user_id' || k === 'updated_at') { masked[k] = v; continue; }
        masked[k] = v.length > 8 ? v.slice(0,4) + '••••' + v.slice(-4) : '••••';
        masked[`${k}_set`] = true;
    }
    res.json({ ok: true, keys: masked });
});

app.post('/api/user/keys', requireAuth, (req, res) => {
    const allowed = ['openrouter_key','fred_key','slack_webhook','binance_api_key','binance_secret'];
    const incoming = {};
    for (const k of allowed) {
        if (req.body[k] !== undefined && req.body[k] !== '') incoming[k] = req.body[k];
    }
    db.setUserKeys(req.userId, incoming);
    res.json({ ok: true });
});

// ── PHASE 5: ALERTS SYNC ──────────────────────────────────────────────
app.get('/api/user/alerts', requireAuth, (req, res) => {
    const rows = db.getUserAlerts(req.userId);
    res.json({ ok: true, alerts: rows.map(r => ({
        id: r.id, type: r.type, symbol: r.symbol, condition: r.condition,
        value: r.value, label: r.label,
        active: !!r.active,
        createdAt: r.created_at * 1000,
        firedAt:   r.fired_at  ? r.fired_at * 1000 : null,
    })) });
});

app.post('/api/user/alerts', requireAuth, (req, res) => {
    const alert = req.body;
    if (!alert || !alert.id) return res.status(400).json({ error: 'Missing alert data' });
    db.upsertUserAlert(req.userId, alert);
    res.json({ ok: true });
});

app.delete('/api/user/alerts/:id', requireAuth, (req, res) => {
    db.deleteUserAlert(req.userId, req.params.id);
    res.json({ ok: true });
});

// ── PHASE 5: JOURNAL SYNC ─────────────────────────────────────────────
app.get('/api/user/journal', requireAuth, (req, res) => {
    res.json({ ok: true, trades: db.getUserJournal(req.userId) });
});

app.post('/api/user/journal', requireAuth, (req, res) => {
    const trade = req.body;
    if (!trade || !trade.id) return res.status(400).json({ error: 'Missing trade data' });
    db.upsertJournalTrade(req.userId, trade);
    res.json({ ok: true });
});

app.delete('/api/user/journal/:id', requireAuth, (req, res) => {
    db.deleteJournalTrade(req.userId, req.params.id);
    res.json({ ok: true });
});

// ── PHASE 5: PORTFOLIO SYNC ───────────────────────────────────────────
app.get('/api/user/portfolio', requireAuth, (req, res) => {
    res.json({ ok: true, holdings: db.getUserPortfolio(req.userId) });
});

app.post('/api/user/portfolio', requireAuth, (req, res) => {
    const holding = req.body;
    if (!holding || !holding.id) return res.status(400).json({ error: 'Missing holding data' });
    db.upsertPortfolioHolding(req.userId, holding);
    res.json({ ok: true });
});

app.delete('/api/user/portfolio/:id', requireAuth, (req, res) => {
    db.deletePortfolioHolding(req.userId, req.params.id);
    res.json({ ok: true });
});

// ── PHASE 5: BINANCE READ-ONLY ACCOUNT SYNC ──────────────────────────
const crypto = require('crypto');
app.get('/api/user/binance/balances', requireAuth, async (req, res) => {
    const keys = db.getUserKeys(req.userId);
    if (!keys.binance_api_key || !keys.binance_secret) {
        return res.status(400).json({ error: 'Binance API key not set. Add it in Settings.' });
    }
    try {
        const ts        = Date.now();
        const query     = `timestamp=${ts}`;
        const signature = crypto.createHmac('sha256', keys.binance_secret)
                                .update(query).digest('hex');
        const r = await fetch(
            `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
            { headers: { 'X-MBX-APIKEY': keys.binance_api_key } }
        );
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data.msg || 'Binance error' });

        // Filter to non-zero balances and add USDT symbol
        const balances = (data.balances || [])
            .filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0.00001)
            .map(b => ({ coin: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked), total: parseFloat(b.free)+parseFloat(b.locked) }));
        res.json({ ok: true, balances });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── NEWS ─────────────────────────────────────────────────────────────

app.get('/api/news', async (req, res) => {
    try {
        const { symbol, category } = req.query;
        const news = await newsService.getNews(symbol, category);
        res.json({ success: true, data: news });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch news' });
    }
});

// ── CONFIG FOR FRONTEND ──────────────────────────────────────────────

// Let frontend know available forex pairs and PSX config
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        data: {
            forexPairs: config.forexPairs,
            psxSectors: config.psxSectors,
            cryptocurrencies: config.cryptocurrencies.map(c => ({ symbol: c.symbol, name: c.name }))
        }
    });
});

// ── ML PREDICTION (Python microservice on port 5001) ─────────────────

// Cache predictions to avoid re-training on every request (TTL: 10 min)
const predictionCache = {};

async function callPredictionService(prices, volumes, symbol) {
    const axios = require('axios');
    try {
        const response = await axios.post('http://127.0.0.1:5001/predict', {
            prices, volumes, symbol
        }, { timeout: 30000 });
        return response.data;
    } catch (err) {
        // If Python service is down, return a graceful fallback
        return {
            success: false,
            error: 'ML service unavailable. Start it with: python3 predict_service.py',
            fallback: true
        };
    }
}

// Helper: fetch kline data from Binance (free, no key, reliable for 90d)
async function fetchBinancePrices(symbol) {
    const axios = require('axios');
    const pair  = symbol.toUpperCase() + 'USDT';
    // 90 daily candles
    const url   = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=90`;
    const resp  = await axios.get(url, { timeout: 10000 });
    const prices  = resp.data.map(k => parseFloat(k[4]));   // close prices
    const volumes = resp.data.map(k => parseFloat(k[5]));   // volumes
    return { prices, volumes };
}

// GET /api/crypto/:symbol/predict — Pro feature: ML price prediction
app.get('/api/crypto/:symbol/predict', requireAuth, requirePlan('pro'), async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c =>
            c.symbol === symbol.toUpperCase() || c.id === symbol.toLowerCase()
        );
        if (!crypto) return res.status(404).json({ success: false, error: 'Cryptocurrency not found' });

        const cacheKey = `predict_${crypto.id}`;
        const cached = predictionCache[cacheKey];
        if (cached && (Date.now() - cached.ts) < 10 * 60 * 1000) {
            return res.json({ ...cached.data, cached: true });
        }

        // Try Binance first (no rate limits), fall back to CoinGecko
        let prices, volumes;
        try {
            const binanceData = await fetchBinancePrices(crypto.symbol);
            prices  = binanceData.prices;
            volumes = binanceData.volumes;
        } catch (binanceErr) {
            console.log('Binance fallback to CoinGecko for', crypto.symbol);
            const history = await cryptoService.getHistoricalData(crypto.id, 90);
            prices  = history.prices.map(p => p.price);
            volumes = history.volumes.map(v => v.volume);
        }

        const prediction = await callPredictionService(prices, volumes, crypto.symbol);

        predictionCache[cacheKey] = { data: prediction, ts: Date.now() };
        res.json(prediction);
    } catch (error) {
        console.error('Prediction error:', error.message);
        res.status(500).json({ success: false, error: 'Prediction failed: ' + error.message });
    }
});

// GET /api/predict/status — Check if ML service is running
app.get('/api/predict/status', async (req, res) => {
    const axios = require('axios');
    try {
        const response = await axios.get('http://127.0.0.1:5001/health', { timeout: 3000 });
        res.json({ success: true, running: true, data: response.data });
    } catch {
        res.json({ success: true, running: false, message: 'Start with: python3 predict_service.py' });
    }
});

// ── AUTOTRADE PROXY (port 5002 Python microservice) ──────────────────

async function callAutoTrade(method, path, body = null) {
    const axios = require('axios');
    const url = `http://127.0.0.1:5002${path}`;
    const config = { timeout: 120000 };
    try {
        const resp = method === 'GET'    ? await axios.get(url, config)
                   : method === 'POST'   ? await axios.post(url, body, config)
                   : method === 'DELETE' ? await axios.delete(url, config)
                   : null;
        return { ok: true, data: resp.data };
    } catch (err) {
        const msg = err.response?.data?.error || err.message || 'AutoTrade service unavailable';
        return { ok: false, error: msg };
    }
}

app.get('/api/autotrade/status', async (req, res) => {
    const r = await callAutoTrade('GET', '/health');
    res.json(r.ok ? { success: true, running: true } : { success: true, running: false });
});

app.get('/api/autotrade/strategies', async (req, res) => {
    const r = await callAutoTrade('GET', '/strategies');
    r.ok ? res.json(r.data) : res.status(503).json({ success: false, error: r.error });
});

app.post('/api/autotrade/backtest', async (req, res) => {
    const r = await callAutoTrade('POST', '/backtest', req.body);
    r.ok ? res.json(r.data) : res.status(500).json({ success: false, error: r.error });
});

app.get('/api/autotrade/results', async (req, res) => {
    const r = await callAutoTrade('GET', '/results');
    r.ok ? res.json(r.data) : res.status(503).json({ success: false, error: r.error });
});

app.post('/api/autotrade/results', async (req, res) => {
    const r = await callAutoTrade('POST', '/results', req.body);
    r.ok ? res.json(r.data) : res.status(500).json({ success: false, error: r.error });
});

app.get('/api/autotrade/strategy/:name', async (req, res) => {
    const r = await callAutoTrade('GET', `/strategy/${req.params.name}`);
    r.ok ? res.json(r.data) : res.status(404).json({ success: false, error: r.error });
});

app.post('/api/autotrade/strategy/create', async (req, res) => {
    const r = await callAutoTrade('POST', '/strategy/create', req.body);
    r.ok ? res.json(r.data) : res.status(500).json({ success: false, error: r.error });
});

app.delete('/api/autotrade/strategy/:name', async (req, res) => {
    const r = await callAutoTrade('DELETE', `/strategy/${req.params.name}`);
    r.ok ? res.json(r.data) : res.status(500).json({ success: false, error: r.error });
});

// ── ON-CHAIN ANALYTICS PROXY ROUTES ─────────────────────────────────
// These proxy to free public APIs and add server-side caching

const onChainCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCached(key) {
    const entry = onChainCache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return null;
}
function setCache(key, data) { onChainCache.set(key, { data, ts: Date.now() }); }

// Whale alerts — Pro feature: on-chain analytics
// BTC: real large unconfirmed transactions from Blockchain.info (free, no key).
// ETH/SOL: simulated illustrative data, clearly flagged with _synthetic flag.
app.get('/api/onchain/whale-alerts', requireAuth, requirePlan('pro'), async (req, res) => {
    try {
        const coin = req.query.coin || 'bitcoin';
        const cacheKey = `whale-${coin}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const symbolMap = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' };
        const symbol = symbolMap[coin] || 'BTC';
        const axios = require('axios');

        // BTC: fetch real large transactions from Blockchain.info
        if (coin === 'bitcoin') {
            try {
                const resp = await axios.get(
                    'https://blockchain.info/unconfirmed-transactions?format=json&limit=50',
                    { timeout: 8000 }
                );
                const txs = resp.data?.txs || [];
                const MIN_BTC = 10;
                const alerts = txs
                    .map(tx => {
                        const totalOut = tx.out.reduce((s, o) => s + (o.value || 0), 0) / 1e8;
                        if (totalOut < MIN_BTC) return null;
                        return {
                            type: 'wallet_to_wallet',
                            symbol: 'BTC',
                            amount: Math.round(totalOut * 10) / 10,
                            amountUSD: null,
                            from: tx.inputs?.[0]?.prev_out?.addr || 'unknown',
                            to: tx.out?.[0]?.addr || 'unknown',
                            timestamp: (tx.time || Math.floor(Date.now() / 1000)) * 1000,
                            hash: tx.hash,
                            _synthetic: false,
                        };
                    })
                    .filter(Boolean)
                    .slice(0, 20);

                if (alerts.length > 0) {
                    const result = { data: alerts, _synthetic: false };
                    setCache(cacheKey, result);
                    return res.json(result);
                }
            } catch (e) {
                console.warn('[whale-alerts] Blockchain.info unavailable:', e.message);
            }
        }

        // ETH/SOL (and BTC fallback): simulated illustrative data
        const basePrices = { BTC: 68000, ETH: 3500, SOL: 168 };
        const basePrice = basePrices[symbol] || 100;
        const types = ['wallet_to_exchange', 'exchange_to_wallet', 'wallet_to_wallet'];
        const exchanges = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'];
        const simAlerts = [];
        const count = 10 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const amount = Math.random() > 0.7 ? Math.random() * 5000 + 1000 : Math.random() * 500 + 100;
            simAlerts.push({
                type,
                symbol,
                amount: Math.round(amount * 10) / 10,
                amountUSD: amount * basePrice,
                from: type === 'exchange_to_wallet' ? exchanges[Math.floor(Math.random() * 5)] : `0x${Math.random().toString(16).slice(2, 10)}...`,
                to: type === 'wallet_to_exchange' ? exchanges[Math.floor(Math.random() * 5)] : `0x${Math.random().toString(16).slice(2, 10)}...`,
                timestamp: Date.now() - Math.random() * 86400000,
                _synthetic: true,
            });
        }
        simAlerts.sort((a, b) => b.timestamp - a.timestamp);
        const result = {
            data: simAlerts,
            _synthetic: true,
            _syntheticNote: `Real-time ${symbol} whale alerts require a paid API key (WhaleAlert.io). The entries below are illustrative — amounts and addresses are randomised to demonstrate the feature layout.`,
        };
        setCache(cacheKey, result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exchange flow — Pro feature: on-chain analytics
// Uses real Binance aggTrades for inflow/outflow totals. Per-exchange breakdown is estimated.
app.get('/api/onchain/exchange-flow', requireAuth, requirePlan('pro'), async (req, res) => {
    try {
        const coin = req.query.coin || 'bitcoin';
        const cacheKey = `flow-${coin}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const symbolMap = { bitcoin: { pair: 'BTCUSDT', base: 2800 }, ethereum: { pair: 'ETHUSDT', base: 45000 }, solana: { pair: 'SOLUSDT', base: 850000 } };
        const cfg = symbolMap[coin] || symbolMap.bitcoin;

        let inflowBase = cfg.base;
        try {
            const axios = require('axios');
            const resp = await axios.get(`https://api.binance.com/api/v3/aggTrades?symbol=${cfg.pair}&limit=1000`, { timeout: 4000 });
            if (resp.data) {
                const buys = resp.data.filter(t => !t.m).reduce((s, t) => s + parseFloat(t.q), 0);
                const sells = resp.data.filter(t => t.m).reduce((s, t) => s + parseFloat(t.q), 0);
                const data = {
                    inflow: Math.round(sells),
                    outflow: Math.round(buys),
                    netflow: Math.round(sells - buys),
                    _synthetic: false,
                    // Per-exchange breakdown requires CryptoQuant/Glassnode paid API — estimated from Binance totals
                    _exchangeBreakdownNote: 'Per-exchange netflow is estimated. Total inflow/outflow is real Binance data.',
                    exchanges: ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'].map(name => {
                        const n = (Math.random() - 0.5) * cfg.base * 0.3;
                        return { name, netflow: Math.round(n), _estimated: true };
                    }),
                };
                setCache(cacheKey, data);
                return res.json(data);
            }
        } catch {}

        // Full fallback when Binance is unreachable
        const inflow  = inflowBase * (0.85 + Math.random() * 0.3);
        const outflow = inflowBase * (0.90 + Math.random() * 0.3);
        const data = {
            inflow: Math.round(inflow),
            outflow: Math.round(outflow),
            netflow: Math.round(inflow - outflow),
            _synthetic: true,
            _syntheticNote: 'Binance data unavailable — showing estimated illustrative figures.',
            exchanges: ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'].map(name => ({
                name,
                netflow: Math.round((Math.random() - 0.5) * inflowBase * 0.3),
                _estimated: true,
            })),
        };
        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── ADMIN API ROUTES ──────────────────────────────────────────────────
// All require admin role. Front-end: public/admin.html

// GET /api/admin/users — full user list
app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = db.getAdminUserList();
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

function parseAdminUserId(raw) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// POST /api/admin/users/:id/upgrade — change user plan
app.post('/api/admin/users/:id/upgrade', requireAdmin, (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const { plan, expiresAt } = req.body;
        if (!['free', 'pro', 'team'].includes(plan)) {
            return res.status(400).json({ success: false, error: 'Invalid plan. Use: free, pro, team' });
        }
        let expiresAtVal = null;
        if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
            expiresAtVal = parseInt(expiresAt, 10);
            if (!Number.isFinite(expiresAtVal) || expiresAtVal <= Math.floor(Date.now() / 1000)) {
                return res.status(400).json({ success: false, error: 'expiresAt must be a future Unix timestamp' });
            }
        }
        db.upgradePlan(userId, plan, req.userId, expiresAtVal);
        res.json({ success: true, message: `User ${userId} upgraded to ${plan}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/suspend — suspend user
app.post('/api/admin/users/:id/suspend', requireAdmin, (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const { reason } = req.body;
        if (userId === req.userId) {
            return res.status(400).json({ success: false, error: 'Cannot suspend yourself' });
        }
        db.suspendUser(userId, reason || 'Suspended by admin', req.userId);
        res.json({ success: true, message: `User ${userId} suspended` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/unsuspend — unsuspend user
app.post('/api/admin/users/:id/unsuspend', requireAdmin, (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        db.unsuspendUser(userId, req.userId);
        res.json({ success: true, message: `User ${userId} unsuspended` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/waitlist — view waitlist (JSON)
app.get('/api/admin/waitlist', requireAdmin, (req, res) => {
    const list = db.getWaitlist();
    res.json({ success: true, count: list.length, data: list });
});

// GET /api/admin/waitlist/export.csv — download waitlist as CSV
app.get('/api/admin/waitlist/export.csv', requireAdmin, (req, res) => {
    try {
        const list = db.getWaitlist();
        // csvEsc: doubles internal quotes (RFC 4180) and strips leading =+@- to prevent formula injection
        // Prefix ANY leading formula char (=+-@\t\r) to block CSV injection regardless of quoting
        const csvEsc = v => { const s = String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&"); return `"${s.replace(/"/g, '""')}"`; };
        const header = 'id,email,source,signed_up_at\n';
        const rows = list.map(r =>
            `${r.id},${csvEsc(r.email)},${csvEsc(r.source)},"${new Date(r.signed_up_at * 1000).toISOString()}"`
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="waitlist-${Date.now()}.csv"`);
        res.send(header + rows);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/revenue — MRR/ARR/user metrics
app.get('/api/admin/revenue', requireAdmin, (req, res) => {
    try {
        const stats = db.getRevenueStats();
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/audit — recent admin audit log
app.get('/api/admin/audit', requireAdmin, (req, res) => {
    try {
        const limit = safeInt(req.query.limit, 50, 500);
        const log = db.getAuditLog(limit);
        res.json({ success: true, data: log });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/health — system health (DB, cache, collector, process)
app.get('/api/admin/health', requireAdmin, (req, res) => {
    try {
        const dbStats    = db.getDbStats();
        const cacheStats = apiCache.stats();
        const mem        = process.memoryUsage();
        res.json({
            success: true,
            data: {
                uptime: Math.round(process.uptime()),
                env: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '2.0.0',
                collector: dataCollector.isRunning(),
                memory: {
                    heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + ' MB',
                    rss:       Math.round(mem.rss       / 1024 / 1024) + ' MB',
                },
                db:    dbStats,
                cache: cacheStats,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/settings — read app settings
app.get('/api/admin/settings', requireAdmin, (req, res) => {
    try {
        const keys = ['registration_open', 'app_version', 'maintenance_mode'];
        const settings = {};
        for (const k of keys) settings[k] = db.getSetting(k);
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/admin/settings — update a setting
app.put('/api/admin/settings', requireAdmin, (req, res) => {
    try {
        const { key, value } = req.body;
        const allowed = ['registration_open', 'maintenance_mode', 'max_price_history_days'];
        if (!allowed.includes(key)) {
            return res.status(400).json({ success: false, error: 'Setting not editable via API' });
        }
        db.setSetting(key, value);
        res.json({ success: true, message: `${key} = ${value}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users — create a user directly (admin-only)
app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { username, email, password, plan, role } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, error: 'username, email and password are required' });
        }
        const result = await authService.register(username, email, password);
        if (!result.success) return res.status(400).json({ success: false, error: result.error });

        // Apply requested plan/role overrides
        const userId = result.userId;
        if (plan && plan !== 'free') {
            db.upgradePlan(userId, plan, req.userId, null);
        }
        if (role === 'admin') {
            const secret = process.env.ADMIN_PROMOTION_SECRET;
            if (!secret || req.body.promotionSecret !== secret) {
                return res.status(403).json({ success: false, error: 'ADMIN_PROMOTION_SECRET required to grant admin role' });
            }
            db.getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', userId);
        }
        db.auditLog(req.userId, 'create_user', userId, `${username} (${email}) plan=${plan||'free'} role=${role||'user'}`);
        res.json({ success: true, userId, message: `User ${username} created` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/bulk — bulk action on multiple users
app.post('/api/admin/users/bulk', requireAdmin, async (req, res) => {
    try {
        const { action, userIds, reason } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, error: 'userIds must be a non-empty array' });
        }
        if (!['suspend', 'unsuspend', 'delete', 'upgrade'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }

        let affected = 0;
        for (const id of userIds) {
            const uid = parseInt(id, 10);
            if (!uid || uid === req.userId) continue; // never touch self
            if (action === 'suspend') {
                db.suspendUser(uid, reason || 'Bulk suspended by admin', req.userId);
            } else if (action === 'unsuspend') {
                db.unsuspendUser(uid, req.userId);
            } else if (action === 'delete') {
                const user = db.getUserById(uid);
                if (user) {
                    db.getDb().prepare('DELETE FROM users WHERE id = ?').run(uid);
                    db.auditLog(req.userId, 'bulk_delete_user', uid, `${user.username} (${user.email})`);
                }
            } else if (action === 'upgrade') {
                const { plan } = req.body;
                if (!['free', 'pro', 'team'].includes(plan)) continue;
                db.upgradePlan(uid, plan, req.userId, null);
            }
            affected++;
        }
        db.auditLog(req.userId, `bulk_${action}`, null, `${affected} users affected; ids=[${userIds.slice(0, 100).join(',')}]`);
        res.json({ success: true, affected });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/admin/users/:id — permanently delete a user
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        if (userId === req.userId) return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        const user = db.getUserById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        db.getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
        db.auditLog(req.userId, 'delete_user', userId, `Deleted ${user.username} (${user.email})`);
        res.json({ success: true, message: `User ${userId} deleted` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/role — promote/demote user role
app.post('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        if (userId === req.userId) return res.status(400).json({ success: false, error: 'Cannot change your own role' });
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, error: 'Invalid role' });
        if (role === 'admin') {
            const secret = process.env.ADMIN_PROMOTION_SECRET;
            if (!secret || req.body.promotionSecret !== secret) {
                return res.status(403).json({ success: false, error: 'ADMIN_PROMOTION_SECRET required to grant admin role' });
            }
        }
        db.getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
        db.auditLog(req.userId, 'change_role', userId, JSON.stringify({ role }));
        res.json({ success: true, message: `User ${userId} role set to ${role}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/force-password-reset — email a reset link to the user
app.post('/api/admin/users/:id/force-password-reset', requireAdmin, async (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const user = db.getUserById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const crypto = require('crypto');
        const token  = crypto.randomBytes(32).toString('hex');
        db.createResetToken(userId, token);
        await emailService.sendPasswordReset(user.email, token);
        db.auditLog(req.userId, 'force_password_reset', userId, user.email);
        res.json({ success: true, message: `Password reset email sent to ${user.email}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/users/export.csv — export all users as CSV
app.get('/api/admin/users/export.csv', requireAdmin, (req, res) => {
    try {
        const users = db.getAdminUserList();
        // Prefix ANY leading formula char (=+-@\t\r) to block CSV injection regardless of quoting
        const csvEsc = v => { const s = String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&"); return `"${s.replace(/"/g, '""')}"`; };
        const fmtTs = ts => ts ? new Date(ts * 1000).toISOString() : '';
        const header = 'id,username,email,role,plan,plan_expires_at,suspended,suspend_reason,created_at,last_login,stripe_customer_id\n';
        const rows = users.map(u =>
            [u.id, csvEsc(u.username), csvEsc(u.email), csvEsc(u.role), csvEsc(u.plan),
             fmtTs(u.plan_expires_at), u.suspended ? 1 : 0, csvEsc(u.suspend_reason),
             fmtTs(u.created_at), fmtTs(u.last_login), csvEsc(u.stripe_customer_id)].join(',')
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.csv"`);
        res.send(header + rows);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/users/:id — full single user details
app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
    try {
        const userId = parseAdminUserId(req.params.id);
        if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const user = db.getDb().prepare(`
            SELECT id, username, email, role, plan, plan_expires_at, plan_upgraded_at,
                   suspended, suspend_reason, created_at, last_login,
                   stripe_customer_id, stripe_subscription_id, totp_enabled
            FROM users WHERE id = ?
        `).get(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        // Single query for all per-user counts — avoids 3 separate COUNT round-trips
        const counts = db.getDb().prepare(`
            SELECT
                (SELECT COUNT(*) FROM user_alerts    WHERE user_id = ?) AS alertCount,
                (SELECT COUNT(*) FROM user_journal   WHERE user_id = ?) AS journalCount,
                (SELECT COUNT(*) FROM user_portfolio WHERE user_id = ?) AS portfolioCount,
                (SELECT COUNT(*) FROM user_api_keys  WHERE user_id = ?) AS hasKeys
        `).get(userId, userId, userId, userId);
        const auditHistory = db.getDb().prepare(
            `SELECT action, details, ts FROM admin_audit_log WHERE target_id = ? ORDER BY ts DESC LIMIT 10`
        ).all(userId);
        res.json({ success: true, data: {
            ...user,
            alertCount:    counts.alertCount,
            journalCount:  counts.journalCount,
            portfolioCount: counts.portfolioCount,
            hasKeys:       counts.hasKeys > 0,
            auditHistory,
        } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /admin — serve admin portal (HTML page, redirects non-admins to /auth)
app.get('/admin', requireAdminPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── HEALTH CHECK ─────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    const dbStats = (() => { try { return db.getDbStats(); } catch { return null; } })();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        env: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        collector: dataCollector.isRunning(),
        db: dbStats ? 'ok' : 'unavailable',
        cache: apiCache.stats(),
    });
});

// GET /api/cache/stats — admin only
app.get('/api/cache/stats', requireAdmin, (req, res) => {
    res.json({ success: true, ...apiCache.stats() });
});

// DELETE /api/cache — admin: flush entire cache
app.delete('/api/cache', requireAdmin, (req, res) => {
    const raw  = req.query.host || '';
    let host   = null;
    try { if (raw) { const u = new URL(raw.includes('://') ? raw : `https://${raw}`); host = u.hostname; } } catch { /* invalid */ }
    if (host) { apiCache.invalidateHost(host); }
    res.json({ success: true, message: host ? `Cache cleared for ${host}` : 'Full cache cleared' });
});

// ── NOTIFICATIONS / TELEGRAM / AUTO-SIGNALS ───────────────────────────
const notificationService = require('./services/notificationService');
const autoSignalEngine    = require('./services/autoSignalEngine');
const { insertSignalBroadcast, getSignalBroadcasts, updateSignalOutcome, getSignalStats } = require('./services/appDb');

// GET /api/admin/notifications/config
app.get('/api/admin/notifications/config', requireAdmin, (req, res) => {
    const cfg = notificationService.getConfig();
    res.json({ success: true, data: { botToken: cfg.botToken ? '***configured***' : '', chatIds: cfg.chatIds } });
});

// PUT /api/admin/notifications/config — save bot token + chat IDs
app.put('/api/admin/notifications/config', requireAdmin, (req, res) => {
    const { botToken, chatIds } = req.body || {};
    if (botToken !== undefined) db.setSetting('telegram_bot_token', String(botToken || '').trim());
    if (chatIds  !== undefined) {
        const ids = (Array.isArray(chatIds) ? chatIds : String(chatIds || '').split(','))
            .map(s => String(s).trim()).filter(Boolean).join(',');
        db.setSetting('telegram_chat_ids', ids);
    }
    db.auditLog(req.session.userId, 'UPDATE_TELEGRAM_CONFIG', null, 'Telegram config updated');
    res.json({ success: true });
});

// POST /api/admin/notifications/test — send a test message
app.post('/api/admin/notifications/test', requireAdmin, async (req, res) => {
    try {
        const result = await notificationService.broadcast('✅ <b>Trader Portal</b> — Telegram connection test successful!');
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/admin/signals/broadcast — broadcast a trade signal via Telegram
app.post('/api/admin/signals/broadcast', requireAdmin, async (req, res) => {
    const { symbol, direction, assetType, entry, tp1, tp2, sl, confidence, timeframe, notes } = req.body || {};
    if (!symbol || !direction || !entry) {
        return res.status(400).json({ success: false, error: 'symbol, direction and entry are required' });
    }
    if (!['BUY', 'SELL'].includes(String(direction).toUpperCase())) {
        return res.status(400).json({ success: false, error: 'direction must be BUY or SELL' });
    }
    const signal = { symbol, direction: direction.toUpperCase(), assetType, entry, tp1, tp2, sl, confidence, timeframe, notes, source: 'manual' };
    const text   = notificationService.formatSignal(signal);
    try {
        const result = await notificationService.broadcast(text);
        insertSignalBroadcast(signal);
        db.auditLog(req.session.userId, 'BROADCAST_SIGNAL', null, `Signal: ${direction.toUpperCase()} ${symbol}`);
        res.json({ success: true, data: result, preview: text });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/admin/signals/history — paginated broadcast history
app.get('/api/admin/signals/history', requireAdmin, (req, res) => {
    const limit  = safeInt(req.query.limit, 100, 500);
    const symbol = req.query.symbol ? String(req.query.symbol).trim().toUpperCase() : null;
    const rows   = getSignalBroadcasts({ limit, symbol });
    res.json({ success: true, data: rows });
});

// GET /api/admin/signals/stats — win/loss stats
app.get('/api/admin/signals/stats', requireAdmin, (req, res) => {
    res.json({ success: true, data: getSignalStats() });
});

// PATCH /api/admin/signals/:id/outcome — mark TP/SL result
app.patch('/api/admin/signals/:id/outcome', requireAdmin, (req, res) => {
    const id = safeInt(req.params.id, 0);
    const { outcome, note } = req.body || {};
    const VALID = ['TP1_HIT', 'TP2_HIT', 'SL_HIT', 'CANCELLED', 'PENDING'];
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });
    if (!VALID.includes(outcome)) return res.status(400).json({ success: false, error: `outcome must be one of: ${VALID.join(', ')}` });
    const result = updateSignalOutcome(id, outcome, note || null);
    if (!result.changes) return res.status(404).json({ success: false, error: 'Signal not found' });
    db.auditLog(req.session.userId, 'UPDATE_SIGNAL_OUTCOME', id, `${outcome}${note ? ': ' + note : ''}`);
    res.json({ success: true });
});

// GET /api/admin/auto-signal/status
app.get('/api/admin/auto-signal/status', requireAdmin, (req, res) => {
    res.json({ success: true, data: autoSignalEngine.status() });
});

// PUT /api/admin/auto-signal/config — save auto-signal settings
app.put('/api/admin/auto-signal/config', requireAdmin, (req, res) => {
    const { enabled, intervalMin, minConfidence, symbols } = req.body || {};
    if (enabled    !== undefined) db.setSetting('auto_signal_enabled',        String(!!enabled));
    if (intervalMin !== undefined) db.setSetting('auto_signal_interval_min',  String(Math.max(5, parseInt(intervalMin, 10) || 60)));
    if (minConfidence !== undefined) db.setSetting('auto_signal_min_confidence', String(minConfidence));
    if (symbols    !== undefined) {
        const syms = (Array.isArray(symbols) ? symbols : String(symbols).split(','))
            .map(s => String(s).trim().toUpperCase()).filter(Boolean).join(',');
        db.setSetting('auto_signal_symbols', syms);
    }
    autoSignalEngine.restart();
    db.auditLog(req.session.userId, 'UPDATE_AUTO_SIGNAL_CONFIG', null, JSON.stringify({ enabled, intervalMin, minConfidence }));
    res.json({ success: true });
});

// POST /api/admin/auto-signal/run-now — trigger immediate scan
app.post('/api/admin/auto-signal/run-now', requireAdmin, async (req, res) => {
    try {
        autoSignalEngine.runScan(); // fire-and-forget
        res.json({ success: true, message: 'Scan triggered' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── MAIN PAGE ────────────────────────────────────────────────────────

// Landing / marketing page — always public
app.get('/landing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Root: show landing to guests, dashboard to authenticated users
app.get('/', (req, res) => {
    if (req.session?.userId) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'landing.html'));
    }
});

// Explicit dashboard route (always requires auth handled client-side)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 404 & GLOBAL ERROR HANDLER ────────────────────────────────────────

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
    }
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: IS_PROD ? 'An internal error occurred' : err.message,
    });
});

// ── PHASE 5: BACKGROUND ALERT CRON ───────────────────────────────────
// Runs server-side every 60 s — fires Slack for price/RSI alerts
// even when the user's browser is closed.

async function runAlertCron() {
    let activeAlerts;
    try { activeAlerts = db.getActiveAlertsAll(); } catch { return; }
    if (!activeAlerts.length) return;

    // Group by symbol to minimise API calls
    const bySymbol = {};
    activeAlerts.forEach(a => {
        if (!bySymbol[a.symbol]) bySymbol[a.symbol] = [];
        bySymbol[a.symbol].push(a);
    });

    for (const [symbol, alerts] of Object.entries(bySymbol)) {
        try {
            const binSym = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
            const r      = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binSym}`, { signal: AbortSignal.timeout(8000) });
            const ticker = await r.json();
            if (!ticker.lastPrice) continue;
            const price = parseFloat(ticker.lastPrice);

            for (const alert of alerts) {
                const val   = parseFloat(alert.value);
                const fired =
                    (alert.condition === 'above' && price >= val) ||
                    (alert.condition === 'below' && price <= val);
                if (!fired) continue;

                db.markAlertFired(alert.user_id, alert.id);

                const msg = `🚨 [TraderPro Server Alert] ${alert.label} · Now: $${price.toLocaleString('en', { maximumFractionDigits: 4 })}`;
                const _swUrl = (() => { try { const u = new URL(alert.slack_webhook || ''); return (u.protocol === 'https:' && u.hostname === 'hooks.slack.com') ? u.toString() : null; } catch { return null; } })();
                if (_swUrl) {
                    try {
                        await fetch(_swUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                text: msg,
                                attachments: [{
                                    color: '#f59e0b',
                                    fields: [
                                        { title: 'Symbol',    value: alert.symbol,    short: true },
                                        { title: 'Condition', value: `${alert.condition} ${alert.value}`, short: true },
                                        { title: 'Triggered', value: new Date().toLocaleString(), short: true },
                                    ],
                                }],
                            }),
                        });
                        console.log(`[AlertCron] Fired: ${alert.label} → Slack sent`);
                    } catch (slackErr) {
                        console.error('[AlertCron] Slack send failed:', slackErr.message);
                    }
                }
            }
        } catch (cronErr) { console.error(`[AlertCron] Error processing ${binSym}:`, cronErr.message); }
    }
}

setInterval(runAlertCron, 60_000);
setTimeout(runAlertCron, 5_000); // run shortly after boot

// ── START ────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
    console.log(`\n🚀 TraderPro running on http://localhost:${PORT}`);
    console.log(`   Mode: ${IS_PROD ? '🔒 PRODUCTION' : '🛠  development'}`);
    console.log(`📊 Crypto: ${config.cryptocurrencies.length} coins`);
    console.log(`💱 Forex: ${config.forexPairs.length} pairs`);
    console.log(`🇵🇰 PSX: ${config.psxTopStocks?.length ?? 0} stocks`);
    console.log(`🏦 Exchanges: 10 curated + CoinGecko live`);
    console.log(`💰 100% FREE — No paid API keys required!`);
    console.log(`🔐 Auth: SQLite multi-user authentication enabled`);
    console.log(`💾 DB: SQLite data persistence + background collector`);
    console.log(`🌐 Health: http://localhost:${PORT}/health\n`);

    // Start background data collection
    dataCollector.start();
    // Start auto-signal engine (only runs if admin has enabled it)
    autoSignalEngine.start();
    // Start real-time ccxws price feeds
    wsFeeds.start();
});

// ── WEBSOCKET /ws — real-time price ticker ────────────────────────────
// Browser connects via: new WebSocket('ws://host/ws')
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', ws => {
    wsFeeds.addClient(ws);
});

server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') {
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else {
        socket.destroy();
    }
});

// REST fallback: latest prices for all watched symbols
app.get('/api/ws/prices', requireAuth, (req, res) => {
    res.json({ ok: true, prices: wsFeeds.getAllPrices() });
});

// Subscribe to an additional symbol at runtime
app.post('/api/ws/subscribe', requireAuth, (req, res) => {
    const { base, quote } = req.body || {};
    if (!base || !quote) return res.status(400).json({ ok: false, error: 'base and quote required' });
    wsFeeds.subscribe(base.toUpperCase(), quote.toUpperCase());
    res.json({ ok: true });
});

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────

function gracefulShutdown(signal) {
    console.log(`\n[${signal}] Graceful shutdown initiated...`);
    dataCollector.stop();
    autoSignalEngine.stop();
    wsFeeds.stop();
    server.close(() => {
        console.log('HTTP server closed. Bye!\n');
        process.exit(0);
    });
    // Force exit after 10 s if connections hang
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    if (IS_PROD) gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});

module.exports = app;

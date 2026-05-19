'use strict';

/**
 * emailService.js — Transactional email via nodemailer.
 *
 * Recommended provider: Resend (resend.com) — free tier: 3,000 emails/mo, no card needed.
 * Resend SMTP settings (add to .env):
 *   SMTP_HOST=smtp.resend.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=resend
 *   SMTP_PASS=re_xxxxxxxxxxxx   ← your Resend API key
 *   SMTP_FROM=TraderPro <noreply@yourdomain.com>
 *   APP_URL=https://yourdomain.com
 *
 * Dev fallback (no SMTP set): logs the reset link to the console and returns it
 * in the API response so you can test without SMTP. Never use this in production.
 */

const nodemailer = require('nodemailer');

const IS_PROD = process.env.NODE_ENV === 'production';

let _transport = null;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transport;
}

const FROM    = process.env.SMTP_FROM || 'TraderPro <noreply@traderpro.app>';
const APP_URL = process.env.APP_URL   || 'http://localhost:3000';

function resetHtml(link) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#0a0c10;color:#e8eaf0;padding:2rem;border-radius:12px">
      <h2 style="margin:0 0 1rem;color:#6478dc">Reset your TraderPro password</h2>
      <p style="color:#8892a4;margin:0 0 1.5rem">Click the button below to set a new password. This link expires in <strong style="color:#e8eaf0">1 hour</strong>.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#5b72ff,#a855f7);color:#fff;text-decoration:none;padding:.75rem 1.5rem;border-radius:8px;font-weight:600">Reset Password →</a>
      <p style="margin-top:1.5rem;font-size:.8rem;color:#8892a4">If you did not request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:1.5rem 0">
      <p style="font-size:.75rem;color:#6b7280">TraderPro · <a href="${APP_URL}" style="color:#6b7280">${APP_URL.replace(/^https?:\/\//, '')}</a></p>
    </div>`;
}

/**
 * Send a password-reset email.
 * Returns { sent: true } on success.
 * In dev mode (no SMTP configured) returns { sent: false, devLink }.
 */
async function sendPasswordReset(email, token) {
  const link = `${APP_URL}/auth.html?action=reset&token=${encodeURIComponent(token)}`;

  const transport = getTransport();
  if (!transport) {
    if (IS_PROD) {
      console.error('[emailService] SMTP not configured — password reset emails will not be sent. Set SMTP_HOST in .env');
    } else {
      console.log('\n[emailService DEV] Password reset link for', email);
      console.log('[emailService DEV]', link, '\n');
    }
    return { sent: false, devLink: IS_PROD ? null : link };
  }

  try {
    await transport.sendMail({
      from:    FROM,
      to:      email,
      subject: 'Reset your TraderPro password',
      text:    `Reset your TraderPro password\n\nClick the link below (expires in 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`,
      html:    resetHtml(link),
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] Failed to send reset email:', err.message);
    throw err;
  }
}

/**
 * Send a welcome email after registration.
 * Non-critical — failure is logged but does not block registration.
 */
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendWelcome(email, username) {
  const transport = getTransport();
  if (!transport) return { sent: false };

  const safeUser      = escHtml(username);
  const dashboardLink = `${APP_URL}/`;
  try {
    await transport.sendMail({
      from:    FROM,
      to:      email,
      subject: `Welcome to TraderPro, ${username}!`,
      text:    `Hi ${username},\n\nYour TraderPro account is ready. Open your dashboard at: ${dashboardLink}\n\nHappy trading!`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#0a0c10;color:#e8eaf0;padding:2rem;border-radius:12px">
          <h2 style="margin:0 0 1rem;color:#6478dc">Welcome to TraderPro, ${safeUser}! 🚀</h2>
          <p style="color:#8892a4;margin:0 0 1.5rem">Your account is ready. Start exploring markets, signals, and your portfolio.</p>
          <a href="${dashboardLink}" style="display:inline-block;background:linear-gradient(135deg,#5b72ff,#a855f7);color:#fff;text-decoration:none;padding:.75rem 1.5rem;border-radius:8px;font-weight:600">Open Dashboard →</a>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:1.5rem 0">
          <p style="font-size:.75rem;color:#6b7280">TraderPro · <a href="${APP_URL}" style="color:#6b7280">${APP_URL.replace(/^https?:\/\//, '')}</a></p>
        </div>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] Failed to send welcome email:', err.message);
    return { sent: false };
  }
}

/**
 * Send a Pro upgrade confirmation email after a successful Stripe checkout.
 */
async function sendProWelcome(email, username) {
  const transport = getTransport();
  if (!transport) return { sent: false };

  const portalLink    = `${APP_URL}/api/billing/portal`;
  const dashboardLink = `${APP_URL}/`;
  try {
    await transport.sendMail({
      from:    FROM,
      to:      email,
      subject: `You're now Pro — TraderPro 🚀`,
      text:    `Hi ${username},\n\nYour Pro subscription is active! You now have full access to AI signals, ML predictions, whale alerts, and every Pro feature.\n\nDashboard: ${dashboardLink}\nManage subscription: ${portalLink}\n\nHappy trading!`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#0a0c10;color:#e8eaf0;padding:2rem;border-radius:12px">
          <div style="display:inline-block;background:linear-gradient(135deg,#5b72ff22,#a855f722);border:1px solid rgba(99,120,220,0.4);color:#a5b4fc;border-radius:20px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.2rem .7rem;margin-bottom:.75rem">⚡ Pro Plan</div>
          <h2 style="margin:0 0 .5rem;color:#e8eaf0">You're now Pro, ${username}! 🚀</h2>
          <p style="color:#8892a4;margin:0 0 1.5rem">Your subscription is active. All Pro features are unlocked:</p>
          <ul style="color:#8892a4;padding-left:1.25rem;margin:0 0 1.5rem;line-height:1.8">
            <li>Multi-timeframe signal consensus</li>
            <li>AI Trade Engine (3-agent reasoning)</li>
            <li>ML price predictions (1h / 24h / 7d)</li>
            <li>On-chain whale alerts &amp; exchange flows</li>
            <li>Polymarket prediction odds</li>
            <li>Macro sentiment (Fed / CPI / GDP)</li>
          </ul>
          <a href="${dashboardLink}" style="display:inline-block;background:linear-gradient(135deg,#5b72ff,#a855f7);color:#fff;text-decoration:none;padding:.75rem 1.5rem;border-radius:8px;font-weight:600;margin-right:.75rem">Open Dashboard →</a>
          <a href="${portalLink}" style="display:inline-block;color:#8892a4;text-decoration:none;padding:.75rem 1rem;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:.875rem">Manage subscription</a>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:1.5rem 0">
          <p style="font-size:.75rem;color:#6b7280">TraderPro · <a href="${APP_URL}" style="color:#6b7280">${APP_URL.replace(/^https?:\/\//, '')}</a></p>
        </div>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] Failed to send Pro welcome email:', err.message);
    return { sent: false };
  }
}

module.exports = { sendPasswordReset, sendWelcome, sendProWelcome };

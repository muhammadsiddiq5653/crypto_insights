'use strict';

/**
 * billingService.js — Stripe subscription helpers.
 *
 * Requires env vars:
 *   STRIPE_SECRET_KEY          — sk_live_… or sk_test_…
 *   STRIPE_PRICE_ID_MONTHLY    — price_… for the $19/mo plan
 *   STRIPE_PRICE_ID_ANNUAL     — price_… for the $149/yr plan
 *   STRIPE_PRICE_ID_LIFETIME   — price_… for the $199 one-time plan
 *   STRIPE_WEBHOOK_SECRET      — whsec_… from the Stripe dashboard webhook
 *   APP_URL                    — public base URL for redirect URLs
 */

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Lazy Stripe client — only instantiated when the key is present
let _stripe;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  if (!_stripe) _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

const PLAN_CONFIG = {
  monthly:  { env: 'STRIPE_PRICE_ID_MONTHLY',  mode: 'subscription' },
  annual:   { env: 'STRIPE_PRICE_ID_ANNUAL',   mode: 'subscription' },
  lifetime: { env: 'STRIPE_PRICE_ID_LIFETIME', mode: 'payment' },
};

/**
 * Create a Stripe Checkout session for the chosen plan.
 * plan: 'monthly' | 'annual' | 'lifetime'  (defaults to 'annual')
 * Returns the session URL to redirect the user to.
 */
async function createCheckoutSession(user, plan = 'annual') {
  const stripe = getStripe();
  const config = PLAN_CONFIG[plan] ?? PLAN_CONFIG.annual;
  const priceId = process.env[config.env];
  if (!priceId) throw new Error(`${config.env} not set`);

  const params = {
    mode: config.mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/?upgrade=cancelled`,
    metadata: { userId: String(user.id), plan },
    allow_promotion_codes: true,
  };

  if (config.mode === 'subscription') {
    params.subscription_data = { metadata: { userId: String(user.id), plan } };
  } else {
    params.payment_intent_data = { metadata: { userId: String(user.id), plan } };
  }

  if (user.stripe_customer_id) {
    params.customer = user.stripe_customer_id;
  } else {
    params.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(params);
  return session.url;
}

/**
 * Create a Stripe Customer Portal session so the user can manage / cancel.
 */
async function createPortalSession(customerId) {
  const stripe  = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/`,
  });
  return session.url;
}

/**
 * Verify and parse a Stripe webhook event from the raw request body.
 */
function constructWebhookEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

module.exports = { createCheckoutSession, createPortalSession, constructWebhookEvent };

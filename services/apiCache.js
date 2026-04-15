'use strict';

/**
 * apiCache.js — Smart HTTP cache + retry-with-backoff
 *
 * Problems solved:
 *  1. CoinGecko, Alternative.me, Binance all enforce rate limits (429)
 *  2. Multiple front-end tabs/users firing the same requests simultaneously
 *
 * Solution:
 *  - Server-side in-memory LRU cache keyed by URL
 *  - Per-host cooldown: if a host returns 429, all requests to it wait
 *  - Exponential backoff retries (max 3 attempts)
 *  - Stale-while-revalidate: return old cache while fetching fresh data
 */

const axios = require('axios');

// ── Cache store ──────────────────────────────────────────────────────

const cache  = new Map();   // url → { data, ts, ttl }
const inflight = new Map(); // url → Promise (deduplicate concurrent requests)

// Per-host 429 backoff: host → { until: timestamp }
const hostCooldown = new Map();

const DEFAULT_TTL = {
    'api.coingecko.com':     120_000,  // 2 min — CoinGecko free tier is aggressive
    'api.binance.com':        30_000,  // 30s  — Binance is generous
    'api.alternative.me':    600_000,  // 10 min — F&G only updates hourly
    'api.bybit.com':          30_000,
    'api.kraken.com':         30_000,
    'api.coinbase.com':       60_000,
    'www.okx.com':            30_000,
    'gamma-api.polymarket.com': 300_000, // 5 min
    'default':                60_000,
};

function getTtl(url) {
    try {
        const host = new URL(url).hostname;
        return DEFAULT_TTL[host] ?? DEFAULT_TTL.default;
    } catch { return DEFAULT_TTL.default; }
}

function getHost(url) {
    try { return new URL(url).hostname; } catch { return url; }
}

// ── Core fetch with retry ────────────────────────────────────────────

async function fetchWithRetry(url, options = {}, attempt = 0) {
    const MAX_RETRIES  = options.maxRetries ?? 3;
    const TIMEOUT      = options.timeout    ?? 10_000;
    const host         = getHost(url);

    // Check host cooldown
    const cooldown = hostCooldown.get(host);
    if (cooldown && Date.now() < cooldown.until) {
        const waitMs = cooldown.until - Date.now();
        // Return stale cache if available during cooldown
        const stale = cache.get(url);
        if (stale) {
            stale._stale = true;
            return stale.data;
        }
        // Wait out the remaining cooldown
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
    }

    try {
        const resp = await axios.get(url, {
            timeout: TIMEOUT,
            headers: {
                'User-Agent': 'TraderPro/1.0 (https://traderpro.app)',
                ...(options.headers || {}),
            },
            ...(options.axiosOptions || {}),
        });
        // Clear cooldown on success
        hostCooldown.delete(host);
        return resp.data;

    } catch (err) {
        const status = err.response?.status;

        if (status === 429) {
            // Parse Retry-After header (seconds or date string)
            const retryAfter = err.response?.headers?.['retry-after'];
            let cooldownMs = 60_000; // default 60s cooldown
            if (retryAfter) {
                const parsed = parseInt(retryAfter, 10);
                cooldownMs = isNaN(parsed) ? 60_000 : parsed * 1000;
            }
            // Apply exponential backoff on top
            cooldownMs = Math.min(cooldownMs * Math.pow(2, attempt), 300_000); // max 5 min
            hostCooldown.set(host, { until: Date.now() + cooldownMs });

            console.warn(`[apiCache] 429 from ${host} — backing off ${Math.round(cooldownMs/1000)}s (attempt ${attempt+1}/${MAX_RETRIES})`);

            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, Math.min(cooldownMs, 5000)));
                return fetchWithRetry(url, options, attempt + 1);
            }
            // Out of retries — return stale cache or throw
            const stale = cache.get(url);
            if (stale) { stale._stale = true; return stale.data; }
            throw new Error(`Rate limited by ${host} after ${MAX_RETRIES} retries`);
        }

        if (status >= 500 && attempt < MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
            await new Promise(r => setTimeout(r, delay));
            return fetchWithRetry(url, options, attempt + 1);
        }

        throw err;
    }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * get(url, options?)
 *
 * Returns cached data if fresh. If stale/missing, fetches with retry.
 * Concurrent calls to the same URL are deduplicated (only 1 HTTP req).
 *
 * options:
 *   ttl         — override cache TTL in ms
 *   timeout     — HTTP timeout in ms (default 10s)
 *   maxRetries  — retry attempts on 429/5xx (default 3)
 *   force       — bypass cache, always fetch fresh
 *   fallback    — value to return if fetch fails (instead of throwing)
 *   headers     — extra request headers
 */
async function get(url, options = {}) {
    const ttl = options.ttl ?? getTtl(url);

    // Check cache
    if (!options.force) {
        const entry = cache.get(url);
        if (entry && Date.now() - entry.ts < ttl) {
            return entry.data;
        }
    }

    // Deduplicate concurrent requests
    if (inflight.has(url)) {
        return inflight.get(url);
    }

    const promise = fetchWithRetry(url, options)
        .then(data => {
            cache.set(url, { data, ts: Date.now(), ttl });
            inflight.delete(url);
            return data;
        })
        .catch(err => {
            inflight.delete(url);
            // Return stale data if available
            const stale = cache.get(url);
            if (stale) {
                console.warn(`[apiCache] Fetch failed for ${url}, returning stale data: ${err.message}`);
                return stale.data;
            }
            if (options.fallback !== undefined) return options.fallback;
            throw err;
        });

    inflight.set(url, promise);
    return promise;
}

/** Manually invalidate a cached URL */
function invalidate(url) { cache.delete(url); }

/** Clear all cache entries for a hostname */
function invalidateHost(host) {
    for (const key of cache.keys()) {
        if (key.includes(host)) cache.delete(key);
    }
}

/** Stats for admin dashboard */
function stats() {
    const entries = [...cache.entries()].map(([url, v]) => ({
        url,
        age: Math.round((Date.now() - v.ts) / 1000) + 's',
        ttl: Math.round(v.ttl / 1000) + 's',
        stale: Date.now() - v.ts > v.ttl,
    }));
    return {
        entries: entries.length,
        inflight: inflight.size,
        cooldowns: [...hostCooldown.entries()].map(([host, v]) => ({
            host,
            resumesIn: Math.max(0, Math.round((v.until - Date.now()) / 1000)) + 's',
        })),
    };
}

module.exports = { get, invalidate, invalidateHost, stats };

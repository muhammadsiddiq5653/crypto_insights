'use strict';

const https = require('https');
const db = require('./db');

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'TraderPortal/2.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ─── Tracked symbols ─────────────────────────────────────────────────────────

const TRACKED_SYMBOLS = [
  { binance: 'BTCUSDT', display: 'BTC' },
  { binance: 'ETHUSDT', display: 'ETH' },
  { binance: 'SOLUSDT', display: 'SOL' },
  { binance: 'BNBUSDT', display: 'BNB' },
  { binance: 'XRPUSDT', display: 'XRP' },
  { binance: 'ADAUSDT', display: 'ADA' },
  { binance: 'DOGEUSDT', display: 'DOGE' },
  { binance: 'AVAXUSDT', display: 'AVAX' },
  { binance: 'DOTUSDT', display: 'DOT' },
  { binance: 'MATICUSDT', display: 'MATIC' }
];

// ─── Price data collection ────────────────────────────────────────────────────

async function collectPrices() {
  try {
    const symbols = TRACKED_SYMBOLS.map(s => s.binance).join(',');
    // Binance 24hr ticker for all symbols
    const tickers = await fetchJson(`https://api.binance.com/api/v3/ticker/24hr`);

    if (!Array.isArray(tickers)) {
      console.warn('[DataCollector] Price fetch returned non-array');
      return;
    }

    const symbolSet = new Set(TRACKED_SYMBOLS.map(s => s.binance));
    let collected = 0;

    for (const ticker of tickers) {
      if (!symbolSet.has(ticker.symbol)) continue;

      const price = parseFloat(ticker.lastPrice);
      const volume24h = parseFloat(ticker.quoteVolume);
      const priceChange24h = parseFloat(ticker.priceChangePercent);
      const high24h = parseFloat(ticker.highPrice);
      const low24h = parseFloat(ticker.lowPrice);

      if (isNaN(price) || price <= 0) continue;

      db.insertPriceHistory(
        ticker.symbol,
        price,
        volume24h,
        null, // market cap not available from ticker
        priceChange24h,
        high24h,
        low24h,
        'binance'
      );
      collected++;
    }

    if (collected > 0) {
      console.log(`[DataCollector] ✓ Collected prices for ${collected} symbols`);
    }
  } catch (err) {
    console.warn(`[DataCollector] Price collection failed: ${err.message}`);
  }
}

// ─── Order book snapshots ────────────────────────────────────────────────────

async function collectOrderBookSnapshot(symbol = 'BTCUSDT') {
  try {
    const book = await fetchJson(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`);
    if (!book.bids || !book.asks) return;

    const bestBid = parseFloat(book.bids[0]?.[0] || 0);
    const bestAsk = parseFloat(book.asks[0]?.[0] || 0);
    const spread = bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0;

    // Calculate depth within 1% of mid
    const mid = (bestBid + bestAsk) / 2;
    const band = mid * 0.01;

    let bidDepth = 0, askDepth = 0;
    for (const [p, q] of book.bids) {
      if (parseFloat(p) >= mid - band) bidDepth += parseFloat(p) * parseFloat(q);
    }
    for (const [p, q] of book.asks) {
      if (parseFloat(p) <= mid + band) askDepth += parseFloat(p) * parseFloat(q);
    }

    db.insertOrderBookSnapshot(symbol, bestBid, bestAsk, bidDepth, askDepth, spread);
  } catch (err) {
    // Non-critical, skip quietly
  }
}

// ─── On-chain metrics (BTC via Blockchain.info) ────────────────────────────

async function collectOnchainMetrics() {
  try {
    const stats = await fetchJson('https://blockchain.info/stats?format=json');

    const hashRate = stats.hash_rate || null;
    const difficulty = stats.difficulty || null;

    // Get BTC price from our own DB for ratio calculations
    const btcPrice = db.getLatestPrice('BTCUSDT');
    const price = btcPrice ? btcPrice.price : null;

    // NVT proxy: market cap / daily tx volume
    const marketCap = stats.market_cap_usd || null;
    const txVolume = stats.estimated_transaction_volume_usd || null;
    const nvtRatio = (marketCap && txVolume && txVolume > 0) ? marketCap / txVolume : null;

    db.insertOnchainMetrics('BTC', {
      hashRate,
      difficulty,
      nvtRatio,
      activeAddresses: stats.n_unique_addresses || null,
      netExchangeFlow: null // requires paid API
    });

    console.log('[DataCollector] ✓ Collected on-chain metrics');
  } catch (err) {
    console.warn(`[DataCollector] On-chain collection failed: ${err.message}`);
  }
}

// ─── News collection ─────────────────────────────────────────────────────────

async function collectCryptoNews() {
  try {
    // CoinGecko trending news / trending coins as proxy
    const trending = await fetchJson('https://api.coingecko.com/api/v3/search/trending');

    if (!trending.coins) return;

    const now = Math.floor(Date.now() / 1000);
    let count = 0;

    for (const { item } of trending.coins.slice(0, 7)) {
      const title = `${item.name} (${item.symbol}) trending — Rank #${item.market_cap_rank || '?'}`;
      const url = `https://www.coingecko.com/en/coins/${item.id}`;
      const score = item.score || 0;
      // Positive sentiment for trending coins
      const sentimentScore = Math.min(1, 0.5 + (score / 20));

      db.upsertNews(
        title,
        url,
        'CoinGecko Trending',
        `${item.name} is currently trending on CoinGecko with a score of ${score}.`,
        sentimentScore,
        now
      );
      count++;
    }

    if (count > 0) console.log(`[DataCollector] ✓ Collected ${count} trending items`);
  } catch (err) {
    console.warn(`[DataCollector] News collection failed: ${err.message}`);
  }
}

// ─── Data maintenance ─────────────────────────────────────────────────────────

function runMaintenance() {
  try {
    const purged = db.purgeOldData();
    const total = Object.values(purged).reduce((a, b) => a + b, 0);
    if (total > 0) {
      console.log(`[DataCollector] ✓ Purged ${total} old records`);
    }
  } catch (err) {
    console.warn(`[DataCollector] Maintenance failed: ${err.message}`);
  }
}

// ─── Main collection cycle ───────────────────────────────────────────────────

async function runCollectionCycle() {
  console.log('[DataCollector] Starting collection cycle...');
  await collectPrices();
  await collectOrderBookSnapshot('BTCUSDT');
  // On-chain and news less frequently to avoid rate limits
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let priceTimer = null;
let onchainTimer = null;
let maintenanceTimer = null;
let running = false;

function start() {
  if (running) return;
  running = true;

  const intervalSec = parseInt(db.getSetting('data_collection_interval') || '300');
  const intervalMs = intervalSec * 1000;

  console.log(`[DataCollector] Starting — collecting every ${intervalSec}s`);

  // Run immediately on start
  runCollectionCycle();

  // Price data: every 5 min (or configured interval)
  priceTimer = setInterval(runCollectionCycle, intervalMs);

  // On-chain + news: every 30 min
  onchainTimer = setInterval(async () => {
    await collectOnchainMetrics();
    await collectCryptoNews();
  }, 30 * 60 * 1000);

  // Initial on-chain collection after 10s
  setTimeout(async () => {
    await collectOnchainMetrics();
    await collectCryptoNews();
  }, 10000);

  // Daily maintenance at midnight-ish
  maintenanceTimer = setInterval(runMaintenance, 24 * 60 * 60 * 1000);

  console.log('[DataCollector] ✓ Started');
}

function stop() {
  if (priceTimer) { clearInterval(priceTimer); priceTimer = null; }
  if (onchainTimer) { clearInterval(onchainTimer); onchainTimer = null; }
  if (maintenanceTimer) { clearInterval(maintenanceTimer); maintenanceTimer = null; }
  running = false;
  console.log('[DataCollector] Stopped');
}

function isRunning() { return running; }

module.exports = { start, stop, isRunning, collectPrices, collectOnchainMetrics, collectCryptoNews };

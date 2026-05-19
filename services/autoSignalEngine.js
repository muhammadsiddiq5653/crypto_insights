'use strict';
// Auto-Signal Engine — periodically analyses tracked symbols, broadcasts high-confidence signals via Telegram

const https = require('https');
const technicalAnalysis = require('./technicalAnalysis');
const marketDb          = require('./marketDb');
const appDb             = require('./appDb');
const notification      = require('./notificationService');

let _timer   = null;
let _running = false;
let _lastRun = null;
let _lastResults = [];

// ── Config helpers ────────────────────────────────────────────────────────────

function getAutoConfig() {
    return {
        enabled:    appDb.getSetting('auto_signal_enabled')    === 'true',
        intervalMs: parseInt(appDb.getSetting('auto_signal_interval_min') || '60', 10) * 60_000,
        minConf:    appDb.getSetting('auto_signal_min_confidence') || 'High',
        symbols:   (appDb.getSetting('auto_signal_symbols') || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT').split(',').map(s => s.trim()).filter(Boolean),
    };
}

// ── Binance kline fetch (fresh, bypasses kline cache which may be stale) ──────

function fetchKlines(symbol, interval = '1h', limit = 100) {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const req = https.get(url, { headers: { 'User-Agent': 'TraderPortal/AutoSignal' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Kline parse error: ' + e.message)); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Kline fetch timeout')); });
    });
}

// ── Confidence level ordering ─────────────────────────────────────────────────

const CONF_RANK = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };

function meetsMinConf(signalConf, minConf) {
    return (CONF_RANK[signalConf] || 0) >= (CONF_RANK[minConf] || 3);
}

function overallToDirection(overallSignal) {
    if (overallSignal === 'STRONG BUY' || overallSignal === 'BUY')   return 'BUY';
    if (overallSignal === 'STRONG SELL' || overallSignal === 'SELL') return 'SELL';
    return null;
}

function overallToConf(overallSignal) {
    if (overallSignal === 'STRONG BUY' || overallSignal === 'STRONG SELL') return 'Very High';
    if (overallSignal === 'BUY'        || overallSignal === 'SELL')        return 'High';
    return 'Low';
}

// ── Per-symbol analysis ───────────────────────────────────────────────────────

async function analyseSymbol(symbol) {
    const klines = await fetchKlines(symbol, '1h', 100);
    if (!Array.isArray(klines) || klines.length < 30) throw new Error('Insufficient kline data');

    const prices  = klines.map(k => ({ price: parseFloat(k[4]), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
    const volumes = klines.map(k => parseFloat(k[5]));
    const analysis = technicalAnalysis.analyzeData({ prices, volumes });

    const direction = overallToDirection(analysis.overall.signal);
    const conf      = overallToConf(analysis.overall.signal);
    const price     = prices[prices.length - 1].close;

    // Basic TP/SL from ATR-like estimate (simple %)
    const atr = price * 0.02; // ~2% as proxy when real ATR not computed
    const tp1 = direction === 'BUY'  ? +(price + atr * 1.5).toFixed(6) : +(price - atr * 1.5).toFixed(6);
    const sl  = direction === 'BUY'  ? +(price - atr).toFixed(6)       : +(price + atr).toFixed(6);

    return { symbol, direction, conf, price, tp1, sl, analysis };
}

// ── Main scan ─────────────────────────────────────────────────────────────────

async function runScan() {
    if (_running) return;
    _running = true;
    _lastRun = new Date().toISOString();
    _lastResults = [];

    const cfg = getAutoConfig();
    console.log(`[AutoSignal] Scanning ${cfg.symbols.length} symbol(s)…`);

    for (const symbol of cfg.symbols) {
        try {
            const result = await analyseSymbol(symbol);
            const entry = { symbol, direction: result.direction, conf: result.conf, price: result.price, ts: new Date().toISOString(), broadcast: false };
            _lastResults.push(entry);

            if (!result.direction) continue; // HOLD
            if (!meetsMinConf(result.conf, cfg.minConf)) {
                console.log(`[AutoSignal] ${symbol} ${result.direction} @ ${result.conf} — below threshold (${cfg.minConf}), skipping`);
                continue;
            }

            const signal = {
                symbol:     symbol.replace('USDT', '/USDT'),
                direction:  result.direction,
                assetType:  'Crypto',
                entry:      result.price.toFixed(6),
                tp1:        result.tp1,
                sl:         result.sl,
                confidence: result.conf,
                timeframe:  '1H',
                notes:      result.analysis.overall.recommendation,
                source:     'auto',
            };

            const text = notification.formatSignal(signal);
            await notification.broadcast(text);

            appDb.insertSignalBroadcast(signal);
            entry.broadcast = true;
            console.log(`[AutoSignal] Broadcast: ${result.direction} ${symbol} @ ${result.conf}`);

        } catch (err) {
            console.error(`[AutoSignal] ${symbol} error:`, err.message);
            _lastResults.push({ symbol, direction: null, conf: null, price: null, ts: new Date().toISOString(), error: err.message, broadcast: false });
        }
    }

    _running = false;
    console.log(`[AutoSignal] Scan complete. Broadcast: ${_lastResults.filter(r => r.broadcast).length}/${_lastResults.length}`);
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function start() {
    stop();
    const cfg = getAutoConfig();
    if (!cfg.enabled) { console.log('[AutoSignal] Disabled — not starting'); return; }
    console.log(`[AutoSignal] Starting — interval ${cfg.intervalMs / 60_000}min, min confidence: ${cfg.minConf}`);
    _timer = setInterval(runScan, cfg.intervalMs);
    setTimeout(runScan, 3_000); // quick first run
}

function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    console.log('[AutoSignal] Stopped');
}

function restart() { start(); }

function status() {
    const cfg = getAutoConfig();
    return {
        enabled:       cfg.enabled,
        intervalMin:   cfg.intervalMs / 60_000,
        minConf:       cfg.minConf,
        symbols:       cfg.symbols,
        running:       _running,
        lastRun:       _lastRun,
        lastResults:   _lastResults,
        timerActive:   !!_timer,
    };
}

module.exports = { start, stop, restart, runScan, status };

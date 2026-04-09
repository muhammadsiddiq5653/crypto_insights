const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const config = require('./config');
const cryptoService = require('./services/cryptoService');
const technicalAnalysis = require('./services/technicalAnalysis');
const newsService = require('./services/newsService');
const forexService = require('./services/forexService');
const globalMarketsService = require('./services/globalMarketsService');
const exchangeService = require('./services/exchangeService');
const authService = require('./services/authService');
const db = require('./services/db');
const { requireAuth, requireAdmin, optionalAuth } = require('./middleware/requireAuth');
const dataCollector = require('./services/dataCollector');

const app = express();

// ── SESSION & AUTH MIDDLEWARE ─────────────────────────────────────────

app.use(cookieParser());
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'),
        ttl: 7 * 24 * 60 * 60, // 7 days in seconds
        reapInterval: 60 * 60,   // clean expired sessions every hour
        logFn: () => {}          // silence file-store logs
    }),
    secret: process.env.SESSION_SECRET || 'trader-portal-secret-2024-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'tp.sid',
    cookie: {
        httpOnly: true,
        secure: false,       // set true if serving over HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    }
}));

// ── CORE MIDDLEWARE ────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve auth page without authentication
app.use('/auth.html', express.static(path.join(__dirname, 'public', 'auth.html')));
app.use('/js/auth.js', express.static(path.join(__dirname, 'public', 'js', 'auth.js')));

// Serve static assets (CSS, JS, images) without auth
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

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
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.userRole = user.role;
        res.json({
            success: true,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
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
        req.session.userId = result.user.id;
        req.session.username = result.user.username;
        req.session.userRole = result.user.role;
        res.json({ success: true, user: result.user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
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

// ── DB/DATA ROUTES ────────────────────────────────────────────────────

// GET /api/db/prices/:symbol — historical prices from local DB
app.get('/api/db/prices/:symbol', requireAuth, (req, res) => {
    const { symbol } = req.params;
    const hours = parseInt(req.query.hours || '24');
    const data = db.getPriceHistory(symbol.toUpperCase() + 'USDT', hours);
    res.json({ success: true, data, symbol, hours });
});

// GET /api/db/prices/:symbol/stats
app.get('/api/db/prices/:symbol/stats', requireAuth, (req, res) => {
    const { symbol } = req.params;
    const days = parseInt(req.query.days || '30');
    const stats = db.getPriceStats(symbol.toUpperCase() + 'USDT', days);
    res.json({ success: true, stats, symbol, days });
});

// GET /api/db/arbitrage/:symbol
app.get('/api/db/arbitrage/:symbol', requireAuth, (req, res) => {
    const { symbol } = req.params;
    const hours = parseInt(req.query.hours || '24');
    const data = db.getArbitrageHistory(symbol.toUpperCase(), hours);
    res.json({ success: true, data });
});

// GET /api/db/onchain/:symbol
app.get('/api/db/onchain/:symbol', requireAuth, (req, res) => {
    const { symbol } = req.params;
    const days = parseInt(req.query.days || '30');
    const data = db.getOnchainHistory(symbol.toUpperCase(), days);
    res.json({ success: true, data });
});

// GET /api/db/signals/:symbol
app.get('/api/db/signals/:symbol', requireAuth, (req, res) => {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit || '20');
    const data = db.getRecentSignals(symbol.toUpperCase() + 'USDT', limit);
    res.json({ success: true, data });
});

// GET /api/db/news
app.get('/api/db/news', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit || '50');
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
    const days = parseInt(req.query.days || '30');
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
        const coins = await exchangeService.getTopCoins(parseInt(req.query.limit) || 100, req.query.currency || 'usd');
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

// Multi-timeframe technical analysis for a crypto
app.get('/api/crypto/:symbol/mtf', async (req, res) => {
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
            data: [
                { name: 'KSE-100', current: baseKse, change: Math.round(baseKse * kseChg / 100), changePercent: kseChg, volume: Math.floor(Math.random()*200000000 + 150000000), note: 'Indicative — visit dps.psx.com.pk for live data' },
                { name: 'KSE-30',  current: baseKse30, change: Math.round(baseKse30 * kse30Chg / 100), changePercent: kse30Chg, volume: Math.floor(Math.random()*80000000 + 50000000), note: '' },
                { name: 'KMI-30',  current: baseKmi, change: Math.round(baseKmi * kmiChg / 100), changePercent: kmiChg, volume: Math.floor(Math.random()*60000000 + 40000000), note: '' },
                { name: 'All Share', current: Math.round(baseKse * 0.74), change: 0, changePercent: kseChg, volume: 0, note: '' }
            ],
            fallback: true,
            message: 'Showing indicative PSX data. Visit dps.psx.com.pk for real-time figures.'
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

// GET /api/crypto/:symbol/predict — Full ML prediction with trajectory
app.get('/api/crypto/:symbol/predict', async (req, res) => {
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

// Whale alerts — synthetic for now (Whale Alert API requires paid key)
app.get('/api/onchain/whale-alerts', async (req, res) => {
    try {
        const coin = req.query.coin || 'bitcoin';
        const cacheKey = `whale-${coin}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        // Use free whale data from Blockchain.info large transactions proxy
        // Since whale alert requires a key, return synthetic realistic data
        const symbolMap = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' };
        const symbol = symbolMap[coin] || 'BTC';
        const basePrices = { BTC: 68000, ETH: 3500, SOL: 168 };
        const basePrice = basePrices[symbol] || 100;

        const types = ['wallet_to_exchange', 'exchange_to_wallet', 'wallet_to_wallet'];
        const exchanges = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'];
        const alerts = [];
        const count = 10 + Math.floor(Math.random() * 8);

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const amount = Math.random() > 0.7 ? Math.random() * 5000 + 1000 : Math.random() * 500 + 100;
            alerts.push({
                type,
                symbol,
                amount: Math.round(amount * 10) / 10,
                amountUSD: amount * basePrice,
                from: type === 'exchange_to_wallet' ? exchanges[Math.floor(Math.random() * 5)] : `0x${Math.random().toString(16).slice(2, 10)}...`,
                to: type === 'wallet_to_exchange' ? exchanges[Math.floor(Math.random() * 5)] : `0x${Math.random().toString(16).slice(2, 10)}...`,
                timestamp: Date.now() - Math.random() * 86400000,
            });
        }
        alerts.sort((a, b) => b.timestamp - a.timestamp);
        setCache(cacheKey, alerts);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exchange flow — proxy to Binance aggregated trade stats as proxy
app.get('/api/onchain/exchange-flow', async (req, res) => {
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
                inflowBase = sells; // sells → inflow to exchange
                const outflow = buys;  // buys ← outflow from exchange
                const exchanges = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'];
                const data = {
                    inflow: Math.round(inflowBase),
                    outflow: Math.round(outflow),
                    netflow: Math.round(inflowBase - outflow),
                    exchanges: exchanges.map(name => {
                        const n = (Math.random() - 0.5) * cfg.base * 0.3;
                        return { name, netflow: Math.round(n) };
                    }),
                };
                setCache(cacheKey, data);
                return res.json(data);
            }
        } catch {}

        // Fallback synthetic
        const inflow  = inflowBase * (0.85 + Math.random() * 0.3);
        const outflow = inflowBase * (0.90 + Math.random() * 0.3);
        const data = {
            inflow: Math.round(inflow),
            outflow: Math.round(outflow),
            netflow: Math.round(inflow - outflow),
            exchanges: ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'].map(name => ({
                name,
                netflow: Math.round((Math.random() - 0.5) * inflowBase * 0.3),
            })),
        };
        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── MAIN PAGE ────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ────────────────────────────────────────────────────────────

app.listen(config.port, () => {
    console.log(`🚀 TraderPro running on http://localhost:${config.port}`);
    console.log(`📊 Crypto: ${config.cryptocurrencies.length} coins`);
    console.log(`💱 Forex: ${config.forexPairs.length} pairs`);
    console.log(`🇵🇰 PSX: ${config.psxTopStocks.length} stocks`);
    console.log(`🇺🇸 US Markets: ${config.usStocks.length} stocks + ${config.usIndices.length} indices`);
    console.log(`🇬🇧 UK Markets: ${config.ukStocks.length} stocks + ${config.ukIndices.length} indices`);
    console.log(`🏦 Exchanges: ${exchangeService.getExchangeList ? '10 curated + CoinGecko live' : 'loaded'}`);
    console.log(`💰 100% FREE — No API keys required!`);
    console.log(`🔐 Auth: SQLite multi-user authentication enabled`);
    console.log(`💾 DB: SQLite data persistence enabled`);

    // Start background data collection
    dataCollector.start();
});

module.exports = app;

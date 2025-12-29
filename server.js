const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const cryptoService = require('./services/cryptoService');
const technicalAnalysis = require('./services/technicalAnalysis');
const newsService = require('./services/newsService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Get list of supported cryptocurrencies
app.get('/api/cryptocurrencies', (req, res) => {
    res.json({
        success: true,
        data: config.cryptocurrencies
    });
});

// Get current prices for all cryptocurrencies
app.get('/api/crypto/prices', async (req, res) => {
    try {
        const prices = await cryptoService.getCurrentPrices();
        res.json({
            success: true,
            data: prices
        });
    } catch (error) {
        console.error('Error fetching prices:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cryptocurrency prices'
        });
    }
});

// Get detailed data for a specific cryptocurrency
app.get('/api/crypto/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c => c.symbol === symbol.toUpperCase());

        if (!crypto) {
            return res.status(404).json({
                success: false,
                error: 'Cryptocurrency not found'
            });
        }

        const data = await cryptoService.getCryptoDetails(crypto.id);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error fetching crypto details:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cryptocurrency details'
        });
    }
});

// Get historical price data for charts
app.get('/api/crypto/:symbol/history', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { days = 7 } = req.query;

        const crypto = config.cryptocurrencies.find(c => c.symbol === symbol.toUpperCase());

        if (!crypto) {
            return res.status(404).json({
                success: false,
                error: 'Cryptocurrency not found'
            });
        }

        const history = await cryptoService.getHistoricalData(crypto.id, days);
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error fetching historical data:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch historical data'
        });
    }
});

// Get technical analysis for a cryptocurrency
app.get('/api/crypto/:symbol/analysis', async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c => c.symbol === symbol.toUpperCase());

        if (!crypto) {
            return res.status(404).json({
                success: false,
                error: 'Cryptocurrency not found'
            });
        }

        // Get historical data for analysis
        const history = await cryptoService.getHistoricalData(crypto.id, 30);

        // Calculate technical indicators
        const analysis = technicalAnalysis.analyzeData(history);

        res.json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error('Error performing technical analysis:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to perform technical analysis'
        });
    }
});

// Search for cryptocurrencies
app.get('/api/search/coins', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Query must be at least 2 characters'
            });
        }

        const results = await cryptoService.searchCoins(query);
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error searching coins:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to search cryptocurrencies'
        });
    }
});

// Get futures trading data for a cryptocurrency
app.get('/api/crypto/:symbol/futures', async (req, res) => {
    try {
        const { symbol } = req.params;
        const crypto = config.cryptocurrencies.find(c => c.symbol === symbol.toUpperCase());

        if (!crypto) {
            return res.status(404).json({
                success: false,
                error: 'Cryptocurrency not found'
            });
        }

        const futuresData = await cryptoService.getFuturesData(crypto.id, symbol);
        res.json({
            success: true,
            data: futuresData
        });
    } catch (error) {
        console.error('Error fetching futures data:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch futures data'
        });
    }
});

// Get crypto news
app.get('/api/news', async (req, res) => {
    try {
        const { symbol } = req.query;
        const news = await newsService.getNews(symbol);
        res.json({
            success: true,
            data: news
        });
    } catch (error) {
        console.error('Error fetching news:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news'
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(config.port, () => {
    console.log(`🚀 Crypto Trading Portal running on http://localhost:${config.port}`);
    console.log(`📊 Tracking ${config.cryptocurrencies.length} cryptocurrencies`);
    console.log(`💰 100% FREE - No API keys required!`);
});

module.exports = app;

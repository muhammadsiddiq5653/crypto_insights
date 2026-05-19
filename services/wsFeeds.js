// Real-time price feed service using ccxws
// Subscribes to Binance ticker/trade streams and broadcasts to connected browser clients.

const ccxws = require('ccxws');

// Symbols to stream by default (base/quote pairs for ccxws)
const DEFAULT_MARKETS = [
    { id: 'BTCUSDT', base: 'BTC', quote: 'USDT' },
    { id: 'ETHUSDT', base: 'ETH', quote: 'USDT' },
    { id: 'SOLUSDT', base: 'SOL', quote: 'USDT' },
    { id: 'BNBUSDT', base: 'BNB', quote: 'USDT' },
    { id: 'XRPUSDT', base: 'XRP', quote: 'USDT' },
];

class WsFeeds {
    constructor() {
        this._clients = new Set();   // WebSocket browser connections
        this._prices  = {};          // symbol → latest price snapshot
        this._exchange = null;
        this._running  = false;
    }

    // Register a browser WebSocket connection to receive price updates
    addClient(ws) {
        this._clients.add(ws);
        // Send current snapshot immediately
        if (Object.keys(this._prices).length) {
            ws.send(JSON.stringify({ type: 'snapshot', prices: this._prices }));
        }
        ws.on('close', () => this._clients.delete(ws));
        ws.on('error', () => this._clients.delete(ws));
    }

    // Start streaming from Binance via ccxws
    start() {
        if (this._running) return;
        this._running = true;

        try {
            this._exchange = new ccxws.BinanceClient();
        } catch (err) {
            console.error('[wsFeeds] Failed to create Binance client:', err.message);
            this._running = false;
            return;
        }

        this._exchange.on('ticker', ticker => this._onTicker(ticker));
        this._exchange.on('error',  err    => console.error('[wsFeeds] ccxws error:', err.message));

        for (const market of DEFAULT_MARKETS) {
            try {
                this._exchange.subscribeTicker(market);
            } catch (err) {
                console.error(`[wsFeeds] Failed to subscribe ${market.id}:`, err.message);
            }
        }

        console.log('[wsFeeds] Real-time Binance ticker feeds started for:', DEFAULT_MARKETS.map(m => m.id).join(', '));
    }

    stop() {
        if (!this._exchange) return;
        for (const market of DEFAULT_MARKETS) {
            try { this._exchange.unsubscribeTicker(market); } catch {}
        }
        this._exchange.close();
        this._exchange = null;
        this._running  = false;
        console.log('[wsFeeds] Stopped.');
    }

    _onTicker(ticker) {
        const symbol = ticker.base + ticker.quote;
        const snap = {
            symbol,
            price:     parseFloat(ticker.last)     || 0,
            change24h: parseFloat(ticker.percentChange) || 0,
            high24h:   parseFloat(ticker.high)     || 0,
            low24h:    parseFloat(ticker.low)      || 0,
            volume24h: parseFloat(ticker.quoteVolume) || parseFloat(ticker.volume) || 0,
            ts:        Date.now(),
        };

        this._prices[symbol] = snap;
        this._broadcast({ type: 'ticker', data: snap });
    }

    _broadcast(msg) {
        if (!this._clients.size) return;
        const payload = JSON.stringify(msg);
        for (const ws of this._clients) {
            try {
                if (ws.readyState === 1 /* OPEN */) ws.send(payload);
            } catch { this._clients.delete(ws); }
        }
    }

    getLatestPrice(symbol) {
        return this._prices[symbol] || null;
    }

    getAllPrices() {
        return this._prices;
    }

    // Subscribe to additional symbols at runtime
    subscribe(base, quote) {
        const market = { id: base + quote, base, quote };
        if (this._exchange) {
            try { this._exchange.subscribeTicker(market); } catch {}
        }
    }
}

module.exports = new WsFeeds();

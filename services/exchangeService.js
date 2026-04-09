// ── EXCHANGE SERVICE ──────────────────────────────────────────────────
// CoinGecko exchange data: where to buy coins, exchange rankings,
// live prices across exchanges, trust scores, fees, regions.

const axios = require('axios');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const RATE_LIMIT_MS  = 1200; // CoinGecko free tier: ~50 req/min → 1.2s between calls

// ── In-memory caches ──────────────────────────────────────────────────
const cache = {
    exchangeList:  { data: null, expires: 0, ttl: 3600000  },  // 1 hour
    coinTickers:   {},                                           // per-coin, 5 min TTL
    exchangeInfo:  {},                                           // per-exchange, 1 hour TTL
    coinSearch:    {},                                           // search cache, 5 min TTL
    topCoins:      { data: null, expires: 0, ttl: 300000    },  // top 250 coins, 5 min
};
const TICKER_TTL  = 300000;  // 5 min
const SEARCH_TTL  = 300000;  // 5 min
const EX_INFO_TTL = 3600000; // 1 hour

let lastRequest = 0;
async function rateLimitedFetch(url, params = {}) {
    const now = Date.now();
    const wait = RATE_LIMIT_MS - (now - lastRequest);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequest = Date.now();
    const res = await axios.get(url, { params, timeout: 10000 });
    return res.data;
}

// ── CURATED EXCHANGE DATABASE ─────────────────────────────────────────
// Static data ensuring the app works even when CoinGecko is unavailable
const CURATED_EXCHANGES = [
    {
        id: 'binance', name: 'Binance', url: 'https://www.binance.com',
        image: '🟡', trustScore: 10, tradeVolume24hBtc: 580000,
        country: 'Cayman Islands', yearEstablished: 2017,
        hasTradingIncentive: false, centralized: true,
        makerFee: 0.1, takerFee: 0.1,
        supported: ['Worldwide'], requiresKYC: 'Optional (limited without)',
        features: ['Spot', 'Futures', 'Margin', 'Staking', 'P2P', 'NFT'],
        recommended: ['Low fees', 'Most coins', 'Futures trading', 'P2P for PKR'],
        pakistanFriendly: true, pakistanNote: 'P2P available for PKR ↔ USDT',
        beginnerFriendly: false,
        coins: 350, pairs: 1400
    },
    {
        id: 'coinbase', name: 'Coinbase', url: 'https://www.coinbase.com',
        image: '🔵', trustScore: 10, tradeVolume24hBtc: 120000,
        country: 'United States', yearEstablished: 2012,
        makerFee: 0.4, takerFee: 0.6,
        supported: ['US', 'UK', 'EU', 'Canada', 'Australia'],
        requiresKYC: 'Required',
        features: ['Spot', 'Staking', 'Coinbase One', 'Advanced Trade'],
        recommended: ['Beginners', 'US/UK users', 'Regulated', 'Most trusted'],
        pakistanFriendly: false, pakistanNote: 'Not available in Pakistan',
        beginnerFriendly: true,
        coins: 240, pairs: 550
    },
    {
        id: 'kraken', name: 'Kraken', url: 'https://www.kraken.com',
        image: '🟣', trustScore: 10, tradeVolume24hBtc: 85000,
        country: 'United States', yearEstablished: 2011,
        makerFee: 0.16, takerFee: 0.26,
        supported: ['US', 'UK', 'EU', 'Canada', 'Australia', 'Worldwide'],
        requiresKYC: 'Required',
        features: ['Spot', 'Futures', 'Margin', 'Staking', 'OTC'],
        recommended: ['Low fees for large trades', 'Security', 'Futures'],
        pakistanFriendly: true, pakistanNote: 'Available but wire transfer only',
        beginnerFriendly: false,
        coins: 220, pairs: 620
    },
    {
        id: 'okx', name: 'OKX', url: 'https://www.okx.com',
        image: '⚫', trustScore: 9, tradeVolume24hBtc: 210000,
        country: 'Seychelles', yearEstablished: 2017,
        makerFee: 0.08, takerFee: 0.1,
        supported: ['Worldwide (except US)'],
        requiresKYC: 'Optional (limited without)',
        features: ['Spot', 'Futures', 'Options', 'DeFi', 'NFT', 'Web3 Wallet'],
        recommended: ['Futures', 'Options', 'Web3'],
        pakistanFriendly: true, pakistanNote: 'Available in Pakistan',
        beginnerFriendly: false,
        coins: 330, pairs: 1200
    },
    {
        id: 'bybit', name: 'Bybit', url: 'https://www.bybit.com',
        image: '🟠', trustScore: 9, tradeVolume24hBtc: 195000,
        country: 'Dubai, UAE', yearEstablished: 2018,
        makerFee: 0.1, takerFee: 0.1,
        supported: ['Worldwide (except US, UK)'],
        requiresKYC: 'Optional',
        features: ['Spot', 'Futures', 'Options', 'Copy Trading', 'Earn'],
        recommended: ['Copy trading', 'Futures', 'No KYC option'],
        pakistanFriendly: true, pakistanNote: 'Popular in Pakistan — copy trading supported',
        beginnerFriendly: true,
        coins: 280, pairs: 900
    },
    {
        id: 'kucoin', name: 'KuCoin', url: 'https://www.kucoin.com',
        image: '🟢', trustScore: 8, tradeVolume24hBtc: 65000,
        country: 'Seychelles', yearEstablished: 2017,
        makerFee: 0.1, takerFee: 0.1,
        supported: ['Worldwide (except US)'],
        requiresKYC: 'Optional (higher limits with KYC)',
        features: ['Spot', 'Futures', 'Margin', 'P2P', 'Lending', 'Bot Trading'],
        recommended: ['Altcoins', 'New listings', 'No KYC', 'Bot trading'],
        pakistanFriendly: true, pakistanNote: 'P2P for PKR available',
        beginnerFriendly: true,
        coins: 700, pairs: 1400
    },
    {
        id: 'gate', name: 'Gate.io', url: 'https://www.gate.io',
        image: '🟤', trustScore: 8, tradeVolume24hBtc: 45000,
        country: 'Cayman Islands', yearEstablished: 2013,
        makerFee: 0.2, takerFee: 0.2,
        supported: ['Worldwide (except US)'],
        requiresKYC: 'Optional',
        features: ['Spot', 'Futures', 'Options', 'Startup (IEO)', 'NFT'],
        recommended: ['Most altcoins', 'Early listings', 'Research'],
        pakistanFriendly: true, pakistanNote: 'Available in Pakistan',
        beginnerFriendly: false,
        coins: 1700, pairs: 2800
    },
    {
        id: 'mexc', name: 'MEXC', url: 'https://www.mexc.com',
        image: '🔷', trustScore: 7, tradeVolume24hBtc: 38000,
        country: 'Seychelles', yearEstablished: 2018,
        makerFee: 0.0, takerFee: 0.05,
        supported: ['Worldwide (except US)'],
        requiresKYC: 'Optional',
        features: ['Spot', 'Futures', 'ETF', 'No KYC spot trading'],
        recommended: ['Zero maker fees', 'New altcoins', 'No KYC'],
        pakistanFriendly: true, pakistanNote: 'Available, no KYC for spot',
        beginnerFriendly: true,
        coins: 1500, pairs: 2200
    },
    {
        id: 'bitget', name: 'Bitget', url: 'https://www.bitget.com',
        image: '💠', trustScore: 8, tradeVolume24hBtc: 72000,
        country: 'Seychelles', yearEstablished: 2018,
        makerFee: 0.1, takerFee: 0.1,
        supported: ['Worldwide (except US)'],
        requiresKYC: 'Optional',
        features: ['Spot', 'Futures', 'Copy Trading', 'Earn'],
        recommended: ['Copy trading', 'Futures', 'Social trading'],
        pakistanFriendly: true, pakistanNote: 'Available in Pakistan',
        beginnerFriendly: true,
        coins: 250, pairs: 700
    },
    {
        id: 'htx', name: 'HTX (Huobi)', url: 'https://www.htx.com',
        image: '🌐', trustScore: 7, tradeVolume24hBtc: 52000,
        country: 'Seychelles', yearEstablished: 2013,
        makerFee: 0.2, takerFee: 0.2,
        supported: ['Worldwide (except US)'],
        requiresKYC: 'Required for full access',
        features: ['Spot', 'Futures', 'Options', 'Staking', 'OTC'],
        recommended: ['Asian markets', 'Large altcoin selection'],
        pakistanFriendly: true, pakistanNote: 'Available in Pakistan',
        beginnerFriendly: false,
        coins: 400, pairs: 900
    }
];

// ── WHICH EXCHANGES LIST A COIN (curated mappings) ────────────────────
// Maps coin symbol to the exchanges that list it
const COIN_EXCHANGE_MAP = {
    BTC:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget','htx'],
    ETH:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget','htx'],
    BNB:  ['binance','bybit','kucoin','gate','mexc','bitget','htx'],
    SOL:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    XRP:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget','htx'],
    ADA:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    DOGE: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    AVAX: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    LINK: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    MATIC:['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    DOT:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    UNI:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc'],
    ATOM: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc'],
    LTC:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    XLM:  ['binance','coinbase','kraken','okx','kucoin','gate','mexc'],
    NEAR: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc'],
    TON:  ['binance','okx','bybit','kucoin','gate','mexc','bitget'],
    TRX:  ['binance','okx','bybit','kucoin','gate','mexc','bitget','htx'],
    SHIB: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc','bitget'],
    ETC:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc'],
    XMR:  ['kraken','gate','mexc','htx'],  // delisted from many exchanges
    VET:  ['binance','okx','bybit','kucoin','gate','mexc','htx'],
    FIL:  ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc'],
    ALGO: ['binance','coinbase','kraken','okx','bybit','kucoin','gate','mexc'],
    // Fallback for unknown coins
    DEFAULT: ['binance','okx','kucoin','gate','mexc','bybit','bitget']
};

// ── USE CASE RECOMMENDATIONS ──────────────────────────────────────────
const USE_CASE_GUIDE = [
    {
        useCase: '🇵🇰 Best for Pakistan Users',
        icon: '🇵🇰',
        exchanges: ['binance', 'kucoin', 'bybit', 'okx', 'mexc'],
        reason: 'These exchanges support P2P trading with PKR or are accessible from Pakistan without VPN. Binance and KuCoin have active Pakistani user communities.'
    },
    {
        useCase: '🌱 Best for Beginners',
        icon: '🌱',
        exchanges: ['bybit', 'kucoin', 'mexc'],
        reason: 'Simple interface, copy trading features, and good mobile apps. Bybit and KuCoin are particularly popular with new traders for their clean UX.'
    },
    {
        useCase: '💱 Best for Futures & Leverage',
        icon: '📊',
        exchanges: ['binance', 'okx', 'bybit', 'bitget'],
        reason: 'Deep liquidity for perpetual contracts. Binance leads in volume; Bybit is preferred by many professional traders for its UX and copy trading.'
    },
    {
        useCase: '💰 Lowest Trading Fees',
        icon: '💰',
        exchanges: ['mexc', 'okx', 'kraken', 'bybit'],
        reason: 'MEXC has 0% maker fees. OKX charges 0.08% maker. Kraken Pro has 0.16% maker for larger accounts. Always compare taker fees too.'
    },
    {
        useCase: '🔒 Most Regulated & Trusted',
        icon: '🛡️',
        exchanges: ['coinbase', 'kraken', 'binance'],
        reason: 'Coinbase is publicly listed (NASDAQ: COIN) and US-regulated. Kraken has operated since 2011. These are recommended for large holdings.'
    },
    {
        useCase: '🪙 Most Altcoins / Early Listings',
        icon: '🔍',
        exchanges: ['gate', 'mexc', 'kucoin'],
        reason: 'Gate.io lists 1,700+ coins including very new projects. MEXC and KuCoin are also known for listing tokens early — higher risk, higher potential.'
    },
    {
        useCase: '🤝 Copy Trading',
        icon: '🤝',
        exchanges: ['bybit', 'bitget', 'kucoin'],
        reason: 'Follow professional traders automatically. Bybit and Bitget have the largest copy trading communities. Good option if you\'re learning.'
    },
    {
        useCase: '🚫 No KYC Required',
        icon: '🔐',
        exchanges: ['mexc', 'kucoin', 'okx'],
        reason: 'Trade without identity verification (within limits). MEXC allows spot trading without KYC. KYC may be needed for higher withdrawal limits.'
    }
];

// ── PUBLIC API FUNCTIONS ──────────────────────────────────────────────

// Get all curated exchanges with full data
async function getExchangeList() {
    if (cache.exchangeList.data && Date.now() < cache.exchangeList.expires) {
        return cache.exchangeList.data;
    }

    // Try to enhance with live CoinGecko data
    try {
        const liveData = await rateLimitedFetch(`${COINGECKO_BASE}/exchanges`, {
            per_page: 20, page: 1
        });
        // Merge live trust scores and volumes into curated data
        const liveMap = {};
        liveData.forEach(ex => { liveMap[ex.id] = ex; });

        const enriched = CURATED_EXCHANGES.map(ex => {
            const live = liveMap[ex.id];
            return {
                ...ex,
                tradeVolume24hBtc: live ? live.trade_volume_24h_btc_normalized || ex.tradeVolume24hBtc : ex.tradeVolume24hBtc,
                trustScore: live ? live.trust_score || ex.trustScore : ex.trustScore,
                trustScoreRank: live ? live.trust_score_rank : null
            };
        });

        cache.exchangeList.data = enriched;
        cache.exchangeList.expires = Date.now() + cache.exchangeList.ttl;
        return enriched;
    } catch (e) {
        console.log('Exchange list: using curated fallback');
        cache.exchangeList.data = CURATED_EXCHANGES;
        cache.exchangeList.expires = Date.now() + 900000; // 15 min fallback TTL
        return CURATED_EXCHANGES;
    }
}

// Get exchanges that list a specific coin (with live prices if available)
async function getCoinExchanges(symbol) {
    const upperSym = (symbol || '').toUpperCase();
    const key = `tickers_${upperSym}`;
    const cached = cache.coinTickers[key];
    if (cached && Date.now() < cached.expires) return cached.data;

    const listedOn = COIN_EXCHANGE_MAP[upperSym] || COIN_EXCHANGE_MAP.DEFAULT;
    const allExchanges = await getExchangeList();
    const relevantExchanges = allExchanges.filter(ex => listedOn.includes(ex.id));

    // Try to get live price tickers from CoinGecko
    let liveTickers = [];
    try {
        // Need coin ID — map common symbols to CoinGecko IDs
        const symToId = {
            BTC:'bitcoin', ETH:'ethereum', BNB:'binancecoin', SOL:'solana',
            XRP:'ripple', ADA:'cardano', DOGE:'dogecoin', AVAX:'avalanche-2',
            LINK:'chainlink', MATIC:'matic-network', DOT:'polkadot',
            UNI:'uniswap', ATOM:'cosmos', LTC:'litecoin', XLM:'stellar',
            NEAR:'near', TON:'toncoin', TRX:'tron', SHIB:'shiba-inu',
            ETC:'ethereum-classic', XMR:'monero', VET:'vechain',
            FIL:'filecoin', ALGO:'algorand'
        };
        const coinId = symToId[upperSym];
        if (coinId) {
            const tickerData = await rateLimitedFetch(`${COINGECKO_BASE}/coins/${coinId}/tickers`, {
                depth: false, include_exchange_logo: false, page: 1, order: 'volume_desc'
            });
            liveTickers = (tickerData.tickers || []).filter(t =>
                (t.target === 'USDT' || t.target === 'USD') && t.last > 0
            ).slice(0, 15);
        }
    } catch (e) {
        // Live tickers unavailable — fallback data used
    }

    // Merge live prices into exchange data
    const result = relevantExchanges.map(ex => {
        const ticker = liveTickers.find(t =>
            (t.market?.identifier || '').toLowerCase() === ex.id.toLowerCase()
        );
        return {
            ...ex,
            livePrice: ticker ? ticker.last : null,
            livePair: ticker ? `${upperSym}/${ticker.target}` : `${upperSym}/USDT`,
            volume24h: ticker ? ticker.volume : null,
            bidAskSpread: ticker ? (ticker.bid_ask_spread_percentage || null) : null,
            tradeUrl: ticker?.trade_url || `${ex.url}/trade/${upperSym}_USDT`,
            trustScoreDisplay: ex.trustScore
        };
    });

    cache.coinTickers[key] = { data: result, expires: Date.now() + TICKER_TTL };
    return result;
}

// Get single exchange details
async function getExchangeInfo(exchangeId) {
    const cached = cache.exchangeInfo[exchangeId];
    if (cached && Date.now() < cached.expires) return cached.data;

    const base = CURATED_EXCHANGES.find(ex => ex.id === exchangeId);
    if (!base) return null;

    let result = { ...base };

    try {
        const liveData = await rateLimitedFetch(`${COINGECKO_BASE}/exchanges/${exchangeId}`);
        result = {
            ...result,
            tradeVolume24hBtc: liveData.trade_volume_24h_btc_normalized || result.tradeVolume24hBtc,
            trustScore: liveData.trust_score || result.trustScore,
            trustScoreRank: liveData.trust_score_rank,
            description: liveData.description,
            facebookUrl: liveData.facebook_url,
            twitterHandle: liveData.twitter_handle,
            telegramUrl: liveData.telegram_url,
            slackUrl: liveData.slack_url,
            numberOfCoins: liveData.has_trading_incentive ? result.coins : liveData.number_of_coins || result.coins,
            numberOfPairs: liveData.number_of_trading_pairs || result.pairs
        };
    } catch (e) {
        // Use curated data
    }

    cache.exchangeInfo[exchangeId] = { data: result, expires: Date.now() + EX_INFO_TTL };
    return result;
}

// Search all CoinGecko coins (10,000+) by name or symbol
async function searchAllCoins(query) {
    if (!query || query.length < 2) return [];

    const key = `search_${query.toLowerCase()}`;
    const cached = cache.coinSearch[key];
    if (cached && Date.now() < cached.expires) return cached.data;

    try {
        const data = await rateLimitedFetch(`${COINGECKO_BASE}/search`, { query });
        const coins = (data.coins || []).slice(0, 50).map(c => ({
            id: c.id,
            symbol: (c.symbol || '').toUpperCase(),
            name: c.name,
            marketCapRank: c.market_cap_rank,
            thumb: c.thumb,
            large: c.large
        }));
        cache.coinSearch[key] = { data: coins, expires: Date.now() + SEARCH_TTL };
        return coins;
    } catch (e) {
        return [];
    }
}

// Get top N coins by market cap (for initial display)
async function getTopCoins(limit = 100, currency = 'usd') {
    const key = `top_${limit}`;
    const cached = cache.topCoins;
    if (cached.data && Date.now() < cached.expires) {
        return cached.data.slice(0, limit);
    }

    const perPage = Math.min(limit, 250);
    const pages = Math.ceil(limit / perPage);
    let allCoins = [];

    for (let page = 1; page <= pages; page++) {
        try {
            const batch = await rateLimitedFetch(`${COINGECKO_BASE}/coins/markets`, {
                vs_currency: currency,
                order: 'market_cap_desc',
                per_page: perPage,
                page,
                sparkline: false,
                price_change_percentage: '24h'
            });
            allCoins = allCoins.concat(batch.map(c => ({
                id: c.id,
                symbol: (c.symbol || '').toUpperCase(),
                name: c.name,
                image: c.image,
                price: c.current_price,
                marketCap: c.market_cap,
                marketCapRank: c.market_cap_rank,
                volume24h: c.total_volume,
                change24h: c.price_change_percentage_24h,
                high24h: c.high_24h,
                low24h: c.low_24h,
                circulatingSupply: c.circulating_supply
            })));
        } catch (e) {
            break;
        }
    }

    if (allCoins.length > 0) {
        cache.topCoins.data = allCoins;
        cache.topCoins.expires = Date.now() + cache.topCoins.ttl;
    }

    return allCoins.slice(0, limit);
}

// Get use case recommendations
function getUseCaseGuide() {
    return USE_CASE_GUIDE;
}

// Get exchange by ID
function getExchangeById(id) {
    return CURATED_EXCHANGES.find(ex => ex.id === id) || null;
}

module.exports = {
    getExchangeList,
    getCoinExchanges,
    getExchangeInfo,
    searchAllCoins,
    getTopCoins,
    getUseCaseGuide,
    getExchangeById,
    CURATED_EXCHANGES,
    COIN_EXCHANGE_MAP,
    USE_CASE_GUIDE
};

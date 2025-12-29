const axios = require('axios');
const config = require('../config');

// Simple in-memory cache
const cache = {
    prices: { data: null, timestamp: 0 },
    details: {},
    history: {}
};

// Track last request time for rate limiting
let lastRequestTime = 0;

// Helper function to delay requests to avoid rate limits
async function delayRequest() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const minDelay = config.requestDelay || 1000; // 1 second minimum delay

    if (timeSinceLastRequest < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }

    lastRequestTime = Date.now();
}

// Helper function to check if cache is valid
function isCacheValid(cacheEntry, ttl) {
    if (!cacheEntry.data) return false;
    const now = Date.now();
    return (now - cacheEntry.timestamp) < (ttl * 1000);
}

// Get current prices for all tracked cryptocurrencies
async function getCurrentPrices() {
    // Check cache first
    if (isCacheValid(cache.prices, config.cache.priceDataTTL)) {
        return cache.prices.data;
    }

    try {
        // Add delay to respect rate limits
        await delayRequest();

        const ids = config.cryptocurrencies.map(c => c.id).join(',');
        const response = await axios.get(`${config.apis.coingecko.baseUrl}/simple/price`, {
            params: {
                ids,
                vs_currencies: 'usd',
                include_24hr_change: true,
                include_24hr_vol: true,
                include_market_cap: true
            },
            timeout: 10000
        });

        // Transform data to include symbol
        const prices = config.cryptocurrencies.map(crypto => {
            const data = response.data[crypto.id];
            return {
                id: crypto.id,
                symbol: crypto.symbol,
                name: crypto.name,
                price: data?.usd || 0,
                change24h: data?.usd_24h_change || 0,
                volume24h: data?.usd_24h_vol || 0,
                marketCap: data?.usd_market_cap || 0
            };
        });

        // Update cache
        cache.prices = {
            data: prices,
            timestamp: Date.now()
        };

        return prices;
    } catch (error) {
        console.error('CoinGecko API error:', error.message);
        // Return cached data if available, even if expired
        if (cache.prices.data) {
            console.log('⚠️  Returning cached price data due to API error');
            return cache.prices.data;
        }
        throw error;
    }
}

// Get detailed information for a specific cryptocurrency
async function getCryptoDetails(cryptoId) {
    const cacheKey = cryptoId;

    // Check cache
    if (cache.details[cacheKey] && isCacheValid(cache.details[cacheKey], config.cache.priceDataTTL)) {
        return cache.details[cacheKey].data;
    }

    try {
        // Add delay to respect rate limits
        await delayRequest();

        const response = await axios.get(`${config.apis.coingecko.baseUrl}/coins/${cryptoId}`, {
            params: {
                localization: false,
                tickers: false,
                community_data: false,
                developer_data: false
            },
            timeout: 10000
        });

        const data = {
            id: response.data.id,
            symbol: response.data.symbol.toUpperCase(),
            name: response.data.name,
            price: response.data.market_data.current_price.usd,
            marketCap: response.data.market_data.market_cap.usd,
            volume24h: response.data.market_data.total_volume.usd,
            change24h: response.data.market_data.price_change_percentage_24h,
            change7d: response.data.market_data.price_change_percentage_7d,
            change30d: response.data.market_data.price_change_percentage_30d,
            high24h: response.data.market_data.high_24h.usd,
            low24h: response.data.market_data.low_24h.usd,
            circulatingSupply: response.data.market_data.circulating_supply,
            totalSupply: response.data.market_data.total_supply,
            ath: response.data.market_data.ath.usd,
            athDate: response.data.market_data.ath_date.usd,
            atl: response.data.market_data.atl.usd,
            atlDate: response.data.market_data.atl_date.usd
        };

        // Update cache
        cache.details[cacheKey] = {
            data,
            timestamp: Date.now()
        };

        return data;
    } catch (error) {
        console.error('Error fetching crypto details:', error.message);
        if (cache.details[cacheKey]?.data) {
            console.log(`⚠️  Returning cached details for ${cryptoId} due to API error`);
            return cache.details[cacheKey].data;
        }
        throw error;
    }
}

// Get historical price data
async function getHistoricalData(cryptoId, days = 7) {
    const cacheKey = `${cryptoId}_${days}`;

    // Check cache
    if (cache.history[cacheKey] && isCacheValid(cache.history[cacheKey], config.cache.historicalDataTTL)) {
        console.log(`✅ Using cached historical data for ${cryptoId} (${days} days)`);
        return cache.history[cacheKey].data;
    }

    try {
        // Add delay to respect rate limits
        await delayRequest();

        console.log(`📊 Fetching historical data for ${cryptoId} (${days} days)...`);
        const response = await axios.get(`${config.apis.coingecko.baseUrl}/coins/${cryptoId}/market_chart`, {
            params: {
                vs_currency: 'usd',
                days,
                interval: days <= 1 ? 'hourly' : 'daily'
            },
            timeout: 15000
        });

        // Transform data to a more usable format
        const prices = response.data.prices.map(([timestamp, price]) => ({
            timestamp,
            date: new Date(timestamp),
            price
        }));

        const volumes = response.data.total_volumes.map(([timestamp, volume]) => ({
            timestamp,
            volume
        }));

        const data = {
            prices,
            volumes,
            cryptoId,
            days
        };

        // Update cache
        cache.history[cacheKey] = {
            data,
            timestamp: Date.now()
        };

        console.log(`✅ Successfully fetched historical data for ${cryptoId}`);
        return data;
    } catch (error) {
        console.error(`❌ Error fetching historical data for ${cryptoId}:`, error.message);
        if (cache.history[cacheKey]?.data) {
            console.log(`⚠️  Returning cached historical data for ${cryptoId} (${days} days) due to API error`);
            return cache.history[cacheKey].data;
        }
        throw error;
    }
}

// Search for cryptocurrencies by name or symbol
async function searchCoins(query) {
    try {
        await delayRequest();

        const response = await axios.get(`${config.apis.coingecko.baseUrl}/search`, {
            params: { query },
            timeout: 10000
        });

        // Return top 10 results with relevant info
        const results = response.data.coins.slice(0, 10).map(coin => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            thumb: coin.thumb,
            marketCapRank: coin.market_cap_rank
        }));

        return results;
    } catch (error) {
        console.error('Error searching coins:', error.message);
        throw error;
    }
}

// Get futures trading data (funding rate, open interest, long/short ratio)
async function getFuturesData(cryptoId, symbol) {
    const cacheKey = `futures_${cryptoId}`;

    // Check cache (5 minute TTL for futures data)
    if (cache.details[cacheKey] && isCacheValid(cache.details[cacheKey], 300)) {
        return cache.details[cacheKey].data;
    }

    try {
        // Note: Binance API provides futures data for free
        await delayRequest();

        const futuresSymbol = `${symbol}USDT`;

        // Get funding rate
        let fundingRate = null;
        try {
            const fundingResponse = await axios.get(`${config.apis.binance.baseUrl}/fapi/v1/fundingRate`, {
                params: {
                    symbol: futuresSymbol,
                    limit: 1
                },
                timeout: 10000
            });

            if (fundingResponse.data && fundingResponse.data.length > 0) {
                fundingRate = {
                    rate: parseFloat(fundingResponse.data[0].fundingRate) * 100, // Convert to percentage
                    time: fundingResponse.data[0].fundingTime
                };
            }
        } catch (err) {
            console.log(`Funding rate not available for ${symbol}`);
        }

        // Get open interest
        let openInterest = null;
        try {
            const oiResponse = await axios.get(`${config.apis.binance.baseUrl}/fapi/v1/openInterest`, {
                params: { symbol: futuresSymbol },
                timeout: 10000
            });

            if (oiResponse.data) {
                openInterest = {
                    value: parseFloat(oiResponse.data.openInterest),
                    symbol: oiResponse.data.symbol
                };
            }
        } catch (err) {
            console.log(`Open interest not available for ${symbol}`);
        }

        // Get long/short ratio
        let longShortRatio = null;
        try {
            const lsResponse = await axios.get(`${config.apis.binance.baseUrl}/futures/data/globalLongShortAccountRatio`, {
                params: {
                    symbol: futuresSymbol,
                    period: '5m',
                    limit: 1
                },
                timeout: 10000
            });

            if (lsResponse.data && lsResponse.data.length > 0) {
                const ratio = parseFloat(lsResponse.data[0].longShortRatio);
                longShortRatio = {
                    ratio,
                    longAccount: parseFloat(lsResponse.data[0].longAccount),
                    shortAccount: parseFloat(lsResponse.data[0].shortAccount),
                    timestamp: lsResponse.data[0].timestamp
                };
            }
        } catch (err) {
            console.log(`Long/short ratio not available for ${symbol}`);
        }

        const data = {
            symbol,
            fundingRate,
            openInterest,
            longShortRatio,
            available: !!(fundingRate || openInterest || longShortRatio)
        };

        // Cache the data
        cache.details[cacheKey] = {
            data,
            timestamp: Date.now()
        };

        return data;
    } catch (error) {
        console.error(`Error fetching futures data for ${symbol}:`, error.message);

        // Return cached data if available
        if (cache.details[cacheKey]?.data) {
            console.log(`⚠️  Returning cached futures data for ${symbol}`);
            return cache.details[cacheKey].data;
        }

        // Return empty data structure if no cache
        return {
            symbol,
            fundingRate: null,
            openInterest: null,
            longShortRatio: null,
            available: false
        };
    }
}

module.exports = {
    getCurrentPrices,
    getCryptoDetails,
    getHistoricalData,
    searchCoins,
    getFuturesData
};

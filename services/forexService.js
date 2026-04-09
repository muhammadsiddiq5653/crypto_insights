const axios = require('axios');
const config = require('../config');

// Cache
const cache = {
    rates: { data: null, timestamp: 0 },
    fearGreed: { data: null, timestamp: 0 }
};

function isCacheValid(entry, ttl) {
    if (!entry.data) return false;
    return (Date.now() - entry.timestamp) < (ttl * 1000);
}

// ── Forex Rates ────────────────────────────────────────────────────
async function getForexRates(baseCurrency = 'USD') {
    const cacheKey = `rates_${baseCurrency}`;
    if (!cache[cacheKey]) cache[cacheKey] = { data: null, timestamp: 0 };

    if (isCacheValid(cache[cacheKey], config.cache.forexDataTTL)) {
        return cache[cacheKey].data;
    }

    try {
        // Primary: open.er-api.com (free, no key required)
        const response = await axios.get(`${config.apis.exchangeRate.baseUrl}/${baseCurrency}`, {
            timeout: 10000
        });

        const data = {
            base: baseCurrency,
            rates: response.data.rates,
            lastUpdate: response.data.time_last_update_utc || new Date().toISOString(),
            source: 'open.er-api.com'
        };

        cache[cacheKey] = { data, timestamp: Date.now() };
        return data;

    } catch (primaryError) {
        console.log('Primary forex API failed, trying Frankfurter...');

        try {
            // Fallback: frankfurter.app (free, no key)
            const response = await axios.get(`${config.apis.frankfurter.baseUrl}?from=${baseCurrency}`, {
                timeout: 10000
            });

            const data = {
                base: baseCurrency,
                rates: response.data.rates,
                lastUpdate: response.data.date,
                source: 'frankfurter.app'
            };

            cache[cacheKey] = { data, timestamp: Date.now() };
            return data;

        } catch (fallbackError) {
            console.error('Both forex APIs failed:', fallbackError.message);

            // Return cached data if available
            if (cache[cacheKey]?.data) {
                console.log('Returning stale forex cache');
                return cache[cacheKey].data;
            }

            // Last resort: hardcoded approximate rates (updated periodically)
            return {
                base: 'USD',
                rates: {
                    PKR: 278.5, EUR: 0.92, GBP: 0.79, AED: 3.67,
                    SAR: 3.75, JPY: 149.5, CNY: 7.24, CHF: 0.90,
                    AUD: 1.53, CAD: 1.36, INR: 83.1, BDT: 110.0
                },
                lastUpdate: 'Approximate rates (API unavailable)',
                source: 'fallback'
            };
        }
    }
}

// ── Get all configured Forex pairs ────────────────────────────────
async function getAllForexPairs() {
    try {
        const usdRates = await getForexRates('USD');

        const pairs = config.forexPairs.map(pair => {
            let rate;
            if (pair.base === 'USD') {
                rate = usdRates.rates[pair.quote];
            } else if (pair.quote === 'USD') {
                rate = usdRates.rates[pair.base] ? 1 / usdRates.rates[pair.base] : null;
            } else {
                // Cross rate: base/USD * USD/quote
                const baseInUsd = usdRates.rates[pair.base] ? 1 / usdRates.rates[pair.base] : null;
                const quotePerUsd = usdRates.rates[pair.quote];
                rate = (baseInUsd && quotePerUsd) ? baseInUsd * quotePerUsd : null;
            }

            return {
                symbol: `${pair.base}/${pair.quote}`,
                base: pair.base,
                quote: pair.quote,
                label: pair.label,
                flag: pair.flag,
                rate: rate ? parseFloat(rate.toFixed(4)) : null,
                lastUpdate: usdRates.lastUpdate,
                source: usdRates.source
            };
        });

        return pairs;

    } catch (error) {
        console.error('Error building forex pairs:', error.message);
        throw error;
    }
}

// ── PKR-specific rates (most useful for Pakistani users) ───────────
async function getPKRRates() {
    try {
        const usdRates = await getForexRates('USD');
        const pkrPerUsd = usdRates.rates.PKR || 278.5;

        const currencies = [
            { code: 'USD', name: 'US Dollar',       flag: '🇺🇸' },
            { code: 'EUR', name: 'Euro',             flag: '🇪🇺' },
            { code: 'GBP', name: 'British Pound',    flag: '🇬🇧' },
            { code: 'AED', name: 'UAE Dirham',       flag: '🇦🇪' },
            { code: 'SAR', name: 'Saudi Riyal',      flag: '🇸🇦' },
            { code: 'CNY', name: 'Chinese Yuan',     flag: '🇨🇳' },
            { code: 'JPY', name: 'Japanese Yen',     flag: '🇯🇵' },
            { code: 'AUD', name: 'Australian Dollar',flag: '🇦🇺' },
            { code: 'CAD', name: 'Canadian Dollar',  flag: '🇨🇦' },
            { code: 'INR', name: 'Indian Rupee',     flag: '🇮🇳' },
        ];

        return currencies.map(c => {
            const rateFromUsd = usdRates.rates[c.code];
            const pkrPerUnit = rateFromUsd ? pkrPerUsd / rateFromUsd : null;

            return {
                code: c.code,
                name: c.name,
                flag: c.flag,
                pkrRate: pkrPerUnit ? parseFloat(pkrPerUnit.toFixed(2)) : null
            };
        });

    } catch (error) {
        console.error('Error getting PKR rates:', error.message);
        throw error;
    }
}

// ── Fear & Greed Index ────────────────────────────────────────────
async function getFearGreedIndex() {
    if (isCacheValid(cache.fearGreed, config.cache.fearGreedTTL)) {
        return cache.fearGreed.data;
    }

    try {
        const response = await axios.get(config.apis.fearGreed.baseUrl, {
            timeout: 10000
        });

        const item = response.data.data[0];
        const value = parseInt(item.value);

        const data = {
            value,
            classification: item.value_classification,
            timestamp: item.timestamp,
            label: getFearGreedLabel(value)
        };

        cache.fearGreed = { data, timestamp: Date.now() };
        return data;

    } catch (error) {
        console.error('Fear & Greed API error:', error.message);

        if (cache.fearGreed.data) {
            return cache.fearGreed.data;
        }

        return { value: 50, classification: 'Neutral', label: 'Neutral', timestamp: null };
    }
}

function getFearGreedLabel(value) {
    if (value <= 20)  return 'Extreme Fear';
    if (value <= 40)  return 'Fear';
    if (value <= 60)  return 'Neutral';
    if (value <= 80)  return 'Greed';
    return 'Extreme Greed';
}

// ── Commodity prices via CoinGecko (gold BTC comparison + metals) ──
async function getCommodityPrices() {
    try {
        // Use CoinGecko to get BTC price as proxy,
        // and use Exchange Rate API for gold approximation
        // Gold price: we'll use a free metals endpoint
        const goldResponse = await axios.get('https://api.metals.live/v1/spot/gold', {
            timeout: 8000
        });

        let goldPrice = null;
        if (goldResponse.data && goldResponse.data[0]) {
            goldPrice = goldResponse.data[0].gold;
        }

        return {
            gold: goldPrice,
            silver: null,
            oil: null
        };
    } catch (error) {
        // Fallback commodity prices (approximate)
        return {
            gold: null,
            silver: null,
            oil: null,
            note: 'Commodity data temporarily unavailable'
        };
    }
}

// ── Currency conversion ────────────────────────────────────────────
async function convertCurrency(amount, fromCurrency, toCurrency) {
    try {
        const rates = await getForexRates(fromCurrency);
        const rate = rates.rates[toCurrency];

        if (!rate) {
            throw new Error(`No rate found for ${fromCurrency}/${toCurrency}`);
        }

        return {
            from: fromCurrency,
            to: toCurrency,
            amount,
            result: parseFloat((amount * rate).toFixed(6)),
            rate: parseFloat(rate.toFixed(6)),
            lastUpdate: rates.lastUpdate
        };
    } catch (error) {
        console.error('Conversion error:', error.message);
        throw error;
    }
}

module.exports = {
    getForexRates,
    getAllForexPairs,
    getPKRRates,
    getFearGreedIndex,
    getCommodityPrices,
    convertCurrency
};

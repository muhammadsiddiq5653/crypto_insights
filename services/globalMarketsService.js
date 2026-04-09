/**
 * Global Markets Service
 * Fetches US and UK stock market data from Yahoo Finance (no API key required)
 * Provides caching, rate limiting, and fallback data for resilience
 */

const axios = require('axios');

// ── STATIC DATA & CONFIGURATION ───────────────────────────────────────

const US_STOCKS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'JPM', 'V',
  'JNJ', 'WMT', 'XOM', 'MA', 'UNH', 'HD', 'PG', 'LLY', 'AVGO', 'BAC'
];

const UK_STOCKS = [
  'HSBA.L', 'BP.L', 'SHEL.L', 'AZN.L', 'ULVR.L', 'GSK.L', 'RIO.L',
  'LLOY.L', 'VOD.L', 'BT-A.L', 'BATS.L', 'DGE.L', 'CPG.L', 'PRU.L', 'NWG.L'
];

const US_INDICES = [
  '^GSPC',  // S&P 500
  '^IXIC',  // NASDAQ Composite
  '^DJI',   // Dow Jones Industrial
  '^RUT',   // Russell 2000
  '^VIX'    // VIX Fear Index
];

const UK_INDICES = [
  '^FTSE',  // FTSE 100
  '^FTMC'   // FTSE 250
];

// In-memory cache with TTL
const cache = {
  usStocks: null,
  ukStocks: null,
  indices: null,
  search: {},
  timestamps: {
    usStocks: 0,
    ukStocks: 0,
    indices: 0
  }
};

const TTL = 120000; // 2 minutes in milliseconds
const REQUEST_DELAY = 200; // 200ms delay between batch requests

// Stock metadata for mapping real names and sectors
const STOCK_METADATA = {
  'AAPL': { name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  'MSFT': { name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology' },
  'NVDA': { name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Technology' },
  'GOOGL': { name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  'AMZN': { name: 'Amazon.com Inc.', exchange: 'NASDAQ', sector: 'Consumer' },
  'META': { name: 'Meta Platforms Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  'TSLA': { name: 'Tesla Inc.', exchange: 'NASDAQ', sector: 'Automotive' },
  'BRK-B': { name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', sector: 'Financials' },
  'JPM': { name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financials' },
  'V': { name: 'Visa Inc.', exchange: 'NYSE', sector: 'Financials' },
  'JNJ': { name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare' },
  'WMT': { name: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer' },
  'XOM': { name: 'ExxonMobil Corporation', exchange: 'NYSE', sector: 'Energy' },
  'MA': { name: 'Mastercard Inc.', exchange: 'NYSE', sector: 'Financials' },
  'UNH': { name: 'UnitedHealth Group Inc.', exchange: 'NYSE', sector: 'Healthcare' },
  'HD': { name: 'Home Depot Inc.', exchange: 'NYSE', sector: 'Consumer' },
  'PG': { name: 'Procter & Gamble Co.', exchange: 'NYSE', sector: 'Consumer' },
  'LLY': { name: 'Eli Lilly and Company', exchange: 'NYSE', sector: 'Healthcare' },
  'AVGO': { name: 'Broadcom Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  'BAC': { name: 'Bank of America Corp.', exchange: 'NYSE', sector: 'Financials' },
  // UK stocks
  'HSBA.L': { name: 'HSBC Holdings plc', exchange: 'LSE', sector: 'Financials' },
  'BP.L': { name: 'BP plc', exchange: 'LSE', sector: 'Energy' },
  'SHEL.L': { name: 'Shell plc', exchange: 'LSE', sector: 'Energy' },
  'AZN.L': { name: 'AstraZeneca plc', exchange: 'LSE', sector: 'Healthcare' },
  'ULVR.L': { name: 'Unilever plc', exchange: 'LSE', sector: 'Consumer' },
  'GSK.L': { name: 'GSK plc', exchange: 'LSE', sector: 'Healthcare' },
  'RIO.L': { name: 'Rio Tinto plc', exchange: 'LSE', sector: 'Materials' },
  'LLOY.L': { name: 'Lloyds Banking Group plc', exchange: 'LSE', sector: 'Financials' },
  'VOD.L': { name: 'Vodafone Group plc', exchange: 'LSE', sector: 'Telecom' },
  'BT-A.L': { name: 'BT Group plc', exchange: 'LSE', sector: 'Telecom' },
  'BATS.L': { name: 'British American Tobacco plc', exchange: 'LSE', sector: 'Consumer' },
  'DGE.L': { name: 'Diageo plc', exchange: 'LSE', sector: 'Consumer' },
  'CPG.L': { name: 'Compass Group plc', exchange: 'LSE', sector: 'Consumer' },
  'PRU.L': { name: 'Prudential plc', exchange: 'LSE', sector: 'Financials' },
  'NWG.L': { name: 'NatWest Group plc', exchange: 'LSE', sector: 'Financials' }
};

// Fallback data for resilience
const FALLBACK_DATA = {
  US_STOCKS: {
    'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', price: 195.50, change: 1.25, changePercent: 0.64, volume: 52000000, marketCap: '2.95T', high52w: 238.00, low52w: 164.55, pe: 28.5, sector: 'Technology', flag: '🇺🇸' },
    'MSFT': { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', price: 430.25, change: 2.10, changePercent: 0.49, volume: 18000000, marketCap: '3.2T', high52w: 475.00, low52w: 323.00, pe: 34.2, sector: 'Technology', flag: '🇺🇸' },
    'NVDA': { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', price: 875.00, change: 5.50, changePercent: 0.63, volume: 32000000, marketCap: '2.15T', high52w: 975.00, low52w: 478.00, pe: 62.1, sector: 'Technology', flag: '🇺🇸' },
    'GOOGL': { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', price: 175.25, change: 0.75, changePercent: 0.43, volume: 20000000, marketCap: '1.82T', high52w: 212.00, low52w: 142.00, pe: 26.3, sector: 'Technology', flag: '🇺🇸' },
    'AMZN': { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', price: 190.30, change: 1.40, changePercent: 0.74, volume: 48000000, marketCap: '1.95T', high52w: 201.00, low52w: 143.00, pe: 52.8, sector: 'Consumer', flag: '🇺🇸' },
    'META': { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', price: 510.50, change: 2.25, changePercent: 0.44, volume: 14000000, marketCap: '1.54T', high52w: 651.00, low52w: 378.00, pe: 28.9, sector: 'Technology', flag: '🇺🇸' },
    'TSLA': { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', price: 175.00, change: -2.50, changePercent: -1.41, volume: 95000000, marketCap: '0.56T', high52w: 299.00, low52w: 138.00, pe: null, sector: 'Automotive', flag: '🇺🇸' },
    'BRK-B': { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', price: 420.50, change: 1.75, changePercent: 0.42, volume: 3000000, marketCap: '0.88T', high52w: 441.00, low52w: 370.00, pe: 15.2, sector: 'Financials', flag: '🇺🇸' },
    'JPM': { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', price: 215.75, change: 0.50, changePercent: 0.23, volume: 8000000, marketCap: '0.60T', high52w: 244.00, low52w: 147.00, pe: 12.1, sector: 'Financials', flag: '🇺🇸' },
    'V': { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', price: 275.25, change: 1.25, changePercent: 0.46, volume: 6000000, marketCap: '0.60T', high52w: 328.00, low52w: 207.00, pe: 38.5, sector: 'Financials', flag: '🇺🇸' },
    'JNJ': { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', price: 162.50, change: 0.30, changePercent: 0.19, volume: 7000000, marketCap: '0.43T', high52w: 170.00, low52w: 150.00, pe: 20.1, sector: 'Healthcare', flag: '🇺🇸' },
    'WMT': { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', price: 92.75, change: 0.40, changePercent: 0.43, volume: 7000000, marketCap: '0.24T', high52w: 101.00, low52w: 70.00, pe: 31.2, sector: 'Consumer', flag: '🇺🇸' },
    'XOM': { symbol: 'XOM', name: 'ExxonMobil Corporation', exchange: 'NYSE', price: 118.50, change: 0.60, changePercent: 0.51, volume: 8000000, marketCap: '0.45T', high52w: 145.00, low52w: 80.00, pe: 15.8, sector: 'Energy', flag: '🇺🇸' },
    'MA': { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE', price: 473.25, change: 2.10, changePercent: 0.45, volume: 2000000, marketCap: '0.48T', high52w: 547.00, low52w: 371.00, pe: 47.2, sector: 'Financials', flag: '🇺🇸' },
    'UNH': { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE', price: 520.50, change: 1.85, changePercent: 0.36, volume: 2000000, marketCap: '0.50T', high52w: 629.00, low52w: 442.00, pe: 23.5, sector: 'Healthcare', flag: '🇺🇸' },
    'HD': { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE', price: 395.25, change: 1.50, changePercent: 0.38, volume: 4000000, marketCap: '0.40T', high52w: 430.00, low52w: 278.00, pe: 21.3, sector: 'Consumer', flag: '🇺🇸' },
    'PG': { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE', price: 172.50, change: 0.70, changePercent: 0.41, volume: 5000000, marketCap: '0.42T', high52w: 189.00, low52w: 142.00, pe: 29.8, sector: 'Consumer', flag: '🇺🇸' },
    'LLY': { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE', price: 784.50, change: 3.25, changePercent: 0.41, volume: 1500000, marketCap: '0.75T', high52w: 860.00, low52w: 480.00, pe: 87.3, sector: 'Healthcare', flag: '🇺🇸' },
    'AVGO': { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ', price: 189.75, change: 0.90, changePercent: 0.48, volume: 8000000, marketCap: '0.81T', high52w: 243.00, low52w: 158.00, pe: 26.4, sector: 'Technology', flag: '🇺🇸' },
    'BAC': { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE', price: 38.50, change: 0.15, changePercent: 0.39, volume: 35000000, marketCap: '0.35T', high52w: 46.00, low52w: 27.50, pe: 11.2, sector: 'Financials', flag: '🇺🇸' }
  },
  UK_STOCKS: {
    'HSBA.L': { symbol: 'HSBA.L', name: 'HSBC Holdings plc', exchange: 'LSE', price: 7.20, change: 0.05, changePercent: 0.70, volume: 50000000, marketCap: '146B', high52w: 8.10, low52w: 5.85, pe: 9.1, sector: 'Financials', flag: '🇬🇧' },
    'BP.L': { symbol: 'BP.L', name: 'BP plc', exchange: 'LSE', price: 4.65, change: 0.08, changePercent: 1.75, volume: 80000000, marketCap: '92B', high52w: 5.75, low52w: 3.90, pe: 8.2, sector: 'Energy', flag: '🇬🇧' },
    'SHEL.L': { symbol: 'SHEL.L', name: 'Shell plc', exchange: 'LSE', price: 26.50, change: 0.35, changePercent: 1.34, volume: 25000000, marketCap: '161B', high52w: 32.00, low52w: 20.50, pe: 9.5, sector: 'Energy', flag: '🇬🇧' },
    'AZN.L': { symbol: 'AZN.L', name: 'AstraZeneca plc', exchange: 'LSE', price: 118.50, change: 0.75, changePercent: 0.64, volume: 6000000, marketCap: '385B', high52w: 146.00, low52w: 95.00, pe: 28.3, sector: 'Healthcare', flag: '🇬🇧' },
    'ULVR.L': { symbol: 'ULVR.L', name: 'Unilever plc', exchange: 'LSE', price: 44.25, change: 0.20, changePercent: 0.45, volume: 8000000, marketCap: '114B', high52w: 50.00, low52w: 39.50, pe: 19.8, sector: 'Consumer', flag: '🇬🇧' },
    'GSK.L': { symbol: 'GSK.L', name: 'GSK plc', exchange: 'LSE', price: 18.50, change: 0.10, changePercent: 0.54, volume: 15000000, marketCap: '53B', high52w: 22.00, low52w: 15.50, pe: 14.2, sector: 'Healthcare', flag: '🇬🇧' },
    'RIO.L': { symbol: 'RIO.L', name: 'Rio Tinto plc', exchange: 'LSE', price: 68.50, change: 0.45, changePercent: 0.66, volume: 10000000, marketCap: '95B', high52w: 80.00, low52w: 52.00, pe: 12.5, sector: 'Materials', flag: '🇬🇧' },
    'LLOY.L': { symbol: 'LLOY.L', name: 'Lloyds Banking Group plc', exchange: 'LSE', price: 2.45, change: 0.02, changePercent: 0.82, volume: 400000000, marketCap: '33B', high52w: 3.10, low52w: 2.02, pe: 8.1, sector: 'Financials', flag: '🇬🇧' },
    'VOD.L': { symbol: 'VOD.L', name: 'Vodafone Group plc', exchange: 'LSE', price: 4.15, change: 0.05, changePercent: 1.22, volume: 50000000, marketCap: '42B', high52w: 5.20, low52w: 3.50, pe: 10.3, sector: 'Telecom', flag: '🇬🇧' },
    'BT-A.L': { symbol: 'BT-A.L', name: 'BT Group plc', exchange: 'LSE', price: 2.10, change: 0.02, changePercent: 0.95, volume: 70000000, marketCap: '20B', high52w: 2.80, low52w: 1.85, pe: 12.5, sector: 'Telecom', flag: '🇬🇧' },
    'BATS.L': { symbol: 'BATS.L', name: 'British American Tobacco plc', exchange: 'LSE', price: 27.50, change: 0.10, changePercent: 0.36, volume: 15000000, marketCap: '127B', high52w: 32.00, low52w: 22.50, pe: 6.8, sector: 'Consumer', flag: '🇬🇧' },
    'DGE.L': { symbol: 'DGE.L', name: 'Diageo plc', exchange: 'LSE', price: 24.50, change: 0.15, changePercent: 0.62, volume: 8000000, marketCap: '65B', high52w: 29.00, low52w: 20.00, pe: 17.2, sector: 'Consumer', flag: '🇬🇧' },
    'CPG.L': { symbol: 'CPG.L', name: 'Compass Group plc', exchange: 'LSE', price: 31.75, change: 0.20, changePercent: 0.63, volume: 5000000, marketCap: '58B', high52w: 38.00, low52w: 24.50, pe: 25.1, sector: 'Consumer', flag: '🇬🇧' },
    'PRU.L': { symbol: 'PRU.L', name: 'Prudential plc', exchange: 'LSE', price: 8.05, change: 0.05, changePercent: 0.62, volume: 30000000, marketCap: '20B', high52w: 10.00, low52w: 6.50, pe: 7.9, sector: 'Financials', flag: '🇬🇧' },
    'NWG.L': { symbol: 'NWG.L', name: 'NatWest Group plc', exchange: 'LSE', price: 5.25, change: 0.03, changePercent: 0.57, volume: 50000000, marketCap: '25B', high52w: 6.85, low52w: 4.20, pe: 7.5, sector: 'Financials', flag: '🇬🇧' }
  },
  INDICES: {
    '^GSPC': { symbol: '^GSPC', name: 'S&P 500', exchange: 'US', price: 5450.00, change: 25.50, changePercent: 0.47, volume: null, marketCap: null, high52w: 6094.50, low52w: 4584.57, pe: null, sector: 'Index', flag: '🇺🇸' },
    '^IXIC': { symbol: '^IXIC', name: 'NASDAQ Composite', exchange: 'US', price: 17800.00, change: 125.00, changePercent: 0.71, volume: null, marketCap: null, high52w: 19877.38, low52w: 13410.66, pe: null, sector: 'Index', flag: '🇺🇸' },
    '^DJI': { symbol: '^DJI', name: 'Dow Jones Industrial', exchange: 'US', price: 43000.00, change: 180.00, changePercent: 0.42, volume: null, marketCap: null, high52w: 45090.14, low52w: 37755.97, pe: null, sector: 'Index', flag: '🇺🇸' },
    '^RUT': { symbol: '^RUT', name: 'Russell 2000', exchange: 'US', price: 2190.00, change: 15.00, changePercent: 0.69, volume: null, marketCap: null, high52w: 2350.72, low52w: 1796.28, pe: null, sector: 'Index', flag: '🇺🇸' },
    '^VIX': { symbol: '^VIX', name: 'VIX Fear Index', exchange: 'US', price: 15.50, change: 0.25, changePercent: 1.64, volume: null, marketCap: null, high52w: 42.94, low52w: 11.75, pe: null, sector: 'Volatility', flag: '🇺🇸' },
    '^FTSE': { symbol: '^FTSE', name: 'FTSE 100', exchange: 'UK', price: 8300.00, change: 35.00, changePercent: 0.42, volume: null, marketCap: null, high52w: 8619.00, low52w: 7489.00, pe: null, sector: 'Index', flag: '🇬🇧' },
    '^FTMC': { symbol: '^FTMC', name: 'FTSE 250', exchange: 'UK', price: 19850.00, change: 85.00, changePercent: 0.43, volume: null, marketCap: null, high52w: 21288.00, low52w: 17650.00, pe: null, sector: 'Index', flag: '🇬🇧' }
  }
};

// ── API HELPER FUNCTIONS ──────────────────────────────────────────────

/**
 * Delay execution for rate limiting
 */
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format stock data for API response
 */
function formatStockData(data) {
  const {
    symbol,
    regularMarketPrice,
    regularMarketChange,
    regularMarketChangePercent,
    regularMarketVolume,
    marketCap,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    trailingPE
  } = data;

  const metadata = STOCK_METADATA[symbol] || {};

  return {
    symbol,
    name: metadata.name || symbol,
    exchange: metadata.exchange || 'Unknown',
    price: regularMarketPrice || 0,
    change: regularMarketChange || 0,
    changePercent: regularMarketChangePercent || 0,
    volume: regularMarketVolume || 0,
    marketCap: marketCap ? formatMarketCap(marketCap) : null,
    high52w: fiftyTwoWeekHigh || null,
    low52w: fiftyTwoWeekLow || null,
    pe: trailingPE || null,
    sector: metadata.sector || 'Unknown',
    flag: metadata.exchange === 'LSE' ? '🇬🇧' : '🇺🇸'
  };
}

/**
 * Format market cap to readable format
 */
function formatMarketCap(cap) {
  if (!cap) return null;
  if (cap >= 1e12) return (cap / 1e12).toFixed(2) + 'T';
  if (cap >= 1e9) return (cap / 1e9).toFixed(2) + 'B';
  if (cap >= 1e6) return (cap / 1e6).toFixed(2) + 'M';
  return cap;
}

/**
 * Fetch stock data from Yahoo Finance
 */
async function fetchFromYahooFinance(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data.quoteSummary?.result?.[0]?.price) {
      return response.data.quoteSummary.result[0].price;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Batch fetch multiple stocks using Yahoo Finance quote endpoint
 */
async function batchFetchStocks(symbols) {
  try {
    const symbolString = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolString}`;
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data.quoteResponse?.result) {
      return response.data.quoteResponse.result;
    }
    return [];
  } catch (error) {
    console.error('Batch fetch error:', error.message);
    return [];
  }
}

// ── PUBLIC API FUNCTIONS ──────────────────────────────────────────────

/**
 * Get all US stocks
 */
async function getUSStocks() {
  const now = Date.now();

  // Return cached data if available and not expired
  if (cache.usStocks && (now - cache.timestamps.usStocks) < TTL) {
    return cache.usStocks;
  }

  try {
    console.log('📈 Fetching US stocks from Yahoo Finance...');
    const results = await batchFetchStocks(US_STOCKS);

    if (results && results.length > 0) {
      const stocks = results.map(formatStockData);
      cache.usStocks = stocks;
      cache.timestamps.usStocks = now;
      console.log(`✅ Fetched ${stocks.length} US stocks`);
      return stocks;
    }
  } catch (error) {
    console.error('Error fetching US stocks:', error.message);
  }

  // Fall back to static data
  console.log('📊 Using fallback US stock data');
  const fallbackStocks = Object.values(FALLBACK_DATA.US_STOCKS);
  cache.usStocks = fallbackStocks;
  cache.timestamps.usStocks = now;
  return fallbackStocks;
}

/**
 * Get all UK stocks
 */
async function getUKStocks() {
  const now = Date.now();

  if (cache.ukStocks && (now - cache.timestamps.ukStocks) < TTL) {
    return cache.ukStocks;
  }

  try {
    console.log('📈 Fetching UK stocks from Yahoo Finance...');
    const results = await batchFetchStocks(UK_STOCKS);

    if (results && results.length > 0) {
      const stocks = results.map(formatStockData);
      cache.ukStocks = stocks;
      cache.timestamps.ukStocks = now;
      console.log(`✅ Fetched ${stocks.length} UK stocks`);
      return stocks;
    }
  } catch (error) {
    console.error('Error fetching UK stocks:', error.message);
  }

  console.log('📊 Using fallback UK stock data');
  const fallbackStocks = Object.values(FALLBACK_DATA.UK_STOCKS);
  cache.ukStocks = fallbackStocks;
  cache.timestamps.ukStocks = now;
  return fallbackStocks;
}

/**
 * Get global indices (S&P 500, NASDAQ, FTSE, etc.)
 */
async function getGlobalIndices() {
  const now = Date.now();

  if (cache.indices && (now - cache.timestamps.indices) < TTL) {
    return cache.indices;
  }

  try {
    console.log('📊 Fetching global indices from Yahoo Finance...');
    const allIndices = [...US_INDICES, ...UK_INDICES];
    const results = await batchFetchStocks(allIndices);

    if (results && results.length > 0) {
      const indices = results.map(formatStockData);
      cache.indices = indices;
      cache.timestamps.indices = now;
      console.log(`✅ Fetched ${indices.length} indices`);
      return indices;
    }
  } catch (error) {
    console.error('Error fetching indices:', error.message);
  }

  console.log('📊 Using fallback indices data');
  const fallbackIndices = Object.values(FALLBACK_DATA.INDICES);
  cache.indices = fallbackIndices;
  cache.timestamps.indices = now;
  return fallbackIndices;
}

/**
 * Search for stocks globally
 */
async function searchGlobalStocks(query) {
  if (!query || query.length < 1) {
    return [];
  }

  const normalizedQuery = query.toUpperCase();
  const cacheKey = normalizedQuery;

  // Check if result is cached
  if (cache.search[cacheKey]) {
    return cache.search[cacheKey];
  }

  try {
    console.log(`🔍 Searching for "${query}"`);
    const url = `https://query1.finance.yahoo.com/v6/finance/autocomplete?query=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data.quotes) {
      const results = response.data.quotes
        .filter(item => item.symbol && item.longname)
        .slice(0, 10)
        .map(item => ({
          symbol: item.symbol,
          name: item.longname,
          exchange: item.exchDisp || 'Unknown',
          type: item.typeDisp || 'Equity'
        }));

      cache.search[cacheKey] = results;
      return results;
    }
  } catch (error) {
    console.error('Search error:', error.message);
  }

  return [];
}

/**
 * Get detailed stock information with technical data
 */
async function getStockDetails(symbol) {
  try {
    // First check fallback data
    const fallbackUS = FALLBACK_DATA.US_STOCKS[symbol];
    const fallbackUK = FALLBACK_DATA.UK_STOCKS[symbol];
    const fallback = fallbackUS || fallbackUK;

    const results = await batchFetchStocks([symbol]);
    if (results && results.length > 0) {
      return formatStockData(results[0]);
    }

    // Return fallback if available
    if (fallback) {
      return fallback;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching details for ${symbol}:`, error.message);
    return null;
  }
}

// ── EXPORTS ───────────────────────────────────────────────────────────

module.exports = {
  getUSStocks,
  getUKStocks,
  getGlobalIndices,
  searchGlobalStocks,
  getStockDetails,
  // Export constants for config
  US_STOCKS,
  UK_STOCKS,
  US_INDICES,
  UK_INDICES
};

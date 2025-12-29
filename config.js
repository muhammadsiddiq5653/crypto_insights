// Configuration for the Crypto Trading Portal
// All services are 100% FREE - no API keys required!

module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,

  // Data refresh intervals (in milliseconds)
  priceUpdateInterval: 30000, // 30 seconds
  newsUpdateInterval: 300000, // 5 minutes

  // Cryptocurrencies to track (top 20 by market cap)
  cryptocurrencies: [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'binancecoin', symbol: 'BNB', name: 'Binance Coin' },
    { id: 'ripple', symbol: 'XRP', name: 'Ripple' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
    { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
    { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
    { id: 'monero', symbol: 'XMR', name: 'Monero' },
    { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
    { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
    { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
    { id: 'vechain', symbol: 'VET', name: 'VeChain' },
    { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' }
  ],

  // Free API endpoints (no keys required!)
  apis: {
    coingecko: {
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: 50 // calls per minute on free tier
    },
    binance: {
      baseUrl: 'https://api.binance.com/api/v3',
      rateLimit: 1200 // calls per minute
    }
  },

  // Free news RSS feeds
  newsFeeds: [
    'https://cointelegraph.com/rss',
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://news.bitcoin.com/feed/'
  ],

  // Technical analysis parameters
  technicalAnalysis: {
    rsi: {
      period: 14,
      overbought: 70,
      oversold: 30
    },
    macd: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    },
    movingAverages: {
      short: 20,
      medium: 50,
      long: 200
    },
    bollingerBands: {
      period: 20,
      standardDeviations: 2
    }
  },

  // Cache settings
  cache: {
    priceDataTTL: 60, // seconds (increased from 30)
    newsDataTTL: 600, // seconds (increased from 300)
    historicalDataTTL: 7200 // seconds (increased from 3600)
  },

  // Rate limiting
  requestDelay: 500 // milliseconds between API requests
};

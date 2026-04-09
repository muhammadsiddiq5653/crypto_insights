// TraderPro Configuration
// Multi-asset trading portal: Crypto, PSX, Forex, Stocks
// 100% FREE — no paid API keys required

module.exports = {
  port: process.env.PORT || 3000,

  priceUpdateInterval: 30000,  // 30 seconds
  newsUpdateInterval: 300000,  // 5 minutes

  // ── CRYPTOCURRENCIES ──────────────────────────────────────────────
  cryptocurrencies: [
    { id: 'bitcoin',          symbol: 'BTC',  name: 'Bitcoin' },
    { id: 'ethereum',         symbol: 'ETH',  name: 'Ethereum' },
    { id: 'binancecoin',      symbol: 'BNB',  name: 'Binance Coin' },
    { id: 'ripple',           symbol: 'XRP',  name: 'Ripple' },
    { id: 'cardano',          symbol: 'ADA',  name: 'Cardano' },
    { id: 'solana',           symbol: 'SOL',  name: 'Solana' },
    { id: 'dogecoin',         symbol: 'DOGE', name: 'Dogecoin' },
    { id: 'polkadot',         symbol: 'DOT',  name: 'Polkadot' },
    { id: 'matic-network',    symbol: 'MATIC',name: 'Polygon' },
    { id: 'litecoin',         symbol: 'LTC',  name: 'Litecoin' },
    { id: 'avalanche-2',      symbol: 'AVAX', name: 'Avalanche' },
    { id: 'chainlink',        symbol: 'LINK', name: 'Chainlink' },
    { id: 'uniswap',          symbol: 'UNI',  name: 'Uniswap' },
    { id: 'stellar',          symbol: 'XLM',  name: 'Stellar' },
    { id: 'monero',           symbol: 'XMR',  name: 'Monero' },
    { id: 'ethereum-classic', symbol: 'ETC',  name: 'Ethereum Classic' },
    { id: 'cosmos',           symbol: 'ATOM', name: 'Cosmos' },
    { id: 'algorand',         symbol: 'ALGO', name: 'Algorand' },
    { id: 'vechain',          symbol: 'VET',  name: 'VeChain' },
    { id: 'filecoin',         symbol: 'FIL',  name: 'Filecoin' },
    { id: 'tron',             symbol: 'TRX',  name: 'TRON' },
    { id: 'shiba-inu',        symbol: 'SHIB', name: 'Shiba Inu' },
    { id: 'toncoin',          symbol: 'TON',  name: 'Toncoin' },
    { id: 'near',             symbol: 'NEAR', name: 'NEAR Protocol' }
  ],

  // ── PSX TOP STOCKS (reference data, static + live index) ─────────
  psxTopStocks: [
    { symbol: 'ENGRO',  name: 'Engro Corporation',     sector: 'Conglomerate' },
    { symbol: 'HBL',    name: 'Habib Bank Ltd',         sector: 'Banking' },
    { symbol: 'MCB',    name: 'MCB Bank Ltd',           sector: 'Banking' },
    { symbol: 'UBL',    name: 'United Bank Ltd',        sector: 'Banking' },
    { symbol: 'ABL',    name: 'Allied Bank Ltd',        sector: 'Banking' },
    { symbol: 'LUCK',   name: 'Lucky Cement',           sector: 'Cement' },
    { symbol: 'DGKC',   name: 'DG Khan Cement',         sector: 'Cement' },
    { symbol: 'PSO',    name: 'Pakistan State Oil',      sector: 'Oil & Gas' },
    { symbol: 'OGDC',   name: 'Oil & Gas Dev Co',        sector: 'Oil & Gas' },
    { symbol: 'PPL',    name: 'Pakistan Petroleum Ltd',  sector: 'Oil & Gas' },
    { symbol: 'FFC',    name: 'Fauji Fertilizer Co',     sector: 'Fertilizer' },
    { symbol: 'EFERT',  name: 'Engro Fertilizers',       sector: 'Fertilizer' },
    { symbol: 'HUBC',   name: 'Hub Power Company',       sector: 'Power' },
    { symbol: 'SYS',    name: 'Systems Limited',         sector: 'Technology' },
    { symbol: 'TRG',    name: 'TRG Pakistan',            sector: 'Technology' },
    { symbol: 'NETSOL', name: 'NetSol Technologies',     sector: 'Technology' },
    { symbol: 'NML',    name: 'Nishat Mills Ltd',         sector: 'Textile' },
    { symbol: 'SEARL',  name: 'Searle Pakistan',          sector: 'Pharma' }
  ],

  // ── PSX SECTORS ───────────────────────────────────────────────────
  psxSectors: [
    { name: 'Banking',      icon: '🏦', description: 'Commercial & Islamic banks' },
    { name: 'Oil & Gas',    icon: '⛽', description: 'E&P, refining, OMCs' },
    { name: 'Cement',       icon: '🏗️', description: 'Construction materials' },
    { name: 'Fertilizer',   icon: '🌾', description: 'Urea & DAP producers' },
    { name: 'Technology',   icon: '💻', description: 'IT & software exports' },
    { name: 'Power',        icon: '⚡', description: 'IPPs & utilities' },
    { name: 'Textile',      icon: '🧵', description: 'Garments & exports' },
    { name: 'Pharma',       icon: '💊', description: 'Pharmaceuticals' },
    { name: 'Auto',         icon: '🚗', description: 'Automobile assemblers' },
    { name: 'Steel',        icon: '🔩', description: 'Steel & metal products' }
  ],

  // ── US STOCKS (Top 20 NASDAQ/NYSE) ────────────────────────────────
  usStocks: [
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'JPM', 'V',
    'JNJ', 'WMT', 'XOM', 'MA', 'UNH', 'HD', 'PG', 'LLY', 'AVGO', 'BAC'
  ],

  // ── UK STOCKS (FTSE 100) ──────────────────────────────────────────
  ukStocks: [
    'HSBA.L', 'BP.L', 'SHEL.L', 'AZN.L', 'ULVR.L', 'GSK.L', 'RIO.L',
    'LLOY.L', 'VOD.L', 'BT-A.L', 'BATS.L', 'DGE.L', 'CPG.L', 'PRU.L', 'NWG.L'
  ],

  // ── US INDICES ────────────────────────────────────────────────────
  usIndices: [
    { symbol: '^GSPC', name: 'S&P 500', description: 'Large-cap index' },
    { symbol: '^IXIC', name: 'NASDAQ Composite', description: 'Tech-heavy index' },
    { symbol: '^DJI', name: 'Dow Jones Industrial', description: '30 blue-chip stocks' },
    { symbol: '^RUT', name: 'Russell 2000', description: 'Small-cap index' },
    { symbol: '^VIX', name: 'VIX Fear Index', description: 'Market volatility' }
  ],

  // ── UK INDICES ────────────────────────────────────────────────────
  ukIndices: [
    { symbol: '^FTSE', name: 'FTSE 100', description: 'Large-cap UK index' },
    { symbol: '^FTMC', name: 'FTSE 250', description: 'Mid-cap UK index' }
  ],

  // ── FOREX PAIRS ───────────────────────────────────────────────────
  forexPairs: [
    // PKR pairs (most relevant for Pakistani users)
    { base: 'USD', quote: 'PKR', label: 'US Dollar',      flag: '🇺🇸' },
    { base: 'EUR', quote: 'PKR', label: 'Euro',            flag: '🇪🇺' },
    { base: 'GBP', quote: 'PKR', label: 'British Pound',   flag: '🇬🇧' },
    { base: 'AED', quote: 'PKR', label: 'UAE Dirham',      flag: '🇦🇪' },
    { base: 'SAR', quote: 'PKR', label: 'Saudi Riyal',     flag: '🇸🇦' },
    { base: 'CNY', quote: 'PKR', label: 'Chinese Yuan',    flag: '🇨🇳' },
    // Major pairs
    { base: 'EUR', quote: 'USD', label: 'Euro/Dollar',     flag: '🇪🇺' },
    { base: 'GBP', quote: 'USD', label: 'Pound/Dollar',    flag: '🇬🇧' },
    { base: 'USD', quote: 'JPY', label: 'Dollar/Yen',      flag: '🇯🇵' },
    { base: 'USD', quote: 'CHF', label: 'Dollar/Franc',    flag: '🇨🇭' },
    { base: 'AUD', quote: 'USD', label: 'Aussie/Dollar',   flag: '🇦🇺' },
    { base: 'USD', quote: 'CAD', label: 'Dollar/CAD',      flag: '🇨🇦' },
  ],

  // ── FREE APIs ─────────────────────────────────────────────────────
  apis: {
    coingecko: {
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: 50
    },
    binance: {
      baseUrl: 'https://api.binance.com',
      rateLimit: 1200
    },
    // Free forex API — no key required
    exchangeRate: {
      baseUrl: 'https://open.er-api.com/v6/latest',
    },
    // Alternative free forex
    frankfurter: {
      baseUrl: 'https://api.frankfurter.app/latest'
    },
    // Fear & Greed Index — completely free
    fearGreed: {
      baseUrl: 'https://api.alternative.me/fng/?limit=1'
    },
    // PSX index data via unofficial JSON endpoint
    psx: {
      baseUrl: 'https://dps.psx.com.pk',
    }
  },

  // ── NEWS RSS FEEDS ────────────────────────────────────────────────
  newsFeeds: [
    { url: 'https://cointelegraph.com/rss',                     category: 'crypto'    },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',   category: 'crypto'    },
    { url: 'https://news.bitcoin.com/feed/',                     category: 'crypto'    },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw-marketpulse', category: 'business' },
    { url: 'https://www.business-recorder.com/feed/all',        category: 'pakistan'  },
  ],

  // ── TECHNICAL ANALYSIS PARAMS ─────────────────────────────────────
  technicalAnalysis: {
    rsi:            { period: 14, overbought: 70, oversold: 30 },
    macd:           { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    movingAverages: { short: 20, medium: 50, long: 200 },
    bollingerBands: { period: 20, standardDeviations: 2 }
  },

  // ── CACHE SETTINGS ────────────────────────────────────────────────
  cache: {
    priceDataTTL:      60,    // seconds
    newsDataTTL:       600,   // seconds
    historicalDataTTL: 7200,  // seconds
    forexDataTTL:      300,   // seconds
    fearGreedTTL:      3600,  // seconds (updates once/day anyway)
  },

  requestDelay: 500
};

// Trading Glossary — comprehensive A–Z reference

const GLOSSARY_TERMS = [
    { term: 'All-Time High (ATH)', def: 'The highest price an asset has ever traded at in its history.' },
    { term: 'All-Time Low (ATL)', def: 'The lowest price an asset has ever traded at in its history.' },
    { term: 'Altcoin', def: 'Any cryptocurrency other than Bitcoin. Ethereum, Solana, XRP are all altcoins.' },
    { term: 'Arbitrage', def: 'Buying an asset on one exchange and simultaneously selling it on another where the price is higher, profiting from the price difference.' },
    { term: 'Ask Price', def: 'The lowest price a seller is willing to accept for an asset. Also called the "offer."' },
    { term: 'Bearish', def: 'A negative outlook on a market or asset, expecting prices to fall.' },
    { term: 'Bear Market', def: 'A prolonged period of falling prices, typically defined as a 20%+ decline from recent highs.' },
    { term: 'Bid Price', def: 'The highest price a buyer is willing to pay for an asset.' },
    { term: 'Blockchain', def: 'A distributed digital ledger that records transactions across many computers. The technology underlying Bitcoin and other cryptocurrencies.' },
    { term: 'Bollinger Bands', def: 'A technical indicator consisting of a moving average and two standard deviation bands above and below it. Used to identify overbought/oversold conditions and volatility.' },
    { term: 'Breakout', def: 'When price moves above a resistance level or below a support level with increased volume, signalling a potential new trend.' },
    { term: 'Broker', def: 'An intermediary who executes trades on behalf of investors in exchange for a commission or spread.' },
    { term: 'Bull Market', def: 'A prolonged period of rising prices, typically defined as a 20%+ rise from recent lows.' },
    { term: 'Bullish', def: 'A positive outlook on a market or asset, expecting prices to rise.' },
    { term: 'Candlestick', def: 'A chart type showing open, high, low, and close prices for a specific time period. Green (bullish) candles close higher than they open; red (bearish) candles close lower.' },
    { term: 'Capital', def: 'The total money available for trading or investing.' },
    { term: 'CDC (Central Depository Company)', def: 'The entity in Pakistan that holds securities (shares) electronically on behalf of investors. You need a CDC account to trade on the PSX.' },
    { term: 'Circuit Breaker', def: 'A mechanism that halts trading when prices move too far too fast. On PSX, trading halts if the KSE-100 drops 5% intraday. Individual stocks have a ±7.5% daily limit.' },
    { term: 'Correction', def: 'A temporary decline of 10–20% from a recent high. Normal part of any bull market.' },
    { term: 'Cryptocurrency', def: 'A digital or virtual currency that uses cryptography for security and operates on a decentralized network (blockchain).' },
    { term: 'Day Trading', def: 'Buying and selling assets within the same trading day, closing all positions before the market closes.' },
    { term: 'Dead Cat Bounce', def: 'A temporary, short-lived recovery in a declining asset before it continues to fall.' },
    { term: 'Death Cross', def: 'When the 50-day moving average crosses below the 200-day moving average — considered a major bearish signal.' },
    { term: 'Decentralized Finance (DeFi)', def: 'Financial services (lending, trading, earning interest) built on blockchain smart contracts without traditional intermediaries.' },
    { term: 'Derivatives', def: 'Financial instruments whose value is derived from an underlying asset. Futures and options are common derivatives.' },
    { term: 'Diversification', def: 'Spreading investments across different assets, sectors, or markets to reduce risk.' },
    { term: 'Dividend', def: 'A portion of a company\'s profits paid to shareholders, usually quarterly or annually. PSX blue-chip stocks often pay attractive dividends.' },
    { term: 'Doji', def: 'A candlestick where opening and closing prices are nearly equal, forming a cross shape. Signals market indecision.' },
    { term: 'Dollar-Cost Averaging (DCA)', def: 'Investing a fixed amount at regular intervals (weekly/monthly) regardless of price. Reduces the impact of volatility over time.' },
    { term: 'Drawdown', def: 'The percentage decline from a portfolio\'s peak value to its lowest point before recovering.' },
    { term: 'Engulfing Pattern', def: 'A two-candle reversal pattern. A bullish engulfing (large green candle after a red candle) signals potential upward reversal.' },
    { term: 'Exchange', def: 'A marketplace where assets are bought and sold. PSX is Pakistan\'s stock exchange; Binance is a major crypto exchange.' },
    { term: 'Exchange Rate', def: 'The price at which one currency can be exchanged for another. USD/PKR = 278 means 1 USD buys 278 Pakistani Rupees.' },
    { term: 'Fear & Greed Index', def: 'A sentiment indicator (0–100) measuring whether crypto investors are fearful (selling) or greedy (buying). Extreme fear can be a buying opportunity.' },
    { term: 'Fibonacci Retracement', def: 'A technical tool using horizontal lines at key Fibonacci ratios (23.6%, 38.2%, 61.8%) to identify potential support and resistance levels.' },
    { term: 'Fiat Currency', def: 'Government-issued currency not backed by a commodity like gold. USD, PKR, EUR are fiat currencies.' },
    { term: 'FOMO (Fear of Missing Out)', def: 'The anxiety of missing out on a profitable trade, often leading to impulsive buying at market tops.' },
    { term: 'Forex (Foreign Exchange)', def: 'The global market for trading currencies. The world\'s largest financial market, with over $7 trillion traded daily.' },
    { term: 'Futures Contract', def: 'An agreement to buy or sell an asset at a predetermined price at a specific future date. Used for hedging or speculation.' },
    { term: 'FUD (Fear, Uncertainty, Doubt)', def: 'Negative news or sentiment spread to drive down the price of an asset. Often used to describe misleading bearish narratives.' },
    { term: 'Fundamental Analysis', def: 'Evaluating an asset\'s intrinsic value based on financial data, company performance, economic conditions, and industry factors.' },
    { term: 'Gap', def: 'When a price opens significantly higher or lower than the previous close, creating a "gap" in the chart with no trading activity.' },
    { term: 'Golden Cross', def: 'When the 50-day moving average crosses above the 200-day moving average — considered a major bullish signal.' },
    { term: 'Hammer', def: 'A bullish reversal candlestick pattern with a small body and a long lower wick, appearing after a downtrend.' },
    { term: 'Hard Fork', def: 'A permanent change to a blockchain protocol that makes previously invalid transactions valid. Creates a new version of the blockchain.' },
    { term: 'Halving', def: 'A Bitcoin event (every ~4 years) where the block reward for miners is cut in half, reducing the rate of new Bitcoin creation. Historically preceded major bull runs.' },
    { term: 'Hedge', def: 'An investment made to reduce the risk of adverse price movements in another asset.' },
    { term: 'HODL', def: 'Crypto slang for holding an asset long-term regardless of short-term price movements. Originated from a misspelled "hold."' },
    { term: 'Inflation', def: 'The rate at which the general level of prices rises, reducing purchasing power. Pakistan has experienced significant inflation in recent years.' },
    { term: 'IPO (Initial Public Offering)', def: 'When a private company first offers shares to the public on a stock exchange. Also called "listing" on the PSX.' },
    { term: 'KSE-100', def: 'The benchmark index of the Pakistan Stock Exchange, comprising the top 100 companies by market capitalization.' },
    { term: 'Leverage', def: 'Borrowing capital from a broker to increase position size. 10x leverage means $100 controls $1,000. Amplifies both gains and losses equally.' },
    { term: 'Limit Order', def: 'An order to buy or sell an asset only at a specified price or better. Does not guarantee execution.' },
    { term: 'Liquidity', def: 'How easily an asset can be bought or sold without significantly affecting its price. Bitcoin is highly liquid; obscure altcoins are not.' },
    { term: 'Long Position', def: 'Buying an asset expecting its price to rise. "Going long" on Bitcoin means you own Bitcoin and profit if it goes up.' },
    { term: 'MACD', def: 'Moving Average Convergence Divergence. A trend-following momentum indicator showing the relationship between two exponential moving averages.' },
    { term: 'Margin', def: 'The amount of capital required to open and maintain a leveraged position. A margin call occurs when your account falls below the required margin.' },
    { term: 'Market Cap', def: 'Total market value of an asset. For stocks: share price × shares outstanding. For crypto: coin price × circulating supply.' },
    { term: 'Market Order', def: 'An order to buy or sell immediately at the current best available price. Guarantees execution but not a specific price.' },
    { term: 'Moving Average (MA)', def: 'The average price of an asset over a specific number of periods. Smooths out price data to identify trends. Common periods: 20, 50, 200 days.' },
    { term: 'NFT (Non-Fungible Token)', def: 'A unique digital asset on a blockchain representing ownership of a specific item (art, music, etc.). Unlike Bitcoin, each NFT is unique and not interchangeable.' },
    { term: 'Open Interest', def: 'In futures markets, the total number of outstanding contracts that have not been settled. Rising open interest with rising prices confirms a strong uptrend.' },
    { term: 'Order Book', def: 'A real-time list of all buy (bid) and sell (ask) orders for an asset on an exchange, showing supply and demand at each price level.' },
    { term: 'Overbought', def: 'When an asset\'s price has risen too far, too fast — suggesting a potential pullback. RSI above 70 is typically considered overbought.' },
    { term: 'Oversold', def: 'When an asset\'s price has fallen too far, too fast — suggesting a potential bounce. RSI below 30 is typically considered oversold.' },
    { term: 'P/E Ratio (Price-to-Earnings)', def: 'A stock\'s price divided by its earnings per share. Indicates how much investors pay per unit of earnings. A P/E of 10 means you pay 10x annual earnings.' },
    { term: 'P2P (Peer-to-Peer)', def: 'Direct transactions between users without a central intermediary. Binance P2P lets Pakistanis buy/sell crypto directly using PKR bank transfers.' },
    { term: 'Paper Trading', def: 'Simulated trading with virtual money to practice strategies without real financial risk. Most brokers offer demo accounts.' },
    { term: 'Pip', def: 'The smallest price increment in forex. For EUR/USD, a pip is 0.0001. Used to measure profit/loss in currency trading.' },
    { term: 'Portfolio', def: 'The collection of all investments held by an individual or entity.' },
    { term: 'Position Size', def: 'The amount of capital allocated to a single trade. Calculated based on account size, risk tolerance, and stop-loss distance.' },
    { term: 'PSX', def: 'Pakistan Stock Exchange. Formed in 2016 by merging KSE, LSE, and ISE. The KSE-100 is its benchmark index.' },
    { term: 'Pump & Dump', def: 'A market manipulation scheme where bad actors artificially inflate an asset\'s price (pump) then sell their holdings (dump), leaving late buyers with losses.' },
    { term: 'Resistance Level', def: 'A price level where selling pressure is strong enough to prevent the price from rising further. Acts as a ceiling.' },
    { term: 'Return on Investment (ROI)', def: 'Profit or loss on an investment expressed as a percentage of cost. ROI = (Current Value - Cost) / Cost × 100.' },
    { term: 'Risk/Reward Ratio', def: 'The ratio of potential loss to potential gain on a trade. A 1:3 ratio means risking $100 to potentially make $300.' },
    { term: 'RSI (Relative Strength Index)', def: 'A momentum oscillator (0–100) measuring the speed and magnitude of price changes. Above 70 = overbought, below 30 = oversold.' },
    { term: 'Scalping', def: 'A trading strategy involving many quick trades to capture tiny price movements, often holding for seconds to minutes.' },
    { term: 'SECP', def: 'Securities and Exchange Commission of Pakistan. The regulatory body overseeing capital markets, including the PSX.' },
    { term: 'Short Position', def: 'Selling a borrowed asset expecting its price to fall. Profit if the price drops; lose if it rises. Also called "shorting" or "going short."' },
    { term: 'Slippage', def: 'The difference between the expected price of a trade and the actual execution price, often occurring in low-liquidity or fast-moving markets.' },
    { term: 'Smart Contract', def: 'Self-executing code on a blockchain that automatically enforces the terms of an agreement when conditions are met. Core to DeFi and NFTs.' },
    { term: 'Spot Trading', def: 'Buying and selling assets for immediate delivery at current market prices. You own the actual asset. Safer than margin or futures trading.' },
    { term: 'Spread', def: 'The difference between bid and ask price. Represents the broker\'s profit. Tighter spreads = lower trading costs.' },
    { term: 'Stablecoin', def: 'A cryptocurrency pegged to a stable asset like USD. USDT and USDC are always worth ~$1. Used as a safe haven in crypto volatility.' },
    { term: 'Stop Loss', def: 'An automatic order to sell an asset if it falls to a specified price, limiting your maximum loss on a trade.' },
    { term: 'Support Level', def: 'A price level where buying interest is strong enough to prevent further decline. Acts as a floor.' },
    { term: 'Swing Trading', def: 'Holding positions for days to weeks to capture medium-term price moves.' },
    { term: 'T+2 Settlement', def: 'Transactions on the PSX settle 2 business days after the trade date. You receive shares/cash on day T+2.' },
    { term: 'Take Profit', def: 'An automatic order to close a position when it reaches a specified profit target.' },
    { term: 'Technical Analysis', def: 'Analyzing price charts and indicators to forecast future price movements, based on the idea that history tends to repeat.' },
    { term: 'Ticker Symbol', def: 'A short abbreviation identifying a security on an exchange. BTC for Bitcoin, HBL for Habib Bank, EUR/USD for Euro/Dollar.' },
    { term: 'Tokenomics', def: 'The economics of a cryptocurrency token — total supply, distribution, inflation rate, and utility. Key for evaluating altcoin projects.' },
    { term: 'Trend', def: 'The general direction of a market over time. Uptrend = higher highs and higher lows. Downtrend = lower highs and lower lows.' },
    { term: 'Uptrend', def: 'A sustained increase in price, characterized by a series of higher highs and higher lows.' },
    { term: 'Volatility', def: 'The degree of variation in an asset\'s price over time. High volatility = bigger price swings. Crypto is far more volatile than stocks.' },
    { term: 'Volume', def: 'The number of units traded in a given period. High volume confirms price moves as genuine; low volume moves may be unreliable.' },
    { term: 'Wallet', def: 'Software or hardware that stores cryptocurrency private keys. Custodial wallets (exchanges) vs non-custodial wallets (Ledger, MetaMask).' },
    { term: 'Whale', def: 'An individual or entity that holds a large amount of a cryptocurrency, capable of moving markets with their trades.' },
    { term: 'Yield', def: 'Income generated from an investment, typically expressed as a percentage annually. Stock dividends, DeFi staking, and bond coupons are all yields.' },
];

function renderGlossary(filter = '') {
    const container = document.getElementById('glossaryContent');
    if (!container) return;

    const terms = filter
        ? GLOSSARY_TERMS.filter(t =>
            t.term.toLowerCase().includes(filter.toLowerCase()) ||
            t.def.toLowerCase().includes(filter.toLowerCase()))
        : GLOSSARY_TERMS;

    if (terms.length === 0) {
        container.innerHTML = `<div class="empty-state">No terms found for "${escapeHtml(filter)}"</div>`;
        return;
    }

    container.innerHTML = terms.map(t => `
        <div class="glossary-item">
            <div class="glossary-term">${escapeHtml(t.term)}</div>
            <div class="glossary-def">${escapeHtml(t.def)}</div>
        </div>
    `).join('');
}

function initGlossary() {
    renderGlossary();

    const searchEl = document.getElementById('glossarySearch');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            renderGlossary(e.target.value);
        });
    }
}

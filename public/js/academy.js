// ── TRADING ACADEMY ───────────────────────────────────────────────────
// Complete Beginner-to-Intermediate curriculum.
// Structured as tracks → modules → lessons.
// Rendered dynamically so the HTML stays clean.

const ACADEMY_CURRICULUM = {

    basics: {
        title: '📘 Trading Basics',
        icon: '📘',
        desc: 'Start here. No experience needed.',
        modules: [
            {
                title: 'Module 1: What is Trading?',
                lessons: [
                    {
                        num: 1,
                        title: 'Trading vs Investing — What\'s the Difference?',
                        badge: 'Beginner',
                        duration: '5 min',
                        content: `
<p><strong>Trading</strong> means buying and selling financial assets — stocks, crypto, forex, commodities — over short periods to profit from price movements. <strong>Investing</strong> means holding assets for months or years, betting on long-term growth.</p>
<table class="lesson-table"><tr><th></th><th>Trading</th><th>Investing</th></tr>
<tr><td>Timeframe</td><td>Minutes to months</td><td>Years to decades</td></tr>
<tr><td>Goal</td><td>Short-term profit from price swings</td><td>Long-term wealth building</td></tr>
<tr><td>Risk</td><td>Higher (active decisions)</td><td>Lower (passive, diversified)</td></tr>
<tr><td>Time required</td><td>Daily attention</td><td>Occasional review</td></tr>
<tr><td>Example</td><td>Buy BTC at $60k, sell at $65k</td><td>Buy Apple stock, hold 10 years</td></tr>
</table>
<div class="lesson-tip">💡 <strong>For Beginners:</strong> Start with investing basics before trading. Most beginners lose money trading because they skip education and risk management.</div>`
                    },
                    {
                        num: 2,
                        title: 'Financial Markets — Stocks, Crypto, Forex, Commodities',
                        badge: 'Beginner',
                        duration: '7 min',
                        content: `
<p>There are four main markets you can trade:</p>
<div class="market-cards-lesson">
<div class="mcl-card"><div class="mcl-icon">📈</div><h4>Stock Market</h4><p>Buy shares of companies. PSX (Pakistan), NYSE/NASDAQ (US), LSE (UK). Companies grow → stock price rises. You earn dividends + capital gains.</p></div>
<div class="mcl-card"><div class="mcl-icon">₿</div><h4>Crypto Market</h4><p>Bitcoin, Ethereum, and 20,000+ digital currencies. Traded 24/7, 365 days. Highly volatile — can move 10-20% in a single day.</p></div>
<div class="mcl-card"><div class="mcl-icon">💱</div><h4>Forex Market</h4><p>Trading currency pairs like USD/PKR, EUR/USD. Largest market in the world — $7 trillion traded daily. You profit from exchange rate movements.</p></div>
<div class="mcl-card"><div class="mcl-icon">🥇</div><h4>Commodities</h4><p>Gold, Silver, Oil, Natural Gas. Used as inflation hedges. Gold rises in uncertainty; oil follows supply/demand from OPEC.</p></div>
</div>
<div class="lesson-tip">💡 <strong>Which is right for you?</strong> Pakistanis often start with PSX stocks (local, familiar) or crypto (accessible 24/7). Forex needs more capital and experience.</div>`
                    },
                    {
                        num: 3,
                        title: 'How Prices Move — Supply, Demand & Market Forces',
                        badge: 'Beginner',
                        duration: '6 min',
                        content: `
<p>Price is determined by one simple principle: <strong>Supply vs Demand</strong>.</p>
<ul><li>More buyers than sellers → price goes <strong class="positive">UP</strong></li><li>More sellers than buyers → price goes <strong class="negative">DOWN</strong></li><li>Equal buyers/sellers → price stays <strong>flat</strong></li></ul>
<h4>What moves prices?</h4>
<div class="lesson-grid-2">
<div><strong>📢 News & Events</strong><p>Earnings reports, interest rate decisions, political events, regulatory changes. Example: SBP cuts rates → PSX stocks rise. SEC approves Bitcoin ETF → BTC price spikes.</p></div>
<div><strong>😱 Sentiment & Emotion</strong><p>Fear causes selling (crash). Greed causes buying (bubble). The Fear & Greed Index measures this. Buy when others are fearful, sell when greedy (Warren Buffett's advice).</p></div>
<div><strong>📊 Technical Levels</strong><p>Support and resistance zones where buyers/sellers concentrate. When price breaks these levels, it often moves sharply in that direction.</p></div>
<div><strong>🐳 Whales & Institutions</strong><p>Large players (hedge funds, banks, crypto whales) move prices with big orders. Watching volume spikes can reveal their activity.</p></div>
</div>`
                    },
                    {
                        num: 4,
                        title: 'Bull Market vs Bear Market — And How to Profit from Both',
                        badge: 'Beginner',
                        duration: '5 min',
                        content: `
<div class="lesson-comparison">
<div class="lc-bull"><h3>🐂 Bull Market</h3><p>Prices rising 20%+ from recent lows. Economy growing, sentiment positive, everyone making money. 2020-2021 was a massive crypto bull market. S&P 500 is in a long-term bull market.</p><p><strong>Strategy:</strong> Buy and hold. Buy dips. Take profits at resistance levels.</p></div>
<div class="lc-bear"><h3>🐻 Bear Market</h3><p>Prices falling 20%+ from recent highs. Recession fears, negative news, panic selling. 2022 crypto bear market wiped 75% off Bitcoin. 2008 financial crisis was a severe stock bear market.</p><p><strong>Strategy:</strong> Cash is king. Short selling. DCA (buy regularly at lower prices).</p></div>
</div>
<div class="lesson-tip">💡 <strong>Reality Check:</strong> Most beginners try to buy the top and panic-sell the bottom. The best traders buy during fear (bear markets) and sell during greed (bull market peaks).</div>`
                    }
                ]
            },
            {
                title: 'Module 2: How to Start Trading',
                lessons: [
                    {
                        num: 5,
                        title: 'Choosing a Broker — What to Look For',
                        badge: 'Beginner',
                        duration: '8 min',
                        content: `
<p>A broker is the platform you use to buy and sell. Here's what matters:</p>
<table class="lesson-table"><tr><th>Factor</th><th>What to Check</th></tr>
<tr><td>Regulation</td><td>Is it licensed? PSX brokers must be SECP-registered. Crypto exchanges: Binance, Coinbase are legitimate.</td></tr>
<tr><td>Fees</td><td>Commission per trade, spreads, withdrawal fees. PSX brokerage: 0.1-0.2%. Crypto: 0.1% spot on Binance.</td></tr>
<tr><td>Minimum deposit</td><td>Some start at $10 (Binance). PSX needs CDC account (takes 1-2 weeks).</td></tr>
<tr><td>Tools</td><td>Charts, news, screeners. This portal gives you all those for free!</td></tr>
<tr><td>Security</td><td>2FA, withdrawal whitelist, cold storage for crypto.</td></tr>
</table>
<h4>Recommended for Pakistanis</h4>
<div class="lesson-grid-2">
<div><strong>PSX Stocks:</strong> Arif Habib Limited, Next Capital, KASB, JS Global. Open a CDC account first.</div>
<div><strong>Crypto:</strong> Binance.com (most liquid), Bybit. Withdraw to local bank via P2P.</div>
<div><strong>Forex:</strong> IC Markets, XM, Pepperstone (accept Pakistani clients).</div>
<div><strong>US Stocks:</strong> Interactive Brokers (best for international), Stake (user-friendly).</div>
</div>`
                    },
                    {
                        num: 6,
                        title: 'Your First Trade — Step by Step',
                        badge: 'Beginner',
                        duration: '10 min',
                        content: `
<h4>Step-by-Step: Buying Bitcoin on Binance</h4>
<ol class="lesson-steps"><li><strong>Create account</strong> — Sign up at Binance.com. Verify with CNIC (KYC).</li><li><strong>Deposit funds</strong> — Use P2P trading to buy USDT with PKR via bank transfer.</li><li><strong>Navigate to Spot Trading</strong> — Go to Trade → Spot. Search BTC/USDT.</li><li><strong>Decide amount</strong> — Never invest more than you can afford to lose. Start with 1-2% of savings.</li><li><strong>Place order</strong> — Use "Market" order for instant execution, or "Limit" order to buy at a specific price.</li><li><strong>Set Stop Loss</strong> — Immediately after buying, set a stop-loss 5-10% below your entry price. This limits losses.</li><li><strong>Track your trade</strong> — Use this portal's Technical Analysis → enter BTC to see signals.</li></ol>
<div class="lesson-tip">🎮 <strong>Practice First!</strong> Use the Paper Trading section on this portal. Trade with virtual $10,000 until you're consistently profitable before using real money.</div>`
                    }
                ]
            }
        ]
    },

    technical: {
        title: '📊 Technical Analysis',
        icon: '📊',
        desc: 'Read charts like a pro.',
        modules: [
            {
                title: 'Module 1: Candlestick Charts',
                lessons: [
                    {
                        num: 1,
                        title: 'How to Read a Candlestick Chart',
                        badge: 'Beginner',
                        duration: '8 min',
                        content: `
<p>Candlestick charts show price movement for any time period — 1 minute, 1 hour, 1 day.</p>
<div class="candle-diagram"><div class="candle-green-demo"><span class="candle-label">Green (Bullish)</span><div class="candle-body-green"></div></div><div class="candle-red-demo"><span class="candle-label">Red (Bearish)</span><div class="candle-body-red"></div></div></div>
<p>Each candle has 4 prices: <strong>Open, High, Low, Close</strong> (OHLC).</p>
<table class="lesson-table"><tr><th>Part</th><th>What it Shows</th></tr>
<tr><td>Body (thick part)</td><td>Range between open and close price</td></tr>
<tr><td>Upper wick (shadow)</td><td>Highest price reached in that period</td></tr>
<tr><td>Lower wick</td><td>Lowest price reached in that period</td></tr>
<tr><td>Green/White candle</td><td>Close > Open = price went UP in this period</td></tr>
<tr><td>Red/Black candle</td><td>Close < Open = price went DOWN in this period</td></tr>
</table>
<div class="lesson-tip">💡 Open the Technical Analysis section, select BTC, and look at the TradingView chart. Toggle between 1D, 1W timeframes and identify candles.</div>`
                    },
                    {
                        num: 2,
                        title: 'Key Candlestick Patterns — Entry & Exit Signals',
                        badge: 'Intermediate',
                        duration: '10 min',
                        content: `
<p>Certain candle shapes reliably predict reversals or continuations:</p>
<div class="pattern-grid">
<div class="pattern-card bullish"><div class="pat-name">Hammer 🔨</div><div class="pat-signal">Bullish Reversal</div><div class="pat-desc">Long lower wick, small body at top. After a downtrend = potential reversal UP. Price rejected lower prices.</div></div>
<div class="pattern-card bearish"><div class="pat-name">Shooting Star ⭐</div><div class="pat-signal">Bearish Reversal</div><div class="pat-desc">Long upper wick, small body at bottom. After an uptrend = buyers pushed price up but sellers took over.</div></div>
<div class="pattern-card bullish"><div class="pat-name">Bullish Engulfing</div><div class="pat-signal">Strong Bullish</div><div class="pat-desc">Large green candle completely covers previous red candle. Strong momentum shift to buyers.</div></div>
<div class="pattern-card bearish"><div class="pat-name">Bearish Engulfing</div><div class="pat-signal">Strong Bearish</div><div class="pat-desc">Large red candle completely covers previous green candle. Sellers have taken over.</div></div>
<div class="pattern-card neutral"><div class="pat-name">Doji ✚</div><div class="pat-signal">Indecision</div><div class="pat-desc">Open and close at same level. Neither buyers nor sellers in control. Watch for breakout direction.</div></div>
<div class="pattern-card bullish"><div class="pat-name">Morning Star</div><div class="pat-signal">Bullish Reversal</div><div class="pat-desc">3-candle pattern: red candle, small doji, large green candle. High-confidence reversal from downtrend.</div></div>
</div>`
                    }
                ]
            },
            {
                title: 'Module 2: Support & Resistance',
                lessons: [
                    {
                        num: 3,
                        title: 'Support & Resistance — The Foundation of All Trading',
                        badge: 'Beginner',
                        duration: '8 min',
                        content: `
<p><strong>Support</strong> is a price level where buying pressure is strong enough to prevent the price from falling further. <strong>Resistance</strong> is where selling pressure stops price from rising.</p>
<div class="sr-visual"><div class="sr-resistance">RESISTANCE ← Sellers dominate here</div><div class="sr-middle">↕️ Price oscillates between levels</div><div class="sr-support">SUPPORT ← Buyers step in here</div></div>
<h4>How to Trade Support & Resistance</h4>
<ul>
<li><strong>Buy at Support:</strong> Price tests support level → buy with SL just below support. TP at next resistance.</li>
<li><strong>Sell at Resistance:</strong> Price tests resistance → sell/short with SL just above resistance.</li>
<li><strong>Breakout Trade:</strong> Price breaks through resistance with high volume → buy the breakout, as the old resistance becomes new support.</li>
</ul>
<div class="lesson-tip">💡 On this portal: open Technical Analysis, select any coin, and look at the TradingView chart. Draw horizontal lines at obvious price levels where the price has bounced multiple times.</div>`
                    }
                ]
            },
            {
                title: 'Module 3: Technical Indicators',
                lessons: [
                    {
                        num: 4,
                        title: 'RSI — Relative Strength Index Explained',
                        badge: 'Intermediate',
                        duration: '10 min',
                        content: `
<p>RSI measures the speed and magnitude of price movements on a scale of 0-100.</p>
<div class="indicator-visual rsi-visual"><div class="ind-zone overbought">70-100: OVERBOUGHT (Consider selling)</div><div class="ind-zone neutral-zone">30-70: NEUTRAL</div><div class="ind-zone oversold">0-30: OVERSOLD (Consider buying)</div></div>
<table class="lesson-table"><tr><th>RSI Level</th><th>Signal</th><th>Meaning</th></tr>
<tr><td class="negative">RSI > 70</td><td>Overbought</td><td>Asset may be overvalued, consider taking profits or avoiding new longs</td></tr>
<tr><td class="positive">RSI < 30</td><td>Oversold</td><td>Asset may be undervalued, potential buying opportunity</td></tr>
<tr><td>RSI 40-60</td><td>Neutral</td><td>No clear signal, watch other indicators</td></tr>
<tr><td>RSI declining from above 70</td><td>Bearish divergence</td><td>Strong sell signal when RSI drops below 70</td></tr>
</table>
<div class="lesson-tip">🔍 <strong>Use Now:</strong> Go to Crypto Screener on this portal. Select "RSI Oversold (<30)" preset to find coins that may be at buying opportunities.</div>`
                    },
                    {
                        num: 5,
                        title: 'MACD — Trend Direction & Momentum',
                        badge: 'Intermediate',
                        duration: '8 min',
                        content: `
<p>MACD (Moving Average Convergence Divergence) shows when trend momentum is shifting. It consists of:</p>
<ul>
<li><strong>MACD Line:</strong> 12-period EMA minus 26-period EMA</li>
<li><strong>Signal Line:</strong> 9-period EMA of the MACD line</li>
<li><strong>Histogram:</strong> Difference between MACD and Signal line</li>
</ul>
<div class="lesson-grid-2">
<div class="signal-example bullish-eg"><h4 class="positive">🟢 Bullish Signal</h4><p>MACD line crosses <strong>above</strong> signal line. Momentum shifting upward. Good potential entry for long positions.</p></div>
<div class="signal-example bearish-eg"><h4 class="negative">🔴 Bearish Signal</h4><p>MACD line crosses <strong>below</strong> signal line. Momentum shifting downward. Potential sell or short signal.</p></div>
</div>
<div class="lesson-tip">💡 MACD works best on daily and weekly charts. On 1-minute charts it generates too many false signals. Use it alongside RSI and Support/Resistance for confirmation.</div>`
                    },
                    {
                        num: 6,
                        title: 'Bollinger Bands — Volatility & Price Extremes',
                        badge: 'Intermediate',
                        duration: '7 min',
                        content: `
<p>Bollinger Bands consist of 3 lines: a moving average (middle) and two standard deviation bands (upper and lower).</p>
<table class="lesson-table"><tr><th>Signal</th><th>Meaning</th><th>Action</th></tr>
<tr><td class="positive">Price touches/breaks LOWER band</td><td>Oversold, high volatility lower extreme</td><td>Potential buy. Confirm with RSI below 30.</td></tr>
<tr><td class="negative">Price touches/breaks UPPER band</td><td>Overbought, high volatility upper extreme</td><td>Potential sell. Confirm with RSI above 70.</td></tr>
<tr><td>Bands squeezing (narrowing)</td><td>Low volatility = big move coming</td><td>Watch for breakout direction</td></tr>
<tr><td>Bands expanding (widening)</td><td>Increasing volatility</td><td>Trend is strong, ride it carefully</td></tr>
</table>
<div class="lesson-tip">💡 On this portal, the Technical Analysis section automatically shows Bollinger Band position for every coin. "BELOW_LOWER" = oversold signal.</div>`
                    },
                    {
                        num: 7,
                        title: 'Moving Averages (SMA & EMA) — Trend Following',
                        badge: 'Intermediate',
                        duration: '8 min',
                        content: `
<p>Moving averages smooth price data to show the trend direction clearly.</p>
<ul>
<li><strong>SMA (Simple Moving Average):</strong> Equal weight to all periods. Slower to react.</li>
<li><strong>EMA (Exponential Moving Average):</strong> More weight to recent prices. Faster to react.</li>
</ul>
<h4>Key Levels</h4>
<table class="lesson-table"><tr><th>MA</th><th>Use</th></tr>
<tr><td>20 EMA</td><td>Short-term trend. Crypto traders use this for entries.</td></tr>
<tr><td>50 SMA</td><td>Medium-term trend. Major support/resistance level.</td></tr>
<tr><td>200 SMA</td><td>Long-term trend. THE most watched level by institutions.</td></tr>
</table>
<h4>Golden Cross & Death Cross</h4>
<div class="lesson-grid-2">
<div class="signal-example bullish-eg"><h4 class="positive">🌟 Golden Cross</h4><p>50 SMA crosses above 200 SMA. Historically a strong bullish signal for stocks and crypto. Often marks the start of a bull run.</p></div>
<div class="signal-example bearish-eg"><h4 class="negative">💀 Death Cross</h4><p>50 SMA crosses below 200 SMA. A bear market warning signal. Often marks the start of extended downtrends.</p></div>
</div>`
                    }
                ]
            }
        ]
    },

    risk: {
        title: '🛡️ Risk Management',
        icon: '🛡️',
        desc: 'How professionals protect capital.',
        modules: [
            {
                title: 'The Most Important Subject in Trading',
                lessons: [
                    {
                        num: 1,
                        title: 'The #1 Rule: Protect Your Capital First',
                        badge: 'Critical',
                        duration: '8 min',
                        content: `
<div class="lesson-important">⚠️ Most traders lose money not because they can't identify opportunities, but because they don't manage risk. Risk management is the difference between pro traders and amateurs.</div>
<h4>The 1-2% Rule</h4>
<p>Never risk more than 1-2% of your total trading capital on a single trade.</p>
<div class="risk-example"><p>Example: You have ₨100,000 in your account.</p><ul><li>Maximum risk per trade = ₨1,000-2,000 (1-2%)</li><li>If you lose 10 trades in a row, you've only lost 10-20% — recoverable.</li><li>If you risk 20% per trade, 5 losing trades = bankrupt.</li></ul></div>
<h4>Why This Works</h4>
<p>Even the best traders lose 40-50% of their trades. If your wins are bigger than your losses (good R:R ratio), you're profitable overall.</p>
<div class="lesson-tip">🧮 Use the Risk Calculator on this portal (Tools → Risk Calculator) to calculate exact position size for any trade.</div>`
                    },
                    {
                        num: 2,
                        title: 'Stop Loss — Your Trade\'s Safety Net',
                        badge: 'Critical',
                        duration: '7 min',
                        content: `
<p>A <strong>Stop Loss</strong> is an automatic order that closes your position at a predetermined price to limit losses.</p>
<h4>Where to Place Stop Loss</h4>
<ul>
<li><strong>Below Support:</strong> For long trades, place SL just below the nearest support level</li>
<li><strong>Above Resistance:</strong> For short trades, place SL just above the nearest resistance level</li>
<li><strong>ATR-based:</strong> Place SL 1-2× ATR (Average True Range) away from entry — adapts to volatility</li>
<li><strong>Percentage:</strong> Simple: 3-7% below entry for stocks, 5-10% for crypto (more volatile)</li>
</ul>
<div class="lesson-important">❌ <strong>Never move your stop loss further away</strong> when the trade goes against you. This is the biggest mistake beginners make. Accept the loss and move on.</div>
<div class="lesson-tip">💡 This portal's Technical Analysis generates Stop Loss levels automatically using Bollinger Bands. See the Trade Signal card when you select any coin.</div>`
                    },
                    {
                        num: 3,
                        title: 'Risk:Reward Ratio — Only Take Good Trades',
                        badge: 'Intermediate',
                        duration: '8 min',
                        content: `
<p>Risk:Reward (R:R) ratio compares how much you could lose vs how much you could gain on a trade.</p>
<div class="rr-visual"><div class="rr-risk">Risk: -₨1,000</div><div class="rr-arrow">→</div><div class="rr-reward">Reward: +₨2,000 to +₨3,000</div><div class="rr-label">1:2 to 1:3 R:R</div></div>
<table class="lesson-table"><tr><th>R:R Ratio</th><th>Win Rate Needed to Break Even</th><th>Assessment</th></tr>
<tr><td>1:1</td><td>50%</td><td>Barely acceptable</td></tr>
<tr><td>1:2</td><td>33%</td><td class="positive">Good — even losing 60% of trades you're profitable</td></tr>
<tr><td>1:3</td><td>25%</td><td class="positive">Excellent — professional standard</td></tr>
<tr><td>Less than 1:1</td><td>Over 50%</td><td class="negative">Bad — avoid this trade</td></tr>
</table>
<div class="lesson-tip">📓 Track your R:R in the Trade Journal. The journal automatically calculates your average R:R over all trades.</div>`
                    },
                    {
                        num: 4,
                        title: 'Position Sizing — How Much to Buy',
                        badge: 'Intermediate',
                        duration: '7 min',
                        content: `
<p>Position sizing determines exactly how many units/shares/coins to buy based on your risk tolerance.</p>
<h4>The Formula</h4>
<div class="formula-box"><code>Position Size = (Account × Risk%) ÷ (Entry Price − Stop Loss Price)</code></div>
<div class="lesson-example"><strong>Example:</strong><br>Account: ₨500,000 | Risk per trade: 1% = ₨5,000<br>BTC Entry: ₨8,500,000 | Stop Loss: ₨8,000,000 | Risk per BTC = ₨500,000<br>Position Size = ₨5,000 ÷ ₨500,000 = 0.01 BTC</div>
<div class="lesson-tip">🧮 Use the Risk Calculator on this portal. Enter your account size, entry price, and stop loss price — it calculates position size instantly.</div>`
                    }
                ]
            }
        ]
    },

    crypto: {
        title: '₿ Crypto Trading',
        icon: '₿',
        desc: 'Bitcoin, Ethereum, DeFi & more.',
        modules: [
            {
                title: 'Module 1: Crypto Fundamentals',
                lessons: [
                    {
                        num: 1,
                        title: 'What is Bitcoin & Why Does it Have Value?',
                        badge: 'Beginner',
                        duration: '10 min',
                        content: `
<p>Bitcoin was created in 2009 by the anonymous Satoshi Nakamoto. It's a decentralized digital currency — no government or bank controls it.</p>
<h4>Why Bitcoin Has Value</h4>
<div class="lesson-grid-2">
<div><strong>🔒 Scarcity</strong><p>Only 21 million Bitcoin will ever exist. Contrast with fiat money (PKR, USD) which governments can print unlimited amounts of. Scarcity = value.</p></div>
<div><strong>⛏️ Mining Halvings</strong><p>Every 4 years, the reward for mining Bitcoin is cut in half. This reduces new supply entering the market. Historically, each halving is followed by a bull market 6-18 months later.</p></div>
<div><strong>🌍 Global Adoption</strong><p>Institutional investors (BlackRock, Fidelity), governments (El Salvador), and corporations (Tesla, MicroStrategy) hold Bitcoin as treasury asset.</p></div>
<div><strong>📱 Network Effect</strong><p>Bitcoin has the strongest brand recognition, deepest liquidity, and longest track record. Being first mover gives it a massive advantage.</p></div>
</div>
<div class="lesson-tip">💡 Bitcoin's 4-year cycle (boom → bust → recovery → new ATH) is driven by the halving schedule. Understanding this helps with long-term position management.</div>`
                    },
                    {
                        num: 2,
                        title: 'Crypto Market Cycles — When to Buy and Sell',
                        badge: 'Intermediate',
                        duration: '10 min',
                        content: `
<h4>The 4-Stage Crypto Market Cycle</h4>
<div class="market-cycle-diagram"><div class="mc-stage accumulation"><div class="mc-num">1</div><strong>Accumulation</strong><p>Smart money buys quietly. Low price, low volume. Sentiment: "Crypto is dead."</p></div><div class="mc-arrow">→</div><div class="mc-stage markup"><div class="mc-num">2</div><strong>Markup (Bull)</strong><p>Price rises. Institutions buy. Media coverage increases. Early majority enters.</p></div><div class="mc-arrow">→</div><div class="mc-stage distribution"><div class="mc-num">3</div><strong>Distribution</strong><p>Smart money sells to retail. Price volatile. "To the moon!" headlines.</p></div><div class="mc-arrow">→</div><div class="mc-stage markdown"><div class="mc-num">4</div><strong>Markdown (Bear)</strong><p>Price crashes. Panic selling. "Bitcoin is dead" headlines again.</p></div></div>
<div class="lesson-tip">🔮 <strong>Check the Fear & Greed Index</strong> on this portal's sidebar. Extreme Fear = Stage 1 (accumulation opportunity). Extreme Greed = Stage 3 (consider taking profits).</div>`
                    },
                    {
                        num: 3,
                        title: 'DCA — Dollar Cost Averaging for Crypto',
                        badge: 'Beginner',
                        duration: '6 min',
                        content: `
<p><strong>DCA (Dollar Cost Averaging)</strong> means investing a fixed amount at regular intervals, regardless of price. It removes emotion from investing.</p>
<div class="dca-example"><table class="lesson-table"><tr><th>Month</th><th>BTC Price</th><th>Invested</th><th>BTC Bought</th></tr><tr><td>Jan</td><td>$40,000</td><td>$100</td><td>0.0025</td></tr><tr><td>Feb</td><td>$35,000</td><td>$100</td><td>0.00286</td></tr><tr><td>Mar</td><td>$45,000</td><td>$100</td><td>0.00222</td></tr><tr><td>Apr</td><td>$50,000</td><td>$100</td><td>0.002</td></tr><tr><td><strong>Total</strong></td><td>Avg: $42,500</td><td>$400</td><td>0.00958</td></tr></table><p>Current Value at $50,000: $479 (+19.75% on avg cost)</p></div>
<div class="lesson-tip">⏱️ <strong>Test DCA on this portal:</strong> Go to Backtesting → DCA Strategy. See how investing $100/week in Bitcoin would have performed over the last year.</div>`
                    }
                ]
            }
        ]
    },

    'psx-learn': {
        title: '🇵🇰 PSX Trading',
        icon: '🇵🇰',
        desc: 'Pakistan Stock Exchange — complete guide.',
        modules: [
            {
                title: 'PSX Complete Beginner Guide',
                lessons: [
                    {
                        num: 1,
                        title: 'What is PSX and How Does It Work?',
                        badge: 'Beginner',
                        duration: '8 min',
                        content: `
<p>PSX (Pakistan Stock Exchange) is where you can buy and sell shares of Pakistani companies. The main index is KSE-100 — which tracks the 100 largest companies.</p>
<h4>Key Facts about PSX</h4>
<table class="lesson-table"><tr><th>Detail</th><th>Info</th></tr>
<tr><td>Trading Hours</td><td>Monday-Friday, 9:15 AM – 3:30 PM (PST)</td></tr>
<tr><td>Settlement</td><td>T+2 (your shares/money arrive 2 business days after trade)</td></tr>
<tr><td>Account needed</td><td>CDC (Central Depository Company) investor account</td></tr>
<tr><td>Regulator</td><td>SECP (Securities & Exchange Commission of Pakistan)</td></tr>
<tr><td>Lot size</td><td>Minimum 500 shares for most stocks</td></tr>
<tr><td>Price limit</td><td>±7.5% circuit breaker (price can't move more than this per day)</td></tr>
</table>
<div class="lesson-tip">📊 Live PSX data is available on this portal under PSX Stocks section. Check KSE-100 index level and top sectors.</div>`
                    },
                    {
                        num: 2,
                        title: 'How to Open a CDC Account — Step by Step',
                        badge: 'Beginner',
                        duration: '10 min',
                        content: `
<p>To trade on PSX, you need a <strong>CDC Account</strong> (Central Depository Company) — this holds your shares electronically, like a bank account for stocks.</p>
<h4>Step-by-Step Process</h4>
<ol class="lesson-steps">
<li><strong>Choose a TREC Holder (Broker)</strong> — Registered broker with PSX. Examples: Arif Habib Ltd, Next Capital, KASB Securities, BMA Capital, AKD Securities.</li>
<li><strong>Documents Required</strong> — CNIC (original + copy), NTN (for taxable income), bank account details (cheque leaf or statement), 2 passport photos.</li>
<li><strong>Open Account</strong> — Visit broker office OR apply online (most brokers now have digital onboarding). Takes 3-7 business days.</li>
<li><strong>Get CDC Investor Account</strong> — Your broker opens this for you. You'll receive a CDC IAS (Investor Account Services) login.</li>
<li><strong>Fund Your Account</strong> — Transfer money from your bank. Minimum investment varies by broker (usually ₨10,000-50,000).</li>
<li><strong>Place Your First Order</strong> — Through broker's app/platform. Search for stock symbol (e.g., ENGRO), enter quantity in lots, set price.</li>
</ol>
<div class="lesson-important">⚠️ <strong>Filer vs Non-Filer Tax:</strong> If you're a tax filer, CGT (Capital Gains Tax) is lower. Non-filers pay higher rates. File your tax return with FBR to get better rates.</div>`
                    },
                    {
                        num: 3,
                        title: 'Which PSX Stocks to Buy? Sectors Explained',
                        badge: 'Intermediate',
                        duration: '10 min',
                        content: `
<p>PSX has companies across many sectors. Here's what drives each:</p>
<div class="sector-cards-lesson">
<div class="scl-card"><div class="scl-icon">🏦</div><h4>Banking (HBL, MCB, UBL, BAFL)</h4><p><strong>Drives:</strong> Interest rate spreads, loan growth, NPLs. When SBP keeps rates high → banks earn more. Currently most profitable sector.</p></div>
<div class="scl-card"><div class="scl-icon">🧪</div><h4>Fertilizer (ENGRO, EFERT, FFC)</h4><p><strong>Drives:</strong> Gas prices (feedstock), agriculture demand, crop seasons. High gas prices hurt margins. Consistent dividend payers.</p></div>
<div class="scl-card"><div class="scl-icon">🏗️</div><h4>Cement (LUCK, DGKC, CHCC)</h4><p><strong>Drives:</strong> Construction activity, PSDP spending, coal/energy costs. Boom in housing = cement stocks rise. Cyclical.</p></div>
<div class="scl-card"><div class="scl-icon">⛽</div><h4>Oil & Gas (OGDC, PPL, PSO)</h4><p><strong>Drives:</strong> International crude oil prices, gas exploration, circular debt. Government controls pricing — adds regulatory risk.</p></div>
<div class="scl-card"><div class="scl-icon">🔌</div><h4>Power (HUBC, KAPCO, NEPRA)</h4><p><strong>Drives:</strong> Capacity payments from WAPDA, fuel prices, capacity utilisation. Government payment delays are key risk.</p></div>
<div class="scl-card"><div class="scl-icon">📱</div><h4>Technology (NETSOL, TRG, SYSTEMS)</h4><p><strong>Drives:</strong> USD revenues (exports IT services), PKR devaluation helps these. Growing sector with export remittances.</p></div>
</div>
<div class="lesson-tip">💡 In a high-interest-rate environment (like Pakistan currently): Banks and dividend stocks outperform. In a rate-cutting cycle: Growth stocks, cement, and tech tend to outperform.</div>`
                    },
                    {
                        num: 4,
                        title: 'Reading PSX Financial Reports — EPS, P/E, Dividend Yield',
                        badge: 'Intermediate',
                        duration: '8 min',
                        content: `
<p>To evaluate if a PSX stock is worth buying, you need to understand these key metrics:</p>
<table class="lesson-table"><tr><th>Metric</th><th>What it Means</th><th>Rule of Thumb</th></tr>
<tr><td><strong>EPS</strong> (Earnings Per Share)</td><td>Profit per share</td><td>Higher EPS growth = better. Compare YoY.</td></tr>
<tr><td><strong>P/E Ratio</strong> (Price/Earnings)</td><td>How much you pay per ₨1 of earnings</td><td>PSX average: 7-10x. Under 6x = potentially cheap.</td></tr>
<tr><td><strong>Dividend Yield</strong></td><td>Annual dividend ÷ share price</td><td>5%+ is good. Banking stocks often give 10%+.</td></tr>
<tr><td><strong>ROE</strong> (Return on Equity)</td><td>How efficiently company uses shareholder money</td><td>15%+ is good quality.</td></tr>
<tr><td><strong>Debt/Equity</strong></td><td>How leveraged the company is</td><td>Under 1.0 is safer. Above 2.0 is risky.</td></tr>
</table>
<h4>Where to Find This Data</h4>
<ul><li>Company website → Investor Relations section</li><li>PSX website: dps.psx.com.pk</li><li>Business Recorder, The News (financial sections)</li></ul>`
                    }
                ]
            }
        ]
    },

    'forex-learn': {
        title: '💱 Forex Trading',
        icon: '💱',
        desc: 'Currency markets & PKR explained.',
        modules: [
            {
                title: 'Forex Fundamentals',
                lessons: [
                    {
                        num: 1,
                        title: 'How Forex Works — Currency Pairs Explained',
                        badge: 'Beginner',
                        duration: '8 min',
                        content: `
<p>Forex (Foreign Exchange) is trading one currency against another. You always trade pairs like EUR/USD or USD/PKR.</p>
<div class="pair-breakdown"><span class="pair-base">EUR</span><span class="pair-slash">/</span><span class="pair-quote">USD</span><span class="pair-label-base">Base Currency</span><span class="pair-label-quote">Quote Currency</span></div>
<p>If EUR/USD = 1.10, it means 1 Euro = 1.10 US Dollars. When EUR strengthens vs USD, EUR/USD rate rises.</p>
<h4>Major Pairs (Most Traded)</h4>
<table class="lesson-table"><tr><th>Pair</th><th>Nickname</th><th>Characteristics</th></tr>
<tr><td>EUR/USD</td><td>The Fiber</td><td>Most traded pair, low spreads, influenced by ECB & Fed</td></tr>
<tr><td>GBP/USD</td><td>The Cable</td><td>Volatile, influenced by UK/US economies</td></tr>
<tr><td>USD/JPY</td><td>The Yen</td><td>Risk-off safe haven, carry trade currency</td></tr>
<tr><td>USD/PKR</td><td>PKR Rate</td><td>Determined by SBP, oil imports, remittances, debt</td></tr>
</table>`
                    },
                    {
                        num: 2,
                        title: 'What Moves USD/PKR — Factors Every Pakistani Must Know',
                        badge: 'Intermediate',
                        duration: '10 min',
                        content: `
<p>The Pakistani Rupee value is influenced by several key factors:</p>
<div class="lesson-grid-2">
<div><strong>📤 Remittances</strong><p>Overseas Pakistanis send billions in USD/GBP/AED to Pakistan. Higher remittances → more foreign currency supply → PKR strengthens.</p></div>
<div><strong>🛢️ Oil Imports</strong><p>Pakistan imports almost all its oil (pays in USD). High oil prices → more USD demand → PKR weakens. This is why oil prices directly affect PKR.</p></div>
<div><strong>🏦 SBP Policy & IMF</strong><p>State Bank of Pakistan manages reserves. IMF loan disbursements support PKR. When IMF reviews stall or reserves fall below 3 months import cover, PKR falls.</p></div>
<div><strong>📊 Current Account Deficit</strong><p>When Pakistan imports more than it exports, it needs more USD → PKR weakens. Trade deficit is structural challenge for PKR.</p></div>
<div><strong>🌍 Global USD Strength</strong><p>When the Federal Reserve raises US interest rates, global investors move to USD → all emerging market currencies (PKR, INR, TRY) weaken vs USD.</p></div>
<div><strong>🏃 Capital Flight</strong><p>Political uncertainty or economic crisis causes investors to pull money out of Pakistan → USD demand spikes → PKR crashes (as happened 2022-2023).</p></div>
</div>
<div class="lesson-tip">💱 Use the Currency Converter on this portal to check live USD/PKR rate and convert amounts.</div>`
                    }
                ]
            }
        ]
    },

    'us-uk': {
        title: '🌍 US & UK Markets',
        icon: '🌍',
        desc: 'Wall Street, FTSE 100 & how to invest.',
        modules: [
            {
                title: 'Investing in Global Markets from Pakistan',
                lessons: [
                    {
                        num: 1,
                        title: 'S&P 500 — The World\'s Most Important Index',
                        badge: 'Beginner',
                        duration: '8 min',
                        content: `
<p>The S&P 500 tracks the 500 largest US companies. It's the global benchmark for investment performance. If the S&P 500 is up, global confidence is generally high.</p>
<table class="lesson-table"><tr><th>Index</th><th>What it Tracks</th><th>Sectors</th></tr>
<tr><td>S&P 500</td><td>Top 500 US companies by market cap</td><td>All sectors — diversified</td></tr>
<tr><td>NASDAQ 100</td><td>100 largest non-financial NASDAQ companies</td><td>Technology-heavy (Apple, Microsoft, Nvidia)</td></tr>
<tr><td>Dow Jones (DJIA)</td><td>30 major US industrial companies</td><td>Traditional blue chips</td></tr>
<tr><td>FTSE 100</td><td>100 largest UK companies</td><td>Energy, Financials, Consumer Goods</td></tr>
</table>
<h4>How to Get Exposure</h4>
<ul><li><strong>Individual Stocks:</strong> Buy Apple, Tesla, Microsoft via international brokers</li><li><strong>ETFs:</strong> SPY (S&P 500 ETF), QQQ (NASDAQ ETF) — instant diversification</li><li><strong>ADRs:</strong> Some Pakistani brokers offer access to US stocks via depository receipts</li></ul>`
                    },
                    {
                        num: 2,
                        title: 'Tech Giants — FAANG & the Magnificent 7',
                        badge: 'Intermediate',
                        duration: '8 min',
                        content: `
<p>The <strong>Magnificent 7</strong> are the seven largest technology companies that now dominate the S&P 500:</p>
<div class="mag7-grid">
<div class="m7-card"><strong>AAPL</strong><div>Apple</div><div class="dim">$3T+ market cap. iPhone, Mac, services ecosystem.</div></div>
<div class="m7-card"><strong>MSFT</strong><div>Microsoft</div><div class="dim">Azure cloud, Office 365, OpenAI partnership.</div></div>
<div class="m7-card"><strong>NVDA</strong><div>Nvidia</div><div class="dim">AI chips. GPU monopoly for AI training. Fastest growing.</div></div>
<div class="m7-card"><strong>GOOGL</strong><div>Alphabet</div><div class="dim">Google Search, YouTube, Google Cloud, Waymo.</div></div>
<div class="m7-card"><strong>AMZN</strong><div>Amazon</div><div class="dim">E-commerce + AWS cloud (most profitable business).</div></div>
<div class="m7-card"><strong>META</strong><div>Meta</div><div class="dim">Facebook, Instagram, WhatsApp, AI investment.</div></div>
<div class="m7-card"><strong>TSLA</strong><div>Tesla</div><div class="dim">EVs, Autopilot, energy storage. Elon Musk premium.</div></div>
</div>
<div class="lesson-tip">🌍 Check live US stock prices on this portal under US & UK Markets section.</div>`
                    }
                ]
            }
        ]
    },

    psychology: {
        title: '🧠 Trading Psychology',
        icon: '🧠',
        desc: 'The mental game of trading.',
        modules: [
            {
                title: 'The Psychology Edge',
                lessons: [
                    {
                        num: 1,
                        title: 'Fear & Greed — The Two Enemies of Every Trader',
                        badge: 'Critical',
                        duration: '8 min',
                        content: `
<p>Markets are moved by two emotions: <strong>Fear</strong> and <strong>Greed</strong>. Most traders lose money because they act on these emotions instead of logic.</p>
<div class="emotion-cycle"><div class="ec-stage fear"><strong>😱 Fear Cycle</strong><p>Price falls → fear increases → you panic sell near the bottom → price recovers → you missed the rebound. Classic "buy high, sell low" behavior.</p></div><div class="ec-stage greed"><strong>🤑 Greed Cycle</strong><p>Price rises → FOMO kicks in → you buy near the top → price reverses → you hold hoping for recovery → price falls further → you finally sell at a loss.</p></div></div>
<h4>How to Beat Fear & Greed</h4>
<ul>
<li><strong>Have a plan before entering</strong> — Know your entry, stop loss, and take profit BEFORE you trade. Write it in the Trade Journal.</li>
<li><strong>Follow rules, not feelings</strong> — "I will exit if price drops 7%" → stick to it no matter what.</li>
<li><strong>Use the Fear & Greed Index</strong> — When it reads "Extreme Fear", that's historically a buying opportunity. When "Extreme Greed", consider reducing positions.</li>
</ul>
<div class="lesson-tip">📊 Check the Fear & Greed Index widget in the sidebar of this portal every time you consider making a trade.</div>`
                    },
                    {
                        num: 2,
                        title: 'Building a Trading Routine — How Pros Do It',
                        badge: 'Intermediate',
                        duration: '7 min',
                        content: `
<p>Profitable traders don't guess — they follow a repeatable process.</p>
<div class="routine-timeline">
<div class="rt-step"><div class="rt-time">Pre-Market (7-9 AM)</div><div class="rt-action">Check news, check Fear & Greed, review watchlist, plan trades for the day. Update Trade Journal from yesterday.</div></div>
<div class="rt-step"><div class="rt-time">Market Hours</div><div class="rt-action">Execute planned trades only. Don't chase. Monitor open positions. Respect stop losses — no moving them.</div></div>
<div class="rt-step"><div class="rt-time">Post-Market (4-6 PM)</div><div class="rt-action">Review all trades in Trade Journal. What worked? What didn't? Note emotions during trades. Identify improvement areas.</div></div>
<div class="rt-step"><div class="rt-time">Weekend</div><div class="rt-action">Backtesting, studying charts, learning. Update your trading rules based on what you learned this week.</div></div>
</div>
<div class="lesson-tip">📓 Use the Trade Journal on this portal to log every trade with your emotion at the time. Over time, patterns emerge — you'll see which emotions lead to losses.</div>`
                    },
                    {
                        num: 3,
                        title: 'Common Trading Mistakes (And How to Avoid Them)',
                        badge: 'Critical',
                        duration: '10 min',
                        content: `
<div class="mistakes-grid">
<div class="mistake-card"><div class="mistake-icon">❌</div><div class="mistake-name">Trading Without a Plan</div><div class="mistake-fix">Always define entry, SL, and TP before entering. Write it in the journal.</div></div>
<div class="mistake-card"><div class="mistake-icon">❌</div><div class="mistake-name">Moving Stop Losses</div><div class="mistake-fix">Accept the loss. A small, planned loss is far better than a large, unexpected one.</div></div>
<div class="mistake-card"><div class="mistake-icon">❌</div><div class="mistake-name">Revenge Trading</div><div class="mistake-fix">After a loss, take a break. Don't immediately re-enter trying to "win back" money. This leads to bigger losses.</div></div>
<div class="mistake-card"><div class="mistake-icon">❌</div><div class="mistake-name">Over-Leveraging</div><div class="mistake-fix">Leverage amplifies BOTH gains and losses. 10x leverage means a 10% move wipes you out. Start with 1-2x maximum.</div></div>
<div class="mistake-card"><div class="mistake-icon">❌</div><div class="mistake-name">FOMO (Fear of Missing Out)</div><div class="mistake-fix">There will ALWAYS be another opportunity. Missing a trade is free. A bad trade costs money.</div></div>
<div class="mistake-card"><div class="mistake-icon">❌</div><div class="mistake-name">Skipping Risk Management</div><div class="mistake-fix">Even one unprotected trade can wipe out weeks of profits. Always use stop losses.</div></div>
</div>`
                    }
                ]
            }
        ]
    }
};

// ── RENDER ENGINE ─────────────────────────────────────────────────────

function initAcademyDynamic() {
    // Populate track buttons and sections from curriculum data
    const tracksContainer = document.getElementById('academyTracksContainer');
    const contentContainer = document.getElementById('academyDynamicContent');
    if (!tracksContainer || !contentContainer) return;

    // Build track buttons
    tracksContainer.innerHTML = Object.entries(ACADEMY_CURRICULUM).map(([key, track], idx) =>
        `<button class="track-btn ${idx === 0 ? 'active' : ''}" data-track="${key}" onclick="showAcademyTrack('${key}', this)">
            ${track.icon} ${track.title}
        </button>`
    ).join('');

    // Build content for all tracks
    contentContainer.innerHTML = Object.entries(ACADEMY_CURRICULUM).map(([key, track], idx) =>
        `<div class="academy-track ${idx === 0 ? 'active' : ''}" id="dtrack-${key}">
            <div class="track-intro">
                <div class="track-intro-icon">${track.icon}</div>
                <div>
                    <h3>${track.title}</h3>
                    <p class="dim">${track.desc}</p>
                </div>
            </div>
            ${renderTrackContent(track)}
        </div>`
    ).join('');

    // Count total lessons
    let total = 0;
    Object.values(ACADEMY_CURRICULUM).forEach(t => t.modules.forEach(m => total += m.lessons.length));
    const countEl = document.getElementById('academyLessonCount');
    if (countEl) countEl.textContent = total + ' lessons';
}

function renderTrackContent(track) {
    return track.modules.map(mod => `
    <div class="academy-module">
        <div class="module-title">${mod.title}</div>
        <div class="lessons-list">
            ${mod.lessons.map(lesson => renderLessonCard(lesson)).join('')}
        </div>
    </div>`).join('');
}

function renderLessonCard(lesson) {
    const badgeClass = lesson.badge === 'Critical' ? 'badge-critical' : lesson.badge === 'Intermediate' ? 'badge-intermediate' : 'badge-beginner';
    return `
    <div class="lesson-card-new" id="lesson-${lesson.num}">
        <div class="lesson-card-header" onclick="toggleLesson('lesson-${lesson.num}')">
            <div class="lesson-card-left">
                <span class="lesson-num">Lesson ${lesson.num}</span>
                <span class="lesson-title-text">${lesson.title}</span>
            </div>
            <div class="lesson-card-right">
                <span class="lesson-badge ${badgeClass}">${lesson.badge}</span>
                <span class="lesson-duration">⏱ ${lesson.duration}</span>
                <span class="lesson-toggle">▼</span>
            </div>
        </div>
        <div class="lesson-card-body" style="display:none">
            <div class="lesson-content">${lesson.content}</div>
            <div class="lesson-footer">
                <button class="lesson-complete-btn" onclick="markLessonComplete('lesson-${lesson.num}', this)">
                    ✓ Mark Complete
                </button>
                <button class="lesson-practice-btn" onclick="switchSection('papertrading')">
                    🎮 Practice This →
                </button>
            </div>
        </div>
    </div>`;
}

function toggleLesson(id) {
    const card = document.getElementById(id);
    if (!card) return;
    const body = card.querySelector('.lesson-card-body');
    const toggle = card.querySelector('.lesson-toggle');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (toggle) toggle.textContent = isOpen ? '▼' : '▲';
    card.classList.toggle('open', !isOpen);
}

function showAcademyTrack(key, btn) {
    document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.academy-track').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const track = document.getElementById(`dtrack-${key}`);
    if (track) track.classList.add('active');
}

function setAcademyTrack(key) {
    const btn = document.querySelector(`[data-track="${key}"]`);
    if (btn) showAcademyTrack(key, btn);
    else {
        // fallback for old static buttons
        document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.academy-track').forEach(t => t.classList.remove('active'));
        const b2 = document.querySelector(`button[data-track="${key}"]`);
        if (b2) b2.classList.add('active');
        const t2 = document.getElementById(`track-${key}`);
        if (t2) t2.classList.add('active');
    }
}

// Track lesson completion in localStorage
function markLessonComplete(id, btn) {
    const completed = JSON.parse(localStorage.getItem('tp_lessons_done') || '[]');
    if (!completed.includes(id)) completed.push(id);
    localStorage.setItem('tp_lessons_done', JSON.stringify(completed));
    btn.textContent = '✅ Completed!';
    btn.style.background = 'rgba(72,187,120,0.2)';
    btn.style.color = '#48bb78';
    btn.disabled = true;
    updateAcademyProgress();
}

function updateAcademyProgress() {
    const completed = JSON.parse(localStorage.getItem('tp_lessons_done') || '[]');
    let total = 0;
    Object.values(ACADEMY_CURRICULUM).forEach(t => t.modules.forEach(m => total += m.lessons.length));
    const progressEl = document.getElementById('academyProgress');
    if (progressEl) {
        progressEl.textContent = `${completed.length}/${total} lessons completed`;
    }
}

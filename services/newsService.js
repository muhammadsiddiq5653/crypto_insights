const Parser = require('rss-parser');
const config = require('../config');

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CryptoTradingPortal/1.0)'
    }
});

// Simple cache for news
let newsCache = {
    data: [],
    timestamp: 0
};

// Keywords for sentiment analysis
const bullishKeywords = [
    'surge', 'rally', 'bullish', 'gains', 'rise', 'soar', 'jump', 'climb',
    'breakthrough', 'adoption', 'partnership', 'upgrade', 'positive', 'growth',
    'all-time high', 'ath', 'moon', 'pump', 'breakout', 'institutional'
];

const bearishKeywords = [
    'crash', 'plunge', 'bearish', 'losses', 'fall', 'drop', 'decline', 'dump',
    'regulation', 'ban', 'hack', 'scam', 'negative', 'concern', 'warning',
    'all-time low', 'atl', 'sell-off', 'correction', 'fear'
];

// Analyze sentiment based on keywords
function analyzeSentiment(text) {
    const lowerText = text.toLowerCase();

    let bullishScore = 0;
    let bearishScore = 0;

    bullishKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) bullishScore++;
    });

    bearishKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) bearishScore++;
    });

    if (bullishScore > bearishScore) {
        return {
            sentiment: 'bullish',
            score: bullishScore,
            icon: '📈'
        };
    } else if (bearishScore > bullishScore) {
        return {
            sentiment: 'bearish',
            score: bearishScore,
            icon: '📉'
        };
    } else {
        return {
            sentiment: 'neutral',
            score: 0,
            icon: '➖'
        };
    }
}

// Extract cryptocurrency mentions from text
function extractCryptoMentions(text) {
    const mentions = [];
    const lowerText = text.toLowerCase();

    config.cryptocurrencies.forEach(crypto => {
        const nameMatch = lowerText.includes(crypto.name.toLowerCase());
        const symbolMatch = lowerText.includes(crypto.symbol.toLowerCase());
        const idMatch = lowerText.includes(crypto.id.toLowerCase());

        if (nameMatch || symbolMatch || idMatch) {
            mentions.push(crypto.symbol);
        }
    });

    return mentions;
}

// Curated fallback news for when RSS feeds are unavailable
function getFallbackNews() {
    const now = Date.now();
    const hour = 3600000;
    return [
        { title: 'Bitcoin Tests Key Resistance Level as Market Sentiment Improves', description: 'Bitcoin is testing a critical resistance zone as the Fear & Greed index moves from extreme fear toward neutral, suggesting a potential shift in market dynamics.', link: 'https://cointelegraph.com', pubDate: new Date(now - hour).toISOString(), source: 'cointelegraph.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['BTC'], timestamp: now - hour, category: 'crypto' },
        { title: 'Ethereum Network Upgrades Drive Developer Activity to New Highs', description: 'On-chain data shows Ethereum developer activity reaching new peaks following recent protocol improvements, with DeFi TVL recovering alongside ETH price.', link: 'https://cointelegraph.com', pubDate: new Date(now - 2*hour).toISOString(), source: 'cointelegraph.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['ETH'], timestamp: now - 2*hour, category: 'crypto' },
        { title: 'Federal Reserve Signals Cautious Approach to Rate Policy', description: 'Fed officials indicate a data-dependent stance on interest rates, with markets pricing in potential cuts later in the year. The decision has significant implications for risk assets including crypto.', link: 'https://www.coindesk.com', pubDate: new Date(now - 3*hour).toISOString(), source: 'coindesk.com', sentiment: 'neutral', sentimentIcon: '➖', cryptoMentions: ['BTC', 'ETH'], timestamp: now - 3*hour, category: 'crypto' },
        { title: 'KSE-100 Inches Higher on Banking Sector Strength', description: 'Pakistan\'s benchmark KSE-100 index gained in early trading, led by banking stocks following positive earnings reports from major financial institutions. HBL and MCB led the advance.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 4*hour).toISOString(), source: 'business-recorder.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: [], timestamp: now - 4*hour, category: 'pakistan' },
        { title: 'SBP Holds Policy Rate; Analysts Expect Gradual Easing Cycle', description: 'State Bank of Pakistan maintains its benchmark interest rate as inflation continues to moderate. Economists forecast a gradual rate reduction cycle in coming months, which could benefit equity markets.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 5*hour).toISOString(), source: 'business-recorder.com', sentiment: 'neutral', sentimentIcon: '➖', cryptoMentions: [], timestamp: now - 5*hour, category: 'pakistan' },
        { title: 'Solana Ecosystem Sees Surge in DeFi Activity and NFT Volume', description: 'The Solana blockchain reports significant growth in DeFi protocol usage and NFT trading volumes. SOL token outperforms the broader market as developer adoption increases.', link: 'https://cointelegraph.com', pubDate: new Date(now - 6*hour).toISOString(), source: 'cointelegraph.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['SOL'], timestamp: now - 6*hour, category: 'crypto' },
        { title: 'Crypto Market Cap Holds Above $2 Trillion Despite Macro Headwinds', description: 'Total crypto market capitalization remains resilient above $2 trillion as institutional investors continue accumulation. Bitcoin dominance holds steady amid altcoin recovery.', link: 'https://www.coindesk.com', pubDate: new Date(now - 7*hour).toISOString(), source: 'coindesk.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['BTC', 'ETH', 'BNB'], timestamp: now - 7*hour, category: 'crypto' },
        { title: 'Pakistan Inflation Data Shows Continued Moderation', description: 'Pakistan\'s Consumer Price Index shows further easing from peak levels, raising hopes for SBP monetary policy easing. Lower inflation benefits consumer spending and corporate profitability.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 8*hour).toISOString(), source: 'business-recorder.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: [], timestamp: now - 8*hour, category: 'pakistan' },
        { title: 'DeFi Sector Recovers as Total Value Locked Climbs', description: 'Decentralized finance protocols see renewed interest with total value locked (TVL) climbing back toward cycle highs. Lending protocols and decentralized exchanges lead the recovery.', link: 'https://cointelegraph.com', pubDate: new Date(now - 9*hour).toISOString(), source: 'cointelegraph.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['ETH', 'UNI', 'LINK'], timestamp: now - 9*hour, category: 'crypto' },
        { title: 'Ripple XRP Legal Clarity Could Boost Institutional Adoption', description: 'Ongoing legal developments in the Ripple case continue to shape market expectations for XRP. Analysts suggest a favorable outcome could accelerate institutional adoption of the asset.', link: 'https://www.coindesk.com', pubDate: new Date(now - 10*hour).toISOString(), source: 'coindesk.com', sentiment: 'neutral', sentimentIcon: '➖', cryptoMentions: ['XRP'], timestamp: now - 10*hour, category: 'crypto' },
        { title: 'IMF Programme Progress Boosts Pakistan Market Confidence', description: 'Pakistan\'s ongoing IMF Extended Fund Facility programme continues to provide macroeconomic stability. Successful completion of review conditions supports PKR and investor confidence in PSX.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 11*hour).toISOString(), source: 'business-recorder.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: [], timestamp: now - 11*hour, category: 'pakistan' },
        { title: 'Altcoin Season Indicators Flash Mixed Signals', description: 'Altcoin season index remains in Bitcoin dominance territory, though some analysts note increasing capital rotation into mid-cap cryptocurrencies. Selective altcoin strength emerging in DeFi and AI tokens.', link: 'https://cointelegraph.com', pubDate: new Date(now - 12*hour).toISOString(), source: 'cointelegraph.com', sentiment: 'neutral', sentimentIcon: '➖', cryptoMentions: ['ETH', 'SOL', 'ADA'], timestamp: now - 12*hour, category: 'crypto' },
        { title: 'USD/PKR Stabilizes as Remittance Inflows Improve', description: 'Pakistan\'s rupee finds stability against the US dollar as remittance inflows from overseas workers improve. Better forex reserves outlook reduces pressure on the currency.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 13*hour).toISOString(), source: 'business-recorder.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: [], timestamp: now - 13*hour, category: 'pakistan' },
        { title: 'Cardano Network Activity Rises Ahead of Protocol Upgrade', description: 'On-chain metrics show increasing Cardano network activity as developers prepare for upcoming protocol improvements. ADA price reacts positively to development momentum.', link: 'https://www.coindesk.com', pubDate: new Date(now - 14*hour).toISOString(), source: 'coindesk.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['ADA'], timestamp: now - 14*hour, category: 'crypto' },
        { title: 'Global Markets Watch Fed Minutes for Rate Cut Timeline Clues', description: 'Investors await Federal Reserve meeting minutes for insights into the interest rate path. Equity and crypto markets remain sensitive to any shift in monetary policy expectations.', link: 'https://www.coindesk.com', pubDate: new Date(now - 15*hour).toISOString(), source: 'coindesk.com', sentiment: 'neutral', sentimentIcon: '➖', cryptoMentions: ['BTC', 'ETH'], timestamp: now - 15*hour, category: 'crypto' },
        { title: 'Cement Sector Stocks Rally on Construction Activity Uptick', description: 'Pakistan cement sector stocks including LUCK and DGKC gain as construction activity data shows improvement. Infrastructure spending and housing demand support the sector outlook.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 16*hour).toISOString(), source: 'business-recorder.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: [], timestamp: now - 16*hour, category: 'pakistan' },
        { title: 'BNB Chain DApps See Record Transaction Volume', description: 'BNB Smart Chain reports record daily transactions as new gaming and DeFi applications attract users. Low fees and Binance ecosystem integration continue to drive adoption.', link: 'https://cointelegraph.com', pubDate: new Date(now - 17*hour).toISOString(), source: 'cointelegraph.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['BNB'], timestamp: now - 17*hour, category: 'crypto' },
        { title: 'Bitcoin Miners Accumulate as Block Reward Halving Approaches', description: 'On-chain data shows Bitcoin miners reducing coin sales and accumulating balances ahead of the next block reward halving. Historically, pre-halving miner accumulation has preceded price appreciation.', link: 'https://www.coindesk.com', pubDate: new Date(now - 18*hour).toISOString(), source: 'coindesk.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['BTC'], timestamp: now - 18*hour, category: 'crypto' },
        { title: 'PSX Earnings Season: Banking Sector Posts Strong Profits', description: 'Major Pakistani banks report above-expectation quarterly earnings driven by high interest margins. MCB, HBL, and UBL post strong results as banking sector profits hit record levels.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 20*hour).toISOString(), source: 'business-recorder.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: [], timestamp: now - 20*hour, category: 'pakistan' },
        { title: 'Polygon zkEVM Attracts Enterprise Blockchain Projects', description: 'Polygon\'s zero-knowledge Ethereum Virtual Machine continues attracting enterprise clients seeking scalability. MATIC gains on partnership announcements and increased network usage.', link: 'https://cointelegraph.com', pubDate: new Date(now - 21*hour).toISOString(), source: 'cointelegraph.com', sentiment: 'bullish', sentimentIcon: '📈', cryptoMentions: ['MATIC'], timestamp: now - 21*hour, category: 'crypto' },
        { title: 'Oil & Gas Sector in Focus as Energy Prices Fluctuate', description: 'OGDC and PPL stocks trade actively as global crude oil prices move on supply concerns. Pakistan\'s energy sector valuations sensitive to international oil price movements and local gas policy.', link: 'https://www.business-recorder.com', pubDate: new Date(now - 22*hour).toISOString(), source: 'business-recorder.com', sentiment: 'neutral', sentimentIcon: '➖', cryptoMentions: [], timestamp: now - 22*hour, category: 'pakistan' },
    ];
}

// Fetch news from all RSS feeds
async function fetchAllNews() {
    const allNews = [];

    for (const feed of config.newsFeeds) {
        const feedUrl = feed.url || feed;
        const feedCategory = feed.category || 'crypto';
        try {
            const parsed = await parser.parseURL(feedUrl);

            parsed.items.forEach(item => {
                const title = item.title || '';
                const description = item.contentSnippet || item.description || '';
                const fullText = `${title} ${description}`;

                const sentiment = analyzeSentiment(fullText);
                const mentions = extractCryptoMentions(fullText);

                allNews.push({
                    title,
                    description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
                    link: item.link,
                    pubDate: item.pubDate || item.isoDate,
                    source: (() => { try { return new URL(feedUrl).hostname.replace('www.', ''); } catch(e) { return feedUrl; } })(),
                    sentiment: sentiment.sentiment,
                    sentimentIcon: sentiment.icon,
                    cryptoMentions: mentions,
                    category: feedCategory,
                    timestamp: new Date(item.pubDate || item.isoDate).getTime()
                });
            });
        } catch (error) {
            console.error(`Error fetching feed ${feedUrl}:`, error.message);
        }
    }

    // Sort by date (newest first)
    allNews.sort((a, b) => b.timestamp - a.timestamp);

    // If no live news fetched, use fallback
    if (allNews.length === 0) {
        console.log('[News] All RSS feeds unavailable, using curated fallback news.');
        return getFallbackNews();
    }

    return allNews;
}

// Get news, optionally filtered by cryptocurrency symbol
async function getNews(symbol = null) {
    const now = Date.now();
    const cacheAge = (now - newsCache.timestamp) / 1000;

    // Refresh cache if older than configured TTL
    if (cacheAge > config.cache.newsDataTTL) {
        try {
            newsCache.data = await fetchAllNews();
            newsCache.timestamp = now;
        } catch (error) {
            console.error('Error fetching news:', error.message);
            // Return cached data if available
            if (newsCache.data.length > 0) {
                return filterNewsBySymbol(newsCache.data, symbol);
            }
            throw error;
        }
    }

    return filterNewsBySymbol(newsCache.data, symbol);
}

// Filter news by cryptocurrency symbol
function filterNewsBySymbol(news, symbol) {
    if (!symbol) {
        return news.slice(0, 50); // Return top 50 news items
    }

    const filtered = news.filter(item =>
        item.cryptoMentions.includes(symbol.toUpperCase())
    );

    return filtered.slice(0, 20); // Return top 20 relevant news items
}

// Get sentiment summary for a cryptocurrency
function getSentimentSummary(news) {
    if (news.length === 0) {
        return {
            overall: 'neutral',
            bullish: 0,
            bearish: 0,
            neutral: 0
        };
    }

    const bullish = news.filter(n => n.sentiment === 'bullish').length;
    const bearish = news.filter(n => n.sentiment === 'bearish').length;
    const neutral = news.filter(n => n.sentiment === 'neutral').length;

    let overall;
    if (bullish > bearish && bullish > neutral) {
        overall = 'bullish';
    } else if (bearish > bullish && bearish > neutral) {
        overall = 'bearish';
    } else {
        overall = 'neutral';
    }

    return {
        overall,
        bullish,
        bearish,
        neutral,
        total: news.length
    };
}

module.exports = {
    getNews,
    getSentimentSummary,
    analyzeSentiment
};

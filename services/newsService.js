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

// Fetch news from all RSS feeds
async function fetchAllNews() {
    const allNews = [];

    for (const feedUrl of config.newsFeeds) {
        try {
            const feed = await parser.parseURL(feedUrl);

            feed.items.forEach(item => {
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
                    source: new URL(feedUrl).hostname.replace('www.', ''),
                    sentiment: sentiment.sentiment,
                    sentimentIcon: sentiment.icon,
                    cryptoMentions: mentions,
                    timestamp: new Date(item.pubDate || item.isoDate).getTime()
                });
            });
        } catch (error) {
            console.error(`Error fetching feed ${feedUrl}:`, error.message);
        }
    }

    // Sort by date (newest first)
    allNews.sort((a, b) => b.timestamp - a.timestamp);

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

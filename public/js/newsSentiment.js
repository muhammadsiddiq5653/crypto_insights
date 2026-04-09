// ── NEWS SENTIMENT AI SCORING ──────────────────────────────────────────────
// Weighted keyword sentiment analysis. Enriches news cards and sentiment dashboard.

const SENTIMENT_POSITIVE_WEIGHTS = {
    'surge': 3, 'rally': 3, 'breakout': 3, 'all-time high': 4, 'adoption': 2,
    'approve': 2, 'bullish': 3, 'partnership': 2, 'upgrade': 2, 'launch': 1,
    'growth': 1, 'gain': 2, 'recover': 2, 'pump': 2, 'moon': 2,
    'green': 1, 'hodl': 1, 'accumulate': 2
};

const SENTIMENT_NEGATIVE_WEIGHTS = {
    'crash': 4, 'hack': 4, 'ban': 3, 'lawsuit': 3, 'fud': 3,
    'dump': 3, 'fear': 2, 'bearish': 3, 'scam': 4, 'fraud': 4,
    'regulation': 2, 'selloff': 3, 'panic': 3, 'liquidation': 3,
    'warning': 2, 'concern': 1, 'drop': 2, 'fall': 2, 'plunge': 3, 'bear': 2
};

const SENTIMENT_CACHE_KEY = 'tp_news_sentiment';

// ── SCORE A SINGLE TEXT ────────────────────────────────────────────────────

function scoreSentiment(text) {
    if (!text || typeof text !== 'string') {
        return { score: 0, label: 'Neutral', positive_hits: 0, negative_hits: 0, confidence: 0 };
    }

    const lower = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    let posHits = 0;
    let negHits = 0;

    // Count positive words
    Object.entries(SENTIMENT_POSITIVE_WEIGHTS).forEach(([word, weight]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = (lower.match(regex) || []).length;
        if (matches > 0) {
            positiveScore += matches * weight;
            posHits += matches;
        }
    });

    // Count negative words
    Object.entries(SENTIMENT_NEGATIVE_WEIGHTS).forEach(([word, weight]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = (lower.match(regex) || []).length;
        if (matches > 0) {
            negativeScore += matches * weight;
            negHits += matches;
        }
    });

    let score = positiveScore - negativeScore;
    score = Math.max(-100, Math.min(100, score));

    let label = 'Neutral';
    if (score > 20) label = 'Bullish';
    else if (score > 5) label = 'Slightly Bullish';
    else if (score > -5) label = 'Neutral';
    else if (score > -20) label = 'Slightly Bearish';
    else label = 'Bearish';

    const totalHits = posHits + negHits;
    const confidence = totalHits > 0 ? Math.min(100, (totalHits / 10) * 100) : 0;

    return {
        score: Math.round(score),
        label: label,
        positive_hits: posHits,
        negative_hits: negHits,
        confidence: Math.round(confidence)
    };
}

// ── SCORE ALL NEWS ARTICLES ────────────────────────────────────────────────

function scoreAllNews(articles) {
    if (!Array.isArray(articles)) return [];
    return articles.map(article => ({
        ...article,
        sentiment: scoreSentiment(article.title + ' ' + (article.description || '') + ' ' + (article.content || ''))
    }));
}

// ── BUILD COIN SENTIMENT MAP ───────────────────────────────────────────────

function buildCoinSentimentMap(articles) {
    const map = {};
    const coinList = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'MATIC', 'DOT', 'LTC'];

    articles.forEach(article => {
        const text = (article.title + ' ' + (article.description || '')).toUpperCase();
        const sentiment = article.sentiment || scoreSentiment(article.title + ' ' + (article.description || ''));

        coinList.forEach(coin => {
            if (text.includes(coin)) {
                if (!map[coin]) {
                    map[coin] = { scores: [], count: 0, trend: [] };
                }
                map[coin].scores.push(sentiment.score);
                map[coin].count += 1;
            }
        });
    });

    // Compute avg and trend
    const result = {};
    Object.entries(map).forEach(([coin, data]) => {
        const avg = data.scores.length > 0
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : 0;
        result[coin] = {
            avgScore: avg,
            count: data.count,
            trend: data.scores.length > 0 ? (data.scores[data.scores.length - 1] > avg ? 'up' : 'down') : 'neutral'
        };
    });

    return result;
}

// ── RENDER SENTIMENT TREND CHART ───────────────────────────────────────────

function renderSentimentTrendChart(coin, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const cached = localStorage.getItem(SENTIMENT_CACHE_KEY);
        let allNews = cached ? JSON.parse(cached) : [];

        // Filter for this coin
        const coinNews = allNews.filter(n => {
            const text = (n.title || '').toUpperCase();
            return text.includes(coin);
        }).slice(-7).reverse();

        if (coinNews.length === 0) {
            container.innerHTML = '<small>No sentiment data for ' + coin + '</small>';
            return;
        }

        const maxScore = Math.max(...coinNews.map(n => Math.abs(n.sentiment?.score || 0)), 1);
        const height = 50;

        const html = `
        <div style="display: flex; gap: 3px; align-items: flex-end; height: ${height}px;">
            ${coinNews.map(n => {
                const s = n.sentiment?.score || 0;
                const barH = (Math.abs(s) / maxScore) * height;
                return `<div style="
                    width: 12px;
                    height: ${barH}px;
                    background: ${s > 0 ? '#10b981' : s < 0 ? '#ef4444' : '#d1d5db'};
                    border-radius: 2px;
                " title="${n.sentiment?.label}: ${s}"></div>`;
            }).join('')}
        </div>
        `;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<small>Error loading sentiment chart</small>';
    }
}

// ── CACHE SENTIMENT DATA ───────────────────────────────────────────────────

function cacheSentimentData(articles) {
    try {
        const scored = scoreAllNews(articles);
        let cached = [];
        try {
            const raw = localStorage.getItem(SENTIMENT_CACHE_KEY);
            cached = raw ? JSON.parse(raw) : [];
        } catch (e) {}

        // Keep last 50
        const combined = [...scored, ...cached].slice(0, 50);
        localStorage.setItem(SENTIMENT_CACHE_KEY, JSON.stringify(combined));
        return combined;
    } catch (e) {
        return articles;
    }
}

// ── GET SENTIMENT SUMMARY ──────────────────────────────────────────────────

function getSentimentSummary() {
    try {
        const cached = localStorage.getItem(SENTIMENT_CACHE_KEY);
        const articles = cached ? JSON.parse(cached) : [];

        const bullish = articles.filter(a => a.sentiment?.score > 20).length;
        const bearish = articles.filter(a => a.sentiment?.score < -20).length;
        const neutral = articles.filter(a => {
            const s = a.sentiment?.score || 0;
            return s >= -20 && s <= 20;
        }).length;

        let overallScore = 0;
        if (articles.length > 0) {
            overallScore = Math.round(articles.reduce((sum, a) => sum + (a.sentiment?.score || 0), 0) / articles.length);
        }

        // Find top bullish/bearish coins
        const coinMap = buildCoinSentimentMap(articles);
        let topBullish = null, topBearish = null;
        let maxBull = -Infinity, maxBear = Infinity;

        Object.entries(coinMap).forEach(([coin, data]) => {
            if (data.avgScore > maxBull) {
                topBullish = coin;
                maxBull = data.avgScore;
            }
            if (data.avgScore < maxBear) {
                topBearish = coin;
                maxBear = data.avgScore;
            }
        });

        return {
            overallScore,
            bullishCount: bullish,
            bearishCount: bearish,
            neutralCount: neutral,
            topBullishCoin: topBullish,
            topBearishCoin: topBearish,
            lastUpdated: new Date().toISOString()
        };
    } catch (e) {
        return {
            overallScore: 0,
            bullishCount: 0,
            bearishCount: 0,
            neutralCount: 0,
            topBullishCoin: null,
            topBearishCoin: null,
            lastUpdated: null
        };
    }
}

// ── AUTO-ENHANCE NEWS CARDS ────────────────────────────────────────────────

function autoEnhanceNewsCards() {
    try {
        const newsCards = document.querySelectorAll('[data-news-id]');
        newsCards.forEach(card => {
            const title = card.querySelector('[data-news-title]')?.textContent || '';
            const desc = card.querySelector('[data-news-desc]')?.textContent || '';
            const sentiment = scoreSentiment(title + ' ' + desc);

            // Add sentiment badge
            let badgeClass = 'sentiment-neutral';
            if (sentiment.score > 20) badgeClass = 'sentiment-bullish';
            else if (sentiment.score < -20) badgeClass = 'sentiment-bearish';

            const badge = document.createElement('span');
            badge.className = `sentiment-badge ${badgeClass}`;
            badge.textContent = `${sentiment.label} (${sentiment.score > 0 ? '+' : ''}${sentiment.score})`;
            badge.style.fontSize = '0.8em';
            badge.style.padding = '4px 8px';
            badge.style.borderRadius = '4px';
            badge.style.marginTop = '8px';
            badge.style.display = 'inline-block';

            const sentimentEl = card.querySelector('[data-sentiment]');
            if (sentimentEl) {
                sentimentEl.innerHTML = '';
                sentimentEl.appendChild(badge);
            } else {
                card.appendChild(badge);
            }
        });
    } catch (e) {
        console.log('News enhancement error:', e);
    }
}

// Export globally
window.scoreSentiment = scoreSentiment;
window.scoreAllNews = scoreAllNews;
window.buildCoinSentimentMap = buildCoinSentimentMap;
window.renderSentimentTrendChart = renderSentimentTrendChart;
window.cacheSentimentData = cacheSentimentData;
window.getSentimentSummary = getSentimentSummary;
window.autoEnhanceNewsCards = autoEnhanceNewsCards;

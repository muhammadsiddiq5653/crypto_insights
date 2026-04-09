/**
 * Sentiment Dashboard - Vanilla JS
 * Displays Fear & Greed Index, news sentiment, market signals, and trending topics
 */

const SentimentDash = {
  container: null,
  fearGreedData: null,
  newsData: null,
  signals: null,

  async initSentimentDash() {
    this.container = document.getElementById('sentiment');
    if (!this.container) {
      console.error('Sentiment container not found');
      return;
    }

    // Render shell
    this.renderShell();

    // Load data in parallel
    await Promise.all([
      this.loadFearGreed(),
      this.loadNews(),
      this.computeSignals()
    ]);

    // Populate sections
    this.renderFearGreed();
    this.renderNews();
    this.renderSignals();
    this.renderTrendingTopics();
  },

  renderShell() {
    this.container.innerHTML = `
      <div class="sentiment-dashboard">
        <div class="sent-section sent-fg-section">
          <h2>Fear & Greed Index</h2>
          <div class="sent-fg-wrap" id="fearGreedGauge"></div>
          <div class="sent-fg-history" id="fgHistory"></div>
          <div class="sent-fg-insight" id="fgInsight"></div>
        </div>

        <div class="sent-section sent-news-section">
          <h2>Crypto News Sentiment</h2>
          <div class="sent-news-grid" id="newsGrid"></div>
        </div>

        <div class="sent-section sent-signals-section">
          <h2>Market Signals</h2>
          <div class="sent-signals-row" id="signalsRow"></div>
        </div>

        <div class="sent-section sent-trending-section">
          <h2>Trending Topics</h2>
          <div class="sent-trending" id="trendingTopics"></div>
        </div>
      </div>
    `;
  },

  async loadFearGreed() {
    try {
      const response = await fetch('/api/sentiment/fear-greed');
      this.fearGreedData = await response.json();
    } catch (e) {
      console.warn('Failed to load fear-greed data:', e);
      // Mock data for demo
      this.fearGreedData = {
        value: 42,
        history: [
          { date: '2026-03-29', value: 42 },
          { date: '2026-03-28', value: 45 },
          { date: '2026-03-27', value: 38 },
          { date: '2026-03-26', value: 35 },
          { date: '2026-03-25', value: 52 },
          { date: '2026-03-24', value: 58 },
          { date: '2026-03-23', value: 48 }
        ]
      };
    }
  },

  async loadNews() {
    try {
      const response = await fetch('/api/news?category=crypto&symbol=BTC');
      const data = await response.json();
      this.newsData = (data.articles || data || []).slice(0, 6);
    } catch (e) {
      console.warn('Failed to load news:', e);
      // Mock data for demo
      this.newsData = [
        {
          title: 'Bitcoin Surges to New All-Time High After Institutional Adoption',
          source: 'CryptoNews',
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          title: 'Ethereum Network Upgrade Breakout Rally Expected',
          source: 'BlockchainToday',
          publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        },
        {
          title: 'Market Crash Fears as FUD Spreads',
          source: 'CryptoWatch',
          publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          title: 'Major Hack Leads to Bear Market Concerns',
          source: 'SecurityAlert',
          publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        },
        {
          title: 'Altcoin Rally Approved by Major Exchange',
          source: 'ExchangeNews',
          publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
        },
        {
          title: 'Regulatory Approval Drives Positive Sentiment',
          source: 'PolicyNews',
          publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ];
    }
  },

  async computeSignals() {
    // In a real scenario, these would be computed from live data
    this.signals = {
      bitcoinDominance: 45.2,
      altcoinSeason: 52,
      fundingRate: -0.85
    };
  },

  renderFearGreed() {
    const value = this.fearGreedData.value;
    const gaugeEl = document.getElementById('fearGreedGauge');

    // SVG Gauge
    gaugeEl.innerHTML = this.createGaugeSVG(value);

    // Render history
    const historyEl = document.getElementById('fgHistory');
    historyEl.innerHTML = '<div class="history-blocks">' +
      this.fearGreedData.history.map(h => {
        const color = this.getGaugeColor(h.value);
        return `<div class="history-block" style="background-color: ${color}; background: linear-gradient(to top, ${color}cc 50%, ${color}33 100%);" title="${h.date}: ${h.value}"></div>`;
      }).join('') +
      '</div>';

    // Render insight
    const insightEl = document.getElementById('fgInsight');
    insightEl.textContent = this.getInsightText(value);
  },

  createGaugeSVG(value) {
    const radius = 60;
    const cx = 70;
    const cy = 70;
    const startAngle = 180;
    const endAngle = 360;
    const totalAngle = endAngle - startAngle;
    const angle = startAngle + (value / 100) * totalAngle;

    // Convert angle to radians
    const rad = (angle * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);

    // Color based on value
    const color = this.getGaugeColor(value);
    const label = this.getGaugeLabel(value);

    return `
      <svg width="140" height="140" viewBox="0 0 140 140" class="sent-fg-gauge">
        <!-- Background arc -->
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff4444;stop-opacity:1" />
            <stop offset="25%" style="stop-color:#ffaa00;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#ffdd00;stop-opacity:1" />
            <stop offset="75%" style="stop-color:#88dd00;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#22dd22;stop-opacity:1" />
          </linearGradient>
        </defs>

        <!-- Outer arc (gradient background) -->
        <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}"
              fill="none" stroke="url(#gaugeGrad)" stroke-width="8" stroke-linecap="round" opacity="0.4" />

        <!-- Active arc -->
        <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${x} ${y}"
              fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" />

        <!-- Center circle -->
        <circle cx="${cx}" cy="${cy}" r="30" fill="white" stroke="${color}" stroke-width="2" />

        <!-- Value text -->
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" class="sent-fg-value" font-size="28" font-weight="bold" fill="${color}">
          ${value}
        </text>

        <!-- Label -->
        <text x="${cx}" y="130" text-anchor="middle" class="sent-fg-label" font-size="12" fill="#666">
          ${label}
        </text>
      </svg>
    `;
  },

  getGaugeColor(value) {
    if (value < 25) return '#ff4444';      // Extreme Fear - red
    if (value < 45) return '#ffaa00';      // Fear - orange
    if (value < 55) return '#ffdd00';      // Neutral - yellow
    if (value < 75) return '#88dd00';      // Greed - light green
    return '#22dd22';                      // Extreme Greed - green
  },

  getGaugeLabel(value) {
    if (value < 25) return 'Extreme Fear';
    if (value < 45) return 'Fear';
    if (value < 55) return 'Neutral';
    if (value < 75) return 'Greed';
    return 'Extreme Greed';
  },

  getInsightText(value) {
    if (value < 25) return '🛒 Historically a good time to accumulate — be greedy when others are fearful';
    if (value < 45) return '⚠️ Market fearful — dip buyers active, watch for reversal signals';
    if (value < 55) return '⚖️ Neutral market — follow the trend, no extreme positioning';
    if (value < 75) return '📈 Market greedy — momentum trading favorable, watch for overextension';
    return '🚨 Extreme greed — consider taking profits, market may be overheated';
  },

  renderNews() {
    const grid = document.getElementById('newsGrid');
    grid.innerHTML = this.newsData.map(article => {
      const sentiment = this.computeNewsSentiment(article.title);
      const badge = this.getSentimentBadge(sentiment);
      const timeAgo = this.getTimeAgo(new Date(article.publishedAt));
      const titleTrunc = article.title.substring(0, 80) + (article.title.length > 80 ? '...' : '');

      return `
        <div class="sent-news-card">
          <div class="card-header">
            <span class="sent-badge sent-badge-${sentiment}">${badge}</span>
          </div>
          <h4>${titleTrunc}</h4>
          <p class="meta">${article.source} • ${timeAgo}</p>
        </div>
      `;
    }).join('');
  },

  computeNewsSentiment(title) {
    const bullishWords = ['bullish', 'surge', 'rally', 'breakout', 'all-time', 'adopt', 'approve', 'gains', 'pump', 'bull'];
    const bearishWords = ['crash', 'bear', 'hack', 'ban', 'lawsuit', 'fud', 'dump', 'fear', 'decline', 'bearish'];

    const lowerTitle = title.toLowerCase();
    let bullishCount = bullishWords.filter(w => lowerTitle.includes(w)).length;
    let bearishCount = bearishWords.filter(w => lowerTitle.includes(w)).length;

    if (bullishCount > bearishCount) return 'bullish';
    if (bearishCount > bullishCount) return 'bearish';
    return 'neutral';
  },

  getSentimentBadge(sentiment) {
    if (sentiment === 'bullish') return '🟢 Bullish';
    if (sentiment === 'bearish') return '🔴 Bearish';
    return '⚪ Neutral';
  },

  getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  },

  renderSignals() {
    const row = document.getElementById('signalsRow');
    const signals = [
      {
        name: 'Bitcoin Dominance',
        value: this.signals.bitcoinDominance,
        unit: '%',
        explanation: this.signals.bitcoinDominance > 50 ? 'BTC dominance high' : 'Alt season brewing'
      },
      {
        name: 'Altcoin Season',
        value: this.signals.altcoinSeason,
        unit: '',
        explanation: this.signals.altcoinSeason > 60 ? 'Strong alt momentum' : 'Wait for confirmation'
      },
      {
        name: 'Funding Rate',
        value: this.signals.fundingRate.toFixed(2),
        unit: '%',
        explanation: this.signals.fundingRate > 0 ? 'Longs overextended' : 'Shorts building'
      }
    ];

    row.innerHTML = signals.map(signal => {
      const isPositive = parseFloat(signal.value) > 0;
      const color = isPositive ? '#88dd00' : '#ffaa00';

      return `
        <div class="sent-signal-card">
          <h5>${signal.name}</h5>
          <div class="signal-value" style="color: ${color};">${signal.value}${signal.unit}</div>
          <p class="signal-explanation">${signal.explanation}</p>
        </div>
      `;
    }).join('');
  },

  renderTrendingTopics() {
    const container = document.getElementById('trendingTopics');

    // Extract coin mentions from news
    const mentions = {};
    const coinSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'POLKA', 'AVAX', 'LINK'];

    this.newsData.forEach(article => {
      const text = (article.title + ' ' + (article.description || '')).toUpperCase();
      coinSymbols.forEach(coin => {
        if (text.includes(coin)) {
          mentions[coin] = (mentions[coin] || 0) + 1;
        }
      });
    });

    // Get top 5
    const top5 = Object.entries(mentions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (top5.length === 0) {
      container.innerHTML = '<p>No trending coins detected</p>';
      return;
    }

    const maxMentions = Math.max(...top5.map(t => t[1]));

    container.innerHTML = top5.map(([coin, count]) => {
      const percentage = (count / maxMentions) * 100;
      const trending = count >= 3 ? '🔥' : '';

      return `
        <div class="sent-trend-item">
          <div class="trend-label">${coin} ${trending}</div>
          <div class="sent-trend-bar">
            <div class="trend-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="trend-count">${count} mentions</div>
        </div>
      `;
    }).join('');
  }
};

// Global initialization function
function initSentimentDash() {
  SentimentDash.initSentimentDash();
}

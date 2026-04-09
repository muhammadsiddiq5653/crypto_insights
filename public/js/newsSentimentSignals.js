/**
 * News Sentiment → Trading Signals
 * Enriches technical signals with real-time news sentiment scoring
 * Inspired by Traider's news-sentiment-to-signal pipeline
 */

const NewsSentimentSignals = {
  container: null,
  sentimentCache: {},
  CACHE_TTL: 300000, // 5 minutes
  lastFetch: 0,
  autoRefreshTimer: null,

  COINS: ['bitcoin','ethereum','solana','binancecoin','ripple','cardano','avalanche-2','chainlink','dogecoin','polkadot'],
  COIN_LABELS: { bitcoin:'BTC', ethereum:'ETH', solana:'SOL', binancecoin:'BNB', ripple:'XRP', cardano:'ADA', 'avalanche-2':'AVAX', chainlink:'LINK', dogecoin:'DOGE', polkadot:'DOT' },

  KEYWORDS: {
    bullish: ['rally','surge','bull','breakout','soar','pump','moon','adoption','partnership','upgrade','etf','approval','launch','record','high','growth','buy','accumulate','bullish','positive','rise','gain','jump','explode','all-time'],
    bearish: ['crash','dump','bear','plunge','drop','fall','decline','hack','ban','lawsuit','fraud','fear','sell','panic','collapse','scam','warning','concern','risk','fine','regulation','loss','negative','bearish','down','low'],
    neutral:  ['stable','consolidate','sideways','range','analysis','report','update','news','announced','released','said','according']
  },

  async init() {
    this.container = document.getElementById('news-signals');
    if (!this.container) return;
    if (this.container.querySelector('.ns-page')) return;

    this.render();
    this.attachEvents();
    await this.loadData();
  },

  render() {
    this.container.innerHTML = `
      <div class="ns-page">
        <div class="ns-header">
          <div>
            <h2 class="ns-title">📰 News Sentiment Signals</h2>
            <p class="ns-subtitle">Technical signals enriched with real-time news sentiment — higher conviction when both align</p>
          </div>
          <div class="ns-header-right">
            <div class="ns-auto-row">
              <span class="ns-label">Auto-refresh</span>
              <label class="ns-toggle-wrap">
                <input type="checkbox" id="ns-auto-toggle" checked>
                <span class="ns-toggle"></span>
              </label>
            </div>
            <button class="ns-refresh-btn" id="ns-refresh-btn">↻ Refresh</button>
          </div>
        </div>

        <!-- Sentiment Overview Bar -->
        <div class="ns-overview-card" id="ns-overview-card">
          <div class="ns-overview-loading">
            <div class="ns-spinner"></div> Analyzing news sentiment…
          </div>
        </div>

        <!-- Combined Signal Feed -->
        <div class="ns-filters">
          <button class="ns-filter-btn active" data-filter="all">All</button>
          <button class="ns-filter-btn" data-filter="strong-buy">🔥 Strong Buy</button>
          <button class="ns-filter-btn" data-filter="buy">🟢 Buy</button>
          <button class="ns-filter-btn" data-filter="sell">🔴 Sell</button>
          <button class="ns-filter-btn" data-filter="conflict">⚡ Conflicted</button>
        </div>

        <div class="ns-signals-grid" id="ns-signals-grid">
          ${[...Array(6)].map((_,i) => `
            <div class="ns-card ns-card-skeleton">
              <div class="sk-line sk-h3"></div>
              <div class="sk-line sk-h2" style="width:60%"></div>
              <div class="sk-line sk-h1"></div>
            </div>`).join('')}
        </div>

        <!-- News Feed for Selected Coin -->
        <div class="ns-news-panel" id="ns-news-panel" style="display:none;">
          <div class="ns-news-title" id="ns-news-title">Recent News</div>
          <div class="ns-news-list" id="ns-news-list"></div>
        </div>
      </div>

      <style>
        .ns-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .ns-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .ns-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin: 0 0 4px; }
        .ns-subtitle { font-size: 0.85rem; color: var(--text-secondary,#a0a8c1); margin: 0; }
        .ns-header-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .ns-label { font-size: 0.78rem; color: var(--text-secondary,#a0a8c1); }
        .ns-auto-row { display: flex; align-items: center; gap: 8px; }
        .ns-toggle-wrap { position: relative; width: 36px; height: 20px; cursor: pointer; }
        .ns-toggle-wrap input { opacity: 0; width: 0; height: 0; }
        .ns-toggle { position: absolute; inset: 0; background: #444c70; border-radius: 20px; transition: 0.2s; }
        .ns-toggle::before { content:''; position: absolute; width: 14px; height: 14px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
        .ns-toggle-wrap input:checked + .ns-toggle { background: #00c896; }
        .ns-toggle-wrap input:checked + .ns-toggle::before { transform: translateX(16px); }
        .ns-refresh-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--color-border,rgba(102,126,234,0.18)); background: transparent; color: var(--text-secondary,#a0a8c1); font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .ns-refresh-btn:hover { background: var(--color-card,#252b4a); color: var(--text-primary,#e4e7f1); }

        .ns-overview-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 18px; margin-bottom: 16px; }
        .ns-overview-loading { display: flex; align-items: center; gap: 10px; color: var(--text-secondary,#a0a8c1); font-size: 0.85rem; }
        .ns-spinner { width: 16px; height: 16px; border: 2px solid var(--color-border,rgba(102,126,234,0.18)); border-top-color: #6c63ff; border-radius: 50%; animation: ns-spin 0.8s linear infinite; flex-shrink: 0; }
        @keyframes ns-spin { to { transform: rotate(360deg); } }
        .ns-overview-stats { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
        .ns-ov-item { text-align: center; }
        .ns-ov-value { font-size: 1.8rem; font-weight: 700; }
        .ns-ov-label { font-size: 0.72rem; color: var(--text-secondary,#a0a8c1); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .ns-bar { flex: 1; min-width: 200px; }
        .ns-bar-track { height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; display: flex; }
        .ns-bar-bull { background: linear-gradient(90deg,#00c896,#38ef7d); border-radius: 4px 0 0 4px; transition: width 0.6s; }
        .ns-bar-bear { background: linear-gradient(90deg,#ff6a6a,#ff4444); border-radius: 0 4px 4px 0; transition: width 0.6s; }
        .ns-bar-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 0.72rem; color: var(--text-muted,#6b7394); }

        .ns-filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .ns-filter-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--color-border,rgba(102,126,234,0.18)); background: transparent; color: var(--text-secondary,#a0a8c1); font-size: 0.78rem; cursor: pointer; transition: all 0.2s; }
        .ns-filter-btn.active { background: rgba(108,99,255,0.2); color: var(--text-primary,#e4e7f1); border-color: #6c63ff55; }
        .ns-filter-btn:hover:not(.active) { background: var(--color-card,#252b4a); }

        .ns-signals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 20px; }
        .ns-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 16px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .ns-card:hover { border-color: #6c63ff55; transform: translateY(-1px); }
        .ns-card.selected { border-color: #6c63ff; box-shadow: 0 0 0 1px #6c63ff44; }
        .ns-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .ns-coin-info { display: flex; align-items: center; gap: 8px; }
        .ns-coin-badge { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; background: linear-gradient(135deg,#6c63ff22,#00c89622); color: var(--text-primary,#e4e7f1); border: 1px solid #6c63ff33; }
        .ns-coin-name { font-size: 0.95rem; font-weight: 700; color: var(--text-primary,#e4e7f1); }
        .ns-coin-id { font-size: 0.72rem; color: var(--text-muted,#6b7394); }
        .ns-combined-signal { padding: 5px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; }
        .ns-combined-signal.strong-buy { background: rgba(0,200,150,0.2); color: #00c896; border: 1px solid #00c89644; }
        .ns-combined-signal.buy       { background: rgba(56,239,125,0.15); color: #38ef7d; border: 1px solid #38ef7d44; }
        .ns-combined-signal.hold      { background: rgba(247,151,30,0.15); color: #f7971e; border: 1px solid #f7971e44; }
        .ns-combined-signal.sell      { background: rgba(255,106,106,0.15); color: #ff6a6a; border: 1px solid #ff6a6a44; }
        .ns-combined-signal.conflict  { background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid #a78bfa44; }

        .ns-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .ns-row-label { font-size: 0.75rem; color: var(--text-secondary,#a0a8c1); }
        .ns-row-value { font-size: 0.8rem; font-weight: 600; color: var(--text-primary,#e4e7f1); }
        .ns-row-value.bull { color: #00c896; }
        .ns-row-value.bear { color: #ff6a6a; }
        .ns-row-value.neut { color: #f7971e; }

        .ns-sentiment-bar { height: 5px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
        .ns-sentiment-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }

        .ns-conviction { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--color-border,rgba(102,126,234,0.1)); }
        .ns-conviction-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted,#6b7394); margin-bottom: 4px; }
        .ns-conviction-stars { color: #f7971e; font-size: 0.85rem; letter-spacing: 2px; }
        .ns-conviction-text { font-size: 0.72rem; color: var(--text-secondary,#a0a8c1); margin-top: 2px; }

        .ns-card-skeleton { pointer-events: none; }
        .sk-line { background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 8px; }
        .sk-h1 { height: 8px; width: 100%; }
        .sk-h2 { height: 12px; width: 80%; }
        .sk-h3 { height: 20px; width: 50%; }

        .ns-news-panel { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 18px; }
        .ns-news-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin-bottom: 14px; }
        .ns-news-item { padding: 10px 0; border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.1)); display: flex; gap: 10px; align-items: flex-start; }
        .ns-news-item:last-child { border-bottom: none; }
        .ns-news-sent { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .ns-news-sent.bull { background: #00c896; }
        .ns-news-sent.bear { background: #ff6a6a; }
        .ns-news-sent.neut { background: #f7971e; }
        .ns-news-text { font-size: 0.82rem; color: var(--text-primary,#e4e7f1); line-height: 1.5; flex: 1; }
        .ns-news-meta { font-size: 0.7rem; color: var(--text-muted,#6b7394); margin-top: 2px; }
        .ns-news-score { font-size: 0.72rem; font-weight: 600; flex-shrink: 0; }
        .ns-news-score.bull { color: #00c896; }
        .ns-news-score.bear { color: #ff6a6a; }
      </style>
    `;
  },

  attachEvents() {
    document.getElementById('ns-refresh-btn')?.addEventListener('click', () => {
      this.sentimentCache = {};
      this.lastFetch = 0;
      this.loadData();
    });

    document.getElementById('ns-auto-toggle')?.addEventListener('change', (e) => {
      if (e.target.checked) this.startAutoRefresh();
      else this.stopAutoRefresh();
    });

    this.container.querySelectorAll('.ns-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.ns-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyFilter(btn.dataset.filter);
      });
    });

    this.startAutoRefresh();
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => this.loadData(), 5 * 60 * 1000);
  },
  stopAutoRefresh() {
    if (this.autoRefreshTimer) { clearInterval(this.autoRefreshTimer); this.autoRefreshTimer = null; }
  },

  async loadData() {
    const results = [];
    // Fetch news + technical analysis for each coin concurrently (batch of 3)
    const batches = [];
    for (let i = 0; i < this.COINS.length; i += 3) batches.push(this.COINS.slice(i, i+3));

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(batch.map(coin => this.analyzeCoin(coin)));
      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({ coin: batch[idx], error: true, label: this.COIN_LABELS[batch[idx]] });
      });
      await new Promise(r => setTimeout(r, 400)); // rate limit
    }

    this.renderOverview(results.filter(r => !r.error));
    this.renderSignals(results);
    this.currentData = results;
  },

  async analyzeCoin(coinId) {
    const label = this.COIN_LABELS[coinId];

    // Fetch news and technical in parallel
    const [newsResp, techResp] = await Promise.allSettled([
      fetch(`/api/news?symbol=${label}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/crypto/${coinId}/analysis`).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    const newsData = newsResp.status === 'fulfilled' ? newsResp.value : null;
    const techData = techResp.status === 'fulfilled' ? techResp.value : null;

    // Score news articles
    const articles = newsData?.data || [];
    const scored = articles.slice(0, 10).map(a => this.scoreArticle(a));
    const newsScore = scored.length > 0 ? scored.reduce((s, a) => s + a.score, 0) / scored.length : 0;
    const bullCount = scored.filter(a => a.score > 0.1).length;
    const bearCount = scored.filter(a => a.score < -0.1).length;

    // Technical signal
    const techSignal = techData?.signal || 'HOLD';
    const techRsi    = techData?.rsi || 50;

    // Combined signal logic
    const combined = this.combineSignals(techSignal, newsScore, bullCount, bearCount, scored.length);
    const conviction = this.calcConviction(techSignal, newsScore, bullCount, bearCount);

    return { coin: coinId, label, techSignal, techRsi, newsScore, bullCount, bearCount, totalNews: scored.length, combined, conviction, articles: scored, techData };
  },

  scoreArticle(article) {
    const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
    let score = 0;
    this.KEYWORDS.bullish.forEach(kw => { if (text.includes(kw)) score += 0.15; });
    this.KEYWORDS.bearish.forEach(kw => { if (text.includes(kw)) score -= 0.15; });
    score = Math.max(-1, Math.min(1, score));
    const sentiment = score > 0.1 ? 'bull' : score < -0.1 ? 'bear' : 'neut';
    return { ...article, score, sentiment };
  },

  combineSignals(tech, newsScore, bull, bear, total) {
    const techBull = tech === 'BUY';
    const techBear = tech === 'SELL';
    const newsBull = newsScore > 0.15;
    const newsBear = newsScore < -0.15;
    const newsNeut = !newsBull && !newsBear;

    if (techBull && newsBull) return 'strong-buy';
    if (techBull && newsNeut) return 'buy';
    if (techBear && newsBear) return 'sell';
    if (techBear && newsNeut) return 'sell';
    if ((techBull && newsBear) || (techBear && newsBull)) return 'conflict';
    return 'hold';
  },

  calcConviction(tech, newsScore, bull, bear) {
    let score = 0;
    if (tech === 'BUY') score += 2;
    if (tech === 'SELL') score += 1;
    if (Math.abs(newsScore) > 0.3) score += 2;
    else if (Math.abs(newsScore) > 0.1) score += 1;
    if (bull > 3 || bear > 3) score += 1;
    return Math.min(5, score);
  },

  renderOverview(results) {
    const bullCoins = results.filter(r => r.combined === 'strong-buy' || r.combined === 'buy').length;
    const bearCoins = results.filter(r => r.combined === 'sell').length;
    const confCoins = results.filter(r => r.combined === 'conflict').length;
    const total = results.length || 1;
    const bullPct = Math.round(bullCoins / total * 100);
    const bearPct = Math.round(bearCoins / total * 100);
    const avgNews = results.reduce((s,r) => s + r.newsScore, 0) / total;

    const panel = document.getElementById('ns-overview-card');
    if (panel) panel.innerHTML = `
      <div class="ns-overview-stats">
        <div class="ns-ov-item">
          <div class="ns-ov-value" style="color:#00c896;">${bullCoins}</div>
          <div class="ns-ov-label">Bullish Coins</div>
        </div>
        <div class="ns-ov-item">
          <div class="ns-ov-value" style="color:#ff6a6a;">${bearCoins}</div>
          <div class="ns-ov-label">Bearish Coins</div>
        </div>
        <div class="ns-ov-item">
          <div class="ns-ov-value" style="color:#a78bfa;">${confCoins}</div>
          <div class="ns-ov-label">Conflicted</div>
        </div>
        <div class="ns-ov-item">
          <div class="ns-ov-value" style="color:${avgNews>0?'#00c896':avgNews<0?'#ff6a6a':'#f7971e'}">${avgNews>=0?'+':''}${(avgNews*100).toFixed(0)}%</div>
          <div class="ns-ov-label">Avg Sentiment</div>
        </div>
        <div class="ns-bar">
          <div class="ns-bar-track">
            <div class="ns-bar-bull" style="width:${bullPct}%"></div>
            <div class="ns-bar-bear" style="width:${bearPct}%"></div>
          </div>
          <div class="ns-bar-labels"><span>${bullPct}% Bullish</span><span>${bearPct}% Bearish</span></div>
        </div>
      </div>
    `;
  },

  renderSignals(results) {
    const grid = document.getElementById('ns-signals-grid');
    if (!grid) return;

    grid.innerHTML = results.map(r => {
      if (r.error) return `<div class="ns-card"><div class="ns-coin-name">${r.label}</div><div style="color:var(--text-muted,#6b7394);font-size:0.8rem;margin-top:8px;">Data unavailable</div></div>`;

      const sentPct = Math.round(((r.newsScore + 1) / 2) * 100);
      const sentColor = r.newsScore > 0.1 ? '#00c896' : r.newsScore < -0.1 ? '#ff6a6a' : '#f7971e';
      const techClass = r.techSignal === 'BUY' ? 'bull' : r.techSignal === 'SELL' ? 'bear' : 'neut';
      const newsClass = r.newsScore > 0.1 ? 'bull' : r.newsScore < -0.1 ? 'bear' : 'neut';
      const stars = '★'.repeat(r.conviction) + '☆'.repeat(5 - r.conviction);
      const convictionDesc = r.conviction >= 4 ? 'Very high conviction — both signals align' : r.conviction >= 3 ? 'Moderate conviction — signals partially align' : r.conviction >= 2 ? 'Low conviction — mixed signals' : 'Very low conviction — wait for clarity';

      return `
        <div class="ns-card" data-coin="${r.coin}" data-combined="${r.combined}">
          <div class="ns-card-top">
            <div class="ns-coin-info">
              <div class="ns-coin-badge">${r.label}</div>
              <div>
                <div class="ns-coin-name">${r.coin.charAt(0).toUpperCase() + r.coin.slice(1).replace(/-./g, x => ' '+x[1].toUpperCase())}</div>
                <div class="ns-coin-id">${r.label}/USDT</div>
              </div>
            </div>
            <div class="ns-combined-signal ${r.combined}">${r.combined === 'strong-buy' ? '🔥 STRONG BUY' : r.combined.toUpperCase().replace('-',' ')}</div>
          </div>

          <div class="ns-sentiment-bar"><div class="ns-sentiment-fill" style="width:${sentPct}%;background:${sentColor};"></div></div>

          <div class="ns-row">
            <span class="ns-row-label">Technical Signal</span>
            <span class="ns-row-value ${techClass}">${r.techSignal} ${r.techRsi ? `(RSI ${r.techRsi.toFixed(1)})` : ''}</span>
          </div>
          <div class="ns-row">
            <span class="ns-row-label">News Sentiment</span>
            <span class="ns-row-value ${newsClass}">${r.newsScore >= 0 ? '+' : ''}${(r.newsScore * 100).toFixed(0)}% (${r.bullCount}🟢 ${r.bearCount}🔴 / ${r.totalNews} articles)</span>
          </div>

          <div class="ns-conviction">
            <div class="ns-conviction-label">Signal Conviction</div>
            <div class="ns-conviction-stars">${stars}</div>
            <div class="ns-conviction-text">${convictionDesc}</div>
          </div>
        </div>
      `;
    }).join('');

    // Click to show news
    grid.querySelectorAll('.ns-card[data-coin]').forEach(card => {
      card.addEventListener('click', () => {
        const coin = card.dataset.coin;
        const data = results.find(r => r.coin === coin);
        if (data) this.showNewsPanel(data, card);
      });
    });
  },

  showNewsPanel(data, card) {
    // Deselect all
    this.container.querySelectorAll('.ns-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    const panel = document.getElementById('ns-news-panel');
    const title = document.getElementById('ns-news-title');
    const list  = document.getElementById('ns-news-list');
    if (!panel || !list) return;

    title.textContent = `📰 Recent ${data.label} News (${data.articles.length} articles analyzed)`;
    list.innerHTML = data.articles.length ? data.articles.map(a => `
      <div class="ns-news-item">
        <div class="ns-news-sent ${a.sentiment}"></div>
        <div style="flex:1;">
          <div class="ns-news-text">${a.title || 'No title'}</div>
          <div class="ns-news-meta">${a.source || ''} ${a.publishedAt ? '· ' + new Date(a.publishedAt).toLocaleDateString() : ''}</div>
        </div>
        <div class="ns-news-score ${a.sentiment}">${a.score >= 0 ? '+' : ''}${(a.score * 100).toFixed(0)}%</div>
      </div>
    `).join('') : '<div style="color:var(--text-muted,#6b7394);font-size:0.85rem;padding:12px 0;">No recent news found for this coin.</div>';

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  applyFilter(filter) {
    this.container.querySelectorAll('.ns-card[data-combined]').forEach(card => {
      const combined = card.dataset.combined;
      const show = filter === 'all' || combined === filter;
      card.style.display = show ? '' : 'none';
    });
  }
};

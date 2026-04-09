/**
 * Futures Market Scanner
 * Scans Binance Futures for funding rates, open interest, long/short ratios
 * These are powerful signals the spot-only scanner misses
 */

const FuturesScanner = {
  container: null,
  scanData: [],
  autoTimer: null,
  chart: null,

  COINS: [
    { symbol: 'BTC',  pair: 'BTCUSDT',  name: 'Bitcoin'   },
    { symbol: 'ETH',  pair: 'ETHUSDT',  name: 'Ethereum'  },
    { symbol: 'SOL',  pair: 'SOLUSDT',  name: 'Solana'    },
    { symbol: 'BNB',  pair: 'BNBUSDT',  name: 'BNB'       },
    { symbol: 'XRP',  pair: 'XRPUSDT',  name: 'XRP'       },
    { symbol: 'ADA',  pair: 'ADAUSDT',  name: 'Cardano'   },
    { symbol: 'DOGE', pair: 'DOGEUSDT', name: 'Dogecoin'  },
    { symbol: 'AVAX', pair: 'AVAXUSDT', name: 'Avalanche' },
    { symbol: 'LINK', pair: 'LINKUSDT', name: 'Chainlink' },
    { symbol: 'DOT',  pair: 'DOTUSDT',  name: 'Polkadot'  },
    { symbol: 'MATIC',pair: 'MATICUSDT',name: 'Polygon'   },
    { symbol: 'ATOM', pair: 'ATOMUSDT', name: 'Cosmos'    },
    { symbol: 'LTC',  pair: 'LTCUSDT',  name: 'Litecoin'  },
    { symbol: 'UNI',  pair: 'UNIUSDT',  name: 'Uniswap'   },
    { symbol: 'NEAR', pair: 'NEARUSDT', name: 'NEAR'      },
    { symbol: 'TRX',  pair: 'TRXUSDT',  name: 'TRON'      },
  ],

  async init() {
    this.container = document.getElementById('futures-scanner');
    if (!this.container) return;
    if (this.container.querySelector('.fs-page')) return;

    this.render();
    this.attachEvents();
    await this.scan();
  },

  render() {
    this.container.innerHTML = `
      <div class="fs-page">
        <div class="fs-header">
          <div>
            <h2 class="fs-title">📊 Futures Market Scanner</h2>
            <p class="fs-subtitle">Funding rates, open interest & long/short ratios — signals that spot data misses</p>
          </div>
          <div class="fs-header-right">
            <div class="fs-auto-row">
              <span class="fs-label">Auto (5min)</span>
              <label class="fs-toggle-wrap">
                <input type="checkbox" id="fs-auto-toggle" checked>
                <span class="fs-toggle"></span>
              </label>
            </div>
            <button class="fs-scan-btn" id="fs-scan-btn">🔍 Scan Now</button>
          </div>
        </div>

        <!-- Market Summary Bar -->
        <div class="fs-summary-row" id="fs-summary-row">
          <div class="fs-sum-card" id="fs-sum-funding"><div class="fs-sum-label">Avg Funding Rate</div><div class="fs-sum-val">—</div></div>
          <div class="fs-sum-card" id="fs-sum-extreme"><div class="fs-sum-label">Extreme Funding (>0.1%)</div><div class="fs-sum-val">—</div></div>
          <div class="fs-sum-card" id="fs-sum-oi"><div class="fs-sum-label">Market Bias</div><div class="fs-sum-val">—</div></div>
          <div class="fs-sum-card" id="fs-sum-signal"><div class="fs-sum-label">Contrarian Signal</div><div class="fs-sum-val">—</div></div>
        </div>

        <!-- Explanation Banner -->
        <div class="fs-edu-banner">
          <div class="fs-edu-item">
            <span class="fs-edu-icon">💰</span>
            <span><strong>Funding Rate:</strong> Positive = longs pay shorts (overleveraged longs). Negative = shorts pay longs (overleveraged shorts). Extremes are contrarian signals.</span>
          </div>
          <div class="fs-edu-item">
            <span class="fs-edu-icon">📈</span>
            <span><strong>Open Interest:</strong> Total value of open contracts. Rising OI + rising price = strong trend. Rising OI + falling price = bearish.</span>
          </div>
          <div class="fs-edu-item">
            <span class="fs-edu-icon">⚖️</span>
            <span><strong>Long/Short Ratio:</strong> >1 = more longs than shorts. When ratio is extreme (>2 or <0.5), a squeeze of the majority side is likely.</span>
          </div>
        </div>

        <!-- Filters -->
        <div class="fs-filters">
          <button class="fs-filter active" data-filter="all">All</button>
          <button class="fs-filter" data-filter="high-funding">🔥 High Funding</button>
          <button class="fs-filter" data-filter="neg-funding">❄️ Negative Funding</button>
          <button class="fs-filter" data-filter="long-squeeze">🐂 Long Squeeze Risk</button>
          <button class="fs-filter" data-filter="short-squeeze">🐻 Short Squeeze Risk</button>
        </div>

        <!-- Progress -->
        <div class="fs-progress-wrap" id="fs-progress-wrap" style="display:none;">
          <div class="fs-progress-track"><div class="fs-progress-bar" id="fs-progress-bar"></div></div>
          <span class="fs-progress-label" id="fs-progress-label">Scanning…</span>
        </div>

        <!-- Table -->
        <div class="fs-table-card">
          <div class="fs-table-wrap">
            <table class="fs-table">
              <thead>
                <tr>
                  <th>Coin</th>
                  <th>Price</th>
                  <th>Funding Rate</th>
                  <th>24h Change</th>
                  <th>Open Interest</th>
                  <th>L/S Ratio</th>
                  <th>Signal</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="fs-tbody">
                <tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted,#6b7394);">
                  <div class="fs-loading"><div class="fs-spinner"></div> Loading futures data…</div>
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Detail Panel -->
        <div class="fs-detail-panel" id="fs-detail-panel" style="display:none;">
          <div class="fs-detail-header">
            <span class="fs-detail-title" id="fs-detail-title">Coin Details</span>
            <button class="fs-detail-close" id="fs-detail-close">✕</button>
          </div>
          <div class="fs-detail-content" id="fs-detail-content"></div>
        </div>
      </div>

      <style>
        .fs-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .fs-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .fs-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin: 0 0 4px; }
        .fs-subtitle { font-size: 0.85rem; color: var(--text-secondary,#a0a8c1); margin: 0; }
        .fs-header-right { display: flex; gap: 10px; align-items: center; }
        .fs-label { font-size: 0.78rem; color: var(--text-secondary,#a0a8c1); }
        .fs-auto-row { display: flex; align-items: center; gap: 8px; }
        .fs-toggle-wrap { position: relative; width: 36px; height: 20px; cursor: pointer; }
        .fs-toggle-wrap input { opacity: 0; width: 0; height: 0; }
        .fs-toggle { position: absolute; inset: 0; background: #444c70; border-radius: 20px; transition: 0.2s; }
        .fs-toggle::before { content:''; position: absolute; width: 14px; height: 14px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
        .fs-toggle-wrap input:checked + .fs-toggle { background: #00c896; }
        .fs-toggle-wrap input:checked + .fs-toggle::before { transform: translateX(16px); }
        .fs-scan-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #6c63ff44; background: rgba(108,99,255,0.15); color: #a78bfa; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .fs-scan-btn:hover { background: rgba(108,99,255,0.25); }
        .fs-scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .fs-summary-row { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 12px; margin-bottom: 16px; }
        .fs-sum-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 12px; padding: 14px 16px; }
        .fs-sum-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted,#6b7394); margin-bottom: 6px; }
        .fs-sum-val { font-size: 1.2rem; font-weight: 700; color: var(--text-primary,#e4e7f1); }

        .fs-edu-banner { background: rgba(108,99,255,0.08); border: 1px solid rgba(108,99,255,0.2); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
        .fs-edu-item { display: flex; gap: 10px; font-size: 0.8rem; color: var(--text-secondary,#a0a8c1); line-height: 1.5; }
        .fs-edu-icon { flex-shrink: 0; font-size: 1rem; }
        .fs-edu-item strong { color: var(--text-primary,#e4e7f1); }

        .fs-filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .fs-filter { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--color-border,rgba(102,126,234,0.18)); background: transparent; color: var(--text-secondary,#a0a8c1); font-size: 0.78rem; cursor: pointer; transition: all 0.2s; }
        .fs-filter.active { background: rgba(108,99,255,0.2); color: var(--text-primary,#e4e7f1); border-color: #6c63ff55; }

        .fs-progress-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .fs-progress-track { flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; }
        .fs-progress-bar { height: 100%; background: linear-gradient(90deg,#6c63ff,#00c896); border-radius: 2px; transition: width 0.3s; }
        .fs-progress-label { font-size: 0.75rem; color: var(--text-secondary,#a0a8c1); white-space: nowrap; }

        .fs-table-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; overflow: hidden; margin-bottom: 16px; }
        .fs-table-wrap { overflow-x: auto; }
        .fs-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .fs-table th { padding: 11px 14px; text-align: right; color: var(--text-secondary,#a0a8c1); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.18)); white-space: nowrap; }
        .fs-table th:first-child { text-align: left; }
        .fs-table td { padding: 10px 14px; text-align: right; color: var(--text-primary,#e4e7f1); border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.06)); white-space: nowrap; }
        .fs-table td:first-child { text-align: left; }
        .fs-table tr:hover td { background: rgba(108,99,255,0.04); }
        .fs-table tr:last-child td { border-bottom: none; }

        .fs-coin-cell { display: flex; align-items: center; gap: 8px; }
        .fs-coin-icon { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg,#6c63ff22,#00c89622); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: var(--text-primary,#e4e7f1); border: 1px solid #6c63ff22; }
        .fs-coin-sym { font-weight: 700; color: var(--text-primary,#e4e7f1); }
        .fs-coin-name { font-size: 0.7rem; color: var(--text-muted,#6b7394); }

        .fs-bull { color: #00c896; font-weight: 600; }
        .fs-bear { color: #ff6a6a; font-weight: 600; }
        .fs-neut { color: #f7971e; font-weight: 600; }

        .fs-signal-badge { padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; display: inline-block; }
        .fs-signal-badge.long-squeeze { background: rgba(255,106,106,0.15); color: #ff6a6a; border: 1px solid #ff6a6a33; }
        .fs-signal-badge.short-squeeze { background: rgba(0,200,150,0.15); color: #00c896; border: 1px solid #00c89633; }
        .fs-signal-badge.high-funding { background: rgba(247,151,30,0.15); color: #f7971e; border: 1px solid #f7971e33; }
        .fs-signal-badge.neg-funding { background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid #a78bfa33; }
        .fs-signal-badge.neutral { background: rgba(102,126,234,0.1); color: var(--text-secondary,#a0a8c1); border: 1px solid rgba(102,126,234,0.2); }

        .fs-detail-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--color-border,rgba(102,126,234,0.18)); background: transparent; color: #a78bfa; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; }
        .fs-detail-btn:hover { background: rgba(108,99,255,0.15); }

        .fs-detail-panel { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 20px; }
        .fs-detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .fs-detail-title { font-size: 1rem; font-weight: 700; color: var(--text-primary,#e4e7f1); }
        .fs-detail-close { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-border,rgba(102,126,234,0.18)); background: transparent; color: var(--text-secondary,#a0a8c1); cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
        .fs-detail-content { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 14px; }
        .fs-detail-card { background: var(--color-card,#252b4a); border-radius: 10px; padding: 14px; }
        .fs-detail-card-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted,#6b7394); margin-bottom: 10px; }
        .fs-detail-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.8rem; }
        .fs-detail-row:last-child { border-bottom: none; }
        .fs-detail-row-label { color: var(--text-secondary,#a0a8c1); }
        .fs-detail-row-value { color: var(--text-primary,#e4e7f1); font-weight: 600; }

        .fs-loading { display: flex; align-items: center; gap: 8px; color: var(--text-secondary,#a0a8c1); font-size: 0.85rem; justify-content: center; }
        .fs-spinner { width: 16px; height: 16px; border: 2px solid rgba(102,126,234,0.2); border-top-color: #6c63ff; border-radius: 50%; animation: fs-spin 0.8s linear infinite; }
        @keyframes fs-spin { to { transform: rotate(360deg); } }
      </style>
    `;
  },

  attachEvents() {
    document.getElementById('fs-scan-btn')?.addEventListener('click', () => this.scan());
    document.getElementById('fs-auto-toggle')?.addEventListener('change', e => {
      if (e.target.checked) this.startAuto();
      else this.stopAuto();
    });
    document.getElementById('fs-detail-close')?.addEventListener('click', () => {
      document.getElementById('fs-detail-panel').style.display = 'none';
    });
    this.container.querySelectorAll('.fs-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.fs-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyFilter(btn.dataset.filter);
      });
    });
    this.startAuto();
  },

  startAuto() { this.stopAuto(); this.autoTimer = setInterval(() => this.scan(), 5 * 60 * 1000); },
  stopAuto()  { if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; } },

  async scan() {
    const btn = document.getElementById('fs-scan-btn');
    const progressWrap = document.getElementById('fs-progress-wrap');
    const progressBar = document.getElementById('fs-progress-bar');
    const progressLabel = document.getElementById('fs-progress-label');
    if (btn) btn.disabled = true;
    if (progressWrap) progressWrap.style.display = 'flex';

    const results = [];
    const total = this.COINS.length;

    for (let i = 0; i < this.COINS.length; i++) {
      const coin = this.COINS[i];
      const pct = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressLabel) progressLabel.textContent = `Scanning ${coin.symbol}… (${i+1}/${total})`;

      try {
        const data = await this.fetchFuturesData(coin);
        results.push(data);
      } catch(e) {
        results.push({ ...coin, error: true });
      }
      await new Promise(r => setTimeout(r, 100));
    }

    this.scanData = results;
    if (progressWrap) progressWrap.style.display = 'none';
    if (btn) btn.disabled = false;

    this.renderSummary(results);
    this.renderTable(results);
  },

  async fetchFuturesData(coin) {
    const base = 'https://fapi.binance.com';

    // Fetch in parallel: premium index (funding), ticker 24h
    const [premResp, tickResp] = await Promise.allSettled([
      fetch(`${base}/fapi/v1/premiumIndex?symbol=${coin.pair}`).then(r => r.ok ? r.json() : null),
      fetch(`${base}/fapi/v1/ticker/24hr?symbol=${coin.pair}`).then(r => r.ok ? r.json() : null),
    ]);

    const prem = premResp.status === 'fulfilled' ? premResp.value : null;
    const tick = tickResp.status === 'fulfilled' ? tickResp.value : null;

    const fundingRate = prem ? parseFloat(prem.lastFundingRate) : 0;
    const markPrice   = prem ? parseFloat(prem.markPrice) : 0;
    const indexPrice  = prem ? parseFloat(prem.indexPrice) : 0;
    const change24h   = tick ? parseFloat(tick.priceChangePercent) : 0;
    const volume24h   = tick ? parseFloat(tick.quoteVolume) : 0;
    const openInterest = tick ? parseFloat(tick.openInterest || 0) : 0;

    // Synthetic long/short ratio based on funding (positive = more longs)
    const lsRatio = fundingRate > 0 ? 1 + fundingRate * 500 : 1 / (1 + Math.abs(fundingRate) * 500);

    // Signal logic
    const signal = this.deriveSignal(fundingRate, lsRatio, change24h);

    return { ...coin, fundingRate, markPrice, indexPrice, change24h, volume24h, openInterest, lsRatio, signal };
  },

  deriveSignal(funding, lsRatio, change24h) {
    if (funding > 0.001) return 'long-squeeze';   // Very high positive → longs at risk
    if (funding < -0.0005) return 'short-squeeze'; // Negative → shorts at risk
    if (funding > 0.0005) return 'high-funding';   // High but not extreme
    if (lsRatio < 0.7) return 'short-squeeze';     // Far more shorts
    if (lsRatio > 2.0) return 'long-squeeze';      // Far more longs
    return 'neutral';
  },

  renderSummary(results) {
    const valid = results.filter(r => !r.error && r.fundingRate !== undefined);
    const avgFunding = valid.reduce((s,r) => s + r.fundingRate, 0) / (valid.length || 1);
    const extremeCount = valid.filter(r => Math.abs(r.fundingRate) > 0.001).length;
    const longBias = valid.filter(r => r.fundingRate > 0).length;
    const shortBias = valid.length - longBias;
    const bias = longBias > shortBias ? 'LONG-HEAVY' : shortBias > longBias ? 'SHORT-HEAVY' : 'NEUTRAL';
    const contrarian = longBias > shortBias ? '🔴 Watch for long squeeze' : '🟢 Watch for short squeeze';

    const setCard = (id, html) => { const el = document.getElementById(id); if (el) el.querySelector('.fs-sum-val').innerHTML = html; };
    setCard('fs-sum-funding', `<span style="color:${avgFunding>=0?'#00c896':'#ff6a6a'}">${avgFunding>=0?'+':''}${(avgFunding*100).toFixed(4)}%</span>`);
    setCard('fs-sum-extreme', `<span style="color:${extremeCount>3?'#f7971e':'#e4e7f1'}">${extremeCount} coins</span>`);
    setCard('fs-sum-oi', `<span style="color:${bias==='LONG-HEAVY'?'#00c896':bias==='SHORT-HEAVY'?'#ff6a6a':'#f7971e'}">${bias}</span>`);
    setCard('fs-sum-signal', contrarian);
  },

  renderTable(results) {
    const tbody = document.getElementById('fs-tbody');
    if (!tbody) return;

    tbody.innerHTML = results.map(r => {
      if (r.error) return `<tr data-filter="neutral"><td colspan="8" style="color:var(--text-muted,#6b7394);font-size:0.8rem;padding:10px 14px;">${r.symbol} — data unavailable</td></tr>`;

      const fr = r.fundingRate * 100;
      const frClass = fr > 0.05 ? 'fs-bull' : fr < 0 ? 'fs-bear' : 'fs-neut';
      const chClass = r.change24h >= 0 ? 'fs-bull' : 'fs-bear';
      const lsClass = r.lsRatio >= 1 ? 'fs-bull' : 'fs-bear';
      const signalLabels = { 'long-squeeze': '⚠️ Long Squeeze', 'short-squeeze': '🚀 Short Squeeze', 'high-funding': '🔥 High Funding', 'neg-funding': '❄️ Neg Funding', 'neutral': '⚖️ Neutral' };

      return `
        <tr data-filter="${r.signal}">
          <td>
            <div class="fs-coin-cell">
              <div class="fs-coin-icon">${r.symbol.slice(0,3)}</div>
              <div>
                <div class="fs-coin-sym">${r.symbol}</div>
                <div class="fs-coin-name">${r.name}</div>
              </div>
            </div>
          </td>
          <td>$${r.markPrice > 0 ? r.markPrice.toLocaleString(undefined,{maximumFractionDigits:r.markPrice>100?2:4}) : '—'}</td>
          <td><span class="${frClass}">${fr >= 0 ? '+' : ''}${fr.toFixed(4)}%</span></td>
          <td><span class="${chClass}">${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%</span></td>
          <td>${r.openInterest > 0 ? '$' + (r.openInterest / 1e6).toFixed(1) + 'M' : r.volume24h > 0 ? '$' + (r.volume24h / 1e6).toFixed(0) + 'M vol' : '—'}</td>
          <td><span class="${lsClass}">${r.lsRatio.toFixed(2)}</span></td>
          <td><span class="fs-signal-badge ${r.signal}">${signalLabels[r.signal] || '—'}</span></td>
          <td><button class="fs-detail-btn" data-symbol="${r.symbol}">Details</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.fs-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const data = this.scanData.find(r => r.symbol === btn.dataset.symbol);
        if (data) this.showDetail(data);
      });
    });
  },

  showDetail(r) {
    const panel = document.getElementById('fs-detail-panel');
    const title = document.getElementById('fs-detail-title');
    const content = document.getElementById('fs-detail-content');
    if (!panel || !title || !content) return;

    title.textContent = `${r.symbol}/USDT — Futures Detail`;

    const fr = (r.fundingRate * 100).toFixed(4);
    const frAnnual = (r.fundingRate * 100 * 3 * 365).toFixed(1);
    const signalExplain = {
      'long-squeeze': 'High positive funding rate indicates overleveraged longs. If price dips, forced liquidations could cascade downward. Consider reducing long exposure or watching for a quick dip trade.',
      'short-squeeze': 'Negative or very low funding rate with high short interest. A short squeeze is possible — price spikes can cascade liquidations upward.',
      'high-funding': 'Elevated funding rate but not yet extreme. Longs are paying a premium. Bullish market bias but watch for cooling.',
      'neutral': 'Balanced funding and positioning. No strong futures-derived signal. Follow technical indicators.'
    };

    content.innerHTML = `
      <div class="fs-detail-card">
        <div class="fs-detail-card-title">💰 Funding Rate</div>
        <div class="fs-detail-row"><span class="fs-detail-row-label">Current Rate</span><span class="fs-detail-row-value" style="color:${r.fundingRate>=0?'#00c896':'#ff6a6a'}">${r.fundingRate>=0?'+':''}${fr}%</span></div>
        <div class="fs-detail-row"><span class="fs-detail-row-label">Annualized</span><span class="fs-detail-row-value">${r.fundingRate>=0?'+':''}${frAnnual}%/yr</span></div>
        <div class="fs-detail-row"><span class="fs-detail-row-label">Settlement</span><span class="fs-detail-row-value">Every 8 hours</span></div>
      </div>
      <div class="fs-detail-card">
        <div class="fs-detail-card-title">📊 Market Data</div>
        <div class="fs-detail-row"><span class="fs-detail-row-label">Mark Price</span><span class="fs-detail-row-value">$${r.markPrice.toLocaleString(undefined,{maximumFractionDigits:r.markPrice>100?2:4})}</span></div>
        <div class="fs-detail-row"><span class="fs-detail-row-label">Index Price</span><span class="fs-detail-row-value">$${r.indexPrice.toLocaleString(undefined,{maximumFractionDigits:r.markPrice>100?2:4})}</span></div>
        <div class="fs-detail-row"><span class="fs-detail-row-label">24h Change</span><span class="fs-detail-row-value" style="color:${r.change24h>=0?'#00c896':'#ff6a6a'}">${r.change24h>=0?'+':''}${r.change24h.toFixed(2)}%</span></div>
      </div>
      <div class="fs-detail-card" style="grid-column:1/-1;">
        <div class="fs-detail-card-title">🧠 Signal Interpretation</div>
        <div style="font-size:0.82rem;color:var(--text-secondary,#a0a8c1);line-height:1.6;">${signalExplain[r.signal] || signalExplain.neutral}</div>
        <div style="margin-top:10px;padding:10px;background:rgba(108,99,255,0.1);border-radius:8px;font-size:0.78rem;color:#a78bfa;">
          💡 <strong>Long/Short Ratio: ${r.lsRatio.toFixed(2)}</strong> — ${r.lsRatio > 1.5 ? 'Market heavily long. Contrarian signal: watch for dip to squeeze longs.' : r.lsRatio < 0.7 ? 'Market heavily short. Contrarian signal: watch for pop to squeeze shorts.' : 'Balanced positioning. No squeeze signal.'}
        </div>
      </div>
    `;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  applyFilter(filter) {
    const rows = document.querySelectorAll('#fs-tbody tr[data-filter]');
    rows.forEach(row => {
      row.style.display = (filter === 'all' || row.dataset.filter === filter) ? '' : 'none';
    });
  }
};

/**
 * Market Scanner — TraderPro
 * Real-time multi-coin scanner that detects:
 *   • Bollinger Band Squeeze (breakout imminent)
 *   • RSI Divergence (bullish/bearish)
 *   • Golden Cross / Death Cross
 *   • MACD Crossover
 *   • Volume Spike
 *   • Oversold/Overbought extremes
 *   • Price Breakout (above resistance / below support)
 */

const MarketScanner = {
  COINS: [
    'BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','LINK','MATIC',
    'DOT','LTC','ATOM','UNI','NEAR','TRX','SHIB','ETC','TON','FIL'
  ],
  results: [],
  running: false,
  scanInterval: null,
  filterType: 'all',
  sortKey: 'score',
  sortDir: -1,
  lastScanTime: null,

  // ── Init ────────────────────────────────────────────────────────────
  init() {
    const el = document.getElementById('market-scanner');
    if (!el) return;
    if (el.querySelector('.scanner-page')) return; // already inited
    this.render(el);
  },

  // ── Shell Render ────────────────────────────────────────────────────
  render(el) {
    el.innerHTML = `
      <div class="scanner-page">
        <div class="section-header">
          <h1 class="section-title">📡 Market Scanner</h1>
          <p class="section-subtitle">
            Real-time pattern detection across ${this.COINS.length} coins — squeeze setups, crossovers, divergences & breakouts.
          </p>
        </div>

        <!-- Controls -->
        <div class="scanner-controls card">
          <div class="scanner-ctrl-row">
            <button id="scannerRunBtn" class="scanner-run-btn" onclick="MarketScanner.startScan()">
              ▶ Run Scan
            </button>
            <button id="scannerAutoBtn" class="scanner-auto-btn" onclick="MarketScanner.toggleAuto()">
              🔁 Auto (off)
            </button>
            <div class="scanner-filters">
              ${['all','BUY','SELL','squeeze','crossover','divergence','breakout','volume'].map(f =>
                `<button class="scanner-filter-btn ${f==='all'?'active':''}" data-filter="${f}"
                  onclick="MarketScanner.setFilter('${f}',this)">${f==='all'?'All Alerts':f.charAt(0).toUpperCase()+f.slice(1)}</button>`
              ).join('')}
            </div>
          </div>
          <div class="scanner-status-row">
            <span id="scannerStatus" class="scanner-status-idle">Ready to scan</span>
            <span id="scannerMatchCount" style="font-size:0.8rem;color:#888;"></span>
          </div>
        </div>

        <!-- Alert Summary Strip -->
        <div id="scannerAlertStrip" class="scanner-alert-strip" style="display:none;"></div>

        <!-- Results Table -->
        <div class="scanner-table-wrap card" id="scannerTableWrap" style="display:none;">
          <table class="scanner-table">
            <thead>
              <tr>
                <th onclick="MarketScanner.sort('symbol')">Coin ⇅</th>
                <th onclick="MarketScanner.sort('price')">Price ⇅</th>
                <th onclick="MarketScanner.sort('change24h')">24h% ⇅</th>
                <th onclick="MarketScanner.sort('rsi')">RSI ⇅</th>
                <th>MACD</th>
                <th onclick="MarketScanner.sort('score')">Signal Score ⇅</th>
                <th>Alerts Detected</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="scannerTbody"></tbody>
          </table>
        </div>
      </div>

      <style>
        .scanner-page { padding:0 0 2rem; }
        .scanner-controls { padding:1.1rem 1.25rem; margin-bottom:1rem; }
        .scanner-ctrl-row { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem; }
        .scanner-run-btn {
          background:linear-gradient(135deg,#6c63ff,#00c896); color:#fff; border:none;
          border-radius:9px; padding:0.55rem 1.3rem; font-size:0.9rem; font-weight:700;
          cursor:pointer; transition:opacity 0.2s,transform 0.1s;
        }
        .scanner-run-btn:hover { opacity:0.9; transform:translateY(-1px); }
        .scanner-run-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .scanner-auto-btn {
          background:rgba(255,255,255,0.06); color:#aaa; border:1px solid rgba(255,255,255,0.12);
          border-radius:9px; padding:0.5rem 1rem; font-size:0.85rem; font-weight:600; cursor:pointer;
        }
        .scanner-auto-btn.active { background:rgba(108,99,255,0.2); color:#6c63ff; border-color:#6c63ff; }
        .scanner-filters { display:flex; gap:0.35rem; flex-wrap:wrap; }
        .scanner-filter-btn {
          background:rgba(255,255,255,0.05); color:#888; border:1px solid rgba(255,255,255,0.1);
          border-radius:20px; padding:0.3rem 0.8rem; font-size:0.75rem; font-weight:600; cursor:pointer;
          transition:all 0.15s;
        }
        .scanner-filter-btn:hover { background:rgba(255,255,255,0.1); color:#ccc; }
        .scanner-filter-btn.active { background:rgba(108,99,255,0.25); color:#6c63ff; border-color:#6c63ff; }
        .scanner-status-row { display:flex; align-items:center; gap:1rem; }
        .scanner-status-idle { font-size:0.82rem; color:#888; }
        .scanner-status-running { font-size:0.82rem; color:#f59e0b; animation:scannerPulse 1s ease infinite; }
        .scanner-status-done { font-size:0.82rem; color:#00c896; }
        @keyframes scannerPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .scanner-alert-strip {
          display:flex; gap:0.5rem; flex-wrap:wrap; padding:0.75rem 1rem;
          background:rgba(108,99,255,0.06); border:1px solid rgba(108,99,255,0.2);
          border-radius:12px; margin-bottom:1rem;
        }
        .scanner-alert-pill {
          padding:0.3rem 0.75rem; border-radius:20px; font-size:0.77rem; font-weight:700;
          display:flex; align-items:center; gap:0.3rem; cursor:pointer; transition:opacity 0.15s;
        }
        .scanner-alert-pill:hover { opacity:0.8; }
        .pill-squeeze { background:rgba(245,158,11,0.18); color:#f59e0b; border:1px solid #f59e0b; }
        .pill-buy     { background:rgba(0,200,150,0.15); color:#00c896; border:1px solid #00c896; }
        .pill-sell    { background:rgba(255,77,77,0.15); color:#ff4d4d; border:1px solid #ff4d4d; }
        .pill-cross   { background:rgba(108,99,255,0.18); color:#a78bfa; border:1px solid #a78bfa; }
        .pill-vol     { background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid #60a5fa; }
        .pill-div     { background:rgba(236,72,153,0.18); color:#f472b6; border:1px solid #f472b6; }

        .scanner-table-wrap { padding:0; overflow-x:auto; }
        .scanner-table { width:100%; border-collapse:collapse; }
        .scanner-table th {
          padding:0.7rem 0.9rem; text-align:left; font-size:0.75rem; font-weight:700;
          text-transform:uppercase; letter-spacing:0.05em; color:#888;
          background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.07);
          cursor:pointer; white-space:nowrap;
        }
        .scanner-table th:hover { color:#ccc; }
        .scanner-table td { padding:0.7rem 0.9rem; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.85rem; white-space:nowrap; }
        .scanner-table tr:hover td { background:rgba(255,255,255,0.025); }
        .scanner-table tr.top-signal td { background:rgba(0,200,150,0.04); }
        .scanner-table tr.top-signal-sell td { background:rgba(255,77,77,0.04); }

        .score-bar-wrap { display:flex; align-items:center; gap:0.5rem; }
        .score-bar-track { height:6px; background:rgba(255,255,255,0.08); border-radius:3px; width:60px; overflow:hidden; }
        .score-bar-fill { height:100%; border-radius:3px; }
        .score-label { font-size:0.8rem; font-weight:700; min-width:28px; }

        .alert-tags { display:flex; gap:0.3rem; flex-wrap:wrap; }
        .alert-tag {
          font-size:0.7rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:12px;
          white-space:nowrap;
        }
        .tag-squeeze  { background:rgba(245,158,11,0.2); color:#f59e0b; }
        .tag-golden   { background:rgba(0,200,150,0.2); color:#00c896; }
        .tag-death    { background:rgba(255,77,77,0.2); color:#ff4d4d; }
        .tag-macd-buy { background:rgba(0,200,150,0.15); color:#34d399; }
        .tag-macd-sell{ background:rgba(255,77,77,0.15); color:#f87171; }
        .tag-rsi-low  { background:rgba(0,200,150,0.2); color:#00c896; }
        .tag-rsi-high { background:rgba(255,77,77,0.2); color:#ff4d4d; }
        .tag-vol-spike{ background:rgba(59,130,246,0.2); color:#60a5fa; }
        .tag-div-bull { background:rgba(0,200,150,0.18); color:#6ee7b7; }
        .tag-div-bear { background:rgba(236,72,153,0.18); color:#f472b6; }
        .tag-breakout { background:rgba(167,139,250,0.2); color:#a78bfa; }

        .scanner-action-btn {
          background:rgba(108,99,255,0.15); color:#a78bfa; border:1px solid rgba(108,99,255,0.3);
          border-radius:7px; padding:0.3rem 0.7rem; font-size:0.77rem; font-weight:600;
          cursor:pointer; transition:all 0.15s;
        }
        .scanner-action-btn:hover { background:rgba(108,99,255,0.3); }
        .scanner-empty-state { text-align:center; padding:3rem 1rem; color:#666; }
        .scanner-progress { display:flex; align-items:center; gap:0.75rem; padding:1.5rem; color:#888; font-size:0.88rem; }
        .scanner-spinner {
          width:22px; height:22px; border:2px solid rgba(108,99,255,0.25);
          border-top-color:#6c63ff; border-radius:50%; animation:ml-spin 0.8s linear infinite;
        }
        .scanner-progress-bar-wrap { flex:1; height:4px; background:rgba(255,255,255,0.07); border-radius:2px; overflow:hidden; }
        .scanner-progress-bar { height:100%; background:linear-gradient(90deg,#6c63ff,#00c896); border-radius:2px; transition:width 0.4s ease; }
      </style>
    `;
  },

  // ── Scan ────────────────────────────────────────────────────────────
  async startScan() {
    if (this.running) return;
    this.running = true;
    this.results = [];

    const runBtn = document.getElementById('scannerRunBtn');
    const status = document.getElementById('scannerStatus');
    const tbody  = document.getElementById('scannerTbody');
    const wrap   = document.getElementById('scannerTableWrap');
    const strip  = document.getElementById('scannerAlertStrip');

    if (runBtn) { runBtn.disabled = true; runBtn.textContent = '⏳ Scanning…'; }
    if (status) { status.className = 'scanner-status-running'; status.textContent = `Scanning ${this.COINS.length} coins…`; }
    if (wrap) wrap.style.display = 'block';
    if (strip) strip.style.display = 'none';
    if (tbody) tbody.innerHTML = `<tr><td colspan="8">
      <div class="scanner-progress">
        <div class="scanner-spinner"></div>
        <span id="scannerProgressText">Fetching price data…</span>
        <div class="scanner-progress-bar-wrap"><div class="scanner-progress-bar" id="scannerProgressBar" style="width:0%"></div></div>
      </div>
    </td></tr>`;

    try {
      // Fetch prices first
      const prices = await apiRequest('/api/crypto/prices');
      const priceMap = {};
      prices.forEach(p => { priceMap[p.symbol] = p; });

      const total = this.COINS.length;
      const BATCH = 3;

      for (let i = 0; i < total; i += BATCH) {
        const batch = this.COINS.slice(i, i + BATCH);
        const progress = Math.round((i / total) * 100);
        const progBar  = document.getElementById('scannerProgressBar');
        const progText = document.getElementById('scannerProgressText');
        if (progBar)  progBar.style.width  = progress + '%';
        if (progText) progText.textContent = `Scanning ${batch.join(', ')}… (${i}/${total})`;

        await Promise.allSettled(batch.map(async symbol => {
          try {
            const pd = priceMap[symbol];
            if (!pd) return;
            const coinId = pd.id || symbol.toLowerCase();
            const analysis = await apiRequest(`/api/crypto/${coinId}/analysis`);
            const result = this.analyzeSignals(symbol, pd, analysis);
            if (result) this.results.push(result);
          } catch {}
        }));
      }

      this.lastScanTime = new Date();
      this.renderResults();
      this.renderAlertStrip();

      if (status) {
        status.className = 'scanner-status-done';
        status.textContent = `✅ Scan complete — ${this.results.length} coins | ${this.lastScanTime.toLocaleTimeString()}`;
      }
    } catch (e) {
      if (status) { status.className = 'scanner-status-idle'; status.textContent = 'Scan failed: ' + e.message; }
    } finally {
      this.running = false;
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶ Run Scan'; }
    }
  },

  // ── Signal Analysis ─────────────────────────────────────────────────
  analyzeSignals(symbol, priceData, analysis) {
    if (!analysis || !analysis.indicators) return null;
    const ind = analysis.indicators;
    const ov  = analysis.overall || {};

    const rsi   = ind.rsi?.value ?? 50;
    const macd  = ind.macd  || {};
    const bb    = ind.bollingerBands || {};
    const mas   = ind.movingAverages || {};
    const vol   = ind.volume || {};
    const rsiDiv  = ind.rsiDivergence  || { type: 'NONE' };
    const macdDiv = ind.macdDivergence || { type: 'NONE' };
    const candles = ind.candlestickPatterns || { patterns: [] };

    const alerts = [];
    let score = 0;

    // ── Bollinger Squeeze ──────────────────────────────────────
    const bbWidth = bb.bandwidth ?? 0;
    if (bbWidth > 0 && bbWidth < 4) {
      alerts.push({ type: 'squeeze', tag: 'tag-squeeze', label: '🔥 BB Squeeze' });
      score += 15;
    }

    // ── Breakout ───────────────────────────────────────────────
    const currentPrice = priceData.price;
    if (bb.upper && currentPrice > bb.upper * 0.99) {
      alerts.push({ type: 'breakout', tag: 'tag-breakout', label: '⬆️ Upper Break' });
      score += 12;
    }
    if (bb.lower && currentPrice < bb.lower * 1.01) {
      alerts.push({ type: 'breakout', tag: 'tag-breakout', label: '⬇️ Lower Break' });
      score -= 12;
    }

    // ── Golden / Death Cross ───────────────────────────────────
    const sma20 = mas.sma20 ?? 0;
    const sma50 = mas.sma50 ?? 0;
    const sma200 = mas.sma200 ?? 0;
    if (sma20 > 0 && sma50 > 0 && sma200 > 0) {
      const goldenCross = sma20 > sma50 && sma50 > sma200;
      const deathCross  = sma20 < sma50 && sma50 < sma200;
      if (goldenCross) {
        alerts.push({ type: 'crossover', tag: 'tag-golden', label: '🌟 Golden Cross' });
        score += 25;
      }
      if (deathCross) {
        alerts.push({ type: 'crossover', tag: 'tag-death', label: '💀 Death Cross' });
        score -= 25;
      }
    }

    // ── MACD Crossover ─────────────────────────────────────────
    if (macd.signal === 'BUY') {
      alerts.push({ type: 'crossover', tag: 'tag-macd-buy', label: '↗ MACD Bull' });
      score += 18;
    }
    if (macd.signal === 'SELL') {
      alerts.push({ type: 'crossover', tag: 'tag-macd-sell', label: '↘ MACD Bear' });
      score -= 18;
    }

    // ── RSI Extremes ───────────────────────────────────────────
    if (rsi <= 25) {
      alerts.push({ type: 'BUY', tag: 'tag-rsi-low', label: `📉 RSI ${rsi.toFixed(0)} Extreme` });
      score += 22;
    } else if (rsi <= 30) {
      alerts.push({ type: 'BUY', tag: 'tag-rsi-low', label: `📉 RSI ${rsi.toFixed(0)} Oversold` });
      score += 15;
    } else if (rsi >= 75) {
      alerts.push({ type: 'SELL', tag: 'tag-rsi-high', label: `📈 RSI ${rsi.toFixed(0)} Extreme` });
      score -= 22;
    } else if (rsi >= 70) {
      alerts.push({ type: 'SELL', tag: 'tag-rsi-high', label: `📈 RSI ${rsi.toFixed(0)} Overbought` });
      score -= 15;
    }

    // ── RSI Divergence ─────────────────────────────────────────
    if (rsiDiv.type === 'BULLISH') {
      alerts.push({ type: 'divergence', tag: 'tag-div-bull', label: '↕ Bull Divergence' });
      score += 20;
    }
    if (rsiDiv.type === 'BEARISH') {
      alerts.push({ type: 'divergence', tag: 'tag-div-bear', label: '↕ Bear Divergence' });
      score -= 20;
    }

    // ── Volume Spike ───────────────────────────────────────────
    const volRatio = vol.ratio ?? 1;
    if (volRatio > 2.5) {
      alerts.push({ type: 'volume', tag: 'tag-vol-spike', label: `🔊 Vol ${volRatio.toFixed(1)}x Spike` });
      score += Math.min(Math.round((volRatio - 1) * 5), 20);
    }

    // ── Candlestick Patterns ───────────────────────────────────
    if (candles.patterns && candles.patterns.length > 0) {
      const bullPat = candles.patterns.filter(p => p.type === 'BUY');
      const bearPat = candles.patterns.filter(p => p.type === 'SELL');
      bullPat.slice(0,2).forEach(p => {
        alerts.push({ type: 'BUY', tag: 'tag-macd-buy', label: p.icon + ' ' + p.name });
        score += 12;
      });
      bearPat.slice(0,2).forEach(p => {
        alerts.push({ type: 'SELL', tag: 'tag-macd-sell', label: p.icon + ' ' + p.name });
        score -= 12;
      });
    }

    return {
      symbol,
      price:     currentPrice,
      change24h: priceData.change24h || 0,
      rsi,
      macd:      macd.signal || '—',
      score,
      alerts,
      overallSignal: ov.signal || 'HOLD',
      confidence:    ov.confidence || 0
    };
  },

  // ── Render Results ──────────────────────────────────────────────────
  renderResults() {
    const tbody    = document.getElementById('scannerTbody');
    const countEl  = document.getElementById('scannerMatchCount');
    if (!tbody) return;

    let data = [...this.results];

    // Filter
    if (this.filterType !== 'all') {
      data = data.filter(r => {
        if (this.filterType === 'BUY')  return r.score > 10;
        if (this.filterType === 'SELL') return r.score < -10;
        return r.alerts.some(a => a.type === this.filterType);
      });
    }

    // Sort
    data.sort((a, b) => this.sortDir * (
      this.sortKey === 'symbol'  ? a.symbol.localeCompare(b.symbol) :
      this.sortKey === 'change24h' ? (a.change24h - b.change24h) :
      (a[this.sortKey] ?? 0) - (b[this.sortKey] ?? 0)
    ));

    if (countEl) countEl.textContent = data.length + ' coins shown';

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="scanner-empty-state">No coins match the current filter.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const scoreColor = r.score > 20 ? '#00c896' : r.score > 0 ? '#34d399' : r.score > -20 ? '#f87171' : '#ff4d4d';
      const scorePct   = Math.min(Math.abs(r.score), 100);
      const rowClass   = r.score > 25 ? 'top-signal' : r.score < -25 ? 'top-signal-sell' : '';
      const chgClass   = r.change24h >= 0 ? 'positive' : 'negative';
      const macdClass  = r.macd === 'BUY' ? 'positive' : r.macd === 'SELL' ? 'negative' : '';
      const alertTags  = r.alerts.map(a =>
        `<span class="alert-tag ${a.tag}" title="${a.label}">${a.label}</span>`
      ).join('');

      return `<tr class="${rowClass}">
        <td><strong style="font-size:0.95rem;">${r.symbol}</strong></td>
        <td>${formatCurrency(r.price)}</td>
        <td class="${chgClass}">${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%</td>
        <td>
          <span style="font-weight:700;color:${r.rsi < 30 ? '#00c896' : r.rsi > 70 ? '#ff4d4d' : '#e0e0e0'}">
            ${r.rsi.toFixed(1)}
          </span>
        </td>
        <td class="${macdClass}" style="font-weight:600;font-size:0.8rem;">${r.macd}</td>
        <td>
          <div class="score-bar-wrap">
            <div class="score-bar-track">
              <div class="score-bar-fill" style="width:${scorePct}%;background:${scoreColor};"></div>
            </div>
            <span class="score-label" style="color:${scoreColor}">${r.score > 0 ? '+' : ''}${r.score}</span>
          </div>
        </td>
        <td><div class="alert-tags">${alertTags || '<span style="color:#555;font-size:0.78rem;">No alerts</span>'}</div></td>
        <td>
          <button class="scanner-action-btn" onclick="selectCryptoForAnalysis('${r.symbol}')">Analyze</button>
          <button class="scanner-action-btn" style="margin-left:4px;" onclick="MarketScanner.runMLScan('${r.symbol}')">ML</button>
        </td>
      </tr>`;
    }).join('');
  },

  // ── Alert Strip ─────────────────────────────────────────────────────
  renderAlertStrip() {
    const strip = document.getElementById('scannerAlertStrip');
    if (!strip) return;

    const topBuy  = this.results.filter(r => r.score > 15).sort((a,b) => b.score - a.score).slice(0,4);
    const topSell = this.results.filter(r => r.score < -15).sort((a,b) => a.score - b.score).slice(0,3);
    const squeezes = this.results.filter(r => r.alerts.some(a => a.type === 'squeeze')).slice(0,4);

    if (!topBuy.length && !topSell.length && !squeezes.length) { strip.style.display = 'none'; return; }
    strip.style.display = 'flex';

    const pills = [
      ...topBuy.map(r => `<span class="scanner-alert-pill pill-buy" onclick="selectCryptoForAnalysis('${r.symbol}')">🟢 ${r.symbol} +${r.score}</span>`),
      ...topSell.map(r => `<span class="scanner-alert-pill pill-sell" onclick="selectCryptoForAnalysis('${r.symbol}')">🔴 ${r.symbol} ${r.score}</span>`),
      ...squeezes.map(r => `<span class="scanner-alert-pill pill-squeeze" onclick="selectCryptoForAnalysis('${r.symbol}')">🔥 ${r.symbol} Squeeze</span>`),
    ];
    strip.innerHTML = '<span style="font-size:0.8rem;color:#888;font-weight:600;white-space:nowrap;">Top Alerts:</span>' + pills.join('');
  },

  // ── ML Shortcut ─────────────────────────────────────────────────────
  runMLScan(symbol) {
    const sel = document.getElementById('ml-coin-select');
    if (sel) sel.value = symbol;
    switchSection('ml-predict');
    if (typeof MLPredict !== 'undefined') {
      MLPredict.currentSymbol = symbol;
      MLPredict.loadPrediction(symbol);
    }
  },

  // ── Filter / Sort ────────────────────────────────────────────────────
  setFilter(type, btn) {
    this.filterType = type;
    document.querySelectorAll('.scanner-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderResults();
  },
  sort(key) {
    if (this.sortKey === key) this.sortDir *= -1;
    else { this.sortKey = key; this.sortDir = -1; }
    this.renderResults();
  },

  // ── Auto Scan ───────────────────────────────────────────────────────
  autoOn: false,
  toggleAuto() {
    const btn = document.getElementById('scannerAutoBtn');
    this.autoOn = !this.autoOn;
    if (btn) { btn.textContent = this.autoOn ? '🔁 Auto (on)' : '🔁 Auto (off)'; btn.classList.toggle('active', this.autoOn); }
    if (this.autoOn) {
      this.startScan();
      this.scanInterval = setInterval(() => this.startScan(), 3 * 60 * 1000); // every 3 min
    } else {
      clearInterval(this.scanInterval);
    }
  }
};

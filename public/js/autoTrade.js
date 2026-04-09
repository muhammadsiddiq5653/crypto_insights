/**
 * AutoTrade — Institutional-grade backtesting engine UI
 * Powered by the autotrade Python microservice (port 5002)
 * Based on: github.com/rv64m/autotrade
 *
 * Features:
 *  - Run backtests on 5 built-in strategies across any coin/timeframe
 *  - Full metrics: Sharpe, Calmar, Drawdown, Profit Factor, Kelly, SQN
 *  - Two-layer verdict: ELIGIBLE / DISCARD_RISK / DISCARD_PROFIT / CRASH
 *  - Equity curve chart vs buy-and-hold
 *  - Trade log with entry/exit/P&L
 *  - Experiment log (results.jsonl) — save and review all runs
 *  - Create custom strategies from a code editor
 */

const AutoTrade = {
  container: null,
  equityChart: null,
  lastResult: null,
  serviceOnline: false,

  SYMBOLS: [
    'BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT',
    'ADA/USDT','AVAX/USDT','LINK/USDT','DOGE/USDT','DOT/USDT',
  ],
  TIMEFRAMES: [
    { value:'1h', label:'1 Hour' }, { value:'4h', label:'4 Hours' },
    { value:'1d', label:'1 Day'  }, { value:'1w', label:'1 Week'  },
  ],
  PERIODS: [
    { label:'3 Months', start: () => AutoTrade._daysAgo(90)  },
    { label:'6 Months', start: () => AutoTrade._daysAgo(180) },
    { label:'1 Year',   start: () => AutoTrade._daysAgo(365) },
    { label:'2 Years',  start: () => AutoTrade._daysAgo(730) },
  ],
  _daysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0,10);
  },

  VERDICT_CONFIG: {
    ELIGIBLE:       { label:'✅ ELIGIBLE',       color:'#00c896', bg:'rgba(0,200,150,0.12)',  border:'#00c89644', desc:'Both risk and profit checks passed. Strategy is a candidate for live use.' },
    DISCARD_RISK:   { label:'⚠️ DISCARD (Risk)',  color:'#ff6a6a', bg:'rgba(255,106,106,0.1)', border:'#ff6a6a44', desc:'Max drawdown breached the safety floor. Too risky.' },
    DISCARD_PROFIT: { label:'📉 DISCARD (Profit)',color:'#f7971e', bg:'rgba(247,151,30,0.1)',  border:'#f7971e44', desc:'Profit targets not met (Sharpe, trade count). Underperforming.' },
    CRASH:          { label:'💥 CRASH',           color:'#a78bfa', bg:'rgba(167,139,250,0.1)', border:'#a78bfa44', desc:'Zero trades fired or NaN metrics. Strategy logic issue.' },
  },

  async init() {
    this.container = document.getElementById('autotrade');
    if (!this.container) return;
    if (this.container.querySelector('.at-page')) return;

    this.render();
    this.attachEvents();
    await this.checkService();
    await this.loadStrategies();
    await this.loadResults();
  },

  async checkService() {
    try {
      const r = await fetch('/api/autotrade/status').then(r => r.json());
      this.serviceOnline = r.running;
    } catch { this.serviceOnline = false; }
    this.updateServiceBadge();
  },

  updateServiceBadge() {
    const badge = document.getElementById('at-service-badge');
    if (!badge) return;
    if (this.serviceOnline) {
      badge.innerHTML = '<span class="at-dot at-dot-green"></span> AutoTrade Engine Online';
      badge.className = 'at-badge at-badge-green';
    } else {
      badge.innerHTML = '<span class="at-dot at-dot-red"></span> Engine Offline — run: <code>bash start_with_ml.sh</code>';
      badge.className = 'at-badge at-badge-red';
    }
  },

  render() {
    this.container.innerHTML = `
      <div class="at-page">

        <!-- Header -->
        <div class="at-header">
          <div>
            <h2 class="at-title">⚙️ AutoTrade Backtesting Engine</h2>
            <p class="at-subtitle">Institutional-grade strategy testing — Sharpe, Calmar, Drawdown, Kelly Criterion, SQN</p>
          </div>
          <div id="at-service-badge" class="at-badge at-badge-grey">
            <span class="at-dot"></span> Checking engine…
          </div>
        </div>

        <div class="at-layout">

          <!-- LEFT: Config + Results -->
          <div class="at-main-col">

            <!-- Config Card -->
            <div class="at-card">
              <div class="at-card-title">🔬 Backtest Configuration</div>
              <div class="at-config-grid">
                <div class="at-field">
                  <label class="at-label">Strategy</label>
                  <select class="at-select" id="at-strategy">
                    <option value="">Loading strategies…</option>
                  </select>
                </div>
                <div class="at-field">
                  <label class="at-label">Symbol</label>
                  <select class="at-select" id="at-symbol">
                    ${this.SYMBOLS.map(s => `<option value="${s}" ${s==='BTC/USDT'?'selected':''}>${s}</option>`).join('')}
                  </select>
                </div>
                <div class="at-field">
                  <label class="at-label">Timeframe</label>
                  <select class="at-select" id="at-timeframe">
                    ${this.TIMEFRAMES.map(t => `<option value="${t.value}" ${t.value==='1d'?'selected':''}>${t.label}</option>`).join('')}
                  </select>
                </div>
                <div class="at-field">
                  <label class="at-label">Period</label>
                  <select class="at-select" id="at-period">
                    ${this.PERIODS.map((p,i) => `<option value="${i}" ${i===2?'selected':''}>${p.label}</option>`).join('')}
                  </select>
                </div>
                <div class="at-field">
                  <label class="at-label">Starting Capital ($)</label>
                  <input class="at-input" id="at-cash" type="number" value="10000" min="100" step="1000">
                </div>
                <div class="at-field">
                  <label class="at-label">Max Drawdown Limit (%)</label>
                  <div class="at-input-wrap">
                    <input class="at-input" id="at-max-dd" type="number" value="-20" max="-1" step="1">
                    <span class="at-suffix">%</span>
                  </div>
                </div>
                <div class="at-field">
                  <label class="at-label">Min Sharpe Ratio</label>
                  <input class="at-input" id="at-min-sharpe" type="number" value="0.8" min="0" step="0.1">
                </div>
                <div class="at-field">
                  <label class="at-label">Max Leverage</label>
                  <input class="at-input" id="at-leverage" type="number" value="1" min="1" max="10" step="1">
                </div>
              </div>
              <button class="at-run-btn" id="at-run-btn">
                <span id="at-run-text">▶ Run Backtest</span>
              </button>
            </div>

            <!-- Verdict + Metrics (hidden until run) -->
            <div id="at-results-section" style="display:none;">

              <!-- Verdict Banner -->
              <div class="at-verdict-banner" id="at-verdict-banner"></div>

              <!-- Core Metrics -->
              <div class="at-metrics-grid" id="at-metrics-grid"></div>

              <!-- Equity Chart -->
              <div class="at-card">
                <div class="at-card-header">
                  <span class="at-card-title">📈 Equity Curve</span>
                  <div class="at-chart-legend">
                    <span><span class="at-leg-dot" style="background:#6c63ff;"></span>Strategy</span>
                    <span><span class="at-leg-dot" style="background:#f7971e;border-style:dashed;"></span>Buy & Hold</span>
                  </div>
                </div>
                <div class="at-chart-wrap"><canvas id="at-equity-chart"></canvas></div>
              </div>

              <!-- Risk/Profit Detail -->
              <div class="at-two-col">
                <div class="at-card" id="at-risk-card"></div>
                <div class="at-card" id="at-profit-card"></div>
              </div>

              <!-- Trades Table -->
              <div class="at-card">
                <div class="at-card-title">📋 Trade Log</div>
                <div class="at-table-wrap">
                  <table class="at-table">
                    <thead><tr>
                      <th>Entry</th><th>Exit</th><th>Entry $</th><th>Exit $</th><th>Return %</th><th>P&L $</th>
                    </tr></thead>
                    <tbody id="at-trades-tbody"></tbody>
                  </table>
                </div>
              </div>

              <!-- Save Result -->
              <div class="at-save-row">
                <textarea class="at-thoughts" id="at-thoughts" placeholder="Thoughts on this result… (hypothesis, what worked, what to try next)"></textarea>
                <button class="at-save-btn" id="at-save-btn">💾 Save to Experiment Log</button>
              </div>

            </div>
          </div>

          <!-- RIGHT: Sidebar -->
          <div class="at-sidebar-col">

            <!-- Strategy Info -->
            <div class="at-card" id="at-strategy-info">
              <div class="at-card-title">📌 Strategy Info</div>
              <div class="at-strategy-empty">Select a strategy to see details</div>
            </div>

            <!-- Experiment Log -->
            <div class="at-card">
              <div class="at-card-title">📊 Experiment Log</div>
              <div id="at-results-log"><div class="at-empty-log">No experiments logged yet.</div></div>
            </div>

            <!-- Create Strategy -->
            <div class="at-card">
              <div class="at-card-title">✏️ Create Strategy</div>
              <div class="at-field" style="margin-bottom:8px;">
                <label class="at-label">Name</label>
                <input class="at-input" id="at-new-name" type="text" placeholder="my_strategy">
              </div>
              <div class="at-field" style="margin-bottom:10px;">
                <label class="at-label">Description</label>
                <input class="at-input" id="at-new-desc" type="text" placeholder="What does it do?">
              </div>
              <button class="at-create-btn" id="at-create-btn">+ Create Strategy</button>
              <div class="at-create-note">Creates a template you can edit in the code viewer below</div>
            </div>

            <!-- Code Viewer -->
            <div class="at-card" id="at-code-card" style="display:none;">
              <div class="at-card-title">💻 Strategy Code</div>
              <pre class="at-code" id="at-code-content"></pre>
            </div>

          </div>
        </div>
      </div>

      <style>
        .at-page { padding: 20px; max-width: 1200px; margin: 0 auto; }

        /* Header */
        .at-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
        .at-title  { font-size:1.4rem; font-weight:700; color:var(--text-primary,#e4e7f1); margin:0 0 4px; }
        .at-subtitle { font-size:0.85rem; color:var(--text-secondary,#a0a8c1); margin:0; }
        .at-badge  { display:flex; align-items:center; gap:8px; padding:7px 14px; border-radius:20px; font-size:0.8rem; font-weight:600; }
        .at-badge code { font-size:0.72rem; background:rgba(255,255,255,0.1); padding:1px 5px; border-radius:4px; }
        .at-badge-green { background:rgba(0,200,150,0.12); color:#00c896; border:1px solid #00c89633; }
        .at-badge-red   { background:rgba(255,106,106,0.12); color:#ff6a6a; border:1px solid #ff6a6a33; }
        .at-badge-grey  { background:rgba(102,126,234,0.08); color:var(--text-secondary,#a0a8c1); border:1px solid var(--color-border,rgba(102,126,234,0.18)); }
        .at-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .at-dot-green { background:#00c896; box-shadow:0 0 6px #00c896; }
        .at-dot-red   { background:#ff6a6a; box-shadow:0 0 6px #ff6a6a; }

        /* Layout */
        .at-layout { display:grid; grid-template-columns:1fr 300px; gap:16px; }
        @media(max-width:900px){ .at-layout{grid-template-columns:1fr;} }
        .at-main-col, .at-sidebar-col { display:flex; flex-direction:column; gap:14px; }

        /* Cards */
        .at-card { background:var(--color-surface,#1e2442); border:1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius:14px; padding:16px; }
        .at-card-title { font-size:0.875rem; font-weight:700; color:var(--text-primary,#e4e7f1); margin-bottom:14px; }
        .at-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .at-chart-legend { display:flex; gap:14px; font-size:0.75rem; color:var(--text-secondary,#a0a8c1); }
        .at-leg-dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; }

        /* Config */
        .at-config-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
        .at-field { display:flex; flex-direction:column; gap:5px; }
        .at-label { font-size:0.72rem; font-weight:600; color:var(--text-secondary,#a0a8c1); text-transform:uppercase; letter-spacing:0.5px; }
        .at-select,.at-input { width:100%; padding:8px 12px; background:var(--color-card,#252b4a); border:1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius:8px; color:var(--text-primary,#e4e7f1); font-size:0.875rem; font-family:inherit; transition:border-color 0.2s; }
        .at-select:focus,.at-input:focus { outline:none; border-color:#6c63ff88; }
        .at-input-wrap { position:relative; }
        .at-suffix { position:absolute; right:10px; top:50%; transform:translateY(-50%); color:var(--text-secondary,#a0a8c1); font-size:0.8rem; pointer-events:none; }

        /* Buttons */
        .at-run-btn { width:100%; padding:12px; background:linear-gradient(135deg,#6c63ff,#00c896); border:none; border-radius:10px; color:#fff; font-size:1rem; font-weight:700; cursor:pointer; transition:opacity 0.2s; letter-spacing:0.5px; }
        .at-run-btn:hover { opacity:0.9; }
        .at-run-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .at-save-btn { padding:10px 20px; background:rgba(108,99,255,0.2); border:1px solid #6c63ff44; border-radius:10px; color:#a78bfa; font-size:0.875rem; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .at-save-btn:hover { background:rgba(108,99,255,0.3); }
        .at-create-btn { width:100%; padding:9px; background:rgba(0,200,150,0.15); border:1px solid #00c89633; border-radius:8px; color:#00c896; font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s; margin-bottom:6px; }
        .at-create-btn:hover { background:rgba(0,200,150,0.25); }
        .at-create-note { font-size:0.72rem; color:var(--text-muted,#6b7394); }

        /* Verdict */
        .at-verdict-banner { border-radius:12px; padding:16px 20px; margin-bottom:0; }
        .at-verdict-label { font-size:1.2rem; font-weight:700; margin-bottom:6px; }
        .at-verdict-desc  { font-size:0.85rem; opacity:0.85; }
        .at-verdict-violations { margin-top:8px; font-size:0.8rem; opacity:0.8; }
        .at-verdict-violations li { margin:3px 0; }

        /* Metrics */
        .at-metrics-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
        .at-metric { background:var(--color-surface,#1e2442); border:1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius:12px; padding:12px 14px; }
        .at-metric-label { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted,#6b7394); margin-bottom:5px; }
        .at-metric-value { font-size:1.15rem; font-weight:700; color:var(--text-primary,#e4e7f1); }
        .at-metric-value.pos { color:#00c896; }
        .at-metric-value.neg { color:#ff6a6a; }
        .at-metric-value.warn { color:#f7971e; }
        .at-metric-sub { font-size:0.7rem; color:var(--text-muted,#6b7394); margin-top:2px; }

        /* Chart */
        .at-chart-wrap { position:relative; height:280px; }

        /* Two-col */
        .at-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media(max-width:700px){ .at-two-col{grid-template-columns:1fr;} }
        .at-check-row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.8rem; }
        .at-check-row:last-child { border-bottom:none; }
        .at-check-label { color:var(--text-secondary,#a0a8c1); }
        .at-check-value { font-weight:600; }
        .at-pass { color:#00c896; }
        .at-fail { color:#ff6a6a; }

        /* Trades */
        .at-table-wrap { overflow-x:auto; max-height:240px; overflow-y:auto; }
        .at-table { width:100%; border-collapse:collapse; font-size:0.78rem; }
        .at-table th { padding:7px 10px; text-align:right; color:var(--text-secondary,#a0a8c1); font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid var(--color-border,rgba(102,126,234,0.18)); position:sticky; top:0; background:var(--color-surface,#1e2442); }
        .at-table th:first-child { text-align:left; }
        .at-table td { padding:6px 10px; text-align:right; color:var(--text-primary,#e4e7f1); border-bottom:1px solid rgba(255,255,255,0.04); }
        .at-table td:first-child { text-align:left; color:var(--text-secondary,#a0a8c1); }
        .at-table tr:hover td { background:rgba(108,99,255,0.04); }

        /* Save row */
        .at-save-row { display:flex; gap:10px; align-items:flex-start; }
        .at-thoughts { flex:1; padding:10px 14px; background:var(--color-card,#252b4a); border:1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius:10px; color:var(--text-primary,#e4e7f1); font-size:0.82rem; font-family:inherit; resize:vertical; min-height:70px; }
        .at-thoughts:focus { outline:none; border-color:#6c63ff88; }

        /* Experiment log */
        .at-log-item { padding:10px 0; border-bottom:1px solid var(--color-border,rgba(102,126,234,0.1)); }
        .at-log-item:last-child { border-bottom:none; }
        .at-log-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
        .at-log-strategy { font-size:0.82rem; font-weight:600; color:var(--text-primary,#e4e7f1); }
        .at-log-verdict { font-size:0.7rem; font-weight:700; padding:2px 7px; border-radius:10px; }
        .at-log-verdict.ELIGIBLE { background:rgba(0,200,150,0.15); color:#00c896; }
        .at-log-verdict.DISCARD_RISK,.at-log-verdict.DISCARD_PROFIT { background:rgba(255,106,106,0.12); color:#ff6a6a; }
        .at-log-verdict.CRASH { background:rgba(167,139,250,0.12); color:#a78bfa; }
        .at-log-meta { font-size:0.72rem; color:var(--text-muted,#6b7394); }
        .at-log-metrics { display:flex; gap:10px; margin-top:4px; flex-wrap:wrap; }
        .at-log-metric { font-size:0.72rem; color:var(--text-secondary,#a0a8c1); }
        .at-empty-log { font-size:0.8rem; color:var(--text-muted,#6b7394); padding:10px 0; }

        /* Code */
        .at-code { background:var(--color-card,#252b4a); border-radius:8px; padding:12px; font-size:0.72rem; color:#a78bfa; overflow-x:auto; white-space:pre; max-height:300px; overflow-y:auto; line-height:1.5; }

        /* Strategy info */
        .at-strategy-empty { font-size:0.8rem; color:var(--text-muted,#6b7394); }
        .at-strat-name { font-size:0.95rem; font-weight:700; color:var(--text-primary,#e4e7f1); margin-bottom:4px; }
        .at-strat-desc { font-size:0.8rem; color:var(--text-secondary,#a0a8c1); margin-bottom:8px; }
        .at-keep-badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700; }
        .at-keep-true  { background:rgba(0,200,150,0.15); color:#00c896; }
        .at-keep-false { background:rgba(102,126,234,0.1); color:var(--text-muted,#6b7394); }

        /* Spinner */
        .at-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:at-spin 0.7s linear infinite; vertical-align:middle; margin-right:6px; }
        @keyframes at-spin { to { transform:rotate(360deg); } }
      </style>
    `;
  },

  attachEvents() {
    document.getElementById('at-run-btn')?.addEventListener('click', () => this.runBacktest());
    document.getElementById('at-save-btn')?.addEventListener('click', () => this.saveResult());
    document.getElementById('at-create-btn')?.addEventListener('click', () => this.createStrategy());
    document.getElementById('at-strategy')?.addEventListener('change', (e) => this.showStrategyInfo(e.target.value));
  },

  async loadStrategies() {
    try {
      const r = await fetch('/api/autotrade/strategies').then(r => r.json());
      const sel = document.getElementById('at-strategy');
      if (!sel) return;
      if (!r.success || !r.strategies?.length) {
        sel.innerHTML = '<option value="">No strategies found — engine offline?</option>';
        return;
      }
      sel.innerHTML = r.strategies.map(s =>
        `<option value="${s.file}">${s.name.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}${s.keep?' ★':''}</option>`
      ).join('');
      this.showStrategyInfo(sel.value);
      this._strategies = r.strategies;
    } catch { /* engine offline */ }
  },

  showStrategyInfo(filename) {
    const panel = document.getElementById('at-strategy-info');
    if (!panel || !this._strategies) return;
    const s = this._strategies.find(st => st.file === filename);
    if (!s) return;
    panel.innerHTML = `
      <div class="at-card-title">📌 Strategy Info</div>
      <div class="at-strat-name">${s.name.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
      <div class="at-strat-desc">${s.description || 'No description'}</div>
      <span class="at-keep-badge ${s.keep ? 'at-keep-true':'at-keep-false'}">${s.keep ? '★ KEEPER':'Experimental'}</span>
      <div style="margin-top:10px;">
        <button class="at-create-btn" style="background:rgba(108,99,255,0.15);border-color:#6c63ff33;color:#a78bfa;" onclick="AutoTrade.viewCode('${s.file}')">👁 View Source Code</button>
      </div>
    `;
  },

  async viewCode(filename) {
    try {
      const r = await fetch(`/api/autotrade/strategy/${filename}`).then(r => r.json());
      const card = document.getElementById('at-code-card');
      const pre  = document.getElementById('at-code-content');
      if (card && pre && r.success) {
        pre.textContent = r.code;
        card.style.display = 'block';
        card.scrollIntoView({ behavior:'smooth', block:'nearest' });
      }
    } catch {}
  },

  async runBacktest() {
    if (!this.serviceOnline) {
      await this.checkService();
      if (!this.serviceOnline) {
        alert('AutoTrade Engine is offline. Start it with: bash start_with_ml.sh');
        return;
      }
    }

    const btn = document.getElementById('at-run-btn');
    const txt = document.getElementById('at-run-text');
    btn.disabled = true;

    const strategy  = document.getElementById('at-strategy')?.value;
    const symbol    = document.getElementById('at-symbol')?.value;
    const timeframe = document.getElementById('at-timeframe')?.value;
    const periodIdx = parseInt(document.getElementById('at-period')?.value || '2');
    const cash      = parseFloat(document.getElementById('at-cash')?.value || '10000');
    const maxDD     = parseFloat(document.getElementById('at-max-dd')?.value || '-20');
    const minSharpe = parseFloat(document.getElementById('at-min-sharpe')?.value || '0.8');
    const leverage  = parseFloat(document.getElementById('at-leverage')?.value || '1');
    const start     = this.PERIODS[periodIdx].start();

    txt.innerHTML = `<span class="at-spinner"></span> Fetching ${symbol} data & running ${strategy}…`;

    try {
      const resp = await fetch('/api/autotrade/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, symbol, timeframe, start, cash, maxDrawdownLimit: maxDD, minSharpe, maxLeverage: leverage })
      });
      const result = await resp.json();

      if (!result.success) {
        alert('Backtest error: ' + result.error);
        btn.disabled = false;
        txt.textContent = '▶ Run Backtest';
        return;
      }

      this.lastResult = { ...result, strategy, symbol, timeframe, cash, start };
      this.renderResults(result);

      document.getElementById('at-results-section').style.display = 'block';
      document.getElementById('at-results-section').scrollIntoView({ behavior:'smooth', block:'start' });
    } catch(e) {
      alert('Failed to connect to AutoTrade Engine. Is it running?');
    }

    btn.disabled = false;
    txt.textContent = '▶ Run Backtest';
  },

  renderResults(result) {
    const { stats, risk, profit, verdict, trades, equity, candles } = result;

    // Verdict banner
    const vc = this.VERDICT_CONFIG[verdict] || this.VERDICT_CONFIG.CRASH;
    const violations = [...(risk.violations||[]), ...(profit?.violations||[])];
    document.getElementById('at-verdict-banner').innerHTML = `
      <div class="at-verdict-banner" style="background:${vc.bg};border:1px solid ${vc.border};border-radius:12px;padding:16px 20px;margin-bottom:0;">
        <div class="at-verdict-label" style="color:${vc.color};">${vc.label}</div>
        <div class="at-verdict-desc" style="color:${vc.color};">${vc.desc}</div>
        ${violations.length ? `<ul class="at-verdict-violations">${violations.map(v=>`<li>${v}</li>`).join('')}</ul>` : ''}
        <div style="margin-top:8px;font-size:0.75rem;opacity:0.7;">${candles} candles · ${result.timeframe} · ${result.symbol}</div>
      </div>
    `;

    // Metrics
    const s = stats;
    const fmt = (v, decimals=1, suffix='') => v != null ? `${Number(v).toFixed(decimals)}${suffix}` : '—';
    const cls = (v, good='pos') => v == null ? '' : Number(v) >= 0 ? good : 'neg';

    document.getElementById('at-metrics-grid').innerHTML = [
      { label:'Return',         value: fmt(s['Return [%]'],1,'%'),          cls: cls(s['Return [%]']) },
      { label:'Ann. Return',    value: fmt(s['Return (Ann.) [%]'],1,'%'),    cls: cls(s['Return (Ann.) [%]']) },
      { label:'Buy & Hold',     value: fmt(s['Buy & Hold Return [%]'],1,'%'),cls: cls(s['Buy & Hold Return [%]']) },
      { label:'Sharpe Ratio',   value: fmt(s['Sharpe Ratio'],2),             cls: Number(s['Sharpe Ratio'])>=1?'pos':Number(s['Sharpe Ratio'])>=0.5?'warn':'neg' },
      { label:'Calmar Ratio',   value: fmt(s['Calmar Ratio'],2),             cls: Number(s['Calmar Ratio'])>=1?'pos':'warn' },
      { label:'Max Drawdown',   value: fmt(s['Max Drawdown [%]'],1,'%'),     cls: 'neg' },
      { label:'Profit Factor',  value: fmt(s['Profit Factor'],2),            cls: Number(s['Profit Factor'])>=1.5?'pos':Number(s['Profit Factor'])>=1?'warn':'neg' },
      { label:'Win Rate',       value: fmt(s['Win Rate [%]'],1,'%'),         cls: Number(s['Win Rate [%]'])>=50?'pos':'warn' },
      { label:'# Trades',       value: s['Trades'] ?? '—',                   cls: '' },
      { label:'Exposure Time',  value: fmt(s['Exposure Time [%]'],1,'%'),    cls: '' },
      { label:'Kelly Criterion',value: fmt(s['Kelly Criterion'],3),          cls: Number(s['Kelly Criterion'])>0?'pos':'neg' },
      { label:'SQN',            value: fmt(s['SQN'],2),                      cls: Number(s['SQN'])>=1?'pos':'warn' },
      { label:'Equity Final',   value: `$${Number(s['Equity Final [$]']||0).toLocaleString(undefined,{maximumFractionDigits:0})}`, cls: Number(s['Return [%]'])>=0?'pos':'neg' },
      { label:'Alpha',          value: fmt(s['Alpha [%]'],2,'%'),            cls: cls(s['Alpha [%]']) },
    ].map(m => `
      <div class="at-metric">
        <div class="at-metric-label">${m.label}</div>
        <div class="at-metric-value ${m.cls}">${m.value}</div>
      </div>`).join('');

    // Equity Chart
    if (this.equityChart) { this.equityChart.destroy(); this.equityChart = null; }
    const ctx = document.getElementById('at-equity-chart')?.getContext('2d');
    if (ctx && equity?.length) {
      const labels = equity.map(e => new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}));
      const eqData = equity.map(e => e.equity);
      const startEq = eqData[0] || result.cash;
      const bhPct = s['Buy & Hold Return [%]'] != null ? Number(s['Buy & Hold Return [%]']) / 100 : 0;
      const bhData = eqData.map((_, i) => startEq * (1 + bhPct * (i / (eqData.length-1))));

      this.equityChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'Strategy', data:eqData, borderColor:'#6c63ff', backgroundColor:'rgba(108,99,255,0.08)', borderWidth:2, pointRadius:0, fill:true, tension:0.3 },
            { label:'Buy & Hold', data:bhData, borderColor:'#f7971e', backgroundColor:'transparent', borderWidth:1.5, borderDash:[5,5], pointRadius:0, fill:false },
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false}, tooltip:{ mode:'index', intersect:false, backgroundColor:'#1e2442', titleColor:'#e4e7f1', bodyColor:'#a0a8c1', borderColor:'rgba(102,126,234,0.3)', borderWidth:1, callbacks:{ label: c => ` ${c.dataset.label}: $${Number(c.parsed.y).toLocaleString(undefined,{maximumFractionDigits:0})}` } } },
          scales:{
            x:{ ticks:{color:'#6b7394',maxTicksLimit:8,font:{size:10}}, grid:{color:'rgba(102,126,234,0.06)'} },
            y:{ ticks:{color:'#6b7394',font:{size:10},callback:v=>'$'+(v>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0))}, grid:{color:'rgba(102,126,234,0.06)'} }
          }
        }
      });
    }

    // Risk/Profit cards
    const riskChecks = [
      { label:'Drawdown check', value: fmt(risk.details?.max_drawdown_pct,1,'%'), pass: risk.details?.max_drawdown_pct >= (risk.details?.max_drawdown_limit ?? -20) },
      { label:'Trades > 0',     value: risk.details?.num_trades, pass: risk.details?.num_trades > 0 },
    ];
    document.getElementById('at-risk-card').innerHTML = `
      <div class="at-card-title">🛡️ Risk Control</div>
      <div style="margin-bottom:8px;font-size:0.78rem;font-weight:700;color:${risk.passed?'#00c896':'#ff6a6a'};">${risk.passed?'✅ PASSED':'❌ FAILED'}</div>
      ${riskChecks.map(c=>`<div class="at-check-row"><span class="at-check-label">${c.label}</span><span class="at-check-value ${c.pass?'at-pass':'at-fail'}">${c.value} ${c.pass?'✓':'✗'}</span></div>`).join('')}
    `;

    const profitChecks = profit ? [
      { label:'Sharpe Ratio',  value: fmt(profit.details?.sharpe,2), pass: profit.details?.sharpe_ok },
      { label:'Calmar Ratio',  value: fmt(profit.details?.calmar,2), pass: profit.details?.calmar_ok },
      { label:'Trade count',   value: profit.details?.num_trades,    pass: profit.details?.trades_ok },
    ] : [];
    document.getElementById('at-profit-card').innerHTML = `
      <div class="at-card-title">📈 Profit Check</div>
      ${profit ? `<div style="margin-bottom:8px;font-size:0.78rem;font-weight:700;color:${profit.passed?'#00c896':'#ff6a6a'};">${profit.passed?'✅ PASSED':'❌ FAILED'}</div>
      ${profitChecks.map(c=>`<div class="at-check-row"><span class="at-check-label">${c.label}</span><span class="at-check-value ${c.pass?'at-pass':'at-fail'}">${c.value} ${c.pass?'✓':'✗'}</span></div>`).join('')}` : '<div class="at-strategy-empty">Not evaluated (risk failed)</div>'}
    `;

    // Trades
    const tbody = document.getElementById('at-trades-tbody');
    if (tbody) {
      tbody.innerHTML = trades?.length ? trades.slice(0,30).map(t => `<tr>
        <td>${t.entry.slice(0,16)}</td>
        <td>${t.exit.slice(0,16)}</td>
        <td>$${Number(t.entryPrice).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
        <td>$${Number(t.exitPrice).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
        <td class="${t.returnPct>=0?'pos':'neg'}">${t.returnPct>=0?'+':''}${Number(t.returnPct).toFixed(2)}%</td>
        <td class="${t.pnl>=0?'pos':'neg'}">${t.pnl>=0?'+':''}$${Number(t.pnl).toFixed(2)}</td>
      </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted,#6b7394);padding:16px;">No trades executed</td></tr>';
    }
  },

  async saveResult() {
    if (!this.lastResult) return;
    const thoughts = document.getElementById('at-thoughts')?.value || '';
    const { verdict, stats, strategy, symbol, timeframe, start } = this.lastResult;
    const payload = {
      strategy_file: strategy,
      symbol, timeframe, start,
      return_pct:       stats['Return [%]'],
      sharpe:           stats['Sharpe Ratio'],
      max_drawdown_pct: stats['Max Drawdown [%]'],
      profit_factor:    stats['Profit Factor'],
      num_trades:       stats['Trades'],
      win_rate_pct:     stats['Win Rate [%]'],
      calmar:           stats['Calmar Ratio'],
      status:           verdict === 'ELIGIBLE' ? 'eligible' : verdict.startsWith('DISCARD') ? 'discard' : 'crash',
      thoughts,
    };
    try {
      await fetch('/api/autotrade/results', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const btn = document.getElementById('at-save-btn');
      btn.textContent = '✅ Saved!';
      setTimeout(() => { btn.textContent = '💾 Save to Experiment Log'; }, 2000);
      await this.loadResults();
    } catch(e) { alert('Failed to save result.'); }
  },

  async loadResults() {
    try {
      const r = await fetch('/api/autotrade/results').then(r => r.json());
      const el = document.getElementById('at-results-log');
      if (!el) return;
      if (!r.results?.length) { el.innerHTML = '<div class="at-empty-log">No experiments logged yet. Run a backtest and save it!</div>'; return; }
      el.innerHTML = r.results.slice(0,15).map(res => {
        const vc = this.VERDICT_CONFIG[res.status?.toUpperCase()] || {};
        const verdictKey = res.status === 'eligible' ? 'ELIGIBLE' : res.status === 'discard' ? 'DISCARD_RISK' : 'CRASH';
        return `<div class="at-log-item">
          <div class="at-log-header">
            <span class="at-log-strategy">${res.strategy_file?.replace(/_/g,' ').replace('.py','') || '—'}</span>
            <span class="at-log-verdict ${verdictKey}">${verdictKey}</span>
          </div>
          <div class="at-log-meta">${res.symbol || ''} · ${res.timeframe || ''} · ${res.timestamp?.slice(0,10) || ''}</div>
          <div class="at-log-metrics">
            <span class="at-log-metric">Ret: ${res.return_pct != null ? Number(res.return_pct).toFixed(1)+'%' : '—'}</span>
            <span class="at-log-metric">Sharpe: ${res.sharpe != null ? Number(res.sharpe).toFixed(2) : '—'}</span>
            <span class="at-log-metric">DD: ${res.max_drawdown_pct != null ? Number(res.max_drawdown_pct).toFixed(1)+'%' : '—'}</span>
            <span class="at-log-metric">Trades: ${res.num_trades ?? '—'}</span>
          </div>
          ${res.thoughts ? `<div style="font-size:0.72rem;color:var(--text-muted,#6b7394);margin-top:4px;font-style:italic;">"${res.thoughts.slice(0,100)}${res.thoughts.length>100?'…':''}"</div>` : ''}
        </div>`;
      }).join('');
    } catch {}
  },

  async createStrategy() {
    const name = document.getElementById('at-new-name')?.value?.trim();
    const desc = document.getElementById('at-new-desc')?.value?.trim();
    if (!name) { alert('Please enter a strategy name.'); return; }
    try {
      const r = await fetch('/api/autotrade/strategy/create', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, description: desc || 'Custom strategy' })
      }).then(r => r.json());
      if (r.success) {
        await this.loadStrategies();
        const sel = document.getElementById('at-strategy');
        if (sel) sel.value = r.file;
        this.showStrategyInfo(r.file);
        await this.viewCode(r.file);
        alert(`Strategy "${r.file}" created! Edit the code in the viewer below, then run a backtest.`);
      } else {
        alert('Error: ' + r.error);
      }
    } catch(e) { alert('Failed to create strategy — is the engine running?'); }
  },
};

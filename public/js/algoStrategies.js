/**
 * Algo Strategy Framework — TraderPro
 * 5 built-in algorithmic strategies with live simulation and performance metrics:
 *   1. Trend Following  — EMA crossover + MA alignment
 *   2. Mean Reversion   — RSI extremes + Bollinger bounce
 *   3. Momentum         — RSI + volume confirmation
 *   4. Breakout         — BB squeeze + volume spike
 *   5. Multi-Factor     — Weighted ensemble of all signals
 */

const AlgoStrategies = {
  currentStrategy: 'trend',
  currentCoin: 'BTC',
  simRunning: false,
  simResults: null,
  simChart: null,

  STRATEGIES: {
    trend: {
      name: 'Trend Following',
      icon: '📈',
      description: 'Enters long when EMA(12) crosses above EMA(26) with price above 50MA. Exits on reverse cross or 5% stop-loss.',
      color: '#00c896',
      params: [
        { id: 'tf_fastEma',   label: 'Fast EMA Period', type: 'number', default: 12, min: 5,  max: 50  },
        { id: 'tf_slowEma',   label: 'Slow EMA Period', type: 'number', default: 26, min: 10, max: 100 },
        { id: 'tf_stopLoss',  label: 'Stop-Loss %',     type: 'number', default: 5,  min: 1,  max: 20  },
        { id: 'tf_takeProfit',label: 'Take-Profit %',   type: 'number', default: 15, min: 5,  max: 50  },
      ]
    },
    reversion: {
      name: 'Mean Reversion',
      icon: '↩️',
      description: 'Buys when RSI < 30 and price near lower Bollinger Band. Sells when RSI > 70 or price reaches middle band.',
      color: '#f59e0b',
      params: [
        { id: 'mr_rsiOversold',  label: 'RSI Oversold', type: 'number', default: 30, min: 15, max: 40 },
        { id: 'mr_rsiOverbought',label: 'RSI Overbought',type: 'number', default: 70, min: 60, max: 90 },
        { id: 'mr_stopLoss',     label: 'Stop-Loss %',  type: 'number', default: 4,  min: 1,  max: 15 },
        { id: 'mr_bbPeriod',     label: 'BB Period',    type: 'number', default: 20, min: 10, max: 50 },
      ]
    },
    momentum: {
      name: 'Momentum',
      icon: '🚀',
      description: 'Rides strong trends. Enters when RSI 50–70, MACD bullish, and volume above 1.5x average. Uses trailing stop.',
      color: '#a78bfa',
      params: [
        { id: 'mo_rsiMin',       label: 'RSI Min Entry', type: 'number', default: 50, min: 40, max: 65 },
        { id: 'mo_rsiMax',       label: 'RSI Max Entry', type: 'number', default: 70, min: 55, max: 85 },
        { id: 'mo_volMin',       label: 'Min Volume Ratio',type:'number',default: 1.5,min: 1,  max: 3  },
        { id: 'mo_trailStop',    label: 'Trailing Stop %',type: 'number', default: 6, min: 2,  max: 20 },
      ]
    },
    breakout: {
      name: 'Breakout',
      icon: '💥',
      description: 'Detects Bollinger Band squeeze (bandwidth < 5%) then enters on expansion with volume confirmation.',
      color: '#f472b6',
      params: [
        { id: 'bo_squeezeThresh',label: 'Squeeze Threshold %',type:'number', default: 5,  min: 1, max: 15 },
        { id: 'bo_volConfirm',   label: 'Volume Confirm (x)', type:'number', default: 1.5, min:1, max: 4  },
        { id: 'bo_stopLoss',     label: 'Stop-Loss %',        type:'number', default: 5,  min: 1, max: 20 },
        { id: 'bo_takeProfit',   label: 'Take-Profit %',      type:'number', default: 20, min: 5, max: 60 },
      ]
    },
    multifactor: {
      name: 'Multi-Factor',
      icon: '⚙️',
      description: 'Weighted ensemble: RSI (25%) + MACD (25%) + Bollinger (25%) + Volume (25%). Enters on combined score ≥ 60.',
      color: '#60a5fa',
      params: [
        { id: 'mf_entryScore',   label: 'Entry Score (0-100)', type:'number', default: 60, min: 40, max: 85 },
        { id: 'mf_exitScore',    label: 'Exit Score (0-100)',  type:'number', default: -30,min: -80, max: 0 },
        { id: 'mf_stopLoss',     label: 'Stop-Loss %',         type:'number', default: 6, min: 1,  max: 20 },
        { id: 'mf_positionSize', label: 'Position Size %',     type:'number', default: 20,min: 5,  max: 100},
      ]
    }
  },

  // ── Init ─────────────────────────────────────────────────────────────
  init() {
    const el = document.getElementById('algo-strategies');
    if (!el) return;
    if (el.querySelector('.algo-page')) return;
    this.render(el);
  },

  render(el) {
    const stratList = Object.entries(this.STRATEGIES).map(([key, s]) =>
      `<button class="algo-strat-tab ${key === this.currentStrategy ? 'active' : ''}"
        data-key="${key}" onclick="AlgoStrategies.selectStrategy('${key}',this)"
        style="--strat-color:${s.color}">
        <span class="algo-strat-icon">${s.icon}</span>
        <span class="algo-strat-name">${s.name}</span>
      </button>`
    ).join('');

    el.innerHTML = `
      <div class="algo-page">
        <div class="section-header">
          <h1 class="section-title">⚙️ Algo Strategy Framework</h1>
          <p class="section-subtitle">
            5 built-in algorithmic strategies. Select, configure parameters, run a historical simulation, then monitor live signals.
          </p>
        </div>

        <!-- Strategy Tabs -->
        <div class="algo-strat-tabs">${stratList}</div>

        <!-- Main Panel -->
        <div class="algo-main-grid">

          <!-- Left: Config -->
          <div class="algo-config-panel card">
            <div id="algoStratHeader"></div>
            <div class="algo-config-form" id="algoConfigForm"></div>

            <div class="algo-coin-row">
              <label class="algo-label">Coin to test</label>
              <select id="algoSimCoin" class="algo-select">
                ${['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','LINK','DOT','ATOM','LTC'].map(c =>
                  `<option value="${c}">${c}</option>`
                ).join('')}
              </select>
              <label class="algo-label" style="margin-left:1rem;">Capital ($)</label>
              <input type="number" id="algoCapital" value="10000" min="100" step="100" class="algo-input" style="width:110px;">
            </div>

            <button class="algo-run-btn" onclick="AlgoStrategies.runSimulation()">
              ▶ Run Simulation (90 days)
            </button>
          </div>

          <!-- Right: Results -->
          <div class="algo-results-panel">
            <div id="algoResultsContent">
              <div class="algo-empty-state">
                <div style="font-size:2.5rem;margin-bottom:0.75rem;">⚙️</div>
                <p>Configure a strategy and click <strong>Run Simulation</strong> to see performance metrics.</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Live Signal Monitor -->
        <div class="algo-live-section card" style="margin-top:1.25rem;">
          <div class="algo-live-header">
            <h3>📡 Live Strategy Signal Monitor</h3>
            <button class="algo-live-check-btn" onclick="AlgoStrategies.checkLiveSignal()">
              Check Current Signal
            </button>
          </div>
          <div id="algoLiveSignal" class="algo-live-content">
            <p style="color:#666;font-size:0.88rem;">Select a strategy above and click "Check Current Signal" to get a real-time recommendation.</p>
          </div>
        </div>
      </div>

      <style>
        .algo-page { padding:0 0 2rem; }

        .algo-strat-tabs {
          display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.25rem;
        }
        .algo-strat-tab {
          display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.1rem;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
          border-radius:10px; cursor:pointer; font-size:0.85rem; font-weight:600;
          color:#888; transition:all 0.2s;
        }
        .algo-strat-tab:hover { background:rgba(255,255,255,0.08); color:#ccc; }
        .algo-strat-tab.active {
          background:rgba(var(--strat-color-rgb, 108,99,255), 0.15);
          border-color:var(--strat-color);
          color:var(--strat-color);
          box-shadow:0 0 12px rgba(108,99,255,0.15);
        }
        .algo-strat-icon { font-size:1.1rem; }
        .algo-strat-name { white-space:nowrap; }

        .algo-main-grid {
          display:grid; grid-template-columns:340px 1fr; gap:1.25rem; align-items:start;
        }
        @media(max-width:900px){ .algo-main-grid { grid-template-columns:1fr; } }

        .algo-config-panel { padding:1.25rem; }
        .algo-strat-desc {
          font-size:0.85rem; line-height:1.55; color:#aaa;
          background:rgba(255,255,255,0.04); border-radius:9px;
          padding:0.75rem 1rem; margin:0.75rem 0 1rem; border-left:3px solid var(--strat-color, #6c63ff);
        }
        .algo-config-form { display:flex; flex-direction:column; gap:0.65rem; margin-bottom:1rem; }
        .algo-config-row { display:flex; flex-direction:column; gap:0.2rem; }
        .algo-label { font-size:0.75rem; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
        .algo-input, .algo-select {
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);
          color:#e0e0e0; border-radius:8px; padding:0.45rem 0.75rem; font-size:0.88rem; width:100%;
        }
        .algo-input:focus, .algo-select:focus { outline:none; border-color:#6c63ff; }
        .algo-coin-row { display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; }
        .algo-run-btn {
          width:100%; background:linear-gradient(135deg,#6c63ff,#00c896);
          color:#fff; border:none; border-radius:10px; padding:0.65rem;
          font-size:0.95rem; font-weight:700; cursor:pointer; transition:opacity 0.2s;
        }
        .algo-run-btn:hover { opacity:0.9; }
        .algo-run-btn:disabled { opacity:0.5; cursor:not-allowed; }

        .algo-empty-state {
          text-align:center; padding:3rem 1rem; color:#666; font-size:0.9rem;
        }

        /* Metrics grid */
        .algo-metrics-grid {
          display:grid; grid-template-columns:repeat(3,1fr); gap:0.75rem; margin-bottom:1.25rem;
        }
        @media(max-width:600px){ .algo-metrics-grid { grid-template-columns:repeat(2,1fr); } }
        .algo-metric {
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          border-radius:10px; padding:0.75rem 0.9rem;
        }
        .algo-metric-val { font-size:1.15rem; font-weight:700; margin-bottom:0.15rem; }
        .algo-metric-lbl { font-size:0.72rem; color:#888; text-transform:uppercase; letter-spacing:0.05em; }
        .algo-metric.positive .algo-metric-val { color:#00c896; }
        .algo-metric.negative .algo-metric-val { color:#ff4d4d; }
        .algo-metric.neutral  .algo-metric-val { color:#f59e0b; }
        .algo-metric.info     .algo-metric-val { color:#60a5fa; }

        /* Equity chart */
        .algo-chart-wrap { position:relative; height:220px; margin-bottom:1.25rem; }

        /* Trades table */
        .algo-trades-title { font-size:0.8rem; color:#888; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem; }
        .algo-trades-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
        .algo-trades-table th { padding:0.45rem 0.65rem; color:#888; font-size:0.72rem; text-align:left; border-bottom:1px solid rgba(255,255,255,0.07); text-transform:uppercase; }
        .algo-trades-table td { padding:0.45rem 0.65rem; border-bottom:1px solid rgba(255,255,255,0.04); }
        .trade-win { color:#00c896; font-weight:600; }
        .trade-loss { color:#ff4d4d; font-weight:600; }

        /* Live signal */
        .algo-live-section { padding:1.1rem 1.25rem; }
        .algo-live-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; }
        .algo-live-header h3 { font-size:0.95rem; font-weight:700; }
        .algo-live-check-btn {
          background:rgba(108,99,255,0.15); color:#a78bfa; border:1px solid rgba(108,99,255,0.3);
          border-radius:8px; padding:0.4rem 1rem; font-size:0.83rem; font-weight:600; cursor:pointer;
        }
        .algo-live-check-btn:hover { background:rgba(108,99,255,0.3); }
        .algo-live-signal-box {
          background:rgba(255,255,255,0.03); border-radius:10px; padding:1rem 1.25rem;
          border:1px solid rgba(255,255,255,0.07);
        }
        .algo-live-signal-main {
          display:flex; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:0.75rem;
        }
        .algo-live-sig-badge {
          font-size:1.1rem; font-weight:800; padding:0.4rem 1.2rem; border-radius:50px;
        }
        .live-buy  { background:rgba(0,200,150,0.15); color:#00c896; border:1px solid #00c896; }
        .live-sell { background:rgba(255,77,77,0.15); color:#ff4d4d; border:1px solid #ff4d4d; }
        .live-hold { background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid #f59e0b; }
        .algo-live-reasons { font-size:0.83rem; color:#aaa; line-height:1.7; }
        .algo-live-spinner {
          width:22px; height:22px; border:2px solid rgba(108,99,255,0.25);
          border-top-color:#6c63ff; border-radius:50%;
          animation:ml-spin 0.8s linear infinite; display:inline-block; vertical-align:middle;
        }
      </style>
    `;

    this.renderStrategyConfig(this.currentStrategy);
  },

  // ── Strategy Config ─────────────────────────────────────────────────
  selectStrategy(key, btn) {
    this.currentStrategy = key;
    document.querySelectorAll('.algo-strat-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderStrategyConfig(key);
    document.getElementById('algoResultsContent').innerHTML = `<div class="algo-empty-state"><div style="font-size:2rem;margin-bottom:0.5rem;">${this.STRATEGIES[key].icon}</div><p>Click <strong>Run Simulation</strong> to test <strong>${this.STRATEGIES[key].name}</strong>.</p></div>`;
  },

  renderStrategyConfig(key) {
    const s = this.STRATEGIES[key];
    if (!s) return;
    const headerEl = document.getElementById('algoStratHeader');
    const formEl   = document.getElementById('algoConfigForm');
    if (!headerEl || !formEl) return;

    headerEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <span style="font-size:1.5rem;">${s.icon}</span>
        <span style="font-size:1rem;font-weight:700;">${s.name}</span>
      </div>
      <div class="algo-strat-desc" style="--strat-color:${s.color}">${s.description}</div>
    `;
    formEl.innerHTML = s.params.map(p => `
      <div class="algo-config-row">
        <label class="algo-label">${p.label}</label>
        <input type="${p.type}" id="${p.id}" value="${p.default}" min="${p.min}" max="${p.max}"
          step="${p.type === 'number' && String(p.default).includes('.') ? '0.1' : '1'}"
          class="algo-input">
      </div>
    `).join('');
  },

  getParam(id, fallback) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) || fallback : fallback;
  },

  // ── Simulation Engine ───────────────────────────────────────────────
  async runSimulation() {
    if (this.simRunning) return;
    this.simRunning = true;

    const coin      = document.getElementById('algoSimCoin')?.value || 'BTC';
    const capital   = parseFloat(document.getElementById('algoCapital')?.value) || 10000;
    const strategy  = this.currentStrategy;
    const s         = this.STRATEGIES[strategy];
    const runBtn    = document.querySelector('.algo-run-btn');
    const resultsEl = document.getElementById('algoResultsContent');

    if (runBtn) { runBtn.disabled = true; runBtn.textContent = '⏳ Running simulation…'; }
    resultsEl.innerHTML = `<div style="padding:2rem;text-align:center;color:#888;"><div class="algo-live-spinner"></div> <span style="margin-left:0.75rem">Fetching 90 days of ${coin} data…</span></div>`;

    try {
      const coinId = this.coinToId(coin);
      const history = await apiRequest(`/api/crypto/${coinId}/history?days=90`);
      const prices  = history.prices.map(p => ({ date: new Date(p.timestamp), price: p.price }));

      if (prices.length < 30) throw new Error('Not enough data');

      const trades  = this.simulate(strategy, prices, capital);
      const metrics = this.calcMetrics(trades, capital, prices);

      this.simResults = { trades, metrics, prices, coin, capital, strategy };
      this.renderSimResults(metrics, trades, prices, capital, coin, s);

    } catch (e) {
      resultsEl.innerHTML = `<div class="algo-empty-state" style="color:#ff6b6b;">❌ Simulation failed: ${e.message}</div>`;
    } finally {
      this.simRunning = false;
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶ Run Simulation (90 days)'; }
    }
  },

  // ── Core Simulation ─────────────────────────────────────────────────
  simulate(strategy, prices, capital) {
    const closePrices = prices.map(p => p.price);
    const n = closePrices.length;
    const trades = [];
    let position = null;
    let equity   = capital;

    // Pre-compute indicators
    const ema12  = this.ema(closePrices, 12);
    const ema26  = this.ema(closePrices, 26);
    const sma20  = this.sma(closePrices, 20);
    const sma50  = this.sma(closePrices, 50);
    const rsiArr = this.rsiArr(closePrices, 14);
    const bbands = this.bollingerArr(closePrices, 20, 2);
    const volArr = closePrices.map((p, i) => i === 0 ? 1 : Math.abs(p - closePrices[i-1]) / closePrices[i-1]);
    const macdArr = ema12.map((e, i) => e - (ema26[i] || e));

    for (let i = 50; i < n; i++) {
      const price   = closePrices[i];
      const rsi     = rsiArr[i] ?? 50;
      const bb      = bbands[i] ?? { upper: price*1.02, lower: price*0.98, mid: price, width: 5 };
      const macdVal = macdArr[i] ?? 0;
      const prevMacd= macdArr[i-1] ?? 0;
      const vol     = volArr[i] ?? 0.01;
      const avgVol  = volArr.slice(Math.max(0,i-10), i).reduce((a,b)=>a+b,0) / 10;
      const volRatio= avgVol > 0 ? vol / avgVol : 1;

      let signal = 0; // >0 = buy, <0 = sell/exit

      switch (strategy) {
        case 'trend':
          if ((ema12[i] || 0) > (ema26[i] || 0) && price > (sma50[i] || price)) signal = 1;
          else if ((ema12[i] || 0) < (ema26[i] || 0)) signal = -1;
          break;
        case 'reversion':
          const ob = this.getParam('mr_rsiOverbought', 70);
          const os = this.getParam('mr_rsiOversold', 30);
          if (rsi < os && price <= bb.lower * 1.01) signal = 1;
          else if (rsi > ob || price >= bb.mid)    signal = -1;
          break;
        case 'momentum':
          const rMin = this.getParam('mo_rsiMin', 50);
          const rMax = this.getParam('mo_rsiMax', 70);
          const vMin = this.getParam('mo_volMin', 1.5);
          if (rsi > rMin && rsi < rMax && macdVal > prevMacd && volRatio > vMin) signal = 1;
          else if (rsi > rMax || macdVal < prevMacd) signal = -1;
          break;
        case 'breakout':
          const sqT = this.getParam('bo_squeezeThresh', 5);
          const vCon= this.getParam('bo_volConfirm', 1.5);
          const was = bbands[i-1]?.width ?? 5;
          if (was < sqT && bb.width >= sqT && volRatio >= vCon) signal = price > (bb.mid || price) ? 1 : -1;
          else if (bb.width < sqT * 0.5) signal = 0; // still squeezing
          break;
        case 'multifactor': {
          const rsiScore  = rsi < 35 ? 1 : rsi > 65 ? -1 : 0;
          const macdScore = macdVal > prevMacd ? 1 : -1;
          const bbScore   = price < bb.lower ? 1 : price > bb.upper ? -1 : 0;
          const volScore  = volRatio > 1.3 ? (rsiScore > 0 ? 0.5 : -0.5) : 0;
          const composite = (rsiScore + macdScore + bbScore + volScore) / 3.5 * 100;
          const entryT = this.getParam('mf_entryScore', 60);
          const exitT  = this.getParam('mf_exitScore', -30);
          if (composite >= entryT)  signal = 1;
          else if (composite <= exitT) signal = -1;
          break;
        }
      }

      // Position management
      const stopLoss   = this.getParam(`${strategy.substring(0,2)}_stopLoss`,   5) / 100;
      const takeProfit = this.getParam(`${strategy.substring(0,2)}_takeProfit`, 15) / 100;
      const trailStop  = this.getParam('mo_trailStop', 6) / 100;

      if (!position && signal === 1) {
        const posSize = (this.getParam('mf_positionSize', 100) / 100) * equity;
        position = { entry: price, entryDate: prices[i].date, size: posSize, peak: price };
      } else if (position) {
        position.peak = Math.max(position.peak, price);
        const pl    = (price - position.entry) / position.entry;
        const trail = (position.peak - price) / position.peak;

        const exitBySignal = signal === -1;
        const exitByStop   = pl <= -stopLoss;
        const exitByTP     = takeProfit > 0 && pl >= takeProfit;
        const exitByTrail  = strategy === 'momentum' && trail >= trailStop;

        if (exitBySignal || exitByStop || exitByTP || exitByTrail) {
          const pnl = position.size * pl;
          equity   += pnl;
          trades.push({
            entry:     position.entry,
            exit:      price,
            entryDate: position.entryDate,
            exitDate:  prices[i].date,
            pnl,
            pnlPct:    pl * 100,
            size:      position.size,
            win:       pnl > 0,
            exitReason: exitByStop ? 'Stop Loss' : exitByTP ? 'Take Profit' : exitByTrail ? 'Trail Stop' : 'Signal',
          });
          position = null;
        }
      }
    }
    // Close any open position at last price
    if (position) {
      const price = closePrices[n-1];
      const pl    = (price - position.entry) / position.entry;
      const pnl   = position.size * pl;
      equity += pnl;
      trades.push({ entry: position.entry, exit: price, entryDate: position.entryDate, exitDate: prices[n-1].date, pnl, pnlPct: pl*100, size: position.size, win: pnl>0, exitReason: 'End' });
    }
    return trades;
  },

  calcMetrics(trades, capital, prices) {
    const finalEquity = capital + trades.reduce((s, t) => s + t.pnl, 0);
    const totalReturn = ((finalEquity - capital) / capital) * 100;
    const wins        = trades.filter(t => t.win);
    const losses      = trades.filter(t => !t.win);
    const winRate     = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgWin      = wins.length  > 0 ? wins.reduce((s,t) => s + t.pnlPct, 0) / wins.length : 0;
    const avgLoss     = losses.length> 0 ? losses.reduce((s,t) => s + t.pnlPct, 0) / losses.length : 0;
    const profitFactor= losses.length > 0 ? Math.abs(wins.reduce((s,t)=>s+t.pnl,0) / losses.reduce((s,t)=>s+t.pnl,0)) : wins.length > 0 ? 99 : 0;
    const maxDrawdown = this.calcMaxDrawdown(trades, capital);

    // Buy & hold benchmark
    const bhReturn = prices.length > 1 ? ((prices[prices.length-1].price - prices[0].price) / prices[0].price) * 100 : 0;
    const alpha    = totalReturn - bhReturn;

    return { finalEquity, totalReturn, winRate, avgWin, avgLoss, profitFactor, maxDrawdown, trades: trades.length, bhReturn, alpha };
  },

  calcMaxDrawdown(trades, capital) {
    let eq = capital, peak = capital, maxDD = 0;
    trades.forEach(t => {
      eq   += t.pnl;
      peak  = Math.max(peak, eq);
      const dd = (peak - eq) / peak * 100;
      maxDD = Math.max(maxDD, dd);
    });
    return maxDD;
  },

  // ── Render Simulation Results ────────────────────────────────────────
  renderSimResults(metrics, trades, prices, capital, coin, strategy) {
    const resultsEl = document.getElementById('algoResultsContent');
    const m         = metrics;
    const isGood    = m.totalReturn > 0;

    resultsEl.innerHTML = `
      <div class="algo-metrics-grid">
        <div class="algo-metric ${isGood ? 'positive' : 'negative'}">
          <div class="algo-metric-val">${m.totalReturn > 0 ? '+' : ''}${m.totalReturn.toFixed(2)}%</div>
          <div class="algo-metric-lbl">Total Return</div>
        </div>
        <div class="algo-metric info">
          <div class="algo-metric-val">$${m.finalEquity.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div class="algo-metric-lbl">Final Equity</div>
        </div>
        <div class="algo-metric ${m.winRate >= 50 ? 'positive' : 'neutral'}">
          <div class="algo-metric-val">${m.winRate.toFixed(1)}%</div>
          <div class="algo-metric-lbl">Win Rate</div>
        </div>
        <div class="algo-metric ${m.profitFactor >= 1.5 ? 'positive' : m.profitFactor >= 1 ? 'neutral' : 'negative'}">
          <div class="algo-metric-val">${m.profitFactor.toFixed(2)}</div>
          <div class="algo-metric-lbl">Profit Factor</div>
        </div>
        <div class="algo-metric negative">
          <div class="algo-metric-val">-${m.maxDrawdown.toFixed(1)}%</div>
          <div class="algo-metric-lbl">Max Drawdown</div>
        </div>
        <div class="algo-metric info">
          <div class="algo-metric-val">${m.trades}</div>
          <div class="algo-metric-lbl">Total Trades</div>
        </div>
        <div class="algo-metric ${m.alpha >= 0 ? 'positive' : 'negative'}">
          <div class="algo-metric-val">${m.alpha > 0 ? '+' : ''}${m.alpha.toFixed(2)}%</div>
          <div class="algo-metric-lbl">Alpha vs B&H</div>
        </div>
        <div class="algo-metric neutral">
          <div class="algo-metric-val">${m.bhReturn > 0 ? '+' : ''}${m.bhReturn.toFixed(2)}%</div>
          <div class="algo-metric-lbl">Buy & Hold (90d)</div>
        </div>
        <div class="algo-metric ${m.avgWin > 0 ? 'positive' : 'neutral'}">
          <div class="algo-metric-val">${m.avgWin > 0 ? '+' : ''}${m.avgWin.toFixed(2)}%</div>
          <div class="algo-metric-lbl">Avg Win</div>
        </div>
      </div>

      <div class="algo-chart-wrap">
        <canvas id="algoEquityCanvas"></canvas>
      </div>

      <div class="algo-trades-title">Last ${Math.min(trades.length, 10)} Trades</div>
      <div style="overflow-x:auto;">
        <table class="algo-trades-table">
          <thead><tr>
            <th>#</th><th>Entry Date</th><th>Exit Date</th>
            <th>Entry $</th><th>Exit $</th><th>P&L</th><th>Return</th><th>Exit Reason</th>
          </tr></thead>
          <tbody>
            ${trades.slice(-10).reverse().map((t, i) => `
              <tr>
                <td>${trades.length - i}</td>
                <td>${t.entryDate.toLocaleDateString()}</td>
                <td>${t.exitDate.toLocaleDateString()}</td>
                <td>$${t.entry.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                <td>$${t.exit.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                <td class="${t.win ? 'trade-win' : 'trade-loss'}">${t.pnl > 0 ? '+' : ''}$${t.pnl.toFixed(2)}</td>
                <td class="${t.win ? 'trade-win' : 'trade-loss'}">${t.pnlPct > 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%</td>
                <td style="font-size:0.78rem;color:#888;">${t.exitReason}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    setTimeout(() => this.drawEquityChart(trades, capital, prices), 50);
  },

  drawEquityChart(trades, capital, prices) {
    const canvas = document.getElementById('algoEquityCanvas');
    if (!canvas || typeof Chart === 'undefined') return;
    if (this.simChart) { this.simChart.destroy(); this.simChart = null; }

    // Build equity curve
    const equityCurve = [{ x: prices[0].date, y: capital }];
    let eq = capital;
    trades.forEach(t => {
      eq += t.pnl;
      equityCurve.push({ x: t.exitDate, y: eq });
    });
    // B&H curve
    const startPrice = prices[0].price;
    const bhCurve = prices.filter((_, i) => i % 3 === 0).map(p => ({
      x: p.date,
      y: capital * (p.price / startPrice)
    }));

    const finalEq = eq;
    const stratColor = finalEq >= capital ? '#00c896' : '#ff4d4d';

    this.simChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Strategy Equity', data: equityCurve,
            borderColor: stratColor, backgroundColor: stratColor + '15',
            borderWidth: 2.5, pointRadius: 3, fill: true, tension: 0.3, parsing: false
          },
          {
            label: 'Buy & Hold', data: bhCurve,
            borderColor: '#6c63ff', backgroundColor: 'transparent',
            borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3, parsing: false,
            borderDash: [5,3]
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#aaa', font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` $${Number(ctx.raw.y).toLocaleString(undefined,{maximumFractionDigits:0})}` } }
        },
        scales: {
          x: { type: 'time', time: { unit: 'week' }, ticks: { color:'#666', font:{size:11} }, grid: { color:'rgba(255,255,255,0.04)' } },
          y: { ticks: { color:'#666', font:{size:11}, callback: v => '$'+Number(v).toLocaleString() }, grid: { color:'rgba(255,255,255,0.04)' } }
        }
      }
    });
  },

  // ── Live Signal Check ─────────────────────────────────────────────────
  async checkLiveSignal() {
    const coin    = document.getElementById('algoSimCoin')?.value || 'BTC';
    const liveEl  = document.getElementById('algoLiveSignal');
    const s       = this.STRATEGIES[this.currentStrategy];
    if (!liveEl) return;

    liveEl.innerHTML = `<div style="padding:0.75rem;color:#888;font-size:0.88rem;"><div class="algo-live-spinner"></div><span style="margin-left:0.75rem">Fetching ${coin} data…</span></div>`;

    try {
      const coinId  = this.coinToId(coin);
      const analysis = await apiRequest(`/api/crypto/${coinId}/analysis`);
      const ind = analysis.indicators || {};
      const rsi  = ind.rsi?.value ?? 50;
      const macd = ind.macd?.signal || '';
      const bb   = ind.bollingerBands || {};
      const mas  = ind.movingAverages || {};
      const vol  = ind.volume || {};
      const ov   = analysis.overall || {};

      // Evaluate current signal using strategy rules
      let signal = 'HOLD';
      const reasons = [];
      const volRatio = vol.ratio ?? 1;

      switch (this.currentStrategy) {
        case 'trend':
          if (mas.sma20 > mas.sma50 && mas.sma50 > mas.sma200) { signal = 'BUY'; reasons.push('All MAs aligned bullishly (Golden Cross pattern)'); }
          else if (mas.sma20 < mas.sma50) { signal = 'SELL'; reasons.push('Short-term MA below medium-term MA (bearish)'); }
          else reasons.push('MAs not fully aligned — wait for clearer trend');
          break;
        case 'reversion':
          if (rsi < this.getParam('mr_rsiOversold', 30)) { signal = 'BUY'; reasons.push(`RSI ${rsi.toFixed(1)} is oversold`); }
          else if (rsi > this.getParam('mr_rsiOverbought', 70)) { signal = 'SELL'; reasons.push(`RSI ${rsi.toFixed(1)} is overbought`); }
          else reasons.push(`RSI ${rsi.toFixed(1)} is in neutral zone — no mean reversion trigger`);
          if (bb.bandwidth < 5) reasons.push('Bollinger squeeze active — watch for expansion');
          break;
        case 'momentum':
          if (rsi > this.getParam('mo_rsiMin', 50) && rsi < this.getParam('mo_rsiMax', 70) && macd === 'BUY' && volRatio >= this.getParam('mo_volMin', 1.5)) {
            signal = 'BUY'; reasons.push(`Momentum aligned: RSI ${rsi.toFixed(1)}, MACD bullish, volume ${volRatio.toFixed(1)}x`);
          } else {
            reasons.push(`RSI: ${rsi.toFixed(1)} | MACD: ${macd} | Volume: ${volRatio.toFixed(1)}x`);
            if (rsi > this.getParam('mo_rsiMax', 70)) reasons.push('RSI too high — momentum may be exhausted');
          }
          break;
        case 'breakout':
          if (bb.bandwidth < this.getParam('bo_squeezeThresh', 5)) reasons.push('BB squeeze detected — breakout setup forming');
          else reasons.push(`BB bandwidth ${(bb.bandwidth||0).toFixed(1)}% — no active squeeze`);
          if (volRatio > this.getParam('bo_volConfirm', 1.5)) { signal = bb.upper && ov.signal === 'BUY' ? 'BUY' : 'SELL'; reasons.push(`Volume ${volRatio.toFixed(1)}x confirms breakout direction`); }
          break;
        case 'multifactor':
          const rsiS  = rsi < 35 ? 1 : rsi > 65 ? -1 : 0;
          const macdS = macd === 'BUY' ? 1 : macd === 'SELL' ? -1 : 0;
          const bbS   = bb.signal === 'BUY' ? 1 : bb.signal === 'SELL' ? -1 : 0;
          const volS  = volRatio > 1.3 ? (rsiS > 0 ? 0.5 : -0.5) : 0;
          const comp  = (rsiS + macdS + bbS + volS) / 3.5 * 100;
          reasons.push(`Composite score: ${comp.toFixed(0)} (RSI:${rsiS>0?'+':rsiS<0?'-':'0'} MACD:${macdS>0?'+':macdS<0?'-':'0'} BB:${bbS>0?'+':bbS<0?'-':'0'} Vol:${volS>0?'+':volS<0?'-':'0'})`);
          if (comp >= this.getParam('mf_entryScore', 60))       { signal = 'BUY';  reasons.push('Score above entry threshold'); }
          else if (comp <= this.getParam('mf_exitScore', -30))  { signal = 'SELL'; reasons.push('Score below exit threshold'); }
          else reasons.push('Score between thresholds — hold / no action');
          break;
      }

      const sigClass = signal === 'BUY' ? 'live-buy' : signal === 'SELL' ? 'live-sell' : 'live-hold';
      liveEl.innerHTML = `
        <div class="algo-live-signal-box">
          <div class="algo-live-signal-main">
            <span class="algo-live-sig-badge ${sigClass}">${signal === 'BUY' ? '🟢 BUY' : signal === 'SELL' ? '🔴 SELL' : '🟡 HOLD'}</span>
            <span style="font-size:0.9rem;font-weight:600;">${s.icon} ${s.name} — ${coin}</span>
            <span style="font-size:0.8rem;color:#888;">as of ${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="algo-live-reasons">
            ${reasons.map(r => `• ${r}`).join('<br>')}
          </div>
        </div>
      `;
    } catch(e) {
      liveEl.innerHTML = `<p style="color:#ff6b6b;font-size:0.88rem;">Failed: ${e.message}</p>`;
    }
  },

  // ── Technical Helpers ─────────────────────────────────────────────────
  sma(data, period) {
    return data.map((_, i) => {
      if (i < period - 1) return null;
      return data.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
    });
  },
  ema(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i-1] * (1-k));
    return result;
  },
  rsiArr(data, period) {
    const result = new Array(data.length).fill(null);
    for (let i = period; i < data.length; i++) {
      const slice = data.slice(i - period, i + 1);
      const gains = [], losses = [];
      for (let j = 1; j < slice.length; j++) {
        const d = slice[j] - slice[j-1];
        gains.push(d > 0 ? d : 0); losses.push(d < 0 ? -d : 0);
      }
      const ag = gains.reduce((s,v) => s+v, 0) / period;
      const al = losses.reduce((s,v) => s+v, 0) / period;
      result[i] = 100 - 100 / (1 + (al === 0 ? 100 : ag / al));
    }
    return result;
  },
  bollingerArr(data, period, mult) {
    return data.map((_, i) => {
      if (i < period - 1) return null;
      const slice = data.slice(i - period + 1, i + 1);
      const mid   = slice.reduce((s,v) => s+v, 0) / period;
      const std   = Math.sqrt(slice.reduce((s,v) => s + (v-mid)**2, 0) / period);
      const upper = mid + mult * std;
      const lower = mid - mult * std;
      return { upper, lower, mid, width: ((upper - lower) / mid) * 100 };
    });
  },

  coinToId(symbol) {
    const map = { BTC:'bitcoin', ETH:'ethereum', BNB:'binancecoin', SOL:'solana', XRP:'ripple', ADA:'cardano', DOGE:'dogecoin', AVAX:'avalanche-2', LINK:'chainlink', DOT:'polkadot', ATOM:'cosmos', LTC:'litecoin' };
    return map[symbol] || symbol.toLowerCase();
  }
};

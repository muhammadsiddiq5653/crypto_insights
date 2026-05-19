/* backtester.js — Strategy Backtester on Binance historical klines */
const Backtester = (() => {
  let initialised = false;
  let running     = false;
  let resultData  = null;

  const STRATEGIES = {
    rsi_reversion: {
      label: 'RSI Mean Reversion',
      desc:  'BUY when RSI < 30, SELL when RSI > 70',
      params: [
        { id: 'rsi_period', label: 'RSI Period', default: 14, min: 5, max: 30 },
        { id: 'oversold',   label: 'Oversold',   default: 30, min: 10, max: 45 },
        { id: 'overbought', label: 'Overbought', default: 70, min: 55, max: 90 },
      ],
    },
    ma_crossover: {
      label: 'MA Crossover',
      desc:  'BUY when fast MA crosses above slow MA, SELL on cross below',
      params: [
        { id: 'fast_period', label: 'Fast MA', default: 20, min: 5,  max: 50  },
        { id: 'slow_period', label: 'Slow MA', default: 50, min: 20, max: 200 },
      ],
    },
    macd_signal: {
      label: 'MACD Signal Cross',
      desc:  'BUY when MACD crosses above signal, SELL on cross below',
      params: [
        { id: 'fast',   label: 'Fast EMA',   default: 12, min: 5,  max: 30 },
        { id: 'slow',   label: 'Slow EMA',   default: 26, min: 15, max: 60 },
        { id: 'signal', label: 'Signal EMA', default: 9,  min: 3,  max: 20 },
      ],
    },
    bollinger_squeeze: {
      label: 'Bollinger Squeeze Breakout',
      desc:  'BUY breakout above upper band, SELL break below lower band',
      params: [
        { id: 'bb_period', label: 'BB Period', default: 20, min: 10, max: 50 },
        { id: 'bb_std',    label: 'Std Dev',   default: 2,  min: 1,  max: 3  },
      ],
    },
  };

  const INTERVALS = ['1h','4h','1d'];
  const SYMBOLS   = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
                     'ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','MATICUSDT'];

  // ── Technical helpers ─────────────────────────────────────────────────
  function calcSMA(arr, period) {
    return arr.map((_, i) =>
      i < period - 1 ? null :
      arr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period
    );
  }

  function calcEMA(arr, period) {
    const k = 2 / (period + 1);
    const out = new Array(arr.length).fill(null);
    let ema = arr.slice(0, period).reduce((s,v) => s+v, 0) / period;
    out[period - 1] = ema;
    for (let i = period; i < arr.length; i++) {
      ema = arr[i] * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  function calcRSI(closes, period = 14) {
    const out = new Array(closes.length).fill(null);
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let avgG = gains / period, avgL = losses / period;
    out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
      avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
      out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    }
    return out;
  }

  function calcBollinger(closes, period, stdMult) {
    const sma = calcSMA(closes, period);
    return closes.map((_, i) => {
      if (sma[i] === null) return { mid: null, upper: null, lower: null };
      const slice = closes.slice(i - period + 1, i + 1);
      const mean  = sma[i];
      const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
      return { mid: mean, upper: mean + stdMult * std, lower: mean - stdMult * std };
    });
  }

  // ── Signal generators ─────────────────────────────────────────────────
  function signalsRSI(closes, params) {
    const rsi = calcRSI(closes, params.rsi_period);
    return closes.map((_, i) => {
      if (rsi[i] === null) return 0;
      if (rsi[i] < params.oversold)   return  1;  // BUY
      if (rsi[i] > params.overbought) return -1;  // SELL
      return 0;
    });
  }

  function signalsMA(closes, params) {
    const fast = calcSMA(closes, params.fast_period);
    const slow = calcSMA(closes, params.slow_period);
    return closes.map((_, i) => {
      if (fast[i] === null || slow[i] === null || fast[i-1] === null || slow[i-1] === null) return 0;
      if (fast[i-1] <= slow[i-1] && fast[i] > slow[i]) return  1;
      if (fast[i-1] >= slow[i-1] && fast[i] < slow[i]) return -1;
      return 0;
    });
  }

  function signalsMACD(closes, params) {
    const fastEMA   = calcEMA(closes, params.fast);
    const slowEMA   = calcEMA(closes, params.slow);
    const macdLine  = closes.map((_, i) =>
      fastEMA[i] !== null && slowEMA[i] !== null ? fastEMA[i] - slowEMA[i] : null
    );
    const validMACD = macdLine.filter(v => v !== null);
    const signalArr = calcEMA(validMACD, params.signal);
    let si = 0;
    const signalLine = macdLine.map(v => v === null ? null : signalArr[si++] ?? null);

    return closes.map((_, i) => {
      if (macdLine[i] === null || signalLine[i] === null) return 0;
      if (i === 0 || macdLine[i-1] === null || signalLine[i-1] === null) return 0;
      if (macdLine[i-1] <= signalLine[i-1] && macdLine[i] > signalLine[i]) return  1;
      if (macdLine[i-1] >= signalLine[i-1] && macdLine[i] < signalLine[i]) return -1;
      return 0;
    });
  }

  function signalsBollinger(closes, params) {
    const bb = calcBollinger(closes, params.bb_period, params.bb_std);
    return closes.map((c, i) => {
      if (bb[i].upper === null) return 0;
      if (c > bb[i].upper) return  1;
      if (c < bb[i].lower) return -1;
      return 0;
    });
  }

  // ── Simulate trades ───────────────────────────────────────────────────
  function simulate(closes, timestamps, rawSignals, slPct = 0.03, tpPct = 0.06) {
    const trades = [];
    let position = null; // { dir, entry, entryIdx }

    rawSignals.forEach((sig, i) => {
      if (position) {
        const { dir, entry, entryIdx } = position;
        const price = closes[i];
        const pnlPct = dir === 1 ? (price - entry) / entry : (entry - price) / entry;

        // Exit conditions: opposite signal, SL hit, TP hit
        const exitSig = sig === -dir;
        const slHit   = pnlPct <= -slPct;
        const tpHit   = pnlPct >= tpPct;

        if (exitSig || slHit || tpHit) {
          trades.push({
            dir, entry, exit: price,
            entryTime: timestamps[entryIdx], exitTime: timestamps[i],
            pnlPct: parseFloat((pnlPct * 100).toFixed(3)),
            reason: tpHit ? 'TP' : slHit ? 'SL' : 'Signal',
          });
          position = null;
        }
      }

      if (!position && (sig === 1 || sig === -1)) {
        position = { dir: sig, entry: closes[i], entryIdx: i };
      }
    });

    // Close any open position at last candle
    if (position) {
      const price = closes[closes.length - 1];
      const pnlPct = position.dir === 1
        ? (price - position.entry) / position.entry
        : (position.entry - price) / position.entry;
      trades.push({
        dir: position.dir, entry: position.entry, exit: price,
        entryTime: timestamps[position.entryIdx], exitTime: timestamps[timestamps.length - 1],
        pnlPct: parseFloat((pnlPct * 100).toFixed(3)),
        reason: 'End',
      });
    }

    return trades;
  }

  // ── Compute stats from trades ─────────────────────────────────────────
  function stats(trades, closes) {
    if (!trades.length) return null;
    const wins    = trades.filter(t => t.pnlPct > 0);
    const losses  = trades.filter(t => t.pnlPct <= 0);
    const totalR  = trades.reduce((s, t) => s + t.pnlPct, 0);
    const winRate = (wins.length / trades.length * 100).toFixed(1);
    const avgWin  = wins.length  ? (wins.reduce((s,t)=>s+t.pnlPct,0)/wins.length).toFixed(2) : 0;
    const avgLoss = losses.length ? (losses.reduce((s,t)=>s+t.pnlPct,0)/losses.length).toFixed(2) : 0;
    const pf = losses.length && Math.abs(parseFloat(avgLoss)) > 0
      ? (Math.abs(parseFloat(avgWin)*wins.length / (Math.abs(parseFloat(avgLoss))*losses.length))).toFixed(2) : '∞';

    // Cumulative equity curve
    const equity = [100];
    trades.forEach(t => equity.push(equity[equity.length-1] * (1 + t.pnlPct/100)));

    // Max drawdown
    let peak = 100, maxDD = 0;
    equity.forEach(e => {
      if (e > peak) peak = e;
      const dd = (peak - e) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    });

    // Buy & hold return
    const bh = (closes[closes.length-1] - closes[0]) / closes[0] * 100;

    return { trades: trades.length, wins: wins.length, losses: losses.length,
             winRate, totalR: totalR.toFixed(2), avgWin, avgLoss, pf,
             maxDD: maxDD.toFixed(2), equity, bh: bh.toFixed(2) };
  }

  // ── Fetch klines ──────────────────────────────────────────────────────
  async function fetchKlines(symbol, interval, limit = 300) {
    const r = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    const data = await r.json();
    return {
      closes:     data.map(k => parseFloat(k[4])),
      timestamps: data.map(k => k[0]),
    };
  }

  // ── Build param values from form ──────────────────────────────────────
  function readParams(stratId) {
    const paramDefs = STRATEGIES[stratId]?.params || [];
    const out = {};
    paramDefs.forEach(p => {
      const el = document.getElementById(`bt-param-${p.id}`);
      out[p.id] = el ? parseFloat(el.value) || p.default : p.default;
    });
    return out;
  }

  // ── Draw equity curve ─────────────────────────────────────────────────
  function drawEquity(equity, bh) {
    const canvas = document.getElementById('bt-chart');
    if (!canvas || !equity.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = canvas.offsetWidth  || 700;
    const H = canvas.height = canvas.offsetHeight || 200;

    const min = Math.min(...equity, 100 + parseFloat(bh));
    const max = Math.max(...equity, 100 + parseFloat(bh));
    const range = max - min || 1;
    const pad = { t: 16, b: 24, l: 10, r: 10 };
    const w = W - pad.l - pad.r;
    const h = H - pad.t - pad.b;
    const toX = i => pad.l + (i / (equity.length - 1 || 1)) * w;
    const toY = v => pad.t + h - ((v - min) / range) * h;

    ctx.clearRect(0, 0, W, H);

    // Buy & hold reference line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, toY(100));
    ctx.lineTo(W - pad.r, toY(100 + parseFloat(bh)));
    ctx.stroke();
    ctx.setLineDash([]);

    // Equity fill
    const finalVal = equity[equity.length - 1];
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, finalVal >= 100 ? 'rgba(45,216,130,0.3)' : 'rgba(255,95,87,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(equity[0]));
    equity.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(equity.length - 1), H - pad.b);
    ctx.lineTo(toX(0), H - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Equity line
    ctx.beginPath();
    equity.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.strokeStyle = finalVal >= 100 ? '#2dd882' : '#ff5f57';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${min.toFixed(1)}`, pad.l + 2, H - pad.b + 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${max.toFixed(1)}`, W - pad.r, pad.t + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left';
    ctx.fillText('B&H', pad.l + w * 0.85, toY(100 + parseFloat(bh)) - 4);
  }

  // ── Render ────────────────────────────────────────────────────────────
  function renderSection() {
    const el = document.getElementById('backtester');
    if (!el) return;

    el.innerHTML = `
      <div class="bt-page">
        <div class="bt-header">
          <div>
            <h2 class="ae-title">🧪 Strategy Backtester</h2>
            <p class="ae-subtitle">Replay strategies against up to 300 historical Binance candles</p>
          </div>
        </div>

        <div class="card bt-config-card">
          <div class="card-header">Configuration</div>
          <div class="card-body">
            <div class="bt-config-row">
              <div class="bt-config-group">
                <label>Symbol</label>
                <select id="bt-symbol" class="ae-select">
                  ${SYMBOLS.map(s => `<option value="${s}">${s.replace('USDT','')}</option>`).join('')}
                </select>
              </div>
              <div class="bt-config-group">
                <label>Interval</label>
                <select id="bt-interval" class="ae-select">
                  ${INTERVALS.map(i => `<option value="${i}" ${i==='4h'?'selected':''}>${i}</option>`).join('')}
                </select>
              </div>
              <div class="bt-config-group">
                <label>Candles</label>
                <select id="bt-limit" class="ae-select">
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300" selected>300</option>
                  <option value="500">500</option>
                </select>
              </div>
              <div class="bt-config-group">
                <label>Strategy</label>
                <select id="bt-strategy" class="ae-select" onchange="Backtester.onStrategyChange()">
                  ${Object.entries(STRATEGIES).map(([k,v]) =>
                    `<option value="${k}">${v.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="bt-config-group">
                <label>SL %</label>
                <input id="bt-sl" type="number" value="3" min="0.5" max="20" step="0.5" class="ae-input" style="width:70px" />
              </div>
              <div class="bt-config-group">
                <label>TP %</label>
                <input id="bt-tp" type="number" value="6" min="0.5" max="50" step="0.5" class="ae-input" style="width:70px" />
              </div>
            </div>

            <!-- Dynamic strategy params -->
            <div class="bt-params-row" id="bt-params-row"></div>

            <div style="margin-top:1rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
              <button class="ae-btn ae-btn-primary" id="bt-run-btn" onclick="Backtester.run()">▶ Run Backtest</button>
              <span class="bt-strategy-desc" id="bt-strategy-desc"></span>
            </div>
          </div>
        </div>

        <!-- Results placeholder -->
        <div id="bt-results" style="display:none">
          <div class="bt-kpi-grid" id="bt-kpi-grid"></div>
          <div class="card" style="margin-bottom:1.25rem">
            <div class="card-header">
              <span>Equity Curve</span>
              <span class="bt-legend">
                <span class="bt-leg-strategy">─ Strategy</span>
                <span class="bt-leg-bh" style="margin-left:0.75rem">-- Buy &amp; Hold</span>
              </span>
            </div>
            <div class="card-body" style="padding:0.5rem">
              <canvas id="bt-chart" style="width:100%;height:200px;display:block"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <span>Trade Log</span>
              <span id="bt-trade-count" style="font-size:0.75rem;color:var(--color-text-muted)"></span>
            </div>
            <div class="card-body" style="overflow-x:auto" id="bt-trade-log"></div>
          </div>
        </div>

        <!-- Log best result to journal -->
        <div id="bt-journal-action" style="display:none;margin-top:1rem">
          <button class="ae-btn ae-btn-primary" onclick="Backtester.logToJournal()">📝 Log best signal to Trade Journal</button>
        </div>
      </div>
    `;

    onStrategyChange();
  }

  function onStrategyChange() {
    const stratId  = document.getElementById('bt-strategy')?.value;
    const strat    = STRATEGIES[stratId];
    const row      = document.getElementById('bt-params-row');
    const descEl   = document.getElementById('bt-strategy-desc');
    if (!row || !strat) return;
    if (descEl) descEl.textContent = strat.desc;
    row.innerHTML = strat.params.map(p => `
      <div class="bt-config-group">
        <label>${p.label}</label>
        <input id="bt-param-${p.id}" type="number" value="${p.default}"
               min="${p.min}" max="${p.max}" class="ae-input" style="width:80px" />
      </div>
    `).join('');
  }

  async function run() {
    if (running) return;
    running = true;
    const btn = document.getElementById('bt-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running…'; }

    try {
      const symbol   = document.getElementById('bt-symbol')?.value   || 'BTCUSDT';
      const interval = document.getElementById('bt-interval')?.value || '4h';
      const limit    = parseInt(document.getElementById('bt-limit')?.value) || 300;
      const stratId  = document.getElementById('bt-strategy')?.value || 'rsi_reversion';
      const slPct    = parseFloat(document.getElementById('bt-sl')?.value || 3) / 100;
      const tpPct    = parseFloat(document.getElementById('bt-tp')?.value || 6) / 100;
      const params   = readParams(stratId);

      const { closes, timestamps } = await fetchKlines(symbol, interval, limit);

      let rawSignals;
      switch (stratId) {
        case 'rsi_reversion':     rawSignals = signalsRSI(closes, params);       break;
        case 'ma_crossover':      rawSignals = signalsMA(closes, params);        break;
        case 'macd_signal':       rawSignals = signalsMACD(closes, params);      break;
        case 'bollinger_squeeze': rawSignals = signalsBollinger(closes, params); break;
        default:                  rawSignals = new Array(closes.length).fill(0);
      }

      const trades   = simulate(closes, timestamps, rawSignals, slPct, tpPct);
      const s        = stats(trades, closes);
      resultData     = { symbol, interval, stratId, trades, stats: s, closes };

      renderResults(s, trades, symbol, interval);
    } catch (err) {
      alert(`Backtest failed: ${err.message}`);
    } finally {
      running = false;
      if (btn) { btn.disabled = false; btn.textContent = '▶ Run Backtest'; }
    }
  }

  function renderResults(s, trades, symbol, interval) {
    const resultsEl = document.getElementById('bt-results');
    if (resultsEl) resultsEl.style.display = 'block';

    const jaEl = document.getElementById('bt-journal-action');
    if (jaEl) jaEl.style.display = 'block';

    const kpiGrid = document.getElementById('bt-kpi-grid');
    if (kpiGrid && s) {
      const totalReturn = parseFloat(s.totalR);
      const bhReturn    = parseFloat(s.bh);
      const alpha       = (totalReturn - bhReturn).toFixed(2);
      kpiGrid.innerHTML = [
        { label: 'Total Return',    val: `${totalReturn >= 0 ? '+' : ''}${totalReturn}%`, color: totalReturn >= 0 ? '#2dd882' : '#ff5f57' },
        { label: 'Win Rate',        val: `${s.winRate}%`,  color: parseFloat(s.winRate) >= 50 ? '#2dd882' : '#ff5f57' },
        { label: 'Trades',          val: s.trades,         color: '' },
        { label: 'Profit Factor',   val: s.pf,             color: parseFloat(s.pf) >= 1 ? '#2dd882' : '#ff5f57' },
        { label: 'Max Drawdown',    val: `-${s.maxDD}%`,   color: '#ff5f57' },
        { label: 'Alpha vs B&H',    val: `${parseFloat(alpha) >= 0 ? '+' : ''}${alpha}%`, color: parseFloat(alpha) >= 0 ? '#2dd882' : '#ff5f57' },
        { label: 'Avg Win',         val: `+${s.avgWin}%`,  color: '#2dd882' },
        { label: 'Avg Loss',        val: `${s.avgLoss}%`,  color: '#ff5f57' },
      ].map(k => `
        <div class="perf-kpi">
          <div class="perf-kpi-val" style="color:${k.color}">${k.val}</div>
          <div class="perf-kpi-lbl">${k.label}</div>
        </div>
      `).join('');
    }

    if (s) requestAnimationFrame(() => drawEquity(s.equity, s.bh));

    const logEl    = document.getElementById('bt-trade-log');
    const countEl  = document.getElementById('bt-trade-count');
    if (countEl) countEl.textContent = `${trades.length} trades · ${symbol} ${interval}`;
    if (logEl) {
      if (!trades.length) {
        logEl.innerHTML = '<div class="ae-empty">No trades triggered by this strategy. Try different parameters.</div>';
        return;
      }
      logEl.innerHTML = `
        <table class="wallet-table" style="min-width:620px">
          <thead>
            <tr><th>#</th><th>Dir</th><th>Entry</th><th>Exit</th><th>P&L %</th><th>Reason</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${[...trades].reverse().slice(0,50).map((t, i) => `
              <tr>
                <td style="color:var(--color-text-muted)">${trades.length - i}</td>
                <td style="color:${t.dir===1?'#2dd882':'#ff5f57'};font-weight:700">${t.dir===1?'LONG':'SHORT'}</td>
                <td>$${t.entry.toLocaleString('en',{maximumFractionDigits:4})}</td>
                <td>$${t.exit.toLocaleString('en',{maximumFractionDigits:4})}</td>
                <td style="color:${t.pnlPct>=0?'#2dd882':'#ff5f57'};font-weight:700">${t.pnlPct>=0?'+':''}${t.pnlPct}%</td>
                <td><span class="bt-reason-badge bt-reason-${t.reason.toLowerCase()}">${t.reason}</span></td>
                <td style="color:var(--color-text-muted);font-size:0.72rem">${new Date(t.entryTime).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${trades.length > 50 ? `<div class="ae-empty" style="padding:0.75rem">Showing last 50 of ${trades.length} trades.</div>` : ''}
      `;
    }
  }

  function logToJournal() {
    if (!resultData) return;
    const { symbol, trades } = resultData;
    const last = trades[trades.length - 1];
    if (!last || last.reason === 'End') {
      if (typeof AlertEngine !== 'undefined') AlertEngine.showToast('No completed trade to log', '#f59e0b');
      return;
    }
    if (typeof TradeJournal !== 'undefined') {
      TradeJournal.openLogModal({
        symbol,
        direction: last.dir === 1 ? 'LONG' : 'SHORT',
        price: last.entry,
        source: `backtester:${resultData.stratId}`,
      });
    }
  }

  function init() {
    if (initialised) { renderSection(); return; }
    initialised = true;
    renderSection();
  }

  return { init, run, onStrategyChange, logToJournal };
})();

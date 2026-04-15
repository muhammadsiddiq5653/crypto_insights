'use strict';

/**
 * Kelly Position Sizer
 * Calculates optimal position sizes using the Kelly Criterion and variants.
 * Integrates with existing trade signals from ML prediction and technical analysis.
 */
const KellyPositionSizer = (() => {
  let initialised = false;
  let currentSignal = null;
  let userCapital = 10000;

  // ── Kelly math ────────────────────────────────────────────────────────

  /**
   * Full Kelly: f* = (bp - q) / b
   * b = odds (reward/risk ratio), p = win probability, q = 1-p
   */
  function kellyFraction(winRate, rewardRiskRatio) {
    const p = Math.max(0.01, Math.min(0.99, winRate));
    const q = 1 - p;
    const b = Math.max(0.01, rewardRiskRatio);
    const f = (b * p - q) / b;
    return Math.max(0, f); // never negative
  }

  /**
   * Half-Kelly (recommended for live trading — reduces variance)
   */
  function halfKelly(winRate, rewardRiskRatio) {
    return kellyFraction(winRate, rewardRiskRatio) * 0.5;
  }

  /**
   * Quarter-Kelly (conservative, good for high-vol assets like crypto)
   */
  function quarterKelly(winRate, rewardRiskRatio) {
    return kellyFraction(winRate, rewardRiskRatio) * 0.25;
  }

  /**
   * Fixed-fraction sizing (common alternative to Kelly)
   */
  function fixedFraction(riskPct, stopLossDistance, entryPrice) {
    if (!stopLossDistance || stopLossDistance <= 0) return riskPct;
    const riskPerUnit = stopLossDistance;
    return (riskPct * entryPrice) / riskPerUnit;
  }

  /**
   * Compute stop-loss and take-profit prices given signal confidence + ATR proxy
   */
  function computeLevels(entryPrice, signal, confidence, atrPct = 2.0) {
    const atr = entryPrice * (atrPct / 100);
    const direction = signal === 'BUY' ? 1 : -1;

    // Tighter stop for high-confidence signals
    const stopMultiplier = confidence > 0.75 ? 1.2 : confidence > 0.5 ? 1.8 : 2.5;
    const tpMultiplier = confidence > 0.75 ? 3.0 : confidence > 0.5 ? 2.0 : 1.5;

    const stopLoss = entryPrice - direction * atr * stopMultiplier;
    const takeProfit = entryPrice + direction * atr * tpMultiplier;
    const rewardRiskRatio = (Math.abs(takeProfit - entryPrice)) / (Math.abs(entryPrice - stopLoss));

    return { stopLoss, takeProfit, rewardRiskRatio, atr };
  }

  /**
   * Main sizing calculation
   */
  function calculateSizing(params) {
    const {
      entryPrice,
      signal,
      confidence,
      winRate = 0.55,
      capital,
      atrPct = 2.0,
      maxPositionPct = 0.25 // never exceed 25% of capital in one trade
    } = params;

    if (!entryPrice || entryPrice <= 0) return null;

    const levels = computeLevels(entryPrice, signal, confidence, atrPct);
    const { stopLoss, takeProfit, rewardRiskRatio } = levels;

    const fullK  = kellyFraction(winRate, rewardRiskRatio);
    const halfK  = halfKelly(winRate, rewardRiskRatio);
    const qtrK   = quarterKelly(winRate, rewardRiskRatio);

    // Cap fractions at maxPositionPct
    const cappedFull = Math.min(fullK,  maxPositionPct);
    const cappedHalf = Math.min(halfK,  maxPositionPct);
    const cappedQtr  = Math.min(qtrK,   maxPositionPct);

    const riskPct = cappedQtr; // default to quarter-Kelly for crypto
    const dollarAmount = capital * riskPct;
    const units = dollarAmount / entryPrice;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const maxLoss = units * stopDistance;
    const maxGain = units * Math.abs(takeProfit - entryPrice);

    // Confidence rating
    let sizeRating, sizeColor;
    if (cappedQtr >= 0.15) { sizeRating = 'STRONG'; sizeColor = '#2dd882'; }
    else if (cappedQtr >= 0.08) { sizeRating = 'MODERATE'; sizeColor = '#f59e0b'; }
    else if (cappedQtr >= 0.03) { sizeRating = 'SMALL'; sizeColor = '#6378dc'; }
    else { sizeRating = 'SKIP'; sizeColor = '#ff5f57'; }

    return {
      entryPrice,
      stopLoss,
      takeProfit,
      rewardRiskRatio: +rewardRiskRatio.toFixed(2),
      winRate,
      kellyFull: +(fullK * 100).toFixed(1),
      kellyHalf: +(halfK * 100).toFixed(1),
      kellyQtr:  +(qtrK  * 100).toFixed(1),
      recommendedPct: +(cappedQtr * 100).toFixed(1),
      dollarAmount: +dollarAmount.toFixed(2),
      units: +units.toFixed(6),
      maxLoss: +maxLoss.toFixed(2),
      maxGain: +maxGain.toFixed(2),
      sizeRating,
      sizeColor,
      riskRewardLabel: `1 : ${rewardRiskRatio.toFixed(1)}`
    };
  }

  // ── HTML rendering ────────────────────────────────────────────────────

  function renderSection() {
    const el = document.getElementById('kelly-sizer');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">📐 Kelly Position Sizer</h2>
          <p class="section-subtitle">Optimal position sizing using Kelly Criterion — never risk more than math allows</p>
        </div>
      </div>

      <div class="kelly-layout">
        <!-- Input Panel -->
        <div class="card kelly-inputs">
          <div class="card-header">Parameters</div>
          <div class="card-body">

            <div class="kelly-form-grid">
              <div class="form-group-k">
                <label>Portfolio Capital (USD)</label>
                <div class="input-prefix-wrap">
                  <span class="input-prefix">$</span>
                  <input type="number" id="k-capital" value="10000" min="100" step="100" />
                </div>
              </div>

              <div class="form-group-k">
                <label>Asset</label>
                <select id="k-symbol">
                  <option value="BTCUSDT">Bitcoin (BTC)</option>
                  <option value="ETHUSDT">Ethereum (ETH)</option>
                  <option value="SOLUSDT">Solana (SOL)</option>
                  <option value="BNBUSDT">BNB</option>
                  <option value="XRPUSDT">XRP</option>
                </select>
              </div>

              <div class="form-group-k">
                <label>Signal</label>
                <select id="k-signal">
                  <option value="BUY">BUY (Long)</option>
                  <option value="SELL">SELL (Short)</option>
                </select>
              </div>

              <div class="form-group-k">
                <label>Win Rate (%)</label>
                <input type="number" id="k-winrate" value="55" min="1" max="99" step="1" />
              </div>

              <div class="form-group-k">
                <label>Confidence (0–1)</label>
                <input type="number" id="k-confidence" value="0.70" min="0.01" max="0.99" step="0.01" />
              </div>

              <div class="form-group-k">
                <label>ATR % (Volatility)</label>
                <input type="number" id="k-atr" value="2.0" min="0.1" max="20" step="0.1" />
              </div>

              <div class="form-group-k">
                <label>Max Position (%)</label>
                <input type="number" id="k-maxpos" value="25" min="1" max="100" step="1" />
              </div>

              <div class="form-group-k">
                <label>Entry Price (USD)</label>
                <div class="input-prefix-wrap">
                  <span class="input-prefix">$</span>
                  <input type="number" id="k-entry" value="" placeholder="Auto-fetch" step="any" />
                </div>
              </div>
            </div>

            <button class="btn-kelly-calc" id="btn-kelly-calc" onclick="KellyPositionSizer.calculate()">
              Calculate Position Size
            </button>

            <button class="btn-kelly-fetch" onclick="KellyPositionSizer.fetchPrice()">
              ↻ Fetch Live Price
            </button>
          </div>
        </div>

        <!-- Results Panel -->
        <div class="card kelly-results" id="kelly-results-card">
          <div class="card-header">Position Analysis</div>
          <div class="card-body" id="kelly-results-body">
            <div class="kelly-empty">
              <div class="empty-icon">📐</div>
              <div>Enter parameters and click Calculate</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Kelly Comparison Table -->
      <div class="card" style="margin-top:1.25rem;" id="kelly-comparison-card" style="display:none">
        <div class="card-header">Kelly Variants Comparison</div>
        <div class="card-body">
          <div id="kelly-comparison-body">
            <div class="kelly-empty"><div class="empty-icon">📊</div><div>Run a calculation to see comparison</div></div>
          </div>
        </div>
      </div>

      <!-- Educational callout -->
      <div class="kelly-edu-card">
        <div class="kelly-edu-icon">💡</div>
        <div>
          <strong>About Kelly Criterion</strong> — The Kelly formula maximises long-run portfolio growth by sizing positions relative to your edge. Full Kelly is mathematically optimal but has high variance; <em>Quarter-Kelly is recommended for crypto</em> due to volatility. Always use a stop-loss — the formula assumes you exit losing trades at your predetermined level.
        </div>
      </div>
    `;

    injectStyles();
  }

  function renderResults(r) {
    const body = document.getElementById('kelly-results-body');
    if (!body || !r) return;

    const dir = r.stopLoss < r.entryPrice ? 'LONG' : 'SHORT';
    const fmt = (n) => n >= 1000 ? '$' + n.toLocaleString('en', {maximumFractionDigits: 2}) : '$' + n.toFixed(n < 10 ? 6 : 2);

    body.innerHTML = `
      <!-- Size Rating Badge -->
      <div class="kelly-rating-banner" style="border-color:${r.sizeColor};background:${r.sizeColor}18">
        <span class="kelly-rating-label" style="color:${r.sizeColor}">${r.sizeRating} SIGNAL</span>
        <span class="kelly-rating-desc">Quarter-Kelly recommends <strong>${r.recommendedPct}%</strong> of portfolio</span>
      </div>

      <!-- Key metrics grid -->
      <div class="kelly-metrics-grid">
        <div class="kelly-metric">
          <div class="km-label">Position Size</div>
          <div class="km-value" style="color:${r.sizeColor}">$${r.dollarAmount.toLocaleString('en', {maximumFractionDigits:0})}</div>
          <div class="km-sub">${r.recommendedPct}% of capital</div>
        </div>
        <div class="kelly-metric">
          <div class="km-label">Units to Buy</div>
          <div class="km-value">${r.units}</div>
          <div class="km-sub">at ${fmt(r.entryPrice)}</div>
        </div>
        <div class="kelly-metric">
          <div class="km-label">Max Loss</div>
          <div class="km-value" style="color:#ff5f57">-$${r.maxLoss.toLocaleString('en',{maximumFractionDigits:0})}</div>
          <div class="km-sub">if stop hit</div>
        </div>
        <div class="kelly-metric">
          <div class="km-label">Max Gain</div>
          <div class="km-value" style="color:#2dd882">+$${r.maxGain.toLocaleString('en',{maximumFractionDigits:0})}</div>
          <div class="km-sub">if TP hit</div>
        </div>
      </div>

      <!-- Price levels -->
      <div class="kelly-levels">
        <div class="kelly-level-row">
          <span class="level-label">🎯 Take Profit</span>
          <span class="level-price tp">${fmt(r.takeProfit)}</span>
          <span class="level-delta tp">+${(((r.takeProfit - r.entryPrice)/r.entryPrice)*100).toFixed(2)}%</span>
        </div>
        <div class="kelly-level-row entry-row">
          <span class="level-label">📍 Entry</span>
          <span class="level-price">${fmt(r.entryPrice)}</span>
          <span class="level-delta">—</span>
        </div>
        <div class="kelly-level-row">
          <span class="level-label">🛑 Stop Loss</span>
          <span class="level-price sl">${fmt(r.stopLoss)}</span>
          <span class="level-delta sl">${(((r.stopLoss - r.entryPrice)/r.entryPrice)*100).toFixed(2)}%</span>
        </div>
      </div>

      <!-- R:R ratio -->
      <div class="kelly-rr-bar">
        <span>Risk/Reward</span>
        <strong style="color:${r.rewardRiskRatio >= 2 ? '#2dd882' : r.rewardRiskRatio >= 1.5 ? '#f59e0b' : '#ff5f57'}">${r.riskRewardLabel}</strong>
        <span style="color:var(--color-text-muted);font-size:0.8rem;">Win Rate: ${(r.winRate*100).toFixed(0)}%</span>
      </div>
    `;

    // Render comparison table
    renderComparison(r);
  }

  function renderComparison(r) {
    const body = document.getElementById('kelly-comparison-body');
    if (!body) return;

    const cap = userCapital;
    const variants = [
      { name: 'Full Kelly',    pct: r.kellyFull,  dollar: (r.kellyFull/100)*cap,  note: 'Maximum growth — high variance', color: '#f59e0b' },
      { name: 'Half Kelly',    pct: r.kellyHalf,  dollar: (r.kellyHalf/100)*cap,  note: 'Balanced growth & risk',          color: '#6378dc' },
      { name: 'Quarter Kelly', pct: r.kellyQtr,   dollar: (r.kellyQtr/100)*cap,   note: 'Recommended for crypto ✓',        color: '#2dd882' },
      { name: 'Fixed 2%',      pct: 2,            dollar: cap * 0.02,             note: 'Conservative baseline',           color: '#8892a4' },
      { name: 'Fixed 5%',      pct: 5,            dollar: cap * 0.05,             note: 'Moderate baseline',               color: '#8892a4' },
    ];

    body.innerHTML = `
      <table class="kelly-table">
        <thead>
          <tr><th>Strategy</th><th>% of Capital</th><th>Dollar Amount</th><th>Max Loss at SL</th><th>Note</th></tr>
        </thead>
        <tbody>
          ${variants.map(v => `
            <tr class="${v.name === 'Quarter Kelly' ? 'kelly-recommended-row' : ''}">
              <td style="color:${v.color};font-weight:600">${v.name}</td>
              <td>${Math.min(v.pct, 25).toFixed(1)}%</td>
              <td>$${Math.min(v.dollar, cap*0.25).toLocaleString('en',{maximumFractionDigits:0})}</td>
              <td style="color:#ff5f57">-$${(Math.min(v.dollar,cap*0.25) * (Math.abs(r.entryPrice - r.stopLoss)/r.entryPrice)).toFixed(0)}</td>
              <td style="color:var(--color-text-muted);font-size:0.8rem">${v.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Public API ────────────────────────────────────────────────────────

  async function fetchPrice() {
    const symbolEl = document.getElementById('k-symbol');
    const entryEl  = document.getElementById('k-entry');
    if (!symbolEl || !entryEl) return;

    const symbol = symbolEl.value;
    const btn = document.getElementById('btn-kelly-calc');
    if (btn) { btn.textContent = 'Fetching...'; btn.disabled = true; }

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await res.json();
      if (data.price) {
        entryEl.value = parseFloat(data.price).toFixed(2);
      }
    } catch (e) {
      console.warn('[Kelly] Price fetch failed:', e.message);
    } finally {
      if (btn) { btn.textContent = 'Calculate Position Size'; btn.disabled = false; }
    }
  }

  function calculate() {
    const capital    = parseFloat(document.getElementById('k-capital')?.value || 10000);
    const symbol     = document.getElementById('k-symbol')?.value || 'BTCUSDT';
    const signal     = document.getElementById('k-signal')?.value || 'BUY';
    const winRatePct = parseFloat(document.getElementById('k-winrate')?.value || 55);
    const confidence = parseFloat(document.getElementById('k-confidence')?.value || 0.70);
    const atrPct     = parseFloat(document.getElementById('k-atr')?.value || 2.0);
    const maxPosPct  = parseFloat(document.getElementById('k-maxpos')?.value || 25);
    let entryPrice   = parseFloat(document.getElementById('k-entry')?.value);

    userCapital = capital;

    if (!entryPrice || isNaN(entryPrice)) {
      fetchPrice().then(calculate);
      return;
    }

    const result = calculateSizing({
      entryPrice,
      signal,
      confidence,
      winRate: winRatePct / 100,
      capital,
      atrPct,
      maxPositionPct: maxPosPct / 100
    });

    currentSignal = result;
    renderResults(result);
  }

  // ── Styles ─────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('kelly-styles')) return;
    const s = document.createElement('style');
    s.id = 'kelly-styles';
    s.textContent = `
      .kelly-layout {
        display: grid;
        grid-template-columns: 360px 1fr;
        gap: 1.25rem;
        align-items: start;
      }
      @media(max-width:900px) { .kelly-layout { grid-template-columns: 1fr; } }

      .kelly-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .form-group-k label {
        display: block;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-muted);
        margin-bottom: 0.3rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .form-group-k input,
      .form-group-k select {
        width: 100%;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text-primary);
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
        outline: none;
        transition: border-color 0.2s;
      }
      .form-group-k input:focus,
      .form-group-k select:focus { border-color: var(--color-accent-primary); }

      .input-prefix-wrap { position: relative; }
      .input-prefix {
        position: absolute; left: 0.6rem; top: 50%;
        transform: translateY(-50%);
        color: var(--color-text-muted); font-size: 0.875rem;
        pointer-events: none;
      }
      .input-prefix-wrap input { padding-left: 1.5rem; }

      .btn-kelly-calc {
        width: 100%;
        background: linear-gradient(135deg, var(--color-accent-primary), #4f62c8);
        color: white; border: none; border-radius: 8px;
        font-size: 0.9rem; font-weight: 600;
        padding: 0.7rem 1rem; cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 16px rgba(99,120,220,0.3);
        margin-bottom: 0.5rem;
      }
      .btn-kelly-calc:hover:not(:disabled) { transform: translateY(-1px); }
      .btn-kelly-calc:disabled { opacity: 0.6; cursor: not-allowed; }

      .btn-kelly-fetch {
        width: 100%;
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
        border-radius: 8px; font-size: 0.85rem;
        padding: 0.5rem; cursor: pointer;
        transition: all 0.2s;
      }
      .btn-kelly-fetch:hover { border-color: var(--color-accent-primary); color: var(--color-accent-primary); }

      .kelly-empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2.5rem; color: var(--color-text-muted); }
      .kelly-empty .empty-icon { font-size: 2.5rem; opacity: 0.5; }

      .kelly-rating-banner {
        border: 1px solid; border-radius: 10px;
        padding: 0.75rem 1rem;
        display: flex; align-items: center; gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .kelly-rating-label { font-size: 1rem; font-weight: 700; white-space: nowrap; }
      .kelly-rating-desc { font-size: 0.875rem; color: var(--color-text-muted); }

      .kelly-metrics-grid {
        display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem;
        margin-bottom: 1.25rem;
      }
      @media(max-width:700px) { .kelly-metrics-grid { grid-template-columns: 1fr 1fr; } }

      .kelly-metric {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 10px; padding: 0.75rem;
        text-align: center;
      }
      .km-label { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
      .km-value { font-size: 1.1rem; font-weight: 700; color: var(--color-text-primary); }
      .km-sub { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.2rem; }

      .kelly-levels { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; margin-bottom: 1rem; }
      .kelly-level-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.6rem 1rem; border-bottom: 1px solid var(--color-border);
      }
      .kelly-level-row:last-child { border-bottom: none; }
      .entry-row { background: rgba(99,120,220,0.08); }
      .level-label { font-size: 0.85rem; color: var(--color-text-muted); }
      .level-price { font-size: 0.95rem; font-weight: 600; color: var(--color-text-primary); }
      .level-price.tp { color: #2dd882; }
      .level-price.sl { color: #ff5f57; }
      .level-delta { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); min-width: 60px; text-align: right; }
      .level-delta.tp { color: #2dd882; }
      .level-delta.sl { color: #ff5f57; }

      .kelly-rr-bar {
        display: flex; align-items: center; gap: 1rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 10px; padding: 0.75rem 1rem;
        font-size: 0.875rem; color: var(--color-text-muted);
      }
      .kelly-rr-bar strong { font-size: 1rem; margin-left: auto; }

      .kelly-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .kelly-table th {
        text-align: left; padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-muted); font-size: 0.75rem;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .kelly-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--color-border); }
      .kelly-table tr:last-child td { border-bottom: none; }
      .kelly-recommended-row { background: rgba(45,216,130,0.05); }

      .kelly-edu-card {
        display: flex; gap: 1rem; align-items: flex-start;
        background: rgba(99,120,220,0.06);
        border: 1px solid rgba(99,120,220,0.2);
        border-radius: 10px; padding: 1rem 1.25rem;
        margin-top: 1.25rem; font-size: 0.875rem;
        color: var(--color-text-muted); line-height: 1.5;
      }
      .kelly-edu-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 0.1rem; }
      .kelly-edu-card strong { color: var(--color-text-primary); }
    `;
    document.head.appendChild(s);
  }

  // ── Init ─────────────────────────────────────────────────────────────

  function init() {
    if (initialised) return;
    initialised = true;
    renderSection();
    // Auto-fetch price for default symbol
    setTimeout(fetchPrice, 300);
  }

  return { init, calculate, fetchPrice, calculateSizing };
})();

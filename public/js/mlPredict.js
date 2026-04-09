/**
 * ML Prediction Panel — TraderPro
 * Calls Node.js -> Python ensemble model (Ridge + Random Forest + Gradient Boosting)
 * Shows: 24h & 7d price forecasts, ML BUY/SELL/HOLD signal, confidence gauge,
 *        model vote breakdown, price trajectory chart, trading recommendation.
 */

const MLPredict = {
  container: null,
  currentSymbol: 'BTC',
  predictionData: null,
  trajectoryChart: null,
  serviceRunning: false,

  // ── Init ─────────────────────────────────────────────────────────────────
  async init() {
    this.container = document.getElementById('ml-predict');
    if (!this.container) return;
    // Don't re-render shell if already initialised — just refresh service status
    if (this.container.querySelector('.ml-predict-page')) {
      await this.checkServiceStatus();
      return;
    }
    this.renderShell();
    await this.checkServiceStatus();
    await this.loadPrediction(this.currentSymbol);
  },

  // ── Service Status Check ─────────────────────────────────────────────────
  async checkServiceStatus() {
    try {
      const res  = await fetch('/api/predict/status');
      const json = await res.json();
      this.serviceRunning = json.running;
      const badge = this.container.querySelector('#ml-service-status');
      if (badge) {
        badge.textContent  = json.running ? '🟢 ML Engine Online' : '🔴 ML Engine Offline';
        badge.style.color  = json.running ? '#00c896' : '#ff4d4d';
        badge.title        = json.running ? 'Python prediction service is running' :
                             'Run: python3 predict_service.py in the trader_portal folder';
      }
    } catch {}
  },

  // ── Shell ────────────────────────────────────────────────────────────────
  renderShell() {
    this.container.innerHTML = `
      <div class="ml-predict-page">
        <div class="section-header">
          <h1 class="section-title">🤖 ML Price Prediction</h1>
          <p class="section-subtitle">
            Ensemble machine learning model — Ridge Regression + Random Forest + Gradient Boosting
            trained on 90 days of price &amp; volume data.
          </p>
          <span id="ml-service-status" style="font-size:0.82rem;font-weight:600;">Checking ML engine…</span>
        </div>

        <!-- Coin selector -->
        <div class="ml-controls card">
          <div class="ml-controls-row">
            <div class="ml-control-group">
              <label class="ml-label">Select Coin</label>
              <select id="ml-coin-select" class="ml-select">
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
                <option value="BNB">BNB (BNB)</option>
                <option value="SOL">Solana (SOL)</option>
                <option value="XRP">XRP (XRP)</option>
                <option value="ADA">Cardano (ADA)</option>
                <option value="DOGE">Dogecoin (DOGE)</option>
                <option value="DOT">Polkadot (DOT)</option>
                <option value="AVAX">Avalanche (AVAX)</option>
                <option value="MATIC">Polygon (MATIC)</option>
              </select>
            </div>
            <button id="ml-run-btn" class="ml-run-btn">
              <span class="ml-run-icon">⚡</span> Run ML Prediction
            </button>
            <div class="ml-note">
              ⚠️ Predictions are educational, not financial advice. Past patterns ≠ future results.
            </div>
          </div>
        </div>

        <!-- Results area -->
        <div id="ml-results">
          <div class="ml-loading-state">
            <div class="ml-spinner"></div>
            <p>Training model on 90 days of market data…</p>
            <p style="font-size:0.8rem;opacity:0.6;">First run may take 10–20 seconds</p>
          </div>
        </div>
      </div>

      <style>
        .ml-predict-page { padding: 0 0 2rem; }
        .ml-controls { padding: 1.2rem 1.5rem; margin-bottom: 1.5rem; }
        .ml-controls-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .ml-control-group { display: flex; flex-direction: column; gap: 0.3rem; }
        .ml-label { font-size: 0.78rem; color: var(--text-muted, #888); text-transform: uppercase; letter-spacing: 0.05em; }
        .ml-select {
          background: var(--bg-secondary, #1a1a2e);
          color: var(--text-primary, #e0e0e0);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.9rem; cursor: pointer;
        }
        .ml-run-btn {
          background: linear-gradient(135deg, #6c63ff, #00c896);
          color: #fff; border: none; border-radius: 10px;
          padding: 0.6rem 1.4rem; font-size: 0.9rem; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; gap: 0.5rem;
          transition: opacity 0.2s, transform 0.1s;
        }
        .ml-run-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .ml-run-btn:active { transform: translateY(0); }
        .ml-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ml-note { font-size: 0.75rem; color: #f59e0b; opacity: 0.85; max-width: 260px; line-height: 1.4; }

        /* Loading */
        .ml-loading-state { text-align: center; padding: 3rem 1rem; color: var(--text-muted, #888); }
        .ml-spinner {
          width: 40px; height: 40px; border: 3px solid rgba(108,99,255,0.2);
          border-top-color: #6c63ff; border-radius: 50%;
          animation: ml-spin 0.9s linear infinite; margin: 0 auto 1rem;
        }
        @keyframes ml-spin { to { transform: rotate(360deg); } }

        /* Grid */
        .ml-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; margin-bottom: 1.5rem; }
        @media (max-width: 700px) { .ml-grid { grid-template-columns: 1fr; } }

        /* Signal card */
        .ml-signal-card {
          background: var(--bg-card, #1e1e38); border-radius: 14px;
          padding: 1.4rem; border: 1px solid var(--border-color, #333);
          display: flex; flex-direction: column; gap: 0.8rem;
        }
        .ml-signal-badge {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 1.2rem; border-radius: 50px; font-size: 1rem; font-weight: 700;
        }
        .ml-signal-badge.BUY, .ml-signal-badge.STRONG-BUY {
          background: rgba(0,200,150,0.15); color: #00c896; border: 1px solid #00c896;
        }
        .ml-signal-badge.SELL, .ml-signal-badge.STRONG-SELL {
          background: rgba(255,77,77,0.15); color: #ff4d4d; border: 1px solid #ff4d4d;
        }
        .ml-signal-badge.HOLD {
          background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid #f59e0b;
        }
        .ml-conf-bar-wrap { margin-top: 0.5rem; }
        .ml-conf-label { font-size: 0.8rem; color: var(--text-muted, #888); margin-bottom: 0.3rem; }
        .ml-conf-track {
          height: 8px; background: rgba(255,255,255,0.07);
          border-radius: 4px; overflow: hidden;
        }
        .ml-conf-fill {
          height: 100%; border-radius: 4px;
          background: linear-gradient(90deg, #6c63ff, #00c896);
          transition: width 0.8s ease;
        }
        .ml-card-title { font-size: 0.8rem; color: var(--text-muted, #888); text-transform: uppercase; letter-spacing: 0.06em; }
        .ml-summary-text { font-size: 0.88rem; line-height: 1.55; color: var(--text-secondary, #bbb); }

        /* Forecast cards */
        .ml-forecast-card {
          background: var(--bg-card, #1e1e38); border-radius: 14px;
          padding: 1.2rem 1.5rem; border: 1px solid var(--border-color, #333);
        }
        .ml-forecast-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
        .ml-forecast-period { font-size: 1rem; font-weight: 700; }
        .ml-forecast-signal { font-size: 0.78rem; font-weight: 600; padding: 0.2rem 0.7rem; border-radius: 20px; }
        .ml-forecast-row { display: flex; justify-content: space-between; margin-bottom: 0.4rem; }
        .ml-forecast-label { font-size: 0.8rem; color: var(--text-muted, #888); }
        .ml-forecast-value { font-size: 0.88rem; font-weight: 600; }
        .positive { color: #00c896; }
        .negative { color: #ff4d4d; }
        .neutral  { color: #f59e0b; }

        /* Model votes */
        .ml-votes-card {
          background: var(--bg-card, #1e1e38); border-radius: 14px;
          padding: 1.2rem 1.5rem; border: 1px solid var(--border-color, #333);
          grid-column: 1 / -1;
        }
        .ml-votes-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-top: 0.8rem; }
        @media (max-width: 500px) { .ml-votes-grid { grid-template-columns: 1fr; } }
        .ml-vote-item { text-align: center; }
        .ml-vote-name { font-size: 0.75rem; color: var(--text-muted, #888); margin-bottom: 0.3rem; }
        .ml-vote-val {
          font-size: 1.1rem; font-weight: 700;
          padding: 0.35rem 0.7rem; border-radius: 8px; display: inline-block;
        }
        .ml-vote-val.pos { background: rgba(0,200,150,0.12); color: #00c896; }
        .ml-vote-val.neg { background: rgba(255,77,77,0.12); color: #ff4d4d; }
        .ml-vote-val.neu { background: rgba(245,158,11,0.12); color: #f59e0b; }

        /* Trajectory chart */
        .ml-chart-card {
          background: var(--bg-card, #1e1e38); border-radius: 14px;
          padding: 1.2rem 1.5rem; border: 1px solid var(--border-color, #333);
          grid-column: 1 / -1;
        }
        .ml-chart-wrap { position: relative; height: 220px; margin-top: 0.8rem; }

        /* Offline notice */
        .ml-offline-notice {
          background: rgba(255,77,77,0.08); border: 1px solid rgba(255,77,77,0.3);
          border-radius: 12px; padding: 1.5rem; text-align: center;
          color: #ff4d4d; margin-bottom: 1rem;
        }
        .ml-offline-code {
          background: rgba(0,0,0,0.3); border-radius: 8px;
          padding: 0.6rem 1rem; font-family: monospace; font-size: 0.85rem;
          color: #e0e0e0; display: inline-block; margin-top: 0.5rem;
        }
      </style>
    `;

    // Bind events
    this.container.querySelector('#ml-coin-select').addEventListener('change', (e) => {
      this.currentSymbol = e.target.value;
    });
    this.container.querySelector('#ml-run-btn').addEventListener('click', () => {
      this.loadPrediction(this.currentSymbol);
    });
  },

  // ── Load Prediction ──────────────────────────────────────────────────────
  async loadPrediction(symbol) {
    const resultsEl = this.container.querySelector('#ml-results');
    const btn       = this.container.querySelector('#ml-run-btn');

    resultsEl.innerHTML = `
      <div class="ml-loading-state">
        <div class="ml-spinner"></div>
        <p>Training ensemble model on 90-day ${symbol} data…</p>
        <p style="font-size:0.8rem;opacity:0.6;">Ridge + Random Forest + Gradient Boosting</p>
      </div>`;

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Predicting…'; }

    try {
      const res  = await fetch(`/api/crypto/${symbol}/predict`);
      const json = await res.json();

      if (!json.success) {
        this.renderOffline(json.error || 'ML service unavailable');
      } else {
        this.predictionData = json.data;
        this.renderResults(json.data, json.cached);
      }
    } catch (err) {
      this.renderOffline('Could not connect to prediction API: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="ml-run-icon">⚡</span> Run ML Prediction'; }
      await this.checkServiceStatus();
    }
  },

  // ── Render Offline Notice ────────────────────────────────────────────────
  renderOffline(msg) {
    const resultsEl = this.container.querySelector('#ml-results');
    resultsEl.innerHTML = `
      <div class="ml-offline-notice">
        <div style="font-size:1.5rem;margin-bottom:0.5rem;">🔴 ML Engine Offline</div>
        <p>${msg}</p>
        <p style="margin-top:0.8rem;font-size:0.88rem;color:#e0e0e0;">
          To enable ML predictions, open a terminal in your trader_portal folder and run:
        </p>
        <div class="ml-offline-code">python3 predict_service.py</div>
        <p style="font-size:0.8rem;margin-top:0.6rem;opacity:0.7;">
          The service runs on port 5001 and must be running alongside the Node.js server.
        </p>
      </div>`;
  },

  // ── Render Results ───────────────────────────────────────────────────────
  renderResults(data, cached) {
    const resultsEl = this.container.querySelector('#ml-results');
    const overall   = data.overall || {};
    const r24       = data['24h'] || {};
    const r7d       = data['7d']  || {};
    const traj      = data.trajectory || [];

    const signal     = overall.signal     || 'HOLD';
    const confidence = overall.confidence || 50;
    const summary    = overall.summary    || '';

    const cachedNote = cached ? ' <span style="font-size:0.7rem;opacity:0.5;">(cached)</span>' : '';

    resultsEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
        <h3 style="margin:0;font-size:1.1rem;">📊 Prediction Results — ${data.symbol || this.currentSymbol}${cachedNote}</h3>
        <span style="font-size:0.78rem;color:var(--text-muted,#888);">Based on ${data.data_points || 90} data points · Ensemble of 3 models</span>
      </div>

      <div class="ml-grid">

        <!-- Overall ML Signal -->
        <div class="ml-signal-card">
          <div class="ml-card-title">🤖 Overall ML Signal</div>
          <span class="ml-signal-badge ${signal}">${this.signalIcon(signal)} ${signal}</span>
          <div class="ml-conf-bar-wrap">
            <div class="ml-conf-label">Model Confidence: ${confidence}%</div>
            <div class="ml-conf-track">
              <div class="ml-conf-fill" style="width:${confidence}%"></div>
            </div>
          </div>
          <div class="ml-summary-text">${summary}</div>
        </div>

        <!-- Trading Recommendation -->
        <div class="ml-signal-card">
          <div class="ml-card-title">💡 Trading Recommendation</div>
          ${this.renderRecommendation(signal, r24, r7d)}
        </div>

        <!-- 24h Forecast -->
        <div class="ml-forecast-card">
          <div class="ml-forecast-header">
            <span class="ml-forecast-period">24-Hour Forecast</span>
            <span class="ml-forecast-signal ${this.signalColorClass(r24.signal)}">${r24.signal || '—'}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Predicted Return</span>
            <span class="ml-forecast-value ${this.colorClass(r24.predicted_return_pct)}">${this.formatReturn(r24.predicted_return_pct)}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Current Price</span>
            <span class="ml-forecast-value">${this.formatPrice(r24.current_price)}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Target Price</span>
            <span class="ml-forecast-value ${this.colorClass(r24.predicted_return_pct)}">${this.formatPrice(r24.predicted_price)}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Confidence</span>
            <span class="ml-forecast-value">${r24.confidence || '—'}%</span>
          </div>
        </div>

        <!-- 7d Forecast -->
        <div class="ml-forecast-card">
          <div class="ml-forecast-header">
            <span class="ml-forecast-period">7-Day Forecast</span>
            <span class="ml-forecast-signal ${this.signalColorClass(r7d.signal)}">${r7d.signal || '—'}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Predicted Return</span>
            <span class="ml-forecast-value ${this.colorClass(r7d.predicted_return_pct)}">${this.formatReturn(r7d.predicted_return_pct)}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Current Price</span>
            <span class="ml-forecast-value">${this.formatPrice(r7d.current_price)}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Target Price</span>
            <span class="ml-forecast-value ${this.colorClass(r7d.predicted_return_pct)}">${this.formatPrice(r7d.predicted_price)}</span>
          </div>
          <div class="ml-forecast-row">
            <span class="ml-forecast-label">Confidence</span>
            <span class="ml-forecast-value">${r7d.confidence || '—'}%</span>
          </div>
        </div>

        <!-- Trajectory Chart -->
        ${traj.length > 1 ? `
        <div class="ml-chart-card">
          <div class="ml-card-title">📈 7-Day Price Trajectory</div>
          <div class="ml-chart-wrap">
            <canvas id="ml-trajectory-canvas"></canvas>
          </div>
        </div>` : ''}

        <!-- Model Vote Breakdown -->
        ${this.renderModelVotes(r24, r7d)}

        <!-- How it works -->
        <div class="ml-signal-card" style="grid-column: 1 / -1;">
          <div class="ml-card-title">🧠 How This Model Works</div>
          <div class="ml-summary-text">
            The prediction engine uses an <strong>ensemble of 3 ML models</strong> trained on 90 days of price & volume data:
            <br><br>
            <strong>Ridge Regression</strong> — captures linear trends and regularizes against overfitting.
            <br>
            <strong>Random Forest</strong> — detects non-linear patterns across 20+ technical features (RSI, MACD, Bollinger position, momentum, etc.).
            <br>
            <strong>Gradient Boosting</strong> — iteratively corrects errors, especially good at detecting inflection points.
            <br><br>
            The three model predictions are averaged. Confidence reflects how strongly the models <em>agree</em> on direction.
            Higher agreement = higher confidence. <strong>This is educational only — never trade based solely on model output.</strong>
          </div>
        </div>

      </div>
    `;

    // Draw trajectory chart
    if (traj.length > 1) {
      setTimeout(() => this.drawTrajectoryChart(traj, r24.current_price), 50);
    }
  },

  // ── Model Vote Breakdown ─────────────────────────────────────────────────
  renderModelVotes(r24, r7d) {
    const votes24 = r24.model_votes || {};
    const votes7d = r7d.model_votes || {};
    if (!Object.keys(votes24).length && !Object.keys(votes7d).length) return '';

    const fmtVote = (v) => {
      if (v == null) return '<span class="ml-vote-val neu">—</span>';
      const cls = v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : 'neu';
      return `<span class="ml-vote-val ${cls}">${v > 0 ? '+' : ''}${v.toFixed(2)}%</span>`;
    };

    return `
      <div class="ml-votes-card">
        <div class="ml-card-title">⚙️ Individual Model Votes (predicted % return)</div>
        <div class="ml-votes-grid">
          <div class="ml-vote-item">
            <div class="ml-vote-name">Ridge Regression</div>
            <div style="font-size:0.7rem;color:#666;margin-bottom:0.3rem;">24h / 7d</div>
            ${fmtVote(votes24.ridge)} / ${fmtVote(votes7d.ridge)}
          </div>
          <div class="ml-vote-item">
            <div class="ml-vote-name">Random Forest</div>
            <div style="font-size:0.7rem;color:#666;margin-bottom:0.3rem;">24h / 7d</div>
            ${fmtVote(votes24.random_forest)} / ${fmtVote(votes7d.random_forest)}
          </div>
          <div class="ml-vote-item">
            <div class="ml-vote-name">Gradient Boosting</div>
            <div style="font-size:0.7rem;color:#666;margin-bottom:0.3rem;">24h / 7d</div>
            ${fmtVote(votes24.gradient_boost)} / ${fmtVote(votes7d.gradient_boost)}
          </div>
        </div>
      </div>`;
  },

  // ── Recommendation Text ──────────────────────────────────────────────────
  renderRecommendation(signal, r24, r7d) {
    const ret24 = r24.predicted_return_pct || 0;
    const ret7d = r7d.predicted_return_pct || 0;

    const recs = {
      BUY: `
        <p style="color:#00c896;font-weight:600;margin:0 0 0.5rem;">📈 Bullish Outlook</p>
        <ul style="padding-left:1.2rem;font-size:0.86rem;line-height:1.7;color:var(--text-secondary,#bbb);">
          <li>Model predicts <strong>${ret24 > 0 ? '+' : ''}${ret24.toFixed(2)}%</strong> in 24h and <strong>${ret7d > 0 ? '+' : ''}${ret7d.toFixed(2)}%</strong> in 7 days</li>
          <li>Consider <strong>scaling in gradually</strong> rather than a single large buy</li>
          <li>Set a <strong>stop-loss</strong> 5–8% below entry to manage downside risk</li>
          <li>Watch for volume confirmation — a BUY without volume is weaker</li>
        </ul>`,
      SELL: `
        <p style="color:#ff4d4d;font-weight:600;margin:0 0 0.5rem;">📉 Bearish Outlook</p>
        <ul style="padding-left:1.2rem;font-size:0.86rem;line-height:1.7;color:var(--text-secondary,#bbb);">
          <li>Model predicts <strong>${ret24.toFixed(2)}%</strong> in 24h and <strong>${ret7d.toFixed(2)}%</strong> in 7 days</li>
          <li>Consider <strong>reducing exposure</strong> or moving to stable assets</li>
          <li>If holding, tighten <strong>stop-losses</strong> to protect profits</li>
          <li>Avoid new long positions until trend confirms reversal</li>
        </ul>`,
      HOLD: `
        <p style="color:#f59e0b;font-weight:600;margin:0 0 0.5rem;">⏸️ Wait & Watch</p>
        <ul style="padding-left:1.2rem;font-size:0.86rem;line-height:1.7;color:var(--text-secondary,#bbb);">
          <li>Models show mixed signals — no strong directional edge detected</li>
          <li>Best to <strong>wait for a clearer setup</strong> before entering</li>
          <li>Use this time to check <strong>Fear &amp; Greed</strong> and news sentiment</li>
          <li>Set price <strong>alerts</strong> at key support/resistance levels</li>
        </ul>`
    };
    return recs[signal] || recs['HOLD'];
  },

  // ── Trajectory Chart ─────────────────────────────────────────────────────
  drawTrajectoryChart(trajectory, currentPrice) {
    const canvas = document.getElementById('ml-trajectory-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.trajectoryChart) {
      this.trajectoryChart.destroy();
      this.trajectoryChart = null;
    }

    const labels = trajectory.map(t => t.day === 0 ? 'Now' : `Day ${t.day}`);
    const prices = trajectory.map(t => t.price);
    const endPrice = prices[prices.length - 1];
    const color = endPrice >= (currentPrice || prices[0]) ? '#00c896' : '#ff4d4d';

    this.trajectoryChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'ML Forecast',
          data: prices,
          borderColor: color,
          backgroundColor: color + '18',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: color,
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` $${Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#888', font: { size: 11 },
              callback: v => '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
            }
          }
        }
      }
    });
  },

  // ── Helpers ──────────────────────────────────────────────────────────────
  signalIcon(signal) {
    return { BUY: '🟢', SELL: '🔴', HOLD: '🟡', 'STRONG BUY': '🚀', 'STRONG SELL': '💀' }[signal] || '⚪';
  },
  signalColorClass(signal) {
    if (!signal) return '';
    if (signal === 'BUY' || signal === 'STRONG BUY') return 'positive';
    if (signal === 'SELL' || signal === 'STRONG SELL') return 'negative';
    return 'neutral';
  },
  colorClass(val) {
    if (val == null) return '';
    return val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
  },
  formatReturn(val) {
    if (val == null) return '—';
    return (val > 0 ? '+' : '') + val.toFixed(2) + '%';
  },
  formatPrice(val) {
    if (!val) return '—';
    if (val > 1000)  return '$' + val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (val > 1)     return '$' + val.toFixed(4);
    return '$' + val.toFixed(6);
  }
};

// MLPredict.init() is called by switchSection() in app.js when the user clicks the nav item.

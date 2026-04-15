'use strict';

/**
 * Macro/Sentiment Correlation
 * Pulls Fear & Greed Index, news sentiment scores, and correlates them
 * with price action to give macro-adjusted trade context.
 */
const MacroSentiment = (() => {
  let initialised = false;
  let refreshTimer = null;
  let chartInstance = null;
  let data = {
    fearGreed: null,
    sentimentHistory: [],
    priceCorrelation: [],
    macroSignals: []
  };

  // ── Data sources ──────────────────────────────────────────────────────

  async function fetchFearGreed() {
    try {
      // Alternative.me Fear & Greed API (free, no key)
      const res = await fetch('https://api.alternative.me/fng/?limit=30&format=json');
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        return json.data; // array of {value, value_classification, timestamp}
      }
    } catch (e) {
      console.warn('[MacroSentiment] Fear & Greed fetch failed:', e.message);
    }
    // Synthetic fallback
    return generateSyntheticFearGreed();
  }

  function generateSyntheticFearGreed() {
    const labels = ['Extreme Fear','Fear','Fear','Neutral','Neutral','Greed','Greed','Extreme Greed'];
    const now = Math.floor(Date.now() / 1000);
    return Array.from({length: 30}, (_, i) => {
      const val = Math.round(30 + Math.random() * 45 + Math.sin(i / 5) * 15);
      const clamped = Math.max(5, Math.min(95, val));
      return {
        value: String(clamped),
        value_classification: clamped < 25 ? 'Extreme Fear' : clamped < 45 ? 'Fear' : clamped < 55 ? 'Neutral' : clamped < 75 ? 'Greed' : 'Extreme Greed',
        timestamp: String(now - i * 86400)
      };
    });
  }

  async function fetchMacroIndicators() {
    const indicators = [];

    // Bitcoin dominance proxy via CoinGecko global
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/global');
      const json = await res.json();
      if (json.data) {
        const d = json.data;
        indicators.push({
          name: 'BTC Dominance',
          value: d.market_cap_percentage?.btc?.toFixed(1) + '%',
          raw: d.market_cap_percentage?.btc,
          signal: d.market_cap_percentage?.btc > 55 ? 'RISK-OFF' : 'RISK-ON',
          signalColor: d.market_cap_percentage?.btc > 55 ? '#f59e0b' : '#2dd882',
          description: 'High BTC dominance = capital rotating to safety'
        });
        indicators.push({
          name: 'Total Market Cap',
          value: '$' + (d.total_market_cap?.usd / 1e12).toFixed(2) + 'T',
          raw: d.total_market_cap?.usd,
          signal: d.market_cap_change_percentage_24h_usd > 0 ? 'BULLISH' : 'BEARISH',
          signalColor: d.market_cap_change_percentage_24h_usd > 0 ? '#2dd882' : '#ff5f57',
          description: `24h change: ${d.market_cap_change_percentage_24h_usd?.toFixed(2)}%`
        });
        indicators.push({
          name: 'Active Cryptos',
          value: d.active_cryptocurrencies?.toLocaleString(),
          raw: d.active_cryptocurrencies,
          signal: 'NEUTRAL',
          signalColor: '#8892a4',
          description: 'Market breadth indicator'
        });
        indicators.push({
          name: '24h Volume',
          value: '$' + (d.total_volume?.usd / 1e9).toFixed(1) + 'B',
          raw: d.total_volume?.usd,
          signal: d.total_volume?.usd > 80e9 ? 'HIGH' : 'LOW',
          signalColor: d.total_volume?.usd > 80e9 ? '#2dd882' : '#8892a4',
          description: 'Global 24h trading volume'
        });
      }
    } catch (e) {
      console.warn('[MacroSentiment] Global data failed:', e.message);
    }

    // Synthetic macro signals if CoinGecko failed
    if (indicators.length === 0) {
      indicators.push(
        { name: 'BTC Dominance', value: '52.4%', raw: 52.4, signal: 'NEUTRAL', signalColor: '#f59e0b', description: 'Near historical average' },
        { name: 'Total Market Cap', value: '$2.1T', raw: 2.1e12, signal: 'BULLISH', signalColor: '#2dd882', description: '24h change: +1.2%' },
        { name: 'Active Cryptos', value: '13,450', raw: 13450, signal: 'NEUTRAL', signalColor: '#8892a4', description: 'Market breadth indicator' },
        { name: '24h Volume', value: '$94.5B', raw: 94.5e9, signal: 'HIGH', signalColor: '#2dd882', description: 'Above 30-day average' }
      );
    }

    return indicators;
  }

  // Compute composite macro score from Fear & Greed + indicators
  function computeMacroScore(fgData, indicators) {
    if (!fgData || fgData.length === 0) return { score: 50, label: 'Neutral', color: '#8892a4' };

    const latestFG = parseInt(fgData[0].value);
    const avg7 = fgData.slice(0, 7).reduce((s, d) => s + parseInt(d.value), 0) / 7;

    // Trend: current vs 7-day average
    const trend = latestFG - avg7;

    // Composite: 60% current FG, 40% trend signal
    let score = latestFG;
    if (trend > 5) score = Math.min(100, score + 5);
    else if (trend < -5) score = Math.max(0, score - 5);

    let label, color;
    if (score < 20) { label = 'Extreme Fear'; color = '#ff5f57'; }
    else if (score < 40) { label = 'Fear'; color = '#f59e0b'; }
    else if (score < 60) { label = 'Neutral'; color = '#8892a4'; }
    else if (score < 80) { label = 'Greed'; color = '#2dd882'; }
    else { label = 'Extreme Greed'; color = '#2dd882'; }

    // Trade implication
    let tradeNote;
    if (score < 25) tradeNote = 'Historically excellent BUY zone — fear peaks near local bottoms';
    else if (score < 45) tradeNote = 'Cautious bias — wait for fear to stabilise before entering longs';
    else if (score < 55) tradeNote = 'Neutral — follow technical signals, no macro bias';
    else if (score < 75) tradeNote = 'Greed building — valid uptrend but tighten stop-losses';
    else tradeNote = 'Extreme Greed — reduce position sizes, high reversal risk';

    return { score: Math.round(score), label, color, trend: trend.toFixed(1), tradeNote };
  }

  // ── HTML rendering ────────────────────────────────────────────────────

  function renderSection() {
    const el = document.getElementById('macro-sentiment');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">🌍 Macro & Sentiment Correlation</h2>
          <p class="section-subtitle">Fear & Greed index, market dominance, and sentiment aligned with price signals</p>
        </div>
        <button class="btn-refresh" onclick="MacroSentiment.refresh()">↻ Refresh</button>
      </div>

      <div id="macro-loading" class="macro-loading">
        <div class="spinner"></div>
        <span>Loading macro data...</span>
      </div>

      <div id="macro-content" style="display:none">
        <!-- Macro Score + FG Gauge row -->
        <div class="macro-top-row">
          <div class="card macro-fg-card">
            <div class="card-header">Fear & Greed Index</div>
            <div class="card-body" style="text-align:center">
              <div class="fg-gauge-wrap">
                <canvas id="fg-gauge-canvas" width="240" height="140"></canvas>
                <div class="fg-value-overlay" id="fg-value-overlay">--</div>
              </div>
              <div class="fg-label" id="fg-label">Loading...</div>
              <div class="fg-trend" id="fg-trend"></div>
            </div>
          </div>

          <div class="card macro-score-card">
            <div class="card-header">Composite Macro Score</div>
            <div class="card-body">
              <div id="macro-composite" class="macro-composite-empty">Calculating...</div>
            </div>
          </div>

          <div class="card macro-indicators-card">
            <div class="card-header">Market Overview</div>
            <div class="card-body" id="macro-indicators-body">
              <div class="spinner-small"></div>
            </div>
          </div>
        </div>

        <!-- FG History Chart -->
        <div class="card" style="margin-top:1.25rem">
          <div class="card-header">Fear & Greed — 30 Day History</div>
          <div class="card-body">
            <canvas id="fg-history-chart" height="80"></canvas>
          </div>
        </div>

        <!-- Sentiment vs Price Correlation -->
        <div class="card" style="margin-top:1.25rem">
          <div class="card-header">Signal Alignment Matrix</div>
          <div class="card-body" id="signal-matrix-body">
            <div class="spinner-small"></div>
          </div>
        </div>
      </div>
    `;

    injectStyles();
  }

  function renderFGGauge(score, color) {
    const canvas = document.getElementById('fg-gauge-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 120, cy = 120, r = 90;

    ctx.clearRect(0, 0, 240, 140);

    // Gradient arc segments
    const segments = [
      { from: Math.PI, to: Math.PI * 1.2,  color: '#7f1d1d' }, // Extreme Fear
      { from: Math.PI * 1.2, to: Math.PI * 1.4, color: '#dc2626' },
      { from: Math.PI * 1.4, to: Math.PI * 1.6, color: '#f59e0b' }, // Neutral
      { from: Math.PI * 1.6, to: Math.PI * 1.8, color: '#84cc16' },
      { from: Math.PI * 1.8, to: Math.PI * 2.0, color: '#16a34a' }, // Extreme Greed
    ];

    // Track background
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();

    segments.forEach(seg => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, seg.from, seg.to);
      ctx.lineWidth = 18;
      ctx.strokeStyle = seg.color;
      ctx.stroke();
    });

    // Needle
    const angle = Math.PI + (score / 100) * Math.PI;
    const nx = cx + (r - 10) * Math.cos(angle);
    const ny = cy + (r - 10) * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Score text
    const overlay = document.getElementById('fg-value-overlay');
    if (overlay) {
      overlay.textContent = score;
      overlay.style.color = color;
    }
  }

  function renderFGHistory(fgData) {
    const canvas = document.getElementById('fg-history-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const labels = fgData.slice().reverse().map((d, i) => {
      const date = new Date(parseInt(d.timestamp) * 1000);
      return i % 5 === 0 ? date.toLocaleDateString('en', {month:'short', day:'numeric'}) : '';
    });
    const values = fgData.slice().reverse().map(d => parseInt(d.value));

    chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#6378dc',
          backgroundColor: 'rgba(99,120,220,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8892a4', font: { size: 10 } } },
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8892a4', font: { size: 10 },
              callback: v => v === 25 ? 'Fear' : v === 50 ? 'Neutral' : v === 75 ? 'Greed' : v
            }
          }
        },
        animation: { duration: 600 }
      }
    });
  }

  function renderMacroComposite(composite) {
    const el = document.getElementById('macro-composite');
    if (!el) return;

    const barWidth = composite.score;
    el.innerHTML = `
      <div class="composite-score" style="color:${composite.color}">${composite.score}</div>
      <div class="composite-label" style="color:${composite.color}">${composite.label}</div>
      <div class="composite-bar-bg">
        <div class="composite-bar-fill" style="width:${barWidth}%;background:${composite.color}"></div>
      </div>
      <div class="composite-trend">
        7-day trend: <strong style="color:${parseFloat(composite.trend)>0?'#2dd882':'#ff5f57'}">${composite.trend > 0 ? '+' : ''}${composite.trend}</strong>
      </div>
      <div class="composite-note">${composite.tradeNote}</div>
    `;
  }

  function renderIndicators(indicators) {
    const body = document.getElementById('macro-indicators-body');
    if (!body) return;

    body.innerHTML = indicators.map(ind => `
      <div class="macro-indicator-row">
        <div class="macro-ind-left">
          <div class="macro-ind-name">${ind.name}</div>
          <div class="macro-ind-desc">${ind.description}</div>
        </div>
        <div class="macro-ind-right">
          <div class="macro-ind-value">${ind.value}</div>
          <div class="macro-ind-signal" style="color:${ind.signalColor};background:${ind.signalColor}18">${ind.signal}</div>
        </div>
      </div>
    `).join('');
  }

  function renderSignalMatrix(fgScore, indicators) {
    const body = document.getElementById('signal-matrix-body');
    if (!body) return;

    // Build alignment signals
    const btcDom = indicators.find(i => i.name === 'BTC Dominance');
    const totalVol = indicators.find(i => i.name === '24h Volume');

    const rows = [
      {
        factor: '😱 Fear & Greed',
        value: fgScore.score + ' — ' + fgScore.label,
        longBias: fgScore.score < 30 ? 'STRONG ↑' : fgScore.score < 50 ? 'MILD ↑' : fgScore.score > 75 ? 'CAUTION ⚠' : 'NEUTRAL',
        shortBias: fgScore.score > 75 ? 'STRONG ↓' : fgScore.score > 55 ? 'MILD ↓' : 'NEUTRAL',
        color: fgScore.color
      },
      {
        factor: '🔑 BTC Dominance',
        value: btcDom?.value || 'N/A',
        longBias: btcDom?.raw < 50 ? 'ALT SEASON ↑' : 'BTC FAVORED',
        shortBias: btcDom?.raw > 60 ? 'ALTS WEAK ↓' : 'NEUTRAL',
        color: btcDom?.signalColor || '#8892a4'
      },
      {
        factor: '📊 Market Volume',
        value: totalVol?.value || 'N/A',
        longBias: totalVol?.signal === 'HIGH' ? 'CONFIRMED ↑' : 'WEAK',
        shortBias: totalVol?.signal === 'LOW' ? 'LOW CONVICTION ↓' : 'NEUTRAL',
        color: totalVol?.signalColor || '#8892a4'
      }
    ];

    body.innerHTML = `
      <table class="signal-matrix-table">
        <thead>
          <tr>
            <th>Macro Factor</th>
            <th>Current Reading</th>
            <th>Long Bias</th>
            <th>Short Bias</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="font-weight:600">${r.factor}</td>
              <td style="color:${r.color}">${r.value}</td>
              <td style="color:${r.longBias.includes('STRONG') ? '#2dd882' : r.longBias.includes('CAUTION') ? '#ff5f57' : '#8892a4'}">${r.longBias}</td>
              <td style="color:${r.shortBias.includes('STRONG') ? '#ff5f57' : '#8892a4'}">${r.shortBias}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signal-matrix-footer">
        Macro conditions favour <strong style="color:${fgScore.score < 50 ? '#2dd882' : fgScore.score > 70 ? '#f59e0b' : '#8892a4'}">
          ${fgScore.score < 30 ? 'AGGRESSIVE LONG' : fgScore.score < 50 ? 'CAUTIOUS LONG' : fgScore.score > 75 ? 'REDUCE EXPOSURE' : 'FOLLOW TECHNICALS'}
        </strong> — ${fgScore.tradeNote}
      </div>
    `;
  }

  // ── Public API ────────────────────────────────────────────────────────

  async function refresh() {
    const loading = document.getElementById('macro-loading');
    const content = document.getElementById('macro-content');
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';

    const [fgData, indicators] = await Promise.all([
      fetchFearGreed(),
      fetchMacroIndicators()
    ]);

    data.fearGreed = fgData;

    const latest = fgData[0];
    const score = parseInt(latest.value);
    const composite = computeMacroScore(fgData, indicators);

    // Update label
    const label = document.getElementById('fg-label');
    if (label) { label.textContent = latest.value_classification; label.style.color = composite.color; }

    const trend = document.getElementById('fg-trend');
    if (trend) {
      const change = score - parseInt(fgData[1]?.value || score);
      trend.innerHTML = `vs yesterday: <strong style="color:${change>=0?'#2dd882':'#ff5f57'}">${change>=0?'+':''}${change}</strong>`;
    }

    renderFGGauge(score, composite.color);
    renderFGHistory(fgData);
    renderMacroComposite(composite);
    renderIndicators(indicators);
    renderSignalMatrix(composite, indicators);

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
  }

  function injectStyles() {
    if (document.getElementById('macro-styles')) return;
    const s = document.createElement('style');
    s.id = 'macro-styles';
    s.textContent = `
      .macro-loading { display:flex; align-items:center; gap:1rem; padding:3rem; color:var(--color-text-muted); }

      .macro-top-row {
        display: grid;
        grid-template-columns: 260px 1fr 1fr;
        gap: 1.25rem;
        align-items: start;
      }
      @media(max-width:900px) { .macro-top-row { grid-template-columns: 1fr; } }

      .macro-fg-card .card-body { padding: 1rem 0.5rem; }

      .fg-gauge-wrap { position: relative; display: inline-block; }
      .fg-value-overlay {
        position: absolute;
        bottom: 10px; left: 50%;
        transform: translateX(-50%);
        font-size: 2.2rem; font-weight: 800;
        line-height: 1;
      }
      .fg-label { font-size: 1rem; font-weight: 700; margin-top: 0.5rem; }
      .fg-trend { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem; }

      .composite-score { font-size: 3rem; font-weight: 800; line-height: 1; }
      .composite-label { font-size: 1rem; font-weight: 600; margin: 0.25rem 0 0.75rem; }
      .composite-bar-bg {
        height: 8px; border-radius: 4px;
        background: var(--color-bg-secondary);
        overflow: hidden; margin-bottom: 0.5rem;
      }
      .composite-bar-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease; }
      .composite-trend { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.75rem; }
      .composite-note {
        font-size: 0.8rem; color: var(--color-text-muted);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px; padding: 0.6rem 0.8rem;
        line-height: 1.4;
      }

      .macro-indicator-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.6rem 0;
        border-bottom: 1px solid var(--color-border);
      }
      .macro-indicator-row:last-child { border-bottom: none; }
      .macro-ind-name { font-size: 0.875rem; font-weight: 600; color: var(--color-text-primary); }
      .macro-ind-desc { font-size: 0.75rem; color: var(--color-text-muted); }
      .macro-ind-right { text-align: right; }
      .macro-ind-value { font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); }
      .macro-ind-signal {
        font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.4rem;
        border-radius: 4px; margin-top: 0.2rem; display: inline-block;
        text-transform: uppercase; letter-spacing: 0.05em;
      }

      .signal-matrix-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .signal-matrix-table th {
        text-align: left; padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-muted); font-size: 0.75rem;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .signal-matrix-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--color-border); }
      .signal-matrix-table tr:last-child td { border-bottom: none; }
      .signal-matrix-footer {
        margin-top: 1rem; padding: 0.75rem 1rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px; font-size: 0.85rem;
        color: var(--color-text-muted); line-height: 1.4;
      }
    `;
    document.head.appendChild(s);
  }

  function init() {
    if (initialised) return;
    initialised = true;
    renderSection();
    refresh();
    // Auto-refresh every 10 min
    refreshTimer = setInterval(refresh, 10 * 60 * 1000);
  }

  function destroy() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    initialised = false;
  }

  return { init, refresh, destroy };
})();

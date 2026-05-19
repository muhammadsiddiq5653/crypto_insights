/* performanceDashboard.js — Signal & Trade Performance Analytics */
const PerformanceDashboard = (() => {
  let initialised = false;

  // ── Helpers ───────────────────────────────────────────────────────────
  function getTrades() {
    if (typeof TradeJournal !== 'undefined') return TradeJournal.getTrades();
    try { return JSON.parse(localStorage.getItem('trader_journal') || '[]'); } catch { return []; }
  }

  function computeStats(trades) {
    const closed  = trades.filter(t => t.status === 'closed');
    const open    = trades.filter(t => t.status === 'open');
    const wins    = closed.filter(t => (t.pnl || 0) > 0);
    const losses  = closed.filter(t => (t.pnl || 0) <= 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate  = closed.length ? (wins.length / closed.length * 100).toFixed(1) : 0;
    const avgR     = closed.length ? (closed.reduce((s,t) => s + (t.pnlR||0), 0) / closed.length).toFixed(2) : 0;
    const avgWin   = wins.length ? (wins.reduce((s,t) => s + (t.pnl||0), 0) / wins.length).toFixed(2) : 0;
    const avgLoss  = losses.length ? (losses.reduce((s,t) => s + (t.pnl||0), 0) / losses.length).toFixed(2) : 0;
    const profitFactor = losses.length && Math.abs(avgLoss) > 0
      ? (Math.abs(parseFloat(avgWin) * wins.length) / Math.abs(parseFloat(avgLoss) * losses.length)).toFixed(2) : '∞';

    // Current streak
    let streak = 0, streakType = '';
    if (closed.length) {
      const last = [...closed].sort((a,b) => b.closedAt - a.closedAt);
      streakType = (last[0].pnl || 0) > 0 ? 'W' : 'L';
      for (const t of last) {
        if (((t.pnl||0) > 0 ? 'W' : 'L') === streakType) streak++; else break;
      }
    }

    // Source breakdown
    const bySource = {};
    closed.forEach(t => {
      if (!bySource[t.source]) bySource[t.source] = { trades: 0, wins: 0, pnl: 0 };
      bySource[t.source].trades++;
      if ((t.pnl||0) > 0) bySource[t.source].wins++;
      bySource[t.source].pnl += (t.pnl || 0);
    });

    // Cumulative P&L series for chart (sorted by close date)
    const series = [];
    let running = 0;
    [...closed].sort((a,b) => a.closedAt - b.closedAt).forEach(t => {
      running += (t.pnl || 0);
      series.push({ date: t.closedAt, pnl: running, trade: t });
    });

    // Best / worst
    const best  = closed.reduce((b, t) => (t.pnl||0) > (b?.pnl||0) ? t : b, null);
    const worst = closed.reduce((w, t) => (t.pnl||0) < (w?.pnl||0) ? t : w, null);

    // Direction breakdown
    const longs  = closed.filter(t => t.direction === 'LONG');
    const shorts = closed.filter(t => t.direction === 'SHORT');

    return { closed, open, wins, losses, totalPnl, winRate, avgR, avgWin, avgLoss,
             profitFactor, streak, streakType, bySource, series, best, worst,
             longs, shorts };
  }

  // ── P&L Sparkline (canvas) ───────────────────────────────────────────
  function drawChart(series) {
    const canvas = document.getElementById('perf-chart');
    if (!canvas || !series.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = canvas.offsetWidth  || 600;
    const H = canvas.height = canvas.offsetHeight || 160;

    const values = series.map(s => s.pnl);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;
    const pad = { t: 16, b: 24, l: 8, r: 8 };
    const w = W - pad.l - pad.r;
    const h = H - pad.t - pad.b;

    const toX = i => pad.l + (i / (series.length - 1 || 1)) * w;
    const toY = v => pad.t + h - ((v - min) / range) * h;
    const zeroY = toY(0);

    ctx.clearRect(0, 0, W, H);

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(W - pad.r, zeroY); ctx.stroke();

    if (series.length < 2) {
      // Single point
      ctx.fillStyle = values[0] >= 0 ? '#2dd882' : '#ff5f57';
      ctx.beginPath(); ctx.arc(W/2, toY(values[0]), 4, 0, Math.PI*2); ctx.fill();
      return;
    }

    // Fill area
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, values[values.length-1] >= 0 ? 'rgba(45,216,130,0.25)' : 'rgba(255,95,87,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), zeroY);
    series.forEach((s, i) => ctx.lineTo(toX(i), toY(s.pnl)));
    ctx.lineTo(toX(series.length - 1), zeroY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    series.forEach((s, i) => i === 0 ? ctx.moveTo(toX(i), toY(s.pnl)) : ctx.lineTo(toX(i), toY(s.pnl)));
    ctx.strokeStyle = values[values.length-1] >= 0 ? '#2dd882' : '#ff5f57';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots on data points (only if few)
    if (series.length <= 30) {
      series.forEach((s, i) => {
        ctx.beginPath();
        ctx.arc(toX(i), toY(s.pnl), 3, 0, Math.PI * 2);
        ctx.fillStyle = (s.pnl >= 0) ? '#2dd882' : '#ff5f57';
        ctx.fill();
      });
    }

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`$${min.toFixed(0)}`, pad.l + 2, H - pad.b + 12);
    ctx.textAlign = 'right';
    ctx.fillText(`$${max.toFixed(0)}`, W - pad.r - 2, pad.t + 10);
  }

  // ── Render ────────────────────────────────────────────────────────────
  function renderSection() {
    const el = document.getElementById('performance-dashboard');
    if (!el) return;

    const trades = getTrades();
    const s = computeStats(trades);

    if (!trades.length) {
      el.innerHTML = `
        <div class="ae-page">
          <h2 class="ae-title">📈 Performance Dashboard</h2>
          <div class="ae-empty" style="padding:3rem">
            No trades in journal yet.<br>
            <span style="font-size:0.8rem;opacity:0.6">Log your first trade in the Trade Journal to see analytics here.</span>
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="ae-page">
        <div class="tj-header">
          <div>
            <h2 class="ae-title">📈 Performance Dashboard</h2>
            <p class="ae-subtitle">${trades.length} trades · ${s.closed.length} closed · ${s.open.length} open</p>
          </div>
          <button class="ae-btn" onclick="PerformanceDashboard.refresh()">↻ Refresh</button>
        </div>

        <!-- KPI row -->
        <div class="perf-kpi-grid">
          <div class="perf-kpi">
            <div class="perf-kpi-val" style="color:${parseFloat(s.totalPnl) >= 0 ? '#2dd882' : '#ff5f57'}">
              ${parseFloat(s.totalPnl) >= 0 ? '+' : ''}$${parseFloat(s.totalPnl).toFixed(2)}
            </div>
            <div class="perf-kpi-lbl">Total P&L</div>
          </div>
          <div class="perf-kpi">
            <div class="perf-kpi-val" style="color:${parseFloat(s.winRate) >= 50 ? '#2dd882' : '#ff5f57'}">${s.winRate}%</div>
            <div class="perf-kpi-lbl">Win Rate</div>
          </div>
          <div class="perf-kpi">
            <div class="perf-kpi-val">${s.avgR}R</div>
            <div class="perf-kpi-lbl">Avg R-Multiple</div>
          </div>
          <div class="perf-kpi">
            <div class="perf-kpi-val">${s.profitFactor}</div>
            <div class="perf-kpi-lbl">Profit Factor</div>
          </div>
          <div class="perf-kpi">
            <div class="perf-kpi-val" style="color:${s.streakType === 'W' ? '#2dd882' : '#ff5f57'}">
              ${s.streak}${s.streakType}
            </div>
            <div class="perf-kpi-lbl">Current Streak</div>
          </div>
          <div class="perf-kpi">
            <div class="perf-kpi-val">${s.closed.length > 0 ? (s.wins.length + '/' + s.losses.length) : '—'}</div>
            <div class="perf-kpi-lbl">W / L</div>
          </div>
        </div>

        <!-- P&L Curve -->
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-header">Cumulative P&L Curve</div>
          <div class="card-body" style="padding:0.5rem">
            ${s.series.length >= 2
              ? '<canvas id="perf-chart" style="width:100%;height:160px;display:block"></canvas>'
              : '<div class="ae-empty">Need at least 2 closed trades for chart.</div>'}
          </div>
        </div>

        <div class="perf-two-col">
          <!-- Source breakdown -->
          <div class="card">
            <div class="card-header">Signal Source Breakdown</div>
            <div class="card-body">
              ${Object.keys(s.bySource).length ? `
                <table class="wallet-table">
                  <thead><tr><th>Source</th><th>Trades</th><th>Win%</th><th>P&L</th></tr></thead>
                  <tbody>
                    ${Object.entries(s.bySource).sort((a,b) => b[1].pnl - a[1].pnl).map(([src, d]) => `
                      <tr>
                        <td style="font-weight:600">${src}</td>
                        <td>${d.trades}</td>
                        <td style="color:${d.wins/d.trades >= 0.5 ? '#2dd882' : '#ff5f57'}">${Math.round(d.wins/d.trades*100)}%</td>
                        <td style="color:${d.pnl >= 0 ? '#2dd882' : '#ff5f57'};font-weight:700">${d.pnl >= 0 ? '+' : ''}$${d.pnl.toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<div class="ae-empty">No source data.</div>'}
            </div>
          </div>

          <!-- Best / Worst + direction split -->
          <div class="card">
            <div class="card-header">Trade Insights</div>
            <div class="card-body">
              ${s.best ? `
                <div class="perf-insight perf-ins-win">
                  <div class="perf-ins-label">🏆 Best Trade</div>
                  <div class="perf-ins-val">${s.best.symbol} ${s.best.direction} +$${(s.best.pnl||0).toFixed(2)} (+${s.best.pnlR}R)</div>
                  <div class="perf-ins-date">${new Date(s.best.closedAt).toLocaleDateString()}</div>
                </div>
              ` : ''}
              ${s.worst ? `
                <div class="perf-insight perf-ins-loss" style="margin-top:0.6rem">
                  <div class="perf-ins-label">💔 Worst Trade</div>
                  <div class="perf-ins-val">${s.worst.symbol} ${s.worst.direction} $${(s.worst.pnl||0).toFixed(2)} (${s.worst.pnlR}R)</div>
                  <div class="perf-ins-date">${new Date(s.worst.closedAt).toLocaleDateString()}</div>
                </div>
              ` : ''}
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:1rem">
                <div class="perf-dir-card" style="border-color:rgba(45,216,130,0.3)">
                  <div class="perf-dir-label" style="color:#2dd882">LONG</div>
                  <div class="perf-dir-count">${s.longs.length} trades</div>
                  <div class="perf-dir-wr">${s.longs.length ? Math.round(s.longs.filter(t=>(t.pnl||0)>0).length/s.longs.length*100) : 0}% WR</div>
                </div>
                <div class="perf-dir-card" style="border-color:rgba(255,95,87,0.3)">
                  <div class="perf-dir-label" style="color:#ff5f57">SHORT</div>
                  <div class="perf-dir-count">${s.shorts.length} trades</div>
                  <div class="perf-dir-wr">${s.shorts.length ? Math.round(s.shorts.filter(t=>(t.pnl||0)>0).length/s.shorts.length*100) : 0}% WR</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Draw chart after DOM paint
    if (s.series.length >= 2) requestAnimationFrame(() => drawChart(s.series));
  }

  function refresh() { renderSection(); }

  function init() {
    if (initialised) { renderSection(); return; }
    initialised = true;
    renderSection();
  }

  return { init, refresh };
})();

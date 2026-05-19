/* portfolioTracker.js — Portfolio Tracker with live prices & allocation chart */
const PortfolioTracker = (() => {
  const STORE_KEY   = 'trader_portfolio';
  const REFRESH_MS  = 30_000;
  let holdings      = [];
  let liveData      = {};
  let refreshTimer  = null;
  let initialised   = false;

  const COINS = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC',
                 'LINK','LTC','ATOM','NEAR','APT','OP','ARB','INJ','TIA','SEI'];

  // ── Persistence ────────────────────────────────────────────────────────
  function load() { try { holdings = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { holdings = []; } }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(holdings)); }

  function createHolding({ coin, amount, avgEntry }) {
    return {
      id:       Date.now() + Math.random().toString(36).slice(2),
      coin:     coin.toUpperCase().replace('USDT',''),
      amount:   parseFloat(amount),
      avgEntry: parseFloat(avgEntry),
    };
  }

  // ── Live price fetch ───────────────────────────────────────────────────
  async function fetchPrices() {
    const symbols = [...new Set(holdings.map(h => `${h.coin}USDT`))];
    if (!symbols.length) return;

    // First try TickerStrip cache
    let allFromCache = true;
    symbols.forEach(sym => {
      const d = typeof TickerStrip !== 'undefined' ? TickerStrip.getData(sym) : null;
      if (d) {
        liveData[sym] = { price: d.price, change: d.change };
      } else {
        allFromCache = false;
      }
    });

    if (!allFromCache) {
      try {
        const r = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`
        );
        const tickers = await r.json();
        tickers.forEach(t => {
          liveData[t.symbol] = {
            price:  parseFloat(t.lastPrice),
            change: parseFloat(t.priceChangePercent),
          };
        });
      } catch { /* keep stale data */ }
    }

    renderTable();
    drawAllocation();
  }

  // ── Computed values ────────────────────────────────────────────────────
  function enriched() {
    return holdings.map(h => {
      const sym   = `${h.coin}USDT`;
      const live  = liveData[sym];
      const price = live?.price ?? null;
      const value = price !== null ? price * h.amount : null;
      const cost  = h.avgEntry * h.amount;
      const pnl   = value !== null ? value - cost : null;
      const pnlPct = pnl !== null ? (pnl / cost * 100) : null;
      return { ...h, sym, price, value, cost, pnl, pnlPct, change24h: live?.change ?? null };
    });
  }

  function totalValue(rows) {
    return rows.reduce((s, r) => s + (r.value ?? r.cost), 0);
  }

  // ── Donut chart ────────────────────────────────────────────────────────
  const PALETTE = ['#6378dc','#2dd882','#f59e0b','#ff5f57','#38bdf8','#a78bfa',
                   '#fb923c','#34d399','#f472b6','#facc15','#60a5fa','#4ade80'];

  function drawAllocation() {
    const canvas = document.getElementById('pt-donut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rows  = enriched();
    const total = totalValue(rows);
    if (!total) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const W = canvas.width  = canvas.offsetWidth  || 220;
    const H = canvas.height = canvas.offsetHeight || 220;
    const cx = W / 2, cy = H / 2;
    const r  = Math.min(cx, cy) - 10;
    const ri = r * 0.58;

    ctx.clearRect(0, 0, W, H);

    let startAngle = -Math.PI / 2;
    rows.forEach((row, i) => {
      const pct   = (row.value ?? row.cost) / total;
      const sweep = pct * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, ri, 0, Math.PI * 2);
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg-card').trim() || '#161c35';
      ctx.fill();
      startAngle += sweep;
    });

    // Centre label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.round(r * 0.18)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${formatK(total)}`, cx, cy - 7);
    ctx.font = `${Math.round(r * 0.12)}px system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Total', cx, cy + 12);
  }

  function formatK(n) {
    if (n >= 1_000_000) return (n/1_000_000).toFixed(2) + 'M';
    if (n >= 1_000)     return (n/1_000).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  // ── Render section ─────────────────────────────────────────────────────
  function renderSection() {
    const el = document.getElementById('portfolio-tracker');
    if (!el) return;

    el.innerHTML = `
      <div class="pt-page">
        <div class="tj-header">
          <div>
            <h2 class="ae-title">💼 Portfolio Tracker</h2>
            <p class="ae-subtitle">Real-time value, unrealized P&L and allocation — prices from Binance</p>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="ae-btn" onclick="PortfolioTracker.refresh()">↻ Refresh</button>
            <button class="ae-btn" onclick="PortfolioTracker.exportCSV()">⬇ CSV</button>
          </div>
        </div>

        <!-- Add holding form -->
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-header">➕ Add Holding</div>
          <div class="card-body">
            <div class="pt-add-row">
              <div class="bt-config-group">
                <label>Coin</label>
                <select id="pt-coin" class="ae-select">
                  ${COINS.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="bt-config-group">
                <label>Amount (units)</label>
                <input id="pt-amount" type="number" step="any" min="0" class="ae-input" placeholder="e.g. 0.5" />
              </div>
              <div class="bt-config-group">
                <label>Avg Entry (USD)</label>
                <input id="pt-entry" type="number" step="any" min="0" class="ae-input" placeholder="e.g. 62000" />
              </div>
              <button class="ae-btn ae-btn-primary" onclick="PortfolioTracker.addHolding()" style="align-self:flex-end">Add</button>
            </div>
          </div>
        </div>

        <!-- Summary + chart -->
        <div class="pt-overview">
          <div class="pt-stats-col">
            <div class="pt-kpi-row" id="pt-kpi-row">
              <div class="ae-empty" style="padding:1rem">Add holdings to see totals.</div>
            </div>
          </div>
          <div class="pt-chart-col">
            <canvas id="pt-donut" style="width:220px;height:220px;display:block;margin:auto"></canvas>
            <div class="pt-legend" id="pt-legend"></div>
          </div>
        </div>

        <!-- Holdings table -->
        <div class="card">
          <div class="card-header">
            <span>Holdings</span>
            <span class="ae-count" id="pt-count">0 assets</span>
          </div>
          <div class="card-body" style="overflow-x:auto" id="pt-table-body">
            <div class="ae-empty">No holdings yet. Add one above.</div>
          </div>
        </div>

        <!-- Binance sync footer -->
        <div class="pt-binance-footer">
          <button class="ae-btn" onclick="PortfolioTracker.syncFromBinance()">📊 Import from Binance API</button>
          <span class="ae-hint" style="margin-left:0.5rem">Requires Binance read-only key in Settings</span>
        </div>
      </div>
    `;

    renderTable();
    fetchPrices();
  }

  function renderTable() {
    const body  = document.getElementById('pt-table-body');
    const count = document.getElementById('pt-count');
    const kpiEl = document.getElementById('pt-kpi-row');
    if (!body) return;

    if (!holdings.length) {
      body.innerHTML = '<div class="ae-empty">No holdings yet. Add one above.</div>';
      if (count) count.textContent = '0 assets';
      return;
    }

    const rows  = enriched();
    const total = totalValue(rows);
    const totalCost = rows.reduce((s,r) => s + r.cost, 0);
    const totalPnl  = rows.reduce((s,r) => s + (r.pnl ?? 0), 0);
    const totalPct  = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;

    if (count) count.textContent = `${holdings.length} asset${holdings.length !== 1 ? 's' : ''}`;

    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="wt-stat"><div class="wt-stat-val">$${formatK(total)}</div><div class="wt-stat-lbl">Total Value</div></div>
        <div class="wt-stat"><div class="wt-stat-val">$${formatK(totalCost)}</div><div class="wt-stat-lbl">Cost Basis</div></div>
        <div class="wt-stat">
          <div class="wt-stat-val" style="color:${totalPnl >= 0 ? '#2dd882' : '#ff5f57'}">
            ${totalPnl >= 0 ? '+' : ''}$${formatK(totalPnl)}
          </div>
          <div class="wt-stat-lbl">Unrealized P&L</div>
        </div>
        <div class="wt-stat">
          <div class="wt-stat-val" style="color:${totalPct >= 0 ? '#2dd882' : '#ff5f57'}">
            ${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%
          </div>
          <div class="wt-stat-lbl">Total Return</div>
        </div>
      `;
    }

    // Legend
    const legend = document.getElementById('pt-legend');
    if (legend) {
      legend.innerHTML = rows.map((r, i) => {
        const pct = total > 0 ? ((r.value ?? r.cost) / total * 100).toFixed(1) : 0;
        return `<div class="pt-leg-item">
          <span class="pt-leg-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
          <span class="pt-leg-label">${r.coin}</span>
          <span class="pt-leg-pct">${pct}%</span>
        </div>`;
      }).join('');
    }

    body.innerHTML = `
      <table class="wallet-table" style="min-width:720px">
        <thead>
          <tr>
            <th>Coin</th><th>Amount</th><th>Avg Entry</th><th>Live Price</th>
            <th>Value</th><th>P&L</th><th>P&L %</th><th>24h Chg</th><th>Alloc %</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const alloc  = total > 0 ? ((r.value ?? r.cost) / total * 100).toFixed(1) : '—';
            const pnlCol = r.pnl === null ? '' : r.pnl >= 0 ? 'color:#2dd882' : 'color:#ff5f57';
            const chgCol = r.change24h === null ? '' : r.change24h >= 0 ? 'color:#2dd882' : 'color:#ff5f57';
            return `<tr>
              <td style="font-weight:700">${r.coin}</td>
              <td>${r.amount.toLocaleString('en',{maximumFractionDigits:8})}</td>
              <td>$${r.avgEntry.toLocaleString('en',{maximumFractionDigits:4})}</td>
              <td style="font-weight:600">${r.price !== null ? '$'+r.price.toLocaleString('en',{maximumFractionDigits:4}) : '…'}</td>
              <td style="font-weight:600">${r.value !== null ? '$'+formatK(r.value) : '—'}</td>
              <td style="${pnlCol};font-weight:700">${r.pnl !== null ? (r.pnl>=0?'+':'')+' $'+r.pnl.toFixed(2) : '—'}</td>
              <td style="${pnlCol}">${r.pnlPct !== null ? (r.pnlPct>=0?'+':'')+r.pnlPct.toFixed(2)+'%' : '—'}</td>
              <td style="${chgCol}">${r.change24h !== null ? (r.change24h>=0?'▲':'▼')+Math.abs(r.change24h).toFixed(2)+'%' : '—'}</td>
              <td>
                <div class="pt-alloc-bar-wrap">
                  <div class="pt-alloc-bar" style="width:${alloc}%"></div>
                </div>
                <span style="font-size:0.72rem;color:var(--color-text-muted)">${alloc}%</span>
              </td>
              <td><button class="wt-copy-btn" style="color:#ff5f57" onclick="PortfolioTracker.deleteHolding('${r.id}')">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    drawAllocation();
  }

  // ── CRUD ───────────────────────────────────────────────────────────────
  function addHolding() {
    const coin     = document.getElementById('pt-coin')?.value;
    const amount   = parseFloat(document.getElementById('pt-amount')?.value);
    const avgEntry = parseFloat(document.getElementById('pt-entry')?.value);

    if (!coin || isNaN(amount) || amount <= 0 || isNaN(avgEntry) || avgEntry <= 0) {
      if (typeof AlertEngine !== 'undefined') AlertEngine.showToast('Fill in all fields with valid numbers', '#ff5f57');
      return;
    }

    // Merge with existing coin if present
    const existing = holdings.find(h => h.coin === coin);
    if (existing) {
      const totalCost   = existing.avgEntry * existing.amount + avgEntry * amount;
      const totalAmount = existing.amount + amount;
      existing.avgEntry = totalCost / totalAmount;
      existing.amount   = totalAmount;
    } else {
      holdings.push(createHolding({ coin, amount, avgEntry }));
    }

    const newHolding = holdings.find(h => h.coin === coin);
    save();
    if (newHolding) pushHolding(newHolding);
    fetchPrices();
    if (typeof AlertEngine !== 'undefined')
      AlertEngine.showToast(`${coin} added to portfolio`, '#2dd882');
  }

  function deleteHolding(id) {
    holdings = holdings.filter(h => h.id !== id);
    save();
    AuthUtils.apiFetch(`/api/user/portfolio/${id}`, { method: 'DELETE' }).catch(() => {});
    renderTable();
    drawAllocation();
  }

  function exportCSV() {
    const rows = enriched();
    const headers = ['Coin','Amount','AvgEntry','LivePrice','Value','PnL','PnL%','24hChange','Alloc%'];
    const total = totalValue(rows);
    const csv = [headers, ...rows.map(r => [
      r.coin, r.amount, r.avgEntry,
      r.price ?? '', r.value?.toFixed(2) ?? '',
      r.pnl?.toFixed(2) ?? '', r.pnlPct?.toFixed(2) ?? '',
      r.change24h?.toFixed(2) ?? '',
      total > 0 ? ((r.value ?? r.cost)/total*100).toFixed(1) : '',
    ])].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `portfolio_${Date.now()}.csv`;
    a.click();
  }

  function refresh() { fetchPrices(); }

  // ── Server sync ────────────────────────────────────────────────────────
  function pushHolding(holding) {
    AuthUtils.apiFetch('/api/user/portfolio', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holding),
    }).catch(() => {});
  }

  async function syncFromServer() {
    try {
      const r = await fetch('/api/user/portfolio');
      if (!r.ok) return;
      const { holdings: serverH } = await r.json();
      if (!serverH?.length) return;
      const localIds = new Set(holdings.map(h => h.id));
      serverH.forEach(sh => { if (!localIds.has(sh.id)) holdings.push(sh); });
      save(); fetchPrices();
    } catch { /* silent */ }
  }

  async function syncFromBinance() {
    if (typeof AlertEngine !== 'undefined') AlertEngine.showToast('Importing from Binance…', '#f59e0b');
    try {
      const r = await fetch('/api/user/binance/balances');
      if (!r.ok) {
        const e = await r.json();
        if (typeof AlertEngine !== 'undefined') AlertEngine.showToast(`Binance: ${e.error}`, '#ff5f57');
        return;
      }
      const { balances } = await r.json();
      let added = 0;
      // Fetch live prices for imported balances
      const stablecoins = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD']);
      for (const b of balances) {
        if (stablecoins.has(b.coin)) continue;
        const existing = holdings.find(h => h.coin === b.coin);
        if (existing) {
          existing.amount = b.total; save();
        } else {
          // Get current price as a rough avg entry
          let price = 0;
          try {
            const pr = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${b.coin}USDT`);
            const pd = await pr.json();
            price = parseFloat(pd.price) || 0;
          } catch { /* skip */ }
          if (price > 0) {
            const h = createHolding({ coin: b.coin, amount: b.total, avgEntry: price });
            holdings.push(h);
            pushHolding(h);
            added++;
          }
        }
      }
      save();
      fetchPrices();
      if (typeof AlertEngine !== 'undefined')
        AlertEngine.showToast(`Imported ${added} assets from Binance ✓`, '#2dd882');
    } catch (err) {
      if (typeof AlertEngine !== 'undefined') AlertEngine.showToast(`Import failed: ${err.message}`, '#ff5f57');
    }
  }

  function init() {
    if (initialised) { renderSection(); return; }
    initialised = true;
    load();
    renderSection();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(fetchPrices, REFRESH_MS);
    syncFromServer();
  }

  return { init, addHolding, deleteHolding, refresh, exportCSV, syncFromBinance };
})();

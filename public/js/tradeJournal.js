/* tradeJournal.js — Trade Journal with P&L tracking */
const TradeJournal = (() => {
  function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  const STORE_KEY = 'trader_journal';
  let trades      = [];
  let initialised = false;
  let filter      = 'all'; // 'all' | 'open' | 'closed'

  // ── Persistence ──────────────────────────────────────────────────────
  function load() { try { trades = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { trades = []; } }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(trades)); }

  // ── Trade factory ────────────────────────────────────────────────────
  function createTrade({ symbol, direction, entry, sl, tp, size = 1, source = 'manual', notes = '' }) {
    const risk   = direction === 'LONG' ? entry - sl : sl - entry;
    const reward = direction === 'LONG' ? tp - entry : entry - tp;
    const rr     = risk > 0 ? (reward / risk).toFixed(2) : '—';
    return {
      id:        Date.now() + Math.random().toString(36).slice(2),
      symbol:    symbol.replace('USDT','').toUpperCase(),
      direction, entry: parseFloat(entry), sl: parseFloat(sl), tp: parseFloat(tp),
      size: parseFloat(size), rr, source, notes,
      status:    'open',
      openedAt:  Date.now(),
      closedAt:  null,
      exitPrice: null,
      pnl:       null,
      pnlR:      null,
    };
  }

  function logTrade(data) {
    const t = createTrade(data);
    trades.push(t);
    save();
    pushTrade(t);
    renderList();
    if (typeof AlertEngine !== 'undefined') {
      AlertEngine.showToast(`📝 Trade logged: ${t.symbol} ${t.direction} @ ${t.entry.toLocaleString('en',{maximumFractionDigits:4})}`, '#6378dc');
    }
    return t;
  }

  function closeTrade(id, exitPrice) {
    const t = trades.find(x => x.id === id);
    if (!t) return;
    exitPrice  = parseFloat(exitPrice);
    const diff = t.direction === 'LONG' ? exitPrice - t.entry : t.entry - exitPrice;
    t.pnl      = parseFloat((diff * t.size).toFixed(4));
    const risk = Math.abs(t.entry - t.sl);
    t.pnlR     = risk > 0 ? parseFloat((diff / risk).toFixed(2)) : 0;
    t.exitPrice = exitPrice;
    t.status    = 'closed';
    t.closedAt  = Date.now();
    save();
    renderList();

    const color = t.pnl >= 0 ? '#2dd882' : '#ff5f57';
    const msg   = `${t.pnl >= 0 ? '✅' : '❌'} Trade closed: ${t.symbol} ${t.direction} P&L ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.pnlR >= 0 ? '+' : ''}${t.pnlR}R)`;
    if (typeof AlertEngine !== 'undefined') AlertEngine.showToast(msg, color);

    const hook = localStorage.getItem('trader_slack_webhook');
    if (hook) {
      AuthUtils.apiFetch('/api/proxy/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook: hook, text: msg,
          attachments: [{
            color: t.pnl >= 0 ? '#2dd882' : '#ff5f57',
            fields: [
              { title: 'Symbol',     value: t.symbol,                                short: true },
              { title: 'Direction',  value: t.direction,                             short: true },
              { title: 'Entry',      value: `$${t.entry.toLocaleString()}`,          short: true },
              { title: 'Exit',       value: `$${exitPrice.toLocaleString()}`,        short: true },
              { title: 'P&L',        value: `${t.pnl >= 0 ? '+' : ''}$${t.pnl}`,   short: true },
              { title: 'R-Multiple', value: `${t.pnlR >= 0 ? '+' : ''}${t.pnlR}R`, short: true },
            ],
          }],
        }),
      }).catch(() => {});
    }
  }

  function deleteTrade(id) {
    trades = trades.filter(t => t.id !== id);
    save();
    renderList();
  }

  // ── Log modal (called from Command Center) ───────────────────────────
  function openLogModal(prefill = {}) {
    let modal = document.getElementById('tj-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tj-modal';
      modal.className = 'tj-modal-overlay';
      document.body.appendChild(modal);
    }

    const sym   = (prefill.symbol || 'BTC').replace('USDT','');
    const dir   = prefill.direction || 'LONG';
    const price = prefill.price || '';
    const slVal = prefill.sl   ? parseFloat(prefill.sl).toFixed(price > 100 ? 2 : 6)  : '';
    const tpVal = prefill.tp   ? parseFloat(prefill.tp).toFixed(price > 100 ? 2 : 6)  : '';
    const szVal = prefill.size ? parseFloat(prefill.size).toFixed(6)                   : '1';
    const ntVal = prefill.notes || '';

    modal.innerHTML = `
      <div class="tj-modal">
        <div class="tj-modal-header">
          <h3>📝 Log Trade</h3>
          <button class="tj-modal-close" onclick="document.getElementById('tj-modal').style.display='none'">✕</button>
        </div>
        <div class="tj-modal-body">
          <div class="tj-modal-grid">
            <div class="tj-field">
              <label>Symbol</label>
              <select id="tjm-symbol" class="ae-select">
                ${['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC'].map(s =>
                  `<option value="${s}" ${s === sym ? 'selected' : ''}>${s}</option>`
                ).join('')}
              </select>
            </div>
            <div class="tj-field">
              <label>Direction</label>
              <select id="tjm-direction" class="ae-select">
                <option value="LONG"  ${dir === 'LONG'  ? 'selected' : ''}>LONG</option>
                <option value="SHORT" ${dir === 'SHORT' ? 'selected' : ''}>SHORT</option>
              </select>
            </div>
            <div class="tj-field">
              <label>Entry Price</label>
              <input id="tjm-entry" type="number" step="any" class="ae-input" value="${price}" placeholder="e.g. 68000" />
            </div>
            <div class="tj-field">
              <label>Stop Loss</label>
              <input id="tjm-sl" type="number" step="any" class="ae-input" value="${slVal}" placeholder="e.g. 65000" />
            </div>
            <div class="tj-field">
              <label>Take Profit</label>
              <input id="tjm-tp" type="number" step="any" class="ae-input" value="${tpVal}" placeholder="e.g. 74000" />
            </div>
            <div class="tj-field">
              <label>Size (units)</label>
              <input id="tjm-size" type="number" step="any" class="ae-input" value="${szVal}" />
            </div>
          </div>
          <div class="tj-field" style="margin-top:0.75rem">
            <label>Notes</label>
            <input id="tjm-notes" type="text" class="ae-input" value="${ntVal}" placeholder="Optional notes…" style="width:100%" />
          </div>
          <div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:0.5rem">Source: ${prefill.source || 'manual'}</div>
        </div>
        <div class="tj-modal-footer">
          <button class="ae-btn" onclick="document.getElementById('tj-modal').style.display='none'">Cancel</button>
          <button class="ae-btn ae-btn-primary" onclick="TradeJournal.submitModal('${prefill.source || 'manual'}')">Log Trade</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  function submitModal(source) {
    const symbol    = document.getElementById('tjm-symbol')?.value;
    const direction = document.getElementById('tjm-direction')?.value;
    const entry     = parseFloat(document.getElementById('tjm-entry')?.value);
    const sl        = parseFloat(document.getElementById('tjm-sl')?.value);
    const tp        = parseFloat(document.getElementById('tjm-tp')?.value);
    const size      = parseFloat(document.getElementById('tjm-size')?.value) || 1;
    const notes     = document.getElementById('tjm-notes')?.value || '';

    if ([entry,sl,tp].some(isNaN)) {
      if (typeof AlertEngine !== 'undefined') AlertEngine.showToast('Fill in Entry, SL and TP', '#ff5f57');
      return;
    }
    logTrade({ symbol, direction, entry, sl, tp, size, source, notes });
    document.getElementById('tj-modal').style.display = 'none';
    const nav = document.querySelector('[data-section="trade-journal"]');
    if (nav) nav.click();
  }

  // ── Close modal ──────────────────────────────────────────────────────
  function openCloseModal(id) {
    const t = trades.find(x => x.id === id);
    if (!t) return;
    let modal = document.getElementById('tj-close-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tj-close-modal';
      modal.className = 'tj-modal-overlay';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="tj-modal">
        <div class="tj-modal-header">
          <h3>Close Trade: ${t.symbol} ${t.direction}</h3>
          <button class="tj-modal-close" onclick="document.getElementById('tj-close-modal').style.display='none'">✕</button>
        </div>
        <div class="tj-modal-body">
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:1rem">Entry: $${t.entry.toLocaleString()} · SL: $${t.sl.toLocaleString()} · TP: $${t.tp.toLocaleString()}</p>
          <div class="tj-field">
            <label>Exit Price</label>
            <input id="tjc-exit" type="number" step="any" class="ae-input" placeholder="Current price…" />
          </div>
        </div>
        <div class="tj-modal-footer">
          <button class="ae-btn" onclick="document.getElementById('tj-close-modal').style.display='none'">Cancel</button>
          <button class="ae-btn ae-btn-primary" onclick="TradeJournal.confirmClose('${id}')">Confirm Close</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  function confirmClose(id) {
    const exit = parseFloat(document.getElementById('tjc-exit')?.value);
    if (isNaN(exit) || exit <= 0) {
      if (typeof AlertEngine !== 'undefined') AlertEngine.showToast('Enter a valid exit price', '#ff5f57');
      return;
    }
    closeTrade(id, exit);
    document.getElementById('tj-close-modal').style.display = 'none';
  }

  // ── CSV export ───────────────────────────────────────────────────────
  function csvCell(v) { const s = String(v ?? ''); return `"${s.replace(/"/g, '""')}"`; }
  function exportCSV() {
    const headers = ['Symbol','Direction','Entry','SL','TP','Size','R:R','Status','Exit','P&L','P&L(R)','Source','Notes','OpenedAt','ClosedAt'];
    const rows = trades.map(t => [
      t.symbol, t.direction, t.entry, t.sl, t.tp, t.size, t.rr,
      t.status, t.exitPrice ?? '', t.pnl ?? '', t.pnlR ?? '', t.source,
      csvCell(t.notes), new Date(t.openedAt).toLocaleString(),
      t.closedAt ? new Date(t.closedAt).toLocaleString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `trade_journal_${Date.now()}.csv`;
    a.click();
  }

  // ── Render ───────────────────────────────────────────────────────────
  function renderSection() {
    const el = document.getElementById('trade-journal');
    if (!el) return;

    el.innerHTML = `
      <div class="tj-page">
        <div class="tj-header">
          <div>
            <h2 class="ae-title">📓 Trade Journal</h2>
            <p class="ae-subtitle">Log, track and close trades — P&L auto-calculated</p>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="ae-btn ae-btn-primary" onclick="TradeJournal.openLogModal()">+ Log Trade</button>
            <button class="ae-btn" onclick="TradeJournal.exportCSV()">⬇ CSV</button>
          </div>
        </div>

        <div class="tj-stats" id="tj-stats"></div>

        <div class="ae-filter-bar">
          <button class="ae-filter ${filter==='all'?'active':''}"    onclick="TradeJournal.setFilter('all')">All</button>
          <button class="ae-filter ${filter==='open'?'active':''}"   onclick="TradeJournal.setFilter('open')">Open</button>
          <button class="ae-filter ${filter==='closed'?'active':''}" onclick="TradeJournal.setFilter('closed')">Closed</button>
        </div>

        <div class="card">
          <div class="card-body" id="tj-list-body" style="overflow-x:auto"></div>
        </div>
      </div>
    `;

    renderStats();
    renderList();
  }

  function renderStats() {
    const el = document.getElementById('tj-stats');
    if (!el) return;
    const closed   = trades.filter(t => t.status === 'closed');
    const wins     = closed.filter(t => (t.pnl || 0) > 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate  = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
    const avgR     = closed.length ? (closed.reduce((s,t) => s + (t.pnlR || 0), 0) / closed.length).toFixed(2) : '—';
    const open     = trades.filter(t => t.status === 'open').length;

    el.innerHTML = `
      <div class="wt-stat"><div class="wt-stat-val">${trades.length}</div><div class="wt-stat-lbl">Total Trades</div></div>
      <div class="wt-stat"><div class="wt-stat-val" style="color:#f59e0b">${open}</div><div class="wt-stat-lbl">Open</div></div>
      <div class="wt-stat"><div class="wt-stat-val" style="color:${winRate >= 50 ? '#2dd882' : '#ff5f57'}">${winRate}%</div><div class="wt-stat-lbl">Win Rate</div></div>
      <div class="wt-stat"><div class="wt-stat-val" style="color:${totalPnl >= 0 ? '#2dd882' : '#ff5f57'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</div><div class="wt-stat-lbl">Total P&L</div></div>
      <div class="wt-stat"><div class="wt-stat-val">${avgR}</div><div class="wt-stat-lbl">Avg R</div></div>
    `;
  }

  function setFilter(f) { filter = f; renderSection(); }

  // ── Server sync ───────────────────────────────────────────────────────
  function pushTrade(trade) {
    AuthUtils.apiFetch('/api/user/journal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    }).catch(() => {});
  }
  function deleteTadeFromServer(id) {
    AuthUtils.apiFetch(`/api/user/journal/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  async function syncFromServer() {
    try {
      const r = await fetch('/api/user/journal');
      if (!r.ok) return;
      const { trades: serverTrades } = await r.json();
      if (!serverTrades?.length) return;
      const localIds = new Set(trades.map(t => t.id));
      serverTrades.forEach(st => { if (!localIds.has(st.id)) trades.push(st); });
      save(); renderList();
    } catch { /* silent */ }
  }

  function renderList() {
    const body = document.getElementById('tj-list-body');
    if (!body) return;
    renderStats();

    const shown = filter === 'all' ? trades : trades.filter(t => t.status === filter);
    if (!shown.length) {
      body.innerHTML = '<div class="ae-empty">No trades yet. Click "+ Log Trade" to add one.</div>';
      return;
    }

    body.innerHTML = `
      <table class="wallet-table" style="min-width:780px">
        <thead>
          <tr><th>Symbol</th><th>Dir</th><th>Entry</th><th>SL</th><th>TP</th><th>R:R</th><th>Status</th><th>P&L</th><th>Source</th><th>Date</th><th></th></tr>
        </thead>
        <tbody>
          ${[...shown].reverse().map(t => {
            const pnlCol = t.pnl === null ? '' : t.pnl >= 0 ? 'color:#2dd882' : 'color:#ff5f57';
            const pnlStr = t.pnl === null ? '—' : `${t.pnl>=0?'+':''}$${t.pnl.toFixed(2)} (${t.pnlR>=0?'+':''}${t.pnlR}R)`;
            const dirCol = t.direction === 'LONG' ? '#2dd882' : '#ff5f57';
            const badge  = t.status === 'open'
              ? '<span class="tj-badge tj-open">OPEN</span>'
              : '<span class="tj-badge tj-closed">CLOSED</span>';
            return `<tr>
              <td style="font-weight:700">${esc(t.symbol)}</td>
              <td style="color:${dirCol};font-weight:700">${esc(t.direction)}</td>
              <td>$${t.entry.toLocaleString('en',{maximumFractionDigits:4})}</td>
              <td style="color:#ff5f57">$${t.sl.toLocaleString('en',{maximumFractionDigits:4})}</td>
              <td style="color:#2dd882">$${t.tp.toLocaleString('en',{maximumFractionDigits:4})}</td>
              <td>${esc(String(t.rr))}R</td>
              <td>${badge}</td>
              <td style="${pnlCol};font-weight:700">${esc(pnlStr)}</td>
              <td style="color:var(--color-text-muted);font-size:0.72rem">${esc(t.source)}</td>
              <td style="color:var(--color-text-muted);font-size:0.72rem">${new Date(t.openedAt).toLocaleDateString()}</td>
              <td style="display:flex;gap:0.3rem;padding:0.4rem">
                ${t.status === 'open' ? `<button class="wt-copy-btn" onclick="TradeJournal.openCloseModal('${esc(t.id)}')">Close</button>` : ''}
                <button class="wt-copy-btn" style="color:#ff5f57" onclick="TradeJournal.deleteTrade('${esc(t.id)}')">✕</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function init() {
    if (initialised) { renderSection(); return; }
    initialised = true;
    load();
    renderSection();
    syncFromServer();
  }

  // ── Signal bridge: pre-fill log modal from a SignalBus signal + Kelly data ──

  function logFromSignal(signal, kellyData) {
    openLogModal({
      symbol:    signal.symbol,
      direction: signal.direction,
      price:     signal.price,
      sl:        kellyData?.stopLoss,
      tp:        kellyData?.takeProfit,
      size:      kellyData?.units || 1,
      source:    'signal_engine',
      notes:     [
        `Confidence: ${signal.confidence}%`,
        signal.sources?.length ? `Sources: ${signal.sources.join(', ')}` : '',
        signal.reasons?.length ? signal.reasons.slice(0, 2).join('; ') : '',
      ].filter(Boolean).join(' · '),
    });
  }

  return {
    init, logTrade, closeTrade, deleteTrade, exportCSV, setFilter,
    openLogModal, submitModal, openCloseModal, confirmClose, logFromSignal,
    getTrades: () => trades,
  };
})();

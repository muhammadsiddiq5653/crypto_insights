/* alertEngine.js — Smart Alert Engine with Slack webhook support */
const AlertEngine = (() => {
  function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  const STORE_KEY  = 'trader_alerts';
  const SLACK_KEY  = 'trader_slack_webhook';
  const PRICE_POLL = 60_000; // 60 s

  let alerts      = [];
  let slackWebhook = '';
  let pollTimer   = null;
  let initialised = false;

  // ── Persistence ──────────────────────────────────────────────────────
  function load()  { try { alerts = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { alerts = []; } }
  function save()  { localStorage.setItem(STORE_KEY, JSON.stringify(alerts)); }

  // ── Alert factory ────────────────────────────────────────────────────
  function createAlert({ type, symbol, condition, value, label }) {
    return {
      id: Date.now() + Math.random().toString(36).slice(2),
      type,        // 'price' | 'rsi' | 'signal'
      symbol: symbol.toUpperCase(),
      condition,   // 'above' | 'below' | 'direction'
      value,       // numeric or 'LONG'/'SHORT'
      label: label || `${symbol} ${type} ${condition} ${value}`,
      active: true,
      createdAt: Date.now(),
      firedAt: null,
    };
  }

  // ── Fire alert ───────────────────────────────────────────────────────
  async function fire(alert, currentVal) {
    alert.active  = false;
    alert.firedAt = Date.now();
    save();

    const msg = `🚨 Alert: ${alert.label} [now: ${typeof currentVal === 'number' ? currentVal.toLocaleString('en', { maximumFractionDigits: 4 }) : currentVal}]`;

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('TraderPro Alert', { body: msg, icon: '/favicon.ico' });
    }

    // In-app toast
    showToast(msg, alert.type === 'signal' ? '#6378dc' : '#f59e0b');

    // Slack webhook
    if (slackWebhook) {
      try {
        await AuthUtils.apiFetch('/api/proxy/slack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhook: slackWebhook,
            text: msg,
            attachments: [{
              color: alert.type === 'signal' ? '#6378dc' : '#f59e0b',
              fields: [
                { title: 'Symbol',    value: alert.symbol,                    short: true },
                { title: 'Type',      value: alert.type,                      short: true },
                { title: 'Condition', value: `${alert.condition} ${alert.value}`, short: true },
                { title: 'Triggered', value: new Date(alert.firedAt).toLocaleString(), short: true },
              ],
            }],
          }),
        });
      } catch { /* silent */ }
    }

    renderList();
  }

  // ── Check price alerts ───────────────────────────────────────────────
  async function checkPriceAlerts() {
    const activePrice = alerts.filter(a => a.active && a.type === 'price');
    const activeRsi   = alerts.filter(a => a.active && a.type === 'rsi');
    if (!activePrice.length && !activeRsi.length) return;

    const symbols = [...new Set([...activePrice, ...activeRsi].map(a => a.symbol))];
    for (const sym of symbols) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
        const d = await r.json();
        const price = parseFloat(d.lastPrice);

        activePrice.filter(a => a.symbol === sym).forEach(a => {
          if ((a.condition === 'above' && price >= a.value) ||
              (a.condition === 'below' && price <= a.value)) {
            fire(a, price);
          }
        });

        // RSI — approximate from 24h data (need klines for real RSI, use change as proxy)
        if (activeRsi.filter(a => a.symbol === sym).length) {
          try {
            const kr = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=15`);
            const klines = await kr.json();
            const closes = klines.map(k => parseFloat(k[4]));
            const rsi = calcRSI(closes, 14);
            activeRsi.filter(a => a.symbol === sym).forEach(a => {
              if ((a.condition === 'above' && rsi >= a.value) ||
                  (a.condition === 'below' && rsi <= a.value)) {
                fire(a, rsi);
              }
            });
          } catch { /* skip RSI */ }
        }
      } catch { /* skip symbol */ }
    }
  }

  function calcRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgG = gains / period;
    const avgL = losses / period;
    if (avgL === 0) return 100;
    return 100 - 100 / (1 + avgG / avgL);
  }

  // ── Check SignalBus alerts ───────────────────────────────────────────
  function hookSignalBus() {
    if (typeof SignalBus === 'undefined') return;
    SignalBus.subscribe((ranked, newest) => {
      if (!newest) return;
      const active = alerts.filter(a => a.active && a.type === 'signal');
      active.forEach(a => {
        const matchSym = a.symbol === 'ANY' || a.symbol === newest.symbol;
        const matchDir = a.condition === 'direction' && newest.direction === a.value;
        const matchConf = a.condition === 'confidence' && newest.confidence >= a.value;
        if (matchSym && (matchDir || matchConf)) fire(a, newest.direction);
      });
    });
  }

  // ── Toast ────────────────────────────────────────────────────────────
  function showToast(msg, color = '#f59e0b') {
    let t = document.getElementById('ae-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ae-toast';
      t.className = 'ae-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.borderColor = color;
    t.classList.add('ae-toast-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('ae-toast-show'), 4500);
  }

  // ── Render ───────────────────────────────────────────────────────────
  function renderSection() {
    const el = document.getElementById('alert-engine');
    if (!el) return;

    el.innerHTML = `
      <div class="ae-page">
        <div class="ae-header">
          <div>
            <h2 class="ae-title">🔔 Smart Alert Engine</h2>
            <p class="ae-subtitle">Price, RSI & Signal Bus triggers — delivered to browser + Slack</p>
          </div>
          <button class="ae-notif-btn" id="ae-notif-btn" onclick="AlertEngine.requestNotifPerm()">Enable Notifications</button>
        </div>

        <!-- Slack config -->
        <div class="card ae-slack-card">
          <div class="card-header">
            <span>🔗 Slack Webhook</span>
            <span class="ae-slack-status" id="ae-slack-status"></span>
          </div>
          <div class="card-body">
            <div class="ae-slack-row">
              <input id="ae-slack-input" type="password" placeholder="https://hooks.slack.com/services/…" class="ae-input" />
              <button class="ae-btn ae-btn-primary" onclick="AlertEngine.saveSlack()">Save</button>
              <button class="ae-btn" onclick="AlertEngine.testSlack()">Test</button>
            </div>
            <p class="ae-hint">Go to <strong>api.slack.com/apps</strong> → Incoming Webhooks → copy URL. Every fired alert posts a rich message to your channel.</p>
          </div>
        </div>

        <!-- New alert form -->
        <div class="card">
          <div class="card-header">➕ New Alert</div>
          <div class="card-body">
            <div class="ae-form">
              <div class="ae-form-group">
                <label>Type</label>
                <select id="ae-type" class="ae-select" onchange="AlertEngine.onTypeChange()">
                  <option value="price">Price Cross</option>
                  <option value="rsi">RSI Level</option>
                  <option value="signal">Signal Bus</option>
                </select>
              </div>
              <div class="ae-form-group">
                <label>Symbol</label>
                <select id="ae-symbol" class="ae-select">
                  <option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option>
                  <option>BNBUSDT</option><option>XRPUSDT</option><option>ADAUSDT</option>
                  <option>DOGEUSDT</option><option>AVAXUSDT</option><option>DOTUSDT</option>
                  <option>MATICUSDT</option><option value="ANY">ANY (all symbols)</option>
                </select>
              </div>
              <div class="ae-form-group" id="ae-cond-group">
                <label>Condition</label>
                <select id="ae-condition" class="ae-select">
                  <option value="above">Crosses Above</option>
                  <option value="below">Crosses Below</option>
                </select>
              </div>
              <div class="ae-form-group" id="ae-val-group">
                <label id="ae-val-label">Price (USD)</label>
                <input id="ae-value" type="number" step="any" class="ae-input" placeholder="e.g. 70000" />
              </div>
              <div class="ae-form-group" id="ae-dir-group" style="display:none">
                <label>Direction</label>
                <select id="ae-direction" class="ae-select">
                  <option value="LONG">LONG signal</option>
                  <option value="SHORT">SHORT signal</option>
                </select>
              </div>
              <button class="ae-btn ae-btn-primary" onclick="AlertEngine.addAlert()" style="align-self:flex-end">Add Alert</button>
            </div>
          </div>
        </div>

        <!-- Alert list -->
        <div class="card">
          <div class="card-header">
            <span>Active Alerts</span>
            <span class="ae-count" id="ae-active-count">0 active</span>
          </div>
          <div class="card-body" id="ae-list-body">
            <div class="ae-empty">No alerts set. Add one above.</div>
          </div>
        </div>

        <!-- Fired history -->
        <div class="card" id="ae-history-card" style="display:none">
          <div class="card-header">
            <span>Fired Alerts</span>
            <button class="ae-btn ae-btn-sm" onclick="AlertEngine.clearFired()">Clear</button>
          </div>
          <div class="card-body" id="ae-fired-body"></div>
        </div>
      </div>
    `;

    // Restore slack
    slackWebhook = localStorage.getItem(SLACK_KEY) || '';
    if (slackWebhook) {
      const inp = document.getElementById('ae-slack-input');
      if (inp) inp.value = slackWebhook;
      updateSlackStatus(true);
    }

    updateNotifBtn();
    renderList();
  }

  function onTypeChange() {
    const type = document.getElementById('ae-type')?.value;
    const condGroup = document.getElementById('ae-cond-group');
    const valGroup  = document.getElementById('ae-val-group');
    const dirGroup  = document.getElementById('ae-dir-group');
    const valLabel  = document.getElementById('ae-val-label');
    const condSel   = document.getElementById('ae-condition');

    if (type === 'price') {
      condGroup.style.display = ''; valGroup.style.display = ''; dirGroup.style.display = 'none';
      valLabel.textContent = 'Price (USD)';
      condSel.innerHTML = '<option value="above">Crosses Above</option><option value="below">Crosses Below</option>';
    } else if (type === 'rsi') {
      condGroup.style.display = ''; valGroup.style.display = ''; dirGroup.style.display = 'none';
      valLabel.textContent = 'RSI Level (0-100)';
      condSel.innerHTML = '<option value="above">RSI Above</option><option value="below">RSI Below</option>';
    } else {
      condGroup.style.display = 'none'; valGroup.style.display = 'none'; dirGroup.style.display = '';
    }
  }

  function addAlert() {
    const type      = document.getElementById('ae-type')?.value;
    const symbol    = document.getElementById('ae-symbol')?.value;
    const condition = type === 'signal' ? 'direction' : document.getElementById('ae-condition')?.value;
    const value     = type === 'signal'
      ? document.getElementById('ae-direction')?.value
      : parseFloat(document.getElementById('ae-value')?.value);

    if (type !== 'signal' && (isNaN(value) || value <= 0)) {
      showToast('Enter a valid value', '#ff5f57'); return;
    }

    const sym = symbol === 'ANY' ? 'ANY' : symbol.replace('USDT','');
    const label = type === 'price'  ? `${sym} price ${condition} $${value.toLocaleString()}`
                : type === 'rsi'    ? `${sym} RSI ${condition} ${value}`
                : `${sym === 'ANY' ? 'Any' : sym} ${value} signal on bus`;

    const alert = createAlert({ type, symbol: symbol === 'ANY' ? 'ANY' : symbol.replace('USDT',''), condition, value, label });
    alerts.push(alert);
    save();
    pushToServer(alert);
    renderList();
    showToast(`Alert set: ${label}`, '#2dd882');
  }

  function deleteAlert(id) {
    alerts = alerts.filter(a => a.id !== id);
    save();
    deleteFromServer(id);
    renderList();
  }

  function clearFired() {
    alerts = alerts.filter(a => a.active);
    save();
    renderList();
  }

  function renderList() {
    const body    = document.getElementById('ae-list-body');
    const fBody   = document.getElementById('ae-fired-body');
    const hCard   = document.getElementById('ae-history-card');
    const counter = document.getElementById('ae-active-count');
    if (!body) return;

    const active = alerts.filter(a => a.active);
    const fired  = alerts.filter(a => !a.active);

    if (counter) counter.textContent = `${active.length} active`;

    if (!active.length) {
      body.innerHTML = '<div class="ae-empty">No active alerts.</div>';
    } else {
      body.innerHTML = `
        <table class="ae-table">
          <thead><tr><th>Label</th><th>Type</th><th>Created</th><th></th></tr></thead>
          <tbody>
            ${active.map(a => `
              <tr>
                <td><span class="ae-label-badge ae-type-${esc(a.type)}">${esc(a.type).toUpperCase()}</span> ${esc(a.label)}</td>
                <td style="color:var(--color-text-muted);font-size:0.75rem">${esc(a.symbol)}</td>
                <td style="color:var(--color-text-muted);font-size:0.75rem">${new Date(a.createdAt).toLocaleTimeString()}</td>
                <td><button class="ae-del-btn" onclick="AlertEngine.deleteAlert('${esc(a.id)}')">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (hCard) hCard.style.display = fired.length ? 'block' : 'none';
    if (fBody && fired.length) {
      fBody.innerHTML = `
        <table class="ae-table">
          <thead><tr><th>Label</th><th>Fired At</th></tr></thead>
          <tbody>
            ${fired.slice(-20).reverse().map(a => `
              <tr>
                <td><span class="ae-label-badge ae-type-${esc(a.type)}">${esc(a.type).toUpperCase()}</span> ${esc(a.label)}</td>
                <td style="color:var(--color-text-muted);font-size:0.75rem">${new Date(a.firedAt).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  // ── Slack helpers ────────────────────────────────────────────────────
  function saveSlack() {
    const inp = document.getElementById('ae-slack-input');
    if (!inp) return;
    slackWebhook = inp.value.trim();
    if (slackWebhook) {
      localStorage.setItem(SLACK_KEY, slackWebhook);
      updateSlackStatus(true);
      showToast('Slack webhook saved ✓', '#2dd882');
    }
  }

  async function testSlack() {
    if (!slackWebhook) { showToast('Save a webhook URL first', '#ff5f57'); return; }
    try {
      await AuthUtils.apiFetch('/api/proxy/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook: slackWebhook,
          text: '✅ TraderPro alert engine connected! You will receive trade alerts here.',
        }),
      });
      showToast('Test message sent to Slack ✓', '#2dd882');
    } catch { showToast('Slack test failed — check webhook URL', '#ff5f57'); }
  }

  function updateSlackStatus(ok) {
    const el = document.getElementById('ae-slack-status');
    if (!el) return;
    el.innerHTML = ok
      ? '<span class="ae-slack-ok">● Connected</span>'
      : '<span class="ae-slack-err">● Not set</span>';
  }

  // ── Notification permission ──────────────────────────────────────────
  function requestNotifPerm() {
    Notification.requestPermission().then(p => {
      updateNotifBtn();
      if (p === 'granted') showToast('Browser notifications enabled ✓', '#2dd882');
    });
  }

  function updateNotifBtn() {
    const btn = document.getElementById('ae-notif-btn');
    if (!btn) return;
    const p = Notification.permission;
    if (p === 'granted') { btn.textContent = '✓ Notifications On'; btn.disabled = true; }
    else if (p === 'denied') { btn.textContent = '✕ Blocked'; btn.disabled = true; }
    else { btn.textContent = 'Enable Notifications'; btn.disabled = false; }
  }

  // ── Server sync ───────────────────────────────────────────────────────
  async function syncFromServer() {
    try {
      const r = await fetch('/api/user/alerts');
      if (!r.ok) return;
      const { alerts: serverAlerts } = await r.json();
      if (!serverAlerts?.length) return;
      // Merge: server is source of truth for alerts server doesn't know locally
      const localIds = new Set(alerts.map(a => a.id));
      serverAlerts.forEach(sa => { if (!localIds.has(sa.id)) alerts.push(sa); });
      save();
      renderList();
    } catch { /* silent — server may be offline */ }
  }

  function pushToServer(alert) {
    AuthUtils.apiFetch('/api/user/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    }).catch(() => {});
  }

  function deleteFromServer(id) {
    AuthUtils.apiFetch(`/api/user/alerts/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    if (initialised) { renderSection(); return; }
    initialised = true;
    load();
    slackWebhook = localStorage.getItem(SLACK_KEY) || '';
    renderSection();
    hookSignalBus();
    pollTimer = setInterval(checkPriceAlerts, PRICE_POLL);
    checkPriceAlerts();
    syncFromServer();
  }

  return {
    init, renderSection, addAlert, deleteAlert, clearFired,
    onTypeChange, saveSlack, testSlack, requestNotifPerm,
    showToast,
    // called externally (e.g. from commandCenter)
    fireFromBus: (sig) => {
      const active = alerts.filter(a => a.active && a.type === 'signal');
      active.forEach(a => {
        const matchSym = a.symbol === 'ANY' || a.symbol === sig.symbol;
        if (matchSym && a.value === sig.direction) fire(a, sig.direction);
      });
    },
  };
})();

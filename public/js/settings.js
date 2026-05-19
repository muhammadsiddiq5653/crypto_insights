/* settings.js — Centralised Settings Page (Phase 5) */
const Settings = (() => {
  let initialised = false;

  // ── API helpers ───────────────────────────────────────────────────────
  async function loadKeys() {
    try {
      const r = await fetch('/api/user/keys');
      return r.ok ? (await r.json()).keys : {};
    } catch { return {}; }
  }

  async function saveKeys(payload) {
    const r = await AuthUtils.apiFetch('/api/user/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  }

  // ── Render ────────────────────────────────────────────────────────────
  function renderSection() {
    const el = document.getElementById('settings');
    if (!el) return;

    el.innerHTML = `
      <div class="st-page">
        <div class="tj-header">
          <div>
            <h2 class="ae-title">⚙️ Settings</h2>
            <p class="ae-subtitle">API keys, integrations, and preferences — stored server-side per account</p>
          </div>
        </div>

        <!-- AI Integration -->
        <div class="card st-card">
          <div class="card-header">
            <span>🤖 AI Integration (OpenRouter)</span>
            <span class="st-badge" id="st-or-badge"></span>
          </div>
          <div class="card-body">
            <p class="ae-hint">Powers the AI Trade Engine's enhanced reasoning (Mistral-7B). Free tier available at <strong>openrouter.ai</strong>.</p>
            <div class="st-row">
              <input id="st-or-key" type="password" class="ae-input st-key-input" placeholder="sk-or-v1-…" />
              <button class="ae-btn ae-btn-primary" onclick="Settings.save('openrouter')">Save</button>
            </div>
          </div>
        </div>

        <!-- FRED Macro -->
        <div class="card st-card">
          <div class="card-header">
            <span>🏦 FRED Macro API</span>
            <span class="st-badge" id="st-fred-badge"></span>
          </div>
          <div class="card-body">
            <p class="ae-hint">Free API key from <strong>fred.stlouisfed.org</strong> — powers real CPI, rates, GDP data in Macro Sentiment.</p>
            <div class="st-row">
              <input id="st-fred-key" type="password" class="ae-input st-key-input" placeholder="abcdef1234567890…" />
              <button class="ae-btn ae-btn-primary" onclick="Settings.save('fred')">Save</button>
            </div>
          </div>
        </div>

        <!-- Slack -->
        <div class="card st-card">
          <div class="card-header">
            <span>🔗 Slack Webhook</span>
            <span class="st-badge" id="st-slack-badge"></span>
          </div>
          <div class="card-body">
            <p class="ae-hint">Every fired alert and closed trade posts a rich message to your Slack channel. Get a webhook at <strong>api.slack.com/apps</strong>.</p>
            <div class="st-row">
              <input id="st-slack-key" type="password" class="ae-input st-key-input" placeholder="https://hooks.slack.com/services/…" />
              <button class="ae-btn ae-btn-primary" onclick="Settings.save('slack')">Save</button>
              <button class="ae-btn" onclick="Settings.testSlack()">Test</button>
            </div>
          </div>
        </div>

        <!-- Binance Read-Only -->
        <div class="card st-card">
          <div class="card-header">
            <span>📊 Binance Read-Only API</span>
            <span class="st-badge" id="st-bnb-badge"></span>
          </div>
          <div class="card-body">
            <p class="ae-hint">Create a read-only API key on Binance (no withdrawal permissions). Used to auto-sync your real balances into the Portfolio Tracker.</p>
            <div class="st-section-label">API Key</div>
            <div class="st-row" style="margin-bottom:0.6rem">
              <input id="st-bnb-key" type="password" class="ae-input st-key-input" placeholder="Binance API Key" />
            </div>
            <div class="st-section-label">API Secret</div>
            <div class="st-row">
              <input id="st-bnb-secret" type="password" class="ae-input st-key-input" placeholder="Binance API Secret" />
              <button class="ae-btn ae-btn-primary" onclick="Settings.save('binance')">Save</button>
              <button class="ae-btn" onclick="Settings.testBinance()">Test</button>
            </div>
            <p class="ae-hint" style="margin-top:0.5rem;color:#f59e0b">⚠ Only ever enter read-only keys. Never grant withdrawal permissions.</p>
          </div>
        </div>

        <!-- 2FA -->
        <div class="card st-card">
          <div class="card-header">
            <span>🔐 Two-Factor Authentication (TOTP)</span>
            <span class="st-badge" id="st-2fa-badge"></span>
          </div>
          <div class="card-body">
            <p class="ae-hint">Use an authenticator app (Google Authenticator, Authy, 1Password) to require a 6-digit code on every login.</p>
            <div id="st-2fa-body" style="margin-top:0.75rem"></div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="card st-card">
          <div class="card-header">🔔 Browser Notifications</div>
          <div class="card-body">
            <div class="st-notif-row">
              <div>
                <div style="font-weight:600;margin-bottom:0.25rem">Permission status: <span id="st-notif-status" style="font-weight:700"></span></div>
                <p class="ae-hint">Required for alerts to fire as browser notifications even if you're on a different tab.</p>
              </div>
              <button class="ae-btn ae-btn-primary" id="st-notif-btn" onclick="Settings.requestNotif()">Enable</button>
            </div>
          </div>
        </div>

        <!-- Plan & Billing -->
        <div class="card st-card" id="st-billing-card">
          <div class="card-header">
            <span>💳 Plan &amp; Billing</span>
            <span id="st-plan-badge" class="st-badge"></span>
          </div>
          <div class="card-body" id="st-billing-body">
            <p class="ae-hint" style="margin-bottom:0.75rem">Loading plan status…</p>
          </div>
        </div>

        <!-- Data Management -->
        <div class="card st-card">
          <div class="card-header">💾 Data & Sync</div>
          <div class="card-body">
            <p class="ae-hint">Your alerts, journal, and portfolio are stored in the server database and synced to localStorage. Use the buttons below to force a full sync.</p>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.75rem">
              <button class="ae-btn" onclick="Settings.syncAll()">↻ Sync all data from server</button>
              <button class="ae-btn" onclick="Settings.pushAll()">↑ Push localStorage to server</button>
              <button class="ae-btn" style="color:#ff5f57;border-color:rgba(255,95,87,0.3)" onclick="Settings.clearLocal()">🗑 Clear localStorage</button>
            </div>
            <div id="st-sync-status" style="margin-top:0.75rem;font-size:0.78rem;color:var(--color-text-muted)"></div>
          </div>
        </div>
      </div>
    `;

    loadAndFill();
    updateNotifStatus();
    load2faStatus();
    loadBillingCard();
  }

  async function loadBillingCard() {
    const body  = document.getElementById('st-billing-body');
    const badge = document.getElementById('st-plan-badge');
    if (!body) return;

    try {
      const r    = await fetch('/api/auth/me');
      const data = r.ok ? await r.json() : null;
      const user = data?.user || state.currentUser;
      const plan = user?.plan || 'free';
      const isPro = plan === 'pro';

      if (badge) {
        badge.textContent = isPro ? 'Pro' : 'Free';
        badge.style.color = isPro ? '#a5b4fc' : '#6b7280';
        badge.style.border = isPro ? '1px solid rgba(99,120,220,0.4)' : '1px solid rgba(255,255,255,0.1)';
      }

      if (isPro) {
        const expiry = user.plan_expires_at
          ? new Date(user.plan_expires_at * 1000).toLocaleDateString()
          : null;
        body.innerHTML = `
          <p class="ae-hint">You're on the <strong style="color:#a5b4fc">Pro plan</strong>.
          ${expiry ? `Renews / expires: <strong>${expiry}</strong>.` : 'Subscription managed via Stripe.'}</p>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
            <a href="/api/billing/portal" class="ae-btn ae-btn-primary" id="st-portal-btn">Manage subscription →</a>
          </div>
          <p class="ae-hint" style="margin-top:0.6rem;font-size:0.75rem">
            Cancel, update payment method, or download invoices via the Stripe Customer Portal.
          </p>`;
      } else {
        body.innerHTML = `
          <p class="ae-hint">You're on the <strong>Free plan</strong>. Upgrade to Pro to unlock AI signals, ML predictions, whale alerts, and more.</p>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
            <button class="ae-btn ae-btn-primary" id="st-upgrade-btn">🚀 Upgrade to Pro — $20/mo</button>
          </div>`;

        document.getElementById('st-upgrade-btn')?.addEventListener('click', async () => {
          const btn = document.getElementById('st-upgrade-btn');
          btn.textContent = 'Loading…';
          btn.disabled = true;
          try {
            const res  = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const json = await res.json();
            if (json.url) { window.location.href = json.url; }
            else { btn.textContent = json.error || 'Error — try again'; btn.disabled = false; }
          } catch { btn.textContent = 'Error — try again'; btn.disabled = false; }
        });
      }
    } catch {
      if (body) body.innerHTML = '<p class="ae-hint">Unable to load billing status.</p>';
    }
  }

  async function loadAndFill() {
    const keys = await loadKeys();
    setBadge('st-or-badge',   keys.openrouter_key_set);
    setBadge('st-fred-badge', keys.fred_key_set);
    setBadge('st-slack-badge',keys.slack_webhook_set);
    setBadge('st-bnb-badge',  keys.binance_api_key_set);

    // Also sync localStorage so client modules have the keys immediately
    if (keys.slack_webhook_set) {
      // We can't get the real value (masked), but it's on the server — the proxy handles it
    }
  }

  function setBadge(id, isSet) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent  = isSet ? '● Configured' : '○ Not set';
    el.style.color  = isSet ? '#2dd882' : 'var(--color-text-muted)';
    el.style.fontSize = '0.72rem';
    el.style.fontWeight = '700';
  }

  async function save(service) {
    let payload = {};
    let input;
    switch (service) {
      case 'openrouter':
        input = document.getElementById('st-or-key');
        payload.openrouter_key = input?.value?.trim();
        if (payload.openrouter_key) localStorage.setItem('llm_openrouter_key', payload.openrouter_key);
        break;
      case 'fred':
        input = document.getElementById('st-fred-key');
        payload.fred_key = input?.value?.trim();
        break;
      case 'slack':
        input = document.getElementById('st-slack-key');
        payload.slack_webhook = input?.value?.trim();
        if (payload.slack_webhook) localStorage.setItem('trader_slack_webhook', payload.slack_webhook);
        break;
      case 'binance':
        payload.binance_api_key = document.getElementById('st-bnb-key')?.value?.trim();
        payload.binance_secret  = document.getElementById('st-bnb-secret')?.value?.trim();
        break;
    }

    // Strip empty values
    Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
    if (!Object.keys(payload).length) { toast('Nothing to save', '#f59e0b'); return; }

    const ok = await saveKeys(payload);
    if (ok) {
      toast(`${service.charAt(0).toUpperCase() + service.slice(1)} key saved ✓`, '#2dd882');
      if (input) input.value = '';
      loadAndFill();
    } else {
      toast('Save failed — please try again', '#ff5f57');
    }
  }

  async function testSlack() {
    const hook = document.getElementById('st-slack-key')?.value?.trim()
              || localStorage.getItem('trader_slack_webhook');
    if (!hook) { toast('Enter a Slack webhook URL first', '#f59e0b'); return; }
    try {
      const r = await AuthUtils.apiFetch('/api/proxy/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook: hook, text: '✅ TraderPro Settings test — Slack is connected!' }),
      });
      toast(r.ok ? 'Test message sent ✓' : 'Send failed — check URL', r.ok ? '#2dd882' : '#ff5f57');
    } catch { toast('Network error', '#ff5f57'); }
  }

  async function testBinance() {
    toast('Testing Binance connection…', '#f59e0b');
    try {
      const r = await fetch('/api/user/binance/balances');
      if (r.ok) {
        const d = await r.json();
        toast(`Binance connected ✓ — ${d.balances?.length ?? 0} non-zero assets`, '#2dd882');
      } else {
        const e = await r.json();
        toast(`Binance error: ${e.error}`, '#ff5f57');
      }
    } catch { toast('Network error', '#ff5f57'); }
  }

  // ── Sync helpers ──────────────────────────────────────────────────────
  async function syncAll() {
    const statusEl = document.getElementById('st-sync-status');
    if (statusEl) statusEl.textContent = 'Syncing from server…';
    try {
      const [alertsR, journalR, portfolioR] = await Promise.all([
        fetch('/api/user/alerts'),
        fetch('/api/user/journal'),
        fetch('/api/user/portfolio'),
      ]);
      const [alertsD, journalD, portfolioD] = await Promise.all([
        alertsR.json(), journalR.json(), portfolioR.json(),
      ]);
      if (alertsD.ok)    localStorage.setItem('trader_alerts',    JSON.stringify(alertsD.alerts));
      if (journalD.ok)   localStorage.setItem('trader_journal',   JSON.stringify(journalD.trades));
      if (portfolioD.ok) localStorage.setItem('trader_portfolio', JSON.stringify(portfolioD.holdings));
      const msg = `Synced — ${alertsD.alerts?.length ?? 0} alerts · ${journalD.trades?.length ?? 0} trades · ${portfolioD.holdings?.length ?? 0} holdings`;
      if (statusEl) statusEl.textContent = msg;
      toast(msg, '#2dd882');
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Sync failed: ' + err.message;
      toast('Sync failed', '#ff5f57');
    }
  }

  async function pushAll() {
    const statusEl = document.getElementById('st-sync-status');
    if (statusEl) statusEl.textContent = 'Pushing to server…';
    let pushed = 0;
    try {
      const alerts    = JSON.parse(localStorage.getItem('trader_alerts')    || '[]');
      const journal   = JSON.parse(localStorage.getItem('trader_journal')   || '[]');
      const portfolio = JSON.parse(localStorage.getItem('trader_portfolio') || '[]');

      for (const a of alerts)    { await AuthUtils.apiFetch('/api/user/alerts',    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(a) }); pushed++; }
      for (const t of journal)   { await AuthUtils.apiFetch('/api/user/journal',   { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(t) }); pushed++; }
      for (const h of portfolio) { await AuthUtils.apiFetch('/api/user/portfolio', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(h) }); pushed++; }

      const msg = `Pushed ${pushed} records to server ✓`;
      if (statusEl) statusEl.textContent = msg;
      toast(msg, '#2dd882');
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Push failed: ' + err.message;
      toast('Push failed', '#ff5f57');
    }
  }

  function clearLocal() {
    if (!confirm('Clear all local data (alerts, journal, portfolio)? Server data is unaffected.')) return;
    ['trader_alerts','trader_journal','trader_portfolio'].forEach(k => localStorage.removeItem(k));
    toast('Local data cleared', '#f59e0b');
  }

  // ── Notifications ─────────────────────────────────────────────────────
  function updateNotifStatus() {
    const el  = document.getElementById('st-notif-status');
    const btn = document.getElementById('st-notif-btn');
    if (!el) return;
    const p = Notification.permission;
    el.textContent = p;
    el.style.color = p === 'granted' ? '#2dd882' : p === 'denied' ? '#ff5f57' : '#f59e0b';
    if (btn) { btn.disabled = p !== 'default'; btn.textContent = p === 'granted' ? '✓ Enabled' : 'Enable'; }
  }

  function requestNotif() {
    Notification.requestPermission().then(updateNotifStatus);
  }

  // ── Toast ─────────────────────────────────────────────────────────────
  function toast(msg, color) {
    if (typeof AlertEngine !== 'undefined') { AlertEngine.showToast(msg, color); return; }
    let t = document.getElementById('ae-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ae-toast'; t.className = 'ae-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.borderColor = color;
    t.classList.add('ae-toast-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('ae-toast-show'), 4000);
  }

  // ── 2FA management ────────────────────────────────────────────────────
  async function load2faStatus() {
    const badge = document.getElementById('st-2fa-badge');
    const body  = document.getElementById('st-2fa-body');
    if (!body) return;
    try {
      const r    = await fetch('/api/auth/2fa/status', { credentials: 'include' });
      const data = await r.json();
      if (data.enabled) {
        if (badge) { badge.textContent = '● Enabled'; badge.style.color = '#2dd882'; badge.style.fontSize = '0.72rem'; badge.style.fontWeight = '700'; }
        body.innerHTML = '';
        const p = document.createElement('p'); p.className = 'ae-hint'; p.style.color = '#2dd882';
        p.textContent = '✓ 2FA is active. Every login requires your authenticator code.';
        const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.75rem;align-items:center';
        const pwInp = document.createElement('input'); pwInp.type = 'password'; pwInp.id = 'st-2fa-disable-pw';
        pwInp.className = 'ae-input st-key-input'; pwInp.placeholder = 'Your password to disable';
        const btn = document.createElement('button'); btn.className = 'ae-btn'; btn.style.color = '#ff5f57'; btn.style.borderColor = 'rgba(255,95,87,0.3)';
        btn.textContent = 'Disable 2FA';
        btn.addEventListener('click', () => disable2fa());
        row.appendChild(pwInp); row.appendChild(btn);
        body.appendChild(p); body.appendChild(row);
      } else {
        if (badge) { badge.textContent = '○ Disabled'; badge.style.color = 'var(--color-text-muted)'; badge.style.fontSize = '0.72rem'; badge.style.fontWeight = '700'; }
        body.innerHTML = '';
        const btn = document.createElement('button'); btn.className = 'ae-btn ae-btn-primary';
        btn.textContent = '+ Enable 2FA';
        btn.addEventListener('click', () => setup2fa());
        body.appendChild(btn);
      }
    } catch { /* not logged in or server error */ }
  }

  async function setup2fa() {
    const body = document.getElementById('st-2fa-body');
    if (!body) return;
    toast('Generating 2FA secret…', '#f59e0b');
    try {
      const csrf = await AuthUtils.getCsrf();
      const r    = await fetch('/api/auth/2fa/setup', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      body.innerHTML = '';

      const p = document.createElement('p'); p.className = 'ae-hint';
      p.textContent = 'Scan this QR code with your authenticator app, then enter the 6-digit code below to confirm.';
      const img = document.createElement('img'); img.src = data.qr;
      img.style.cssText = 'display:block;margin:0.75rem auto;border-radius:8px;width:180px;height:180px';

      const secretNote = document.createElement('p'); secretNote.className = 'ae-hint';
      secretNote.style.cssText = 'text-align:center;word-break:break-all;font-family:monospace;font-size:0.78rem;margin:0.5rem 0';
      secretNote.textContent = data.secret;

      const row   = document.createElement('div'); row.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.75rem';
      const input = document.createElement('input'); input.type = 'text'; input.id = 'st-2fa-code';
      input.className = 'ae-input'; input.placeholder = '6-digit code'; input.inputMode = 'numeric';
      input.maxLength = 6; input.style.cssText = 'letter-spacing:0.2em;font-size:1.1rem;text-align:center;width:140px';
      const btn = document.createElement('button'); btn.className = 'ae-btn ae-btn-primary'; btn.textContent = 'Verify & Enable';
      btn.addEventListener('click', () => verify2fa());
      row.appendChild(input); row.appendChild(btn);

      body.appendChild(p); body.appendChild(img); body.appendChild(secretNote); body.appendChild(row);
    } catch { toast('Error setting up 2FA', '#ff5f57'); }
  }

  async function verify2fa() {
    const code = document.getElementById('st-2fa-code')?.value?.trim();
    if (!code || code.length !== 6) { toast('Enter a 6-digit code', '#f59e0b'); return; }
    try {
      const csrf = await AuthUtils.getCsrf();
      const r    = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ token: code }),
      });
      const data = await r.json();
      if (data.success) {
        toast('2FA enabled ✓', '#2dd882');
        load2faStatus();
      } else {
        toast(data.error || 'Invalid code', '#ff5f57');
      }
    } catch { toast('Network error', '#ff5f57'); }
  }

  async function disable2fa() {
    const password = document.getElementById('st-2fa-disable-pw')?.value;
    if (!password) { toast('Enter your password to disable 2FA', '#f59e0b'); return; }
    try {
      const csrf = await AuthUtils.getCsrf();
      const r    = await fetch('/api/auth/2fa/disable', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ password }),
      });
      const data = await r.json();
      if (data.success) {
        toast('2FA disabled', '#f59e0b');
        load2faStatus();
      } else {
        toast(data.error || 'Failed', '#ff5f57');
      }
    } catch { toast('Network error', '#ff5f57'); }
  }

  function init() {
    if (initialised) { renderSection(); return; }
    initialised = true;
    renderSection();
  }

  return { init, save, testSlack, testBinance, syncAll, pushAll, clearLocal, requestNotif };
})();

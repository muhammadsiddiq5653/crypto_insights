/**
 * Command Center — Unified trading dashboard
 *
 * Renders a live, ranked feed of all signals emitted by SignalBus.
 * Shows: Signal Radar (ranked table) · Market Tape · Active Signal Detail panel.
 * Auto-updates whenever any module emits a new signal.
 */

const CommandCenter = (() => {
  // Escape HTML to prevent XSS when rendering API/signal data into innerHTML templates
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  let unsubscribe    = null;
  let initialised    = false;
  let selectedSymbol = null;
  let liveTimer      = null;

  // ── Init ───────────────────────────────────────────────────────────────

  function init() {
    const el = document.getElementById('command-center');
    if (!el || initialised) return;
    initialised = true;

    renderShell(el);
    startLiveClock();

    // Subscribe to signal bus — re-render radar on every update
    unsubscribe = SignalBus.subscribe((ranked, latest) => {
      renderRadar(ranked);
      if (latest) flashNewSignal(latest);
    });

    // Seed bus with cockpit data for BTC if already loaded
    if (typeof TradingCockpit !== 'undefined') {
      const cached = TradingCockpit.COINS.reduce((acc, c) => {
        const d = window._cockpitCache?.[c.symbol];
        if (d) acc.push({ coin: c, data: d });
        return acc;
      }, []);
      cached.forEach(({ coin, data }) => SignalBus.seedFromCockpit(coin, data));
    }

    // Trigger cockpit data load for all major coins to populate the bus
    seedAllCoins();
  }

  // ── Seed all coins from Binance klines (no extra API key needed) ───────

  async function seedAllCoins() {
    const COINS = [
      { symbol: 'BTC', binance: 'BTCUSDT' },
      { symbol: 'ETH', binance: 'ETHUSDT' },
      { symbol: 'SOL', binance: 'SOLUSDT' },
      { symbol: 'BNB', binance: 'BNBUSDT' },
      { symbol: 'XRP', binance: 'XRPUSDT' },
      { symbol: 'ADA', binance: 'ADAUSDT' },
      { symbol: 'AVAX',binance: 'AVAXUSDT'},
      { symbol: 'DOGE',binance: 'DOGEUSDT'},
      { symbol: 'LINK',binance: 'LINKUSDT'},
      { symbol: 'DOT', binance: 'DOTUSDT' },
    ];

    updateStatus('Scanning ' + COINS.length + ' markets…');

    const results = await Promise.allSettled(
      COINS.map(c => scanCoin(c))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    updateStatus('Live · ' + successCount + ' markets scanned · Updates every 3 min');
  }

  async function scanCoin(coin) {
    const [tickerRes, klinesRes] = await Promise.allSettled([
      fetch(`/api/proxy/binance/ticker/${coin.binance}`).then(r => r.json()),
      fetch(`/api/proxy/binance/klines?symbol=${coin.binance}&interval=1h&limit=60`).then(r => r.json()),
    ]);

    const tickerRaw = tickerRes.status === 'fulfilled' ? (tickerRes.value?.data ?? tickerRes.value) : null;
    const klinesRaw = klinesRes.status === 'fulfilled' ? (klinesRes.value?.data ?? klinesRes.value) : null;

    const price = tickerRaw?.lastPrice ? parseFloat(tickerRaw.lastPrice) : null;

    if (!klinesRaw || !Array.isArray(klinesRaw) || klinesRaw.length < 20) return;

    const closes  = klinesRaw.map(k => parseFloat(k[4]));
    const volumes = klinesRaw.map(k => parseFloat(k[5]));

    // RSI(14)
    const gains = [], losses = [];
    for (let i = 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    const avgG = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgL = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsi  = +(100 - 100 / (1 + (avgL === 0 ? 100 : avgG / avgL))).toFixed(1);

    // SMA20/50
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : sma20;

    // EMA12/26 → MACD
    const ema = (arr, p) => { const k = 2/(p+1); let v = arr[0]; arr.forEach((x,i) => { if(i>0) v = x*k + v*(1-k); }); return v; };
    const macd = ema(closes, 12) - ema(closes, 26);

    // Volume spike
    const volAvg  = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const volRatio = volAvg > 0 ? volumes[volumes.length - 1] / volAvg : 1;

    // Score
    let score = 0;
    const reasons = [];
    if (rsi < 30)       { score += 3; reasons.push(`RSI ${rsi} — strongly oversold`); }
    else if (rsi < 40)  { score += 2; reasons.push(`RSI ${rsi} — approaching oversold`); }
    else if (rsi > 70)  { score -= 3; reasons.push(`RSI ${rsi} — strongly overbought`); }
    else if (rsi > 60)  { score -= 2; reasons.push(`RSI ${rsi} — approaching overbought`); }

    if (price > sma20)  { score += 1; reasons.push('Above SMA20 — short-term uptrend'); }
    else                { score -= 1; reasons.push('Below SMA20 — short-term downtrend'); }
    if (price > sma50)  { score += 1; reasons.push('Above SMA50 — medium-term uptrend'); }
    if (macd > 0)       { score += 1; reasons.push('MACD positive — bullish momentum'); }
    else                { score -= 1; reasons.push('MACD negative — bearish momentum'); }
    if (volRatio > 1.8) reasons.push(`Volume spike ${volRatio.toFixed(1)}x — confirms move`);

    const direction  = score >= 3 ? 'LONG' : score <= -3 ? 'SHORT' : 'NEUTRAL';
    const confidence = Math.min(95, Math.max(35, 50 + Math.abs(score) * 7));

    SignalBus.emit({ symbol: coin.symbol, direction, confidence, source: 'technical', reasons, price });
  }

  // ── Shell ──────────────────────────────────────────────────────────────

  function renderShell(el) {
    el.innerHTML = `
      <div class="cc-page">

        <!-- Header bar -->
        <div class="cc-header">
          <div class="cc-header-left">
            <div class="cc-title">⚡ Command Center</div>
            <div class="cc-subtitle" id="cc-status">Scanning markets…</div>
          </div>
          <div class="cc-header-right">
            <div class="cc-live-dot"><span class="cc-pulse"></span> LIVE</div>
            <div class="cc-clock" id="cc-clock">--:--:--</div>
            <button class="cc-refresh-btn" onclick="CommandCenter.refresh()" title="Rescan all markets">↺ Rescan</button>
          </div>
        </div>

        <!-- Main grid -->
        <div class="cc-grid">

          <!-- Left: Signal Radar -->
          <div class="cc-panel cc-radar-panel">
            <div class="cc-panel-header">
              <span>📡 Signal Radar</span>
              <span class="cc-panel-sub" id="cc-radar-count">—</span>
            </div>
            <div id="cc-radar" class="cc-radar-list">
              <div class="cc-empty">Scanning markets… <div class="spinner-sm"></div></div>
            </div>
          </div>

          <!-- Right: Detail panel + market context -->
          <div class="cc-right-col">

            <!-- Selected signal detail -->
            <div class="cc-panel cc-detail-panel" id="cc-detail-panel">
              <div class="cc-panel-header"><span>🎯 Signal Detail</span></div>
              <div id="cc-detail-body" class="cc-detail-empty">
                <div class="cc-detail-hint">← Click a signal to see full breakdown</div>
              </div>
            </div>

            <!-- Market context strip -->
            <div class="cc-panel cc-context-panel">
              <div class="cc-panel-header"><span>🌍 Market Context</span></div>
              <div id="cc-context-body" class="cc-context-grid">
                <div class="cc-ctx-item" id="cc-ctx-fg">
                  <div class="cc-ctx-label">Fear &amp; Greed</div>
                  <div class="cc-ctx-value" id="cc-fg-value">—</div>
                </div>
                <div class="cc-ctx-item">
                  <div class="cc-ctx-label">Long Signals</div>
                  <div class="cc-ctx-value cc-bull" id="cc-long-count">0</div>
                </div>
                <div class="cc-ctx-item">
                  <div class="cc-ctx-label">Short Signals</div>
                  <div class="cc-ctx-value cc-bear" id="cc-short-count">0</div>
                </div>
                <div class="cc-ctx-item">
                  <div class="cc-ctx-label">Avg Confidence</div>
                  <div class="cc-ctx-value" id="cc-avg-conf">—</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Toast for new signals -->
        <div class="cc-toast" id="cc-toast"></div>

      </div>
    `;

    fetchFearGreed();
  }

  // ── Radar render ───────────────────────────────────────────────────────

  function renderRadar(ranked) {
    const el = document.getElementById('cc-radar');
    if (!el) return;

    const countEl = document.getElementById('cc-radar-count');
    if (countEl) countEl.textContent = ranked.length + ' assets';

    if (!ranked.length) {
      el.innerHTML = '<div class="cc-empty">No signals yet. Scanning markets…</div>';
      return;
    }

    el.innerHTML = ranked.map(sig => {
      const isLong  = sig.direction === 'LONG';
      const isShort = sig.direction === 'SHORT';
      const dirClass = isLong ? 'cc-long' : isShort ? 'cc-short' : 'cc-neutral';
      const dirLabel = isLong ? '▲ LONG' : isShort ? '▼ SHORT' : '— NEUTRAL';
      const active   = sig.symbol === selectedSymbol ? 'cc-row-active' : '';
      const price    = sig.price ? formatCCPrice(sig.price) : '—';
      const sourceList = sig.sources.map(s => esc(SOURCE_LABEL[s] || s)).join(' · ');
      const barW = sig.direction === 'NEUTRAL' ? 20 : sig.confidence;

      return `
        <div class="cc-radar-row ${dirClass} ${active}" onclick="CommandCenter.selectSignal('${esc(sig.symbol)}')">
          <div class="cc-row-left">
            <span class="cc-sym">${esc(sig.symbol)}</span>
            <span class="cc-price">${esc(price)}</span>
          </div>
          <div class="cc-row-center">
            <span class="cc-dir-badge ${dirClass}">${dirLabel}</span>
            <div class="cc-conf-track">
              <div class="cc-conf-fill ${dirClass}" style="width:${barW}%"></div>
            </div>
          </div>
          <div class="cc-row-right">
            <span class="cc-conf-num">${esc(String(sig.confidence))}%</span>
            <span class="cc-sources">${sourceList}</span>
          </div>
        </div>
      `;
    }).join('');

    updateContextStrip(ranked);
  }

  // ── Detail panel ───────────────────────────────────────────────────────

  function selectSignal(symbol) {
    selectedSymbol = symbol;
    const ranked   = SignalBus.getRanked();
    const sig      = ranked.find(s => s.symbol === symbol);
    const body     = document.getElementById('cc-detail-body');
    if (!body || !sig) return;

    // Re-highlight active row
    document.querySelectorAll('.cc-radar-row').forEach(r => r.classList.remove('cc-row-active'));
    document.querySelectorAll('.cc-radar-row').forEach(r => {
      if (r.querySelector('.cc-sym')?.textContent === symbol) r.classList.add('cc-row-active');
    });

    const isLong   = sig.direction === 'LONG';
    const isShort  = sig.direction === 'SHORT';
    const dirClass = isLong ? 'cc-long' : isShort ? 'cc-short' : 'cc-neutral';
    const price    = sig.price || 0;
    const sl       = isLong  ? (price * 0.95).toFixed(price > 100 ? 2 : 6)
                   : isShort ? (price * 1.05).toFixed(price > 100 ? 2 : 6) : '—';
    const tp1      = isLong  ? (price * 1.08).toFixed(price > 100 ? 2 : 6)
                   : isShort ? (price * 0.93).toFixed(price > 100 ? 2 : 6) : '—';
    const tp2      = isLong  ? (price * 1.15).toFixed(price > 100 ? 2 : 6)
                   : isShort ? (price * 0.87).toFixed(price > 100 ? 2 : 6) : '—';

    // Kelly quick size (with 55% assumed win rate)
    const p = 0.55, b = 2.0, q = 1 - p;
    const kelly = Math.max(0, (b * p - q) / b) * 0.25;
    const kellyPct = (kelly * 100).toFixed(1);

    const sourceRows = sig.sources.map(s =>
      `<div class="cc-det-source"><span class="cc-src-dot"></span>${SOURCE_LABEL[s] || s}</div>`
    ).join('');

    const reasonList = sig.reasons.map(r => `<li>${r}</li>`).join('');

    const updatedAgo = timeAgo(sig.updatedAt);

    body.innerHTML = `
      <div class="cc-detail-inner">
        <div class="cc-det-hero ${dirClass}">
          <div class="cc-det-sym">${sig.symbol}</div>
          <div class="cc-det-dir ${dirClass}">${isLong ? '▲ LONG' : isShort ? '▼ SHORT' : '— NEUTRAL'}</div>
          <div class="cc-det-conf">${sig.confidence}% confidence</div>
          <div class="cc-det-bar-bg"><div class="cc-det-bar ${dirClass}" style="width:${sig.confidence}%"></div></div>
          <div class="cc-det-meta">${sig.signalCount} source${sig.signalCount !== 1 ? 's' : ''} · updated ${updatedAgo}</div>
        </div>

        ${price ? `
        <div class="cc-det-levels">
          <div class="cc-det-level entry"><div class="cdl-label">Entry</div><div class="cdl-val">${formatCCPrice(price)}</div></div>
          ${sig.direction !== 'NEUTRAL' ? `
          <div class="cc-det-level sl"><div class="cdl-label">Stop Loss</div><div class="cdl-val cc-bear">${formatCCPrice(parseFloat(sl))}</div></div>
          <div class="cc-det-level tp"><div class="cdl-label">TP1 (+8%)</div><div class="cdl-val cc-bull">${formatCCPrice(parseFloat(tp1))}</div></div>
          <div class="cc-det-level tp"><div class="cdl-label">TP2 (+15%)</div><div class="cdl-val cc-bull">${formatCCPrice(parseFloat(tp2))}</div></div>
          ` : ''}
        </div>
        ` : ''}

        <div class="cc-det-section">
          <div class="cc-det-section-title">Signal Sources (${sig.signalCount})</div>
          <div class="cc-det-sources">${sourceRows}</div>
        </div>

        ${sig.reasons.length ? `
        <div class="cc-det-section">
          <div class="cc-det-section-title">Why This Signal</div>
          <ul class="cc-det-reasons">${reasonList}</ul>
        </div>
        ` : ''}

        ${sig.direction !== 'NEUTRAL' ? `
        <div class="cc-det-section">
          <div class="cc-det-section-title">Kelly Position Size</div>
          <div class="cc-det-kelly">Recommended: <strong>${kellyPct}% of capital</strong> (quarter-Kelly, 55% win rate assumed)</div>
        </div>
        ` : ''}

        <div class="cc-det-actions">
          <button class="cc-btn-analyze" onclick="CommandCenter.openActionPanel('${esc(sig.symbol)}')">
            🤖 Analyze &amp; Trade →
          </button>
          <button class="cc-btn-secondary" onclick="switchSection('dashboard'); TradingCockpit.selectCoin('${sig.symbol}')">
            Open in Cockpit
          </button>
          <button class="cc-btn-alert" onclick="AlertEngine.init(); switchSection('alert-engine')">
            🔔 Set Alert
          </button>
        </div>

        <div class="cc-det-disclaimer">⚠ Not financial advice. Auto-generated from technical indicators.</div>
      </div>
    `;
  }

  // ── Context strip ──────────────────────────────────────────────────────

  function updateContextStrip(ranked) {
    const longs  = ranked.filter(s => s.direction === 'LONG').length;
    const shorts = ranked.filter(s => s.direction === 'SHORT').length;
    const active = ranked.filter(s => s.direction !== 'NEUTRAL');
    const avgConf = active.length
      ? Math.round(active.reduce((sum, s) => sum + s.confidence, 0) / active.length)
      : 0;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('cc-long-count',  longs);
    setEl('cc-short-count', shorts);
    setEl('cc-avg-conf',    avgConf ? avgConf + '%' : '—');
  }

  async function fetchFearGreed() {
    try {
      const res  = await fetch('/api/proxy/feargreed');
      const json = await res.json();
      const raw  = json?.data ?? json;
      const val  = raw?.data?.[0]?.value;
      const lbl  = raw?.data?.[0]?.value_classification;
      if (val) {
        const el = document.getElementById('cc-fg-value');
        if (el) {
          el.textContent = val + ' — ' + lbl;
          el.style.color = parseInt(val) < 40 ? '#ff5f57' : parseInt(val) > 60 ? '#2dd882' : '#f59e0b';
        }
      }
    } catch(e) {}
  }

  // ── New signal toast ───────────────────────────────────────────────────

  function flashNewSignal(sig) {
    if (sig.direction === 'NEUTRAL') return;
    const el = document.getElementById('cc-toast');
    if (!el) return;
    const icon = sig.direction === 'LONG' ? '▲' : '▼';
    const col  = sig.direction === 'LONG' ? '#2dd882' : '#ff5f57';
    el.innerHTML = `<span style="color:${col}">${icon} ${sig.symbol}</span> ${sig.direction} · ${sig.confidence}% · ${SOURCE_LABEL[sig.source] || sig.source}`;
    el.classList.add('cc-toast-show');
    setTimeout(() => el.classList.remove('cc-toast-show'), 4000);
  }

  // ── Live clock ─────────────────────────────────────────────────────────

  function startLiveClock() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(() => {
      const el = document.getElementById('cc-clock');
      if (el) el.textContent = new Date().toLocaleTimeString();
    }, 1000);
  }

  function updateStatus(msg) {
    const el = document.getElementById('cc-status');
    if (el) el.textContent = msg;
  }

  // ── Refresh ────────────────────────────────────────────────────────────

  function refresh() {
    updateStatus('Rescanning…');
    seedAllCoins();
    fetchFearGreed();
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  const SOURCE_LABEL = {
    mtf_consensus:  'MTF',
    technical:      'Technical',
    news_sentiment: 'News',
    onchain:        'On-Chain',
    polymarket:     'Polymarket',
    screener:       'Screener',
    ml_prediction:  'ML Model',
    autotrade:      'AutoTrade',
  };

  function formatCCPrice(p) {
    if (!p || isNaN(p)) return '—';
    if (p >= 1000) return '$' + p.toLocaleString('en', { maximumFractionDigits: 2 });
    if (p >= 1)    return '$' + p.toFixed(4);
    return '$' + p.toFixed(6);
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)   return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return Math.floor(diff / 3600) + 'h ago';
  }

  function openActionPanel(symbol) {
    const sig = SignalBus.getRanked().find(s => s.symbol === symbol);
    if (sig && typeof SignalActionPanel !== 'undefined') {
      SignalActionPanel.open(sig);
    }
  }

  return { init, selectSignal, refresh, openActionPanel };

})();

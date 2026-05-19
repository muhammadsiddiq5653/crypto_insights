/* tickerStrip.js — Persistent live price WebSocket ticker */
const TickerStrip = (() => {
  const SYMBOLS = [
    'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
    'ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','MATICUSDT',
    'LINKUSDT','LTCUSDT','ATOMUSDT','NEARUSDT','APTUSDT',
  ];

  const WS_URL = `wss://stream.binance.com:9443/stream?streams=${
    SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join('/')
  }`;

  let ws       = null;
  let prices   = {};
  let retryN   = 0;
  let retryTimer = null;
  let paused   = false;

  // ── WebSocket ─────────────────────────────────────────────────────────
  function connect() {
    if (ws && ws.readyState <= 1) return;
    ws = new WebSocket(WS_URL);

    ws.onopen = () => { retryN = 0; setStatus('live'); };

    ws.onmessage = (e) => {
      try {
        const { data: d } = JSON.parse(e.data);
        if (!d || !d.s) return;
        prices[d.s] = {
          symbol:  d.s,
          price:   parseFloat(d.c),
          change:  parseFloat(d.P),   // 24h %
          high:    parseFloat(d.h),
          low:     parseFloat(d.l),
          volume:  parseFloat(d.v),
          bid:     parseFloat(d.b),
          ask:     parseFloat(d.a),
        };
        if (!paused) updateTile(d.s);
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      setStatus('reconnecting');
      const delay = Math.min(30000, 1000 * 2 ** retryN++);
      retryTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }

  function disconnect() {
    clearTimeout(retryTimer);
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
  }

  // ── DOM updates ───────────────────────────────────────────────────────
  function setStatus(state) {
    const dot = document.getElementById('ticker-status-dot');
    if (!dot) return;
    dot.className = `ticker-dot ticker-dot-${state}`;
    dot.title = state === 'live' ? 'Live WebSocket' : state === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  }

  function updateTile(symbol) {
    const tile = document.getElementById(`ticker-tile-${symbol}`);
    if (!tile) return;
    const d = prices[symbol];
    const up = d.change >= 0;
    tile.querySelector('.tk-price').textContent = formatPrice(d.price);
    const chEl = tile.querySelector('.tk-change');
    chEl.textContent = `${up ? '▲' : '▼'} ${Math.abs(d.change).toFixed(2)}%`;
    chEl.className   = `tk-change ${up ? 'tk-up' : 'tk-down'}`;
    tile.classList.remove('tk-flash-up','tk-flash-down');
    void tile.offsetWidth;
    tile.classList.add(up ? 'tk-flash-up' : 'tk-flash-down');
  }

  function formatPrice(p) {
    if (p >= 1000) return p.toLocaleString('en', { maximumFractionDigits: 2 });
    if (p >= 1)    return p.toFixed(4);
    return p.toFixed(6);
  }

  function formatSymbol(s) { return s.replace('USDT',''); }

  // ── Render strip ──────────────────────────────────────────────────────
  function render() {
    const strip = document.getElementById('ticker-strip');
    if (!strip) return;

    strip.innerHTML = `
      <div class="ticker-inner">
        <div class="ticker-meta">
          <span class="ticker-dot ticker-dot-reconnecting" id="ticker-status-dot" title="Connecting…"></span>
          <span class="ticker-label">LIVE</span>
        </div>
        <div class="ticker-scroll" id="ticker-scroll">
          ${SYMBOLS.map(s => `
            <div class="ticker-tile" id="ticker-tile-${s}" data-symbol="${s}">
              <span class="tk-sym">${formatSymbol(s)}</span>
              <span class="tk-price" id="tk-price-${s}">—</span>
              <span class="tk-change tk-neutral">— %</span>
            </div>
          `).join('')}
        </div>
        <button class="ticker-pause-btn" id="ticker-pause-btn" onclick="TickerStrip.togglePause()" title="Pause scrolling">⏸</button>
      </div>
    `;

    // Click tile → open cockpit for that coin
    strip.querySelectorAll('.ticker-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const sym = tile.dataset.symbol;
        if (typeof switchSection === 'function') switchSection('dashboard');
        setTimeout(() => {
          if (typeof TradingCockpit !== 'undefined') TradingCockpit.selectCoin(sym);
        }, 200);
      });
    });
  }

  function togglePause() {
    paused = !paused;
    const btn = document.getElementById('ticker-pause-btn');
    const scroll = document.getElementById('ticker-scroll');
    if (btn) btn.textContent = paused ? '▶' : '⏸';
    if (scroll) scroll.style.animationPlayState = paused ? 'paused' : 'running';
  }

  // ── Seed from REST on init (pre-fills before WS delivers) ────────────
  async function seedPrices() {
    try {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=' +
        encodeURIComponent(JSON.stringify(SYMBOLS)));
      const tickers = await r.json();
      tickers.forEach(d => {
        prices[d.symbol] = {
          symbol: d.symbol, price: parseFloat(d.lastPrice),
          change: parseFloat(d.priceChangePercent),
          high: parseFloat(d.highPrice), low: parseFloat(d.lowPrice),
          volume: parseFloat(d.volume), bid: parseFloat(d.bidPrice), ask: parseFloat(d.askPrice),
        };
        updateTile(d.symbol);
      });
    } catch { /* WS will fill in */ }
  }

  // ── Public ────────────────────────────────────────────────────────────
  function init() {
    render();
    seedPrices();
    connect();
  }

  function getPrice(symbol) { return prices[symbol]?.price ?? null; }
  function getData(symbol)  { return prices[symbol] ?? null; }

  return { init, getPrice, getData, togglePause, disconnect };
})();

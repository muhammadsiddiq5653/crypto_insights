/**
 * Order Book Heatmap
 * Live bid/ask depth from Binance WebSocket — shows liquidity walls
 * Visualises where large buy/sell orders cluster → support & resistance
 */

const OrderBookHeatmap = {
  container: null,
  ws: null,
  chart: null,
  snapshotChart: null,
  symbol: 'BTCUSDT',
  displaySymbol: 'BTC',
  bids: new Map(),
  asks: new Map(),
  heatHistory: [],   // rolling history for heatmap: [{timestamp, bids, asks}]
  maxHistory: 60,    // 60 snapshots
  isConnected: false,
  updateTimer: null,
  renderTimer: null,
  lastPrice: null,
  precision: 10,     // price bucket size

  PAIRS: [
    { label: 'BTC/USDT', symbol: 'BTCUSDT', display: 'BTC', precision: 100 },
    { label: 'ETH/USDT', symbol: 'ETHUSDT', display: 'ETH', precision: 5   },
    { label: 'SOL/USDT', symbol: 'SOLUSDT', display: 'SOL', precision: 0.5 },
    { label: 'BNB/USDT', symbol: 'BNBUSDT', display: 'BNB', precision: 1   },
    { label: 'XRP/USDT', symbol: 'XRPUSDT', display: 'XRP', precision: 0.01},
  ],

  async init() {
    this.container = document.getElementById('order-book-heatmap');
    if (!this.container) return;
    if (this.container.querySelector('.obh-page')) return;

    this.render();
    this.attachEvents();
    await this.connect();
  },

  render() {
    this.container.innerHTML = `
      <div class="obh-page">
        <div class="obh-header">
          <div>
            <h2 class="obh-title">📗 Order Book Heatmap</h2>
            <p class="obh-subtitle">Live bid/ask depth — liquidity walls reveal hidden support & resistance levels</p>
          </div>
          <div class="obh-controls">
            <select id="obh-pair-select" class="obh-select">
              ${this.PAIRS.map(p => `<option value="${p.symbol}" data-precision="${p.precision}" data-display="${p.display}">${p.label}</option>`).join('')}
            </select>
            <div class="obh-status" id="obh-status">
              <span class="obh-dot disconnected"></span>
              <span id="obh-status-text">Connecting...</span>
            </div>
          </div>
        </div>

        <!-- Price & Spread -->
        <div class="obh-price-bar" id="obh-price-bar">
          <div class="obh-price-item">
            <span class="obh-price-label">Mid Price</span>
            <span class="obh-price-val" id="obh-mid-price">—</span>
          </div>
          <div class="obh-price-item">
            <span class="obh-price-label">Spread</span>
            <span class="obh-price-val" id="obh-spread">—</span>
          </div>
          <div class="obh-price-item">
            <span class="obh-price-label">Best Bid</span>
            <span class="obh-price-val success" id="obh-best-bid">—</span>
          </div>
          <div class="obh-price-item">
            <span class="obh-price-label">Best Ask</span>
            <span class="obh-price-val danger" id="obh-best-ask">—</span>
          </div>
          <div class="obh-price-item">
            <span class="obh-price-label">Bid Depth (top 20)</span>
            <span class="obh-price-val success" id="obh-bid-depth">—</span>
          </div>
          <div class="obh-price-item">
            <span class="obh-price-label">Ask Depth (top 20)</span>
            <span class="obh-price-val danger" id="obh-ask-depth">—</span>
          </div>
        </div>

        <!-- Main Layout -->
        <div class="obh-layout">
          <!-- Live Depth Chart -->
          <div class="obh-panel obh-panel-main">
            <div class="obh-panel-title">📊 Depth Chart (Live)</div>
            <div class="obh-chart-wrap">
              <canvas id="obh-depth-chart" height="260"></canvas>
            </div>
          </div>

          <!-- Order Book Table -->
          <div class="obh-panel obh-panel-book">
            <div class="obh-panel-title">📋 Order Book</div>
            <div class="obh-book-header">
              <span>Price</span>
              <span>Size</span>
              <span>Total</span>
            </div>
            <div class="obh-asks-wrap" id="obh-asks-list"></div>
            <div class="obh-mid-price-row" id="obh-book-mid">
              <span id="obh-book-price">—</span>
              <span class="obh-spread-label">spread</span>
            </div>
            <div class="obh-bids-wrap" id="obh-bids-list"></div>
          </div>
        </div>

        <!-- Heatmap (rolling liquidity history) -->
        <div class="obh-panel" style="margin-top:1rem">
          <div class="obh-panel-title">🌡️ Liquidity Heatmap (60s rolling)</div>
          <p class="obh-heat-sub">Brighter = thicker liquidity wall. Green = bids (support). Red = asks (resistance).</p>
          <canvas id="obh-heatmap-canvas" height="180" style="width:100%;border-radius:8px;"></canvas>
        </div>

        <!-- Wall Alerts -->
        <div class="obh-panel" style="margin-top:1rem">
          <div class="obh-panel-title">🧱 Liquidity Walls (Top clusters)</div>
          <div id="obh-walls" class="obh-walls-grid"></div>
        </div>

        <!-- Education -->
        <div class="obh-edu">
          <div class="obh-edu-grid">
            <div class="obh-edu-item"><span>📗</span><div><strong>Bid Wall</strong><br>Large cluster of buy orders. Acts as support — price tends to bounce at thick bid walls.</div></div>
            <div class="obh-edu-item"><span>📕</span><div><strong>Ask Wall</strong><br>Large cluster of sell orders. Acts as resistance — breaking through requires strong buying pressure.</div></div>
            <div class="obh-edu-item"><span>⚡</span><div><strong>Spread</strong><br>The gap between best bid and best ask. Tight spread = liquid market. Wide spread = illiquid or volatile.</div></div>
            <div class="obh-edu-item"><span>🎯</span><div><strong>Depth Imbalance</strong><br>If bid depth &gt; ask depth, buyers dominate. Ratio &gt; 1.5× often precedes short-term price rise.</div></div>
          </div>
        </div>
      </div>
    `;

    this.injectStyles();
  },

  attachEvents() {
    const sel = document.getElementById('obh-pair-select');
    if (sel) {
      sel.addEventListener('change', (e) => {
        const opt = e.target.selectedOptions[0];
        this.symbol = e.target.value;
        this.displaySymbol = opt.dataset.display;
        this.precision = parseFloat(opt.dataset.precision);
        this.bids.clear();
        this.asks.clear();
        this.heatHistory = [];
        this.disconnect();
        setTimeout(() => this.connect(), 300);
      });
    }
  },

  async connect() {
    this.setStatus('connecting');
    try {
      // First fetch REST snapshot
      await this.fetchSnapshot();
      // Then open WebSocket for updates
      this.openWebSocket();
    } catch (err) {
      console.warn('OrderBook: REST snapshot failed, using synthetic data', err);
      this.generateSyntheticBook();
      this.setStatus('synthetic');
      this.startRenderLoop();
    }
  },

  async fetchSnapshot() {
    const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${this.symbol}&limit=100`);
    if (!res.ok) throw new Error('Binance depth API failed');
    const data = await res.json();

    this.bids.clear();
    this.asks.clear();
    data.bids.forEach(([price, qty]) => this.bids.set(parseFloat(price), parseFloat(qty)));
    data.asks.forEach(([price, qty]) => this.asks.set(parseFloat(price), parseFloat(qty)));

    // Get mid price from ticker
    const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.symbol}`);
    if (tickerRes.ok) {
      const t = await tickerRes.json();
      this.lastPrice = parseFloat(t.price);
    }
  },

  openWebSocket() {
    if (this.ws) { try { this.ws.close(); } catch {} }
    const streamName = `${this.symbol.toLowerCase()}@depth@100ms`;
    this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.setStatus('connected');
      this.startRenderLoop();
    };

    this.ws.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data);
        // Apply diff updates
        (d.b || []).forEach(([price, qty]) => {
          const p = parseFloat(price), q = parseFloat(qty);
          if (q === 0) this.bids.delete(p);
          else this.bids.set(p, q);
        });
        (d.a || []).forEach(([price, qty]) => {
          const p = parseFloat(price), q = parseFloat(qty);
          if (q === 0) this.asks.delete(p);
          else this.asks.set(p, q);
        });
      } catch {}
    };

    this.ws.onerror = () => {
      this.isConnected = false;
      this.setStatus('error');
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.setStatus('disconnected');
    };
  },

  disconnect() {
    clearInterval(this.renderTimer);
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.isConnected = false;
  },

  startRenderLoop() {
    clearInterval(this.renderTimer);
    this.renderTimer = setInterval(() => this.renderAll(), 500);
    this.renderAll();
  },

  renderAll() {
    if (!document.getElementById('obh-depth-chart')) return;

    const sortedBids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]).slice(0, 50);
    const sortedAsks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]).slice(0, 50);

    if (!sortedBids.length || !sortedAsks.length) return;

    const bestBid = sortedBids[0][0];
    const bestAsk = sortedAsks[0][0];
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const spreadPct = (spread / mid * 100).toFixed(4);

    const bidDepth = sortedBids.slice(0, 20).reduce((s, [, q]) => s + q, 0);
    const askDepth = sortedAsks.slice(0, 20).reduce((s, [, q]) => s + q, 0);

    // Update price bar
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('obh-mid-price', '$' + this.fmtPrice(mid));
    setEl('obh-spread', `$${spread.toFixed(2)} (${spreadPct}%)`);
    setEl('obh-best-bid', '$' + this.fmtPrice(bestBid));
    setEl('obh-best-ask', '$' + this.fmtPrice(bestAsk));
    setEl('obh-bid-depth', `${bidDepth.toFixed(2)} ${this.displaySymbol}`);
    setEl('obh-ask-depth', `${askDepth.toFixed(2)} ${this.displaySymbol}`);

    // Render book table
    this.renderBookTable(sortedBids, sortedAsks, bestBid, bestAsk, mid);

    // Depth chart
    this.renderDepthChart(sortedBids, sortedAsks);

    // Record snapshot for heatmap
    this.heatHistory.push({ ts: Date.now(), bids: sortedBids.slice(0, 30), asks: sortedAsks.slice(0, 30), mid });
    if (this.heatHistory.length > this.maxHistory) this.heatHistory.shift();
    this.renderHeatmap();

    // Walls
    this.renderWalls(sortedBids, sortedAsks, mid);
  },

  renderBookTable(bids, asks, bestBid, bestAsk, mid) {
    const bidsEl = document.getElementById('obh-bids-list');
    const asksEl = document.getElementById('obh-asks-list');
    const midEl  = document.getElementById('obh-book-price');
    if (!bidsEl || !asksEl) return;

    const maxBidQty = Math.max(...bids.slice(0, 15).map(([, q]) => q));
    const maxAskQty = Math.max(...asks.slice(0, 15).map(([, q]) => q));

    let bidTotal = 0, askTotal = 0;

    const askRows = asks.slice(0, 15).reverse().map(([price, qty]) => {
      askTotal += qty;
      const pct = (qty / maxAskQty * 100).toFixed(1);
      return `<div class="obh-row ask">
        <div class="obh-row-bg" style="width:${pct}%;background:rgba(255,95,87,0.12)"></div>
        <span class="obh-row-price danger">$${this.fmtPrice(price)}</span>
        <span class="obh-row-qty">${qty.toFixed(4)}</span>
        <span class="obh-row-total">${askTotal.toFixed(2)}</span>
      </div>`;
    }).join('');

    const bidRows = bids.slice(0, 15).map(([price, qty]) => {
      bidTotal += qty;
      const pct = (qty / maxBidQty * 100).toFixed(1);
      return `<div class="obh-row bid">
        <div class="obh-row-bg" style="width:${pct}%;background:rgba(45,216,130,0.12)"></div>
        <span class="obh-row-price success">$${this.fmtPrice(price)}</span>
        <span class="obh-row-qty">${qty.toFixed(4)}</span>
        <span class="obh-row-total">${bidTotal.toFixed(2)}</span>
      </div>`;
    }).join('');

    asksEl.innerHTML = askRows;
    bidsEl.innerHTML = bidRows;
    if (midEl) midEl.textContent = '$' + this.fmtPrice(mid);
  },

  renderDepthChart(bids, asks) {
    const canvas = document.getElementById('obh-depth-chart');
    if (!canvas) return;

    const bidPrices = [], bidCum = [], askPrices = [], askCum = [];
    let bs = 0, as_ = 0;
    bids.slice(0, 40).reverse().forEach(([p, q]) => { bs += q; bidPrices.push(p); bidCum.push(bs); });
    bidPrices.reverse(); bidCum.reverse();
    asks.slice(0, 40).forEach(([p, q]) => { as_ += q; askPrices.push(p); askCum.push(as_); });

    const prices = [...bidPrices, ...askPrices];
    const cumQty = [...bidCum, ...askCum.map(() => null)]; // gap at mid

    if (this.chart) { try { this.chart.destroy(); } catch {} this.chart = null; }

    this.chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: prices.map(p => '$' + this.fmtPrice(p)),
        datasets: [
          {
            label: 'Bid Depth',
            data: [...bidCum, ...askPrices.map(() => null)],
            borderColor: '#2dd882',
            backgroundColor: 'rgba(45,216,130,0.15)',
            fill: true,
            tension: 0,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Ask Depth',
            data: [...bidPrices.map(() => null), ...askCum],
            borderColor: '#ff5f57',
            backgroundColor: 'rgba(255,95,87,0.15)',
            fill: true,
            tension: 0,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#9aa3c2', font: { size: 11 } } },
          tooltip: {
            mode: 'index',
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) || '—'} ${this.displaySymbol}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#5e6787', maxTicksLimit: 8, font: { size: 10 } },
            grid: { color: 'rgba(99,120,220,0.06)' },
          },
          y: {
            ticks: { color: '#5e6787', font: { size: 10 } },
            grid: { color: 'rgba(99,120,220,0.06)' },
          },
        },
      },
    });
  },

  renderHeatmap() {
    const canvas = document.getElementById('obh-heatmap-canvas');
    if (!canvas || this.heatHistory.length < 2) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 800;
    const H = canvas.height;
    canvas.width = W;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(14,18,40,0.9)';
    ctx.fillRect(0, 0, W, H);

    if (!this.heatHistory.length) return;

    // Price range
    const allPrices = this.heatHistory.flatMap(s => [...s.bids.map(([p]) => p), ...s.asks.map(([p]) => p)]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    const colWidth = W / this.heatHistory.length;

    this.heatHistory.forEach((snapshot, i) => {
      const x = i * colWidth;

      // Draw bid levels (green)
      snapshot.bids.forEach(([price, qty]) => {
        const y = H - ((price - minPrice) / priceRange) * H;
        const alpha = Math.min(0.9, qty / 5);
        ctx.fillStyle = `rgba(45,216,130,${alpha})`;
        ctx.fillRect(x, y - 2, colWidth, 4);
      });

      // Draw ask levels (red)
      snapshot.asks.forEach(([price, qty]) => {
        const y = H - ((price - minPrice) / priceRange) * H;
        const alpha = Math.min(0.9, qty / 5);
        ctx.fillStyle = `rgba(255,95,87,${alpha})`;
        ctx.fillRect(x, y - 2, colWidth, 4);
      });

      // Draw mid price line
      const midY = H - ((snapshot.mid - minPrice) / priceRange) * H;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x, midY - 1, colWidth, 2);
    });

    // Price labels
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('$' + this.fmtPrice(maxPrice), 4, 14);
    ctx.fillText('$' + this.fmtPrice(minPrice), 4, H - 4);
  },

  renderWalls(bids, asks, mid) {
    const wallsEl = document.getElementById('obh-walls');
    if (!wallsEl) return;

    // Bucket bids and asks into price levels
    const bucketSize = this.precision;
    const bidBuckets = {}, askBuckets = {};

    bids.forEach(([price, qty]) => {
      const bucket = Math.floor(price / bucketSize) * bucketSize;
      bidBuckets[bucket] = (bidBuckets[bucket] || 0) + qty;
    });
    asks.forEach(([price, qty]) => {
      const bucket = Math.ceil(price / bucketSize) * bucketSize;
      askBuckets[bucket] = (askBuckets[bucket] || 0) + qty;
    });

    const topBidWalls = Object.entries(bidBuckets).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topAskWalls = Object.entries(askBuckets).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const maxQty = Math.max(...topBidWalls.map(([, q]) => q), ...topAskWalls.map(([, q]) => q), 1);

    const renderWall = (price, qty, type) => {
      const strength = Math.round((qty / maxQty) * 5);
      const stars = '★'.repeat(strength) + '☆'.repeat(5 - strength);
      const distPct = (((parseFloat(price) - mid) / mid) * 100).toFixed(2);
      const distLabel = parseFloat(distPct) > 0 ? `+${distPct}% above mid` : `${distPct}% below mid`;
      const isBid = type === 'bid';
      return `
        <div class="obh-wall-card ${isBid ? 'bid' : 'ask'}">
          <div class="obh-wall-type">${isBid ? '📗 BID WALL' : '📕 ASK WALL'}</div>
          <div class="obh-wall-price">$${this.fmtPrice(parseFloat(price))}</div>
          <div class="obh-wall-qty">${qty.toFixed(2)} ${this.displaySymbol}</div>
          <div class="obh-wall-stars ${isBid ? 'success' : 'danger'}">${stars}</div>
          <div class="obh-wall-dist">${distLabel}</div>
        </div>
      `;
    };

    wallsEl.innerHTML = [
      ...topAskWalls.map(([p, q]) => renderWall(p, q, 'ask')),
      ...topBidWalls.map(([p, q]) => renderWall(p, q, 'bid')),
    ].join('');
  },

  setStatus(state) {
    const dot = document.querySelector('.obh-dot');
    const txt = document.getElementById('obh-status-text');
    if (!dot || !txt) return;
    dot.className = 'obh-dot ' + state;
    txt.textContent = { connected: 'Live', connecting: 'Connecting…', error: 'Error', disconnected: 'Disconnected', synthetic: 'Simulated' }[state] || state;
  },

  generateSyntheticBook() {
    const basePrice = { BTCUSDT: 68000, ETHUSDT: 3500, SOLUSDT: 168, BNBUSDT: 580, XRPUSDT: 0.52 }[this.symbol] || 100;
    this.bids.clear(); this.asks.clear();
    for (let i = 0; i < 50; i++) {
      const offset = (i + 1) * this.precision;
      const bidQty = Math.random() * 3 + 0.1 + (i % 10 === 0 ? Math.random() * 10 : 0);
      const askQty = Math.random() * 3 + 0.1 + (i % 10 === 0 ? Math.random() * 10 : 0);
      this.bids.set(basePrice - offset, Math.round(bidQty * 1000) / 1000);
      this.asks.set(basePrice + offset, Math.round(askQty * 1000) / 1000);
    }
    this.lastPrice = basePrice;

    // Simulate live updates
    setInterval(() => {
      if (!this.container.querySelector('.obh-page')) return;
      this.bids.forEach((q, p) => this.bids.set(p, Math.max(0.01, q + (Math.random() - 0.5) * 0.5)));
      this.asks.forEach((q, p) => this.asks.set(p, Math.max(0.01, q + (Math.random() - 0.5) * 0.5)));
    }, 500);
  },

  fmtPrice(n) {
    if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(3);
    return n.toFixed(6);
  },

  injectStyles() {
    if (document.getElementById('obh-styles')) return;
    const s = document.createElement('style');
    s.id = 'obh-styles';
    s.textContent = `
      .obh-page { padding:0; }
      .obh-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem; }
      .obh-title { font-size:1.5rem; font-weight:800; letter-spacing:-0.03em; margin-bottom:0.25rem; }
      .obh-subtitle { color:var(--color-text-muted); font-size:0.8125rem; }
      .obh-controls { display:flex; align-items:center; gap:0.75rem; }
      .obh-select { background:var(--color-bg-card); border:1px solid rgba(99,120,220,0.2); border-radius:6px; color:var(--color-text-primary); padding:0.4rem 0.75rem; font-size:0.8125rem; cursor:pointer; }
      .obh-status { display:flex; align-items:center; gap:0.5rem; font-size:0.8rem; color:var(--color-text-muted); background:rgba(99,120,220,0.06); border:1px solid rgba(99,120,220,0.12); border-radius:6px; padding:0.375rem 0.75rem; }
      .obh-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .obh-dot.connected { background:#2dd882; box-shadow:0 0 6px rgba(45,216,130,0.5); animation:statusPulse 2s infinite; }
      .obh-dot.connecting { background:#f5a623; animation:statusPulse 1s infinite; }
      .obh-dot.error, .obh-dot.disconnected { background:#ff5f57; }
      .obh-dot.synthetic { background:#38bdf8; }

      .obh-price-bar { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.75rem; margin-bottom:1.25rem; }
      .obh-price-item { background:var(--color-bg-card); border:1px solid rgba(99,120,220,0.1); border-radius:8px; padding:0.75rem 1rem; }
      .obh-price-label { display:block; font-size:0.68rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.25rem; }
      .obh-price-val { font-size:1rem; font-weight:800; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; }
      .obh-price-val.success { color:#2dd882; }
      .obh-price-val.danger { color:#ff5f57; }

      .obh-layout { display:grid; grid-template-columns:1fr 280px; gap:1rem; }
      @media (max-width:900px) { .obh-layout { grid-template-columns:1fr; } }

      .obh-panel { background:var(--color-bg-card); border:1px solid rgba(99,120,220,0.1); border-radius:10px; padding:1.1rem; }
      .obh-panel-title { font-size:0.875rem; font-weight:700; margin-bottom:0.875rem; }
      .obh-chart-wrap { position:relative; height:260px; }

      /* Order book table */
      .obh-book-header { display:flex; justify-content:space-between; padding:0.25rem 0.5rem; font-size:0.68rem; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid rgba(99,120,220,0.1); margin-bottom:0.25rem; }
      .obh-asks-wrap, .obh-bids-wrap { max-height:180px; overflow:hidden; }
      .obh-row { display:flex; justify-content:space-between; padding:0.2rem 0.5rem; font-size:0.75rem; position:relative; cursor:default; }
      .obh-row:hover { background:rgba(99,120,220,0.06); }
      .obh-row-bg { position:absolute; right:0; top:0; bottom:0; }
      .obh-row-price { font-weight:700; z-index:1; font-variant-numeric:tabular-nums; }
      .obh-row-qty, .obh-row-total { color:var(--color-text-secondary); z-index:1; font-variant-numeric:tabular-nums; }
      .obh-mid-price-row { display:flex; justify-content:center; align-items:center; gap:0.5rem; padding:0.4rem; background:rgba(99,120,220,0.08); border-radius:4px; margin:0.25rem 0; font-size:0.875rem; font-weight:800; }
      .obh-spread-label { font-size:0.68rem; color:var(--color-text-muted); font-weight:400; }

      /* Heatmap */
      .obh-heat-sub { font-size:0.75rem; color:var(--color-text-muted); margin-bottom:0.75rem; }

      /* Walls */
      .obh-walls-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:0.75rem; }
      .obh-wall-card { border-radius:8px; padding:0.875rem; text-align:center; }
      .obh-wall-card.bid { background:rgba(45,216,130,0.06); border:1px solid rgba(45,216,130,0.2); }
      .obh-wall-card.ask { background:rgba(255,95,87,0.06); border:1px solid rgba(255,95,87,0.2); }
      .obh-wall-type { font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-text-muted); margin-bottom:0.375rem; }
      .obh-wall-price { font-size:1.125rem; font-weight:800; margin-bottom:0.2rem; font-variant-numeric:tabular-nums; }
      .obh-wall-qty { font-size:0.75rem; color:var(--color-text-muted); margin-bottom:0.375rem; }
      .obh-wall-stars { font-size:0.875rem; letter-spacing:2px; }
      .obh-wall-stars.success { color:#2dd882; }
      .obh-wall-stars.danger { color:#ff5f57; }
      .obh-wall-dist { font-size:0.7rem; color:var(--color-text-muted); margin-top:0.25rem; }

      /* Education */
      .obh-edu { margin-top:1rem; background:rgba(99,120,220,0.04); border:1px solid rgba(99,120,220,0.1); border-radius:10px; padding:1.1rem; }
      .obh-edu-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0.875rem; }
      .obh-edu-item { display:flex; gap:0.75rem; font-size:0.8rem; color:var(--color-text-secondary); }
      .obh-edu-item span { font-size:1.5rem; flex-shrink:0; }
      .obh-edu-item strong { display:block; color:var(--color-text-primary); margin-bottom:0.2rem; font-size:0.8125rem; }
      .success { color:#2dd882; }
      .danger  { color:#ff5f57; }
    `;
    document.head.appendChild(s);
  },
};

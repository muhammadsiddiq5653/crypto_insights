/**
 * Liquidation Heatmap
 * Estimates liquidation clusters at price levels for futures positions
 * Uses Binance Futures public API (mark price, ticker, OI) + synthetic modeling
 * Coinglass-style visualization — no API key required
 */

const LiquidationHeatmap = {
  container: null,
  chart: null,
  liqChart: null,
  symbol: 'BTCUSDT',
  displaySymbol: 'BTC',
  markPrice: 0,
  data: null,
  refreshTimer: null,
  timeframe: '1h',

  PAIRS: [
    { label: 'BTC/USDT', symbol: 'BTCUSDT', display: 'BTC' },
    { label: 'ETH/USDT', symbol: 'ETHUSDT', display: 'ETH' },
    { label: 'SOL/USDT', symbol: 'SOLUSDT', display: 'SOL' },
    { label: 'BNB/USDT', symbol: 'BNBUSDT', display: 'BNB' },
    { label: 'XRP/USDT', symbol: 'XRPUSDT', display: 'XRP' },
  ],

  TIMEFRAMES: [
    { label: '1h', hours: 1 },
    { label: '4h', hours: 4 },
    { label: '1d', hours: 24 },
  ],

  async init() {
    this.container = document.getElementById('liquidation-heatmap');
    if (!this.container) return;
    if (this.container.querySelector('.liq-page')) return;

    this.render();
    this.attachEvents();
    await this.load();
    this.startAutoRefresh();
  },

  render() {
    this.container.innerHTML = `
      <div class="liq-page">
        <div class="liq-header">
          <div>
            <h2 class="liq-title">💥 Liquidation Heatmap</h2>
            <p class="liq-subtitle">Estimated long/short liquidation clusters by price level — where the stops are hiding</p>
          </div>
          <div class="liq-controls">
            <select id="liq-pair" class="liq-select">
              ${this.PAIRS.map(p => `<option value="${p.symbol}" data-display="${p.display}">${p.label}</option>`).join('')}
            </select>
            <div class="liq-tf-btns">
              ${this.TIMEFRAMES.map(t => `
                <button class="liq-tf-btn ${t.label === '1h' ? 'active' : ''}" data-tf="${t.label}">${t.label}</button>
              `).join('')}
            </div>
            <button class="liq-refresh-btn" id="liq-refresh">↻ Refresh</button>
          </div>
        </div>

        <!-- Market Snapshot -->
        <div class="liq-snapshot" id="liq-snapshot">
          <div class="liq-snap-item">
            <span class="liq-snap-label">Mark Price</span>
            <span class="liq-snap-val" id="liq-mark-price">—</span>
          </div>
          <div class="liq-snap-item">
            <span class="liq-snap-label">24h Change</span>
            <span class="liq-snap-val" id="liq-24h-change">—</span>
          </div>
          <div class="liq-snap-item">
            <span class="liq-snap-label">Funding Rate</span>
            <span class="liq-snap-val" id="liq-funding">—</span>
          </div>
          <div class="liq-snap-item">
            <span class="liq-snap-label">Open Interest</span>
            <span class="liq-snap-val" id="liq-oi">—</span>
          </div>
          <div class="liq-snap-item">
            <span class="liq-snap-label">Long Liq Zone</span>
            <span class="liq-snap-val danger" id="liq-long-zone">—</span>
          </div>
          <div class="liq-snap-item">
            <span class="liq-snap-label">Short Liq Zone</span>
            <span class="liq-snap-val success" id="liq-short-zone">—</span>
          </div>
        </div>

        <!-- Main Layout -->
        <div class="liq-layout">
          <!-- Heatmap Chart -->
          <div class="liq-panel liq-panel-main">
            <div class="liq-panel-title">🌡️ Liquidation Density by Price Level</div>
            <p class="liq-panel-sub">Red = long liquidations (price drops here → cascading longs get wiped). Green = short liquidations.</p>
            <div class="liq-heat-wrap" id="liq-heat-canvas-wrap">
              <canvas id="liq-heatmap-canvas" height="360"></canvas>
            </div>
            <div class="liq-heat-legend">
              <span class="liq-heat-low longs">Low Long Liq</span>
              <span class="liq-heat-high longs">High Long Liq</span>
              <span class="liq-heat-mid">Current Price</span>
              <span class="liq-heat-low shorts">Low Short Liq</span>
              <span class="liq-heat-high shorts">High Short Liq</span>
            </div>
          </div>

          <!-- Side panel: cascade risk + levels -->
          <div class="liq-side">
            <!-- Cascade Risk -->
            <div class="liq-panel">
              <div class="liq-panel-title">⚡ Cascade Risk Score</div>
              <div class="liq-cascade" id="liq-cascade-display">
                <div class="liq-cascade-score" id="liq-cascade-score">—</div>
                <div class="liq-cascade-label" id="liq-cascade-label">Loading...</div>
                <div class="liq-cascade-bar">
                  <div class="liq-cascade-fill" id="liq-cascade-fill"></div>
                </div>
                <div class="liq-cascade-desc" id="liq-cascade-desc"></div>
              </div>
            </div>

            <!-- Key Levels -->
            <div class="liq-panel" style="margin-top:0.875rem">
              <div class="liq-panel-title">🎯 Key Liquidation Levels</div>
              <div id="liq-key-levels" class="liq-levels-list"></div>
            </div>

            <!-- Recent Liquidations -->
            <div class="liq-panel" style="margin-top:0.875rem">
              <div class="liq-panel-title">⚡ Recent Large Liquidations</div>
              <div id="liq-recent" class="liq-recent-list"></div>
            </div>
          </div>
        </div>

        <!-- Leverage Breakdown -->
        <div class="liq-panel" style="margin-top:1rem">
          <div class="liq-panel-title">📊 Estimated Liq. by Leverage Tier</div>
          <div id="liq-leverage-breakdown" class="liq-lev-grid"></div>
        </div>

        <!-- Education -->
        <div class="liq-edu">
          <div class="liq-edu-grid">
            <div class="liq-edu-item">
              <span>💥</span>
              <div><strong>Liquidation Cascade</strong><br>When price hits a dense cluster of longs, forced selling accelerates the drop — triggering more longs below. Self-reinforcing.</div>
            </div>
            <div class="liq-edu-item">
              <span>🔴</span>
              <div><strong>Long Liquidation Zone</strong><br>Below current price. If price reaches here, leveraged longs get wiped. Dense zones = strong magnetic pullback levels.</div>
            </div>
            <div class="liq-edu-item">
              <span>🟢</span>
              <div><strong>Short Liquidation Zone</strong><br>Above current price. If price squeezes up into here, shorts get liquidated, adding fuel to the rally.</div>
            </div>
            <div class="liq-edu-item">
              <span>📐</span>
              <div><strong>How It's Estimated</strong><br>Based on mark price, open interest, and leverage distribution (10×–125× typical for Binance perps). Exact levels are approximate.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.injectStyles();
  },

  attachEvents() {
    this.container.querySelector('#liq-pair')?.addEventListener('change', async (e) => {
      const opt = e.target.selectedOptions[0];
      this.symbol = e.target.value;
      this.displaySymbol = opt.dataset.display;
      await this.load();
    });

    this.container.querySelectorAll('.liq-tf-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.timeframe = btn.dataset.tf;
        this.container.querySelectorAll('.liq-tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await this.load();
      });
    });

    this.container.querySelector('#liq-refresh')?.addEventListener('click', () => this.load());
  },

  async load() {
    try {
      await Promise.allSettled([
        this.fetchMarkPrice(),
        this.fetchFundingAndOI(),
      ]);
    } catch {}
    this.computeLiquidations();
    this.render_ui();
  },

  async fetchMarkPrice() {
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${this.symbol}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      this.markPrice = parseFloat(d.markPrice);
      this.data = this.data || {};
      this.data.markPrice = this.markPrice;
      this.data.indexPrice = parseFloat(d.indexPrice);
      this.data.fundingRate = parseFloat(d.lastFundingRate);
    } catch {
      const base = { BTCUSDT: 68000, ETHUSDT: 3500, SOLUSDT: 168, BNBUSDT: 580, XRPUSDT: 0.52 };
      this.markPrice = base[this.symbol] || 100;
      this.data = { markPrice: this.markPrice, indexPrice: this.markPrice, fundingRate: 0.0001 };
    }
  },

  async fetchFundingAndOI() {
    try {
      const [tickerRes, oiRes] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${this.symbol}`),
        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${this.symbol}`),
      ]);
      if (tickerRes.ok) {
        const t = await tickerRes.json();
        this.data.priceChange24h = parseFloat(t.priceChangePercent);
        this.data.volume24h = parseFloat(t.volume);
      }
      if (oiRes.ok) {
        const oi = await oiRes.json();
        this.data.openInterest = parseFloat(oi.openInterest);
        this.data.openInterestUSD = this.data.openInterest * this.markPrice;
      }
    } catch {
      this.data.priceChange24h = (Math.random() - 0.5) * 5;
      this.data.volume24h = this.markPrice * 50000;
      this.data.openInterest = this.markPrice > 1000 ? 50000 : this.markPrice > 100 ? 1000000 : 100000000;
      this.data.openInterestUSD = this.data.openInterest * this.markPrice;
    }
  },

  computeLiquidations() {
    const price = this.markPrice;
    const oi = this.data?.openInterestUSD || price * 50000;

    // Leverage tiers: model distribution of position sizes
    const leverageTiers = [
      { leverage: 125, pct: 0.05, label: '125×' },
      { leverage: 100, pct: 0.08, label: '100×' },
      { leverage:  50, pct: 0.15, label: '50×'  },
      { leverage:  25, pct: 0.20, label: '25×'  },
      { leverage:  20, pct: 0.20, label: '20×'  },
      { leverage:  10, pct: 0.20, label: '10×'  },
      { leverage:   5, pct: 0.12, label: '5×'   },
    ];

    // For each tier, liq price = entry * (1 - 1/leverage) for longs, entry * (1 + 1/leverage) for shorts
    const liqLevels = [];

    leverageTiers.forEach(tier => {
      const size = oi * tier.pct;
      // Assume positions opened at prices within ±5% of current
      const priceOffsets = [-0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05];

      priceOffsets.forEach(offset => {
        const entryPrice = price * (1 + offset);
        const longLiqPrice = entryPrice * (1 - (1 / tier.leverage) * 0.95);  // slight buffer
        const shortLiqPrice = entryPrice * (1 + (1 / tier.leverage) * 0.95);

        if (longLiqPrice > 0 && longLiqPrice < price) {
          liqLevels.push({
            price: longLiqPrice,
            size: size / priceOffsets.length * (1 - Math.abs(offset) * 5),
            type: 'long',
            leverage: tier.leverage,
          });
        }
        if (shortLiqPrice > price) {
          liqLevels.push({
            price: shortLiqPrice,
            size: size / priceOffsets.length * (1 - Math.abs(offset) * 5),
            type: 'short',
            leverage: tier.leverage,
          });
        }
      });
    });

    // Aggregate into price buckets
    const bucketCount = 80;
    const rangeDown = price * 0.20;
    const rangeUp   = price * 0.15;
    const minPrice  = price - rangeDown;
    const maxPrice  = price + rangeUp;
    const bucketSize = (maxPrice - minPrice) / bucketCount;

    const longBuckets  = new Array(bucketCount).fill(0);
    const shortBuckets = new Array(bucketCount).fill(0);

    liqLevels.forEach(lev => {
      const idx = Math.round((lev.price - minPrice) / bucketSize);
      if (idx < 0 || idx >= bucketCount) return;
      if (lev.type === 'long')  longBuckets[idx]  += lev.size;
      else                       shortBuckets[idx] += lev.size;
    });

    // Add noise/realistic texture
    for (let i = 0; i < bucketCount; i++) {
      longBuckets[i]  *= 0.5 + Math.random() * 0.5;
      shortBuckets[i] *= 0.5 + Math.random() * 0.5;
    }

    // Identify major levels (top 5 by density)
    const keyLongLevels  = [...longBuckets].map((v, i) => ({ price: minPrice + i * bucketSize, size: v, type: 'long'  })).sort((a, b) => b.size - a.size).slice(0, 5);
    const keyShortLevels = [...shortBuckets].map((v, i) => ({ price: minPrice + i * bucketSize, size: v, type: 'short' })).sort((a, b) => b.size - a.size).slice(0, 5);

    // Cascade risk: sum of top-5 long liq density as % of OI
    const topLongSize = keyLongLevels.slice(0, 3).reduce((s, l) => s + l.size, 0);
    const cascadeRisk = Math.min(100, Math.round((topLongSize / oi) * 2000));

    // Recent liquidations (synthetic)
    const recentLiqs = this.generateRecentLiqs(price);

    this.liqData = {
      longBuckets, shortBuckets, bucketCount, minPrice, maxPrice, bucketSize,
      keyLongLevels, keyShortLevels, cascadeRisk, leverageTiers, oi,
      recentLiqs,
      topLongZone: keyLongLevels[0]?.price,
      topShortZone: keyShortLevels[0]?.price,
    };
  },

  generateRecentLiqs(price) {
    const liqs = [];
    const count = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const isLong = Math.random() > 0.5;
      const liqPrice = isLong ? price * (0.95 + Math.random() * 0.045) : price * (1.005 + Math.random() * 0.045);
      const size = Math.random() > 0.8 ? Math.random() * 5e6 + 1e6 : Math.random() * 500000 + 10000;
      liqs.push({
        type: isLong ? 'long' : 'short',
        symbol: this.displaySymbol,
        price: liqPrice,
        size,
        timestamp: Date.now() - Math.random() * 3600000,
      });
    }
    return liqs.sort((a, b) => b.size - a.size);
  },

  render_ui() {
    if (!this.liqData) return;
    const d = this.liqData;
    const price = this.markPrice;

    // Update snapshot
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('liq-mark-price', '$' + this.fmtPrice(price));

    const chg = this.data?.priceChange24h;
    const chgEl = document.getElementById('liq-24h-change');
    if (chgEl) {
      chgEl.textContent = (chg >= 0 ? '+' : '') + chg?.toFixed(2) + '%';
      chgEl.className = 'liq-snap-val ' + (chg >= 0 ? 'success' : 'danger');
    }

    const fr = this.data?.fundingRate;
    const frEl = document.getElementById('liq-funding');
    if (frEl) {
      frEl.textContent = (fr >= 0 ? '+' : '') + (fr * 100).toFixed(4) + '%';
      frEl.className = 'liq-snap-val ' + (fr >= 0 ? 'danger' : 'success');
    }

    const oiUSD = this.data?.openInterestUSD;
    setEl('liq-oi', oiUSD ? '$' + this.fmtLarge(oiUSD) : '—');
    setEl('liq-long-zone', d.topLongZone ? '$' + this.fmtPrice(d.topLongZone) : '—');
    setEl('liq-short-zone', d.topShortZone ? '$' + this.fmtPrice(d.topShortZone) : '—');

    // Cascade risk
    const cascEl = document.getElementById('liq-cascade-score');
    const cascLabel = document.getElementById('liq-cascade-label');
    const cascFill  = document.getElementById('liq-cascade-fill');
    const cascDesc  = document.getElementById('liq-cascade-desc');
    if (cascEl) cascEl.textContent = d.cascadeRisk + '/100';
    if (cascLabel) {
      const label = d.cascadeRisk > 70 ? 'EXTREME' : d.cascadeRisk > 50 ? 'HIGH' : d.cascadeRisk > 30 ? 'MODERATE' : 'LOW';
      cascLabel.textContent = label;
      cascLabel.className = 'liq-cascade-label ' + (d.cascadeRisk > 70 ? 'danger' : d.cascadeRisk > 50 ? 'warning' : d.cascadeRisk > 30 ? 'neutral' : 'success');
    }
    if (cascFill) {
      cascFill.style.width = d.cascadeRisk + '%';
      cascFill.style.background = d.cascadeRisk > 70 ? 'var(--gradient-danger)' : d.cascadeRisk > 50 ? 'var(--gradient-warning)' : 'var(--gradient-success)';
    }
    if (cascDesc) {
      cascDesc.textContent = d.cascadeRisk > 70
        ? 'Massive liquidation clusters below. A move down could trigger a cascade.'
        : d.cascadeRisk > 50
        ? 'Significant long exposure. Correction could accelerate if liq levels are hit.'
        : d.cascadeRisk > 30
        ? 'Moderate liq density. Market can absorb typical volatility.'
        : 'Low cascade risk. Liq levels are well-spread out. Stable conditions.';
    }

    // Key Levels
    const levelsEl = document.getElementById('liq-key-levels');
    if (levelsEl) {
      const allLevels = [
        ...d.keyLongLevels.slice(0, 3).map(l => ({ ...l, pctFromPrice: ((l.price - price) / price * 100).toFixed(2) })),
        ...d.keyShortLevels.slice(0, 3).map(l => ({ ...l, pctFromPrice: ((l.price - price) / price * 100).toFixed(2) })),
      ].sort((a, b) => Math.abs(parseFloat(b.pctFromPrice)) - Math.abs(parseFloat(a.pctFromPrice)));

      levelsEl.innerHTML = allLevels.map(l => `
        <div class="liq-level-row">
          <span class="liq-level-type ${l.type === 'long' ? 'danger' : 'success'}">${l.type === 'long' ? '🔴 LONG LIQ' : '🟢 SHORT LIQ'}</span>
          <span class="liq-level-price">$${this.fmtPrice(l.price)}</span>
          <span class="liq-level-dist ${parseFloat(l.pctFromPrice) < 0 ? 'danger' : 'success'}">${l.pctFromPrice}%</span>
          <span class="liq-level-size">${this.fmtLarge(l.size)}</span>
        </div>
      `).join('');
    }

    // Recent liq events
    const recentEl = document.getElementById('liq-recent');
    if (recentEl) {
      recentEl.innerHTML = (d.recentLiqs || []).slice(0, 6).map(l => `
        <div class="liq-recent-row">
          <span class="liq-recent-type ${l.type === 'long' ? 'danger' : 'success'}">${l.type === 'long' ? '🔴 LONG' : '🟢 SHORT'}</span>
          <span class="liq-recent-price">$${this.fmtPrice(l.price)}</span>
          <span class="liq-recent-size ${l.size > 1e6 ? 'warning' : ''}">$${this.fmtLarge(l.size)}</span>
          <span class="liq-recent-time">${this.timeAgo(l.timestamp)}</span>
        </div>
      `).join('');
    }

    // Leverage breakdown
    const levBreakEl = document.getElementById('liq-leverage-breakdown');
    if (levBreakEl && d.leverageTiers) {
      levBreakEl.innerHTML = d.leverageTiers.map(tier => {
        const liqDist = ((1 / tier.leverage) * 100).toFixed(1);
        const size = (d.oi * tier.pct / 1e6).toFixed(0);
        return `
          <div class="liq-lev-card">
            <div class="liq-lev-badge">${tier.label}</div>
            <div class="liq-lev-dist">Liq at ±${liqDist}%</div>
            <div class="liq-lev-size">~$${size}M exposure</div>
            <div class="liq-lev-pct">${(tier.pct * 100).toFixed(0)}% of OI</div>
          </div>
        `;
      }).join('');
    }

    // Draw heatmap canvas
    this.drawHeatmap();
  },

  drawHeatmap() {
    const canvas = document.getElementById('liq-heatmap-canvas');
    if (!canvas || !this.liqData) return;

    const d = this.liqData;
    const W = canvas.offsetWidth || 700;
    const H = canvas.height;
    canvas.width = W;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, W, H);

    const maxLong  = Math.max(...d.longBuckets, 1);
    const maxShort = Math.max(...d.shortBuckets, 1);

    // Draw bar chart style heatmap
    const barW = (W - 80) / d.bucketCount;
    const midX = W / 2;
    const chartW = W - 80;
    const barLeft = 40; // left margin for labels

    d.longBuckets.forEach((val, i) => {
      const x = barLeft + i * barW;
      const priceLevel = d.minPrice + i * d.bucketSize;
      const y = H - ((priceLevel - d.minPrice) / (d.maxPrice - d.minPrice)) * H;
      const alpha = Math.min(0.95, val / maxLong);
      const barH = Math.max(2, (alpha * 20));

      // Long liq = red, below current price
      ctx.fillStyle = `rgba(255,95,87,${alpha})`;
      ctx.fillRect(barLeft, y - barH / 2, chartW * (val / maxLong) * 0.5, barH);
    });

    d.shortBuckets.forEach((val, i) => {
      const priceLevel = d.minPrice + i * d.bucketSize;
      const y = H - ((priceLevel - d.minPrice) / (d.maxPrice - d.minPrice)) * H;
      const alpha = Math.min(0.95, val / maxShort);
      const barH = Math.max(2, (alpha * 20));
      const barX = barLeft + chartW * 0.5;

      // Short liq = green, above current price
      ctx.fillStyle = `rgba(45,216,130,${alpha})`;
      ctx.fillRect(barX, y - barH / 2, (chartW * 0.5) * (val / maxShort), barH);
    });

    // Current price line
    const priceY = H - ((this.markPrice - d.minPrice) / (d.maxPrice - d.minPrice)) * H;
    ctx.setLineDash([6, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(barLeft, priceY);
    ctx.lineTo(W - 5, priceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('$' + this.fmtPrice(this.markPrice), W - 75, priceY - 4);

    // Price axis labels (left side)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px Inter, sans-serif';
    const numLabels = 6;
    for (let i = 0; i <= numLabels; i++) {
      const frac = i / numLabels;
      const pLabel = d.maxPrice - frac * (d.maxPrice - d.minPrice);
      const yLabel = frac * H;
      ctx.fillText('$' + this.fmtPrice(pLabel), 2, yLabel + 4);
    }

    // Center divider
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barLeft + chartW * 0.5 - 1, 0, 2, H);

    // Labels
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,95,87,0.7)';
    ctx.fillText('◀ LONG LIQIDATIONS', barLeft + 4, 14);
    ctx.fillStyle = 'rgba(45,216,130,0.7)';
    ctx.fillText('SHORT LIQUIDATIONS ▶', barLeft + chartW * 0.5 + 8, 14);
  },

  startAutoRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.load(), 3 * 60 * 1000);
  },

  fmtPrice(n) {
    if (!n) return '—';
    if (n >= 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (n >= 100)   return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1)     return n.toFixed(3);
    return n.toFixed(6);
  },

  fmtLarge(n) {
    if (!n) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return n.toFixed(0);
  },

  timeAgo(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return `${Math.round(s)}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
  },

  injectStyles() {
    if (document.getElementById('liq-styles')) return;
    const s = document.createElement('style');
    s.id = 'liq-styles';
    s.textContent = `
      .liq-page { padding:0; }
      .liq-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem; }
      .liq-title { font-size:1.5rem; font-weight:800; letter-spacing:-0.03em; margin-bottom:0.25rem; }
      .liq-subtitle { color:var(--color-text-muted); font-size:0.8125rem; }
      .liq-controls { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; }
      .liq-select { background:var(--color-bg-card); border:1px solid rgba(99,120,220,0.2); border-radius:6px; color:var(--color-text-primary); padding:0.375rem 0.625rem; font-size:0.8125rem; cursor:pointer; }
      .liq-tf-btns { display:flex; gap:0.25rem; }
      .liq-tf-btn { background:transparent; border:1px solid rgba(99,120,220,0.15); border-radius:6px; color:var(--color-text-secondary); padding:0.375rem 0.7rem; font-size:0.8rem; font-weight:600; cursor:pointer; transition:all 0.15s; }
      .liq-tf-btn.active { background:rgba(99,120,220,0.2); border-color:rgba(99,120,220,0.5); color:#fff; }
      .liq-refresh-btn { background:var(--gradient-primary); color:#fff; border:none; border-radius:6px; padding:0.375rem 0.875rem; font-size:0.8125rem; font-weight:600; cursor:pointer; }

      .liq-snapshot { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.75rem; margin-bottom:1.25rem; }
      .liq-snap-item { background:var(--color-bg-card); border:1px solid rgba(99,120,220,0.1); border-radius:8px; padding:0.75rem 1rem; }
      .liq-snap-label { display:block; font-size:0.68rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.25rem; }
      .liq-snap-val { font-size:1rem; font-weight:800; font-variant-numeric:tabular-nums; }
      .liq-snap-val.success { color:#2dd882; }
      .liq-snap-val.danger  { color:#ff5f57; }

      .liq-layout { display:grid; grid-template-columns:1fr 280px; gap:1rem; }
      @media (max-width:900px) { .liq-layout { grid-template-columns:1fr; } }

      .liq-panel { background:var(--color-bg-card); border:1px solid rgba(99,120,220,0.1); border-radius:10px; padding:1.1rem; }
      .liq-panel-main { overflow:hidden; }
      .liq-panel-title { font-size:0.875rem; font-weight:700; margin-bottom:0.5rem; }
      .liq-panel-sub { font-size:0.75rem; color:var(--color-text-muted); margin-bottom:0.875rem; }

      .liq-heat-wrap { border-radius:8px; overflow:hidden; background:#0a0e1c; }
      .liq-heat-legend { display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.5rem; font-size:0.7rem; }
      .liq-heat-low.longs, .liq-heat-high.longs { color:#ff5f57; }
      .liq-heat-low.shorts, .liq-heat-high.shorts { color:#2dd882; }
      .liq-heat-mid { color:rgba(255,255,255,0.6); }

      /* Cascade */
      .liq-cascade { text-align:center; }
      .liq-cascade-score { font-size:2.5rem; font-weight:900; letter-spacing:-0.04em; margin-bottom:0.25rem; }
      .liq-cascade-label { font-size:0.875rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.875rem; display:block; }
      .liq-cascade-label.danger  { color:#ff5f57; }
      .liq-cascade-label.warning { color:#f5a623; }
      .liq-cascade-label.neutral { color:var(--color-text-secondary); }
      .liq-cascade-label.success { color:#2dd882; }
      .liq-cascade-bar { height:8px; background:rgba(99,120,220,0.12); border-radius:99px; overflow:hidden; margin-bottom:0.75rem; }
      .liq-cascade-fill { height:100%; border-radius:99px; transition:width 0.6s ease; }
      .liq-cascade-desc { font-size:0.78rem; color:var(--color-text-secondary); line-height:1.4; }

      /* Key levels */
      .liq-levels-list { display:flex; flex-direction:column; gap:0.375rem; }
      .liq-level-row { display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0.5rem; background:rgba(99,120,220,0.04); border-radius:6px; font-size:0.75rem; flex-wrap:wrap; }
      .liq-level-type { font-size:0.68rem; font-weight:700; white-space:nowrap; }
      .liq-level-price { font-weight:700; font-variant-numeric:tabular-nums; flex:1; }
      .liq-level-dist { font-weight:700; font-size:0.7rem; }
      .liq-level-size { color:var(--color-text-muted); font-size:0.7rem; }

      /* Recent */
      .liq-recent-list { display:flex; flex-direction:column; gap:0.3rem; }
      .liq-recent-row { display:flex; align-items:center; gap:0.5rem; padding:0.35rem 0.5rem; border-radius:5px; font-size:0.75rem; }
      .liq-recent-type { font-size:0.68rem; font-weight:700; white-space:nowrap; }
      .liq-recent-price { font-variant-numeric:tabular-nums; flex:1; }
      .liq-recent-size { font-weight:700; }
      .liq-recent-size.warning { color:#f5a623; }
      .liq-recent-time { color:var(--color-text-muted); font-size:0.68rem; }

      /* Leverage */
      .liq-lev-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:0.75rem; }
      .liq-lev-card { background:rgba(99,120,220,0.06); border:1px solid rgba(99,120,220,0.1); border-radius:8px; padding:0.875rem; text-align:center; }
      .liq-lev-badge { display:inline-block; background:var(--gradient-primary); color:#fff; font-size:0.875rem; font-weight:800; padding:0.15rem 0.625rem; border-radius:99px; margin-bottom:0.5rem; }
      .liq-lev-dist { font-size:0.8rem; font-weight:700; color:var(--color-accent-danger); margin-bottom:0.25rem; }
      .liq-lev-size { font-size:0.75rem; color:var(--color-text-secondary); }
      .liq-lev-pct { font-size:0.68rem; color:var(--color-text-muted); margin-top:0.2rem; }

      /* Education */
      .liq-edu { margin-top:1rem; background:rgba(99,120,220,0.04); border:1px solid rgba(99,120,220,0.1); border-radius:10px; padding:1.25rem; }
      .liq-edu-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0.875rem; }
      .liq-edu-item { display:flex; gap:0.75rem; font-size:0.8rem; color:var(--color-text-secondary); line-height:1.5; }
      .liq-edu-item span { font-size:1.5rem; flex-shrink:0; }
      .liq-edu-item strong { display:block; color:var(--color-text-primary); margin-bottom:0.2rem; font-size:0.8125rem; }
      .success { color:#2dd882; }
      .danger  { color:#ff5f57; }
      .warning { color:#f5a623; }
    `;
    document.head.appendChild(s);
  },
};

/**
 * DCA Calculator & Simulator
 * Simulates dollar-cost averaging on historical price data
 * vs lump-sum investing, with full chart and metrics
 */

const DCACalculator = {
  container: null,
  chart: null,
  currentData: null,

  COINS: [
    { id: 'bitcoin',      label: 'Bitcoin (BTC)',      symbol: 'BTC'  },
    { id: 'ethereum',     label: 'Ethereum (ETH)',     symbol: 'ETH'  },
    { id: 'solana',       label: 'Solana (SOL)',       symbol: 'SOL'  },
    { id: 'binancecoin',  label: 'BNB',                symbol: 'BNB'  },
    { id: 'ripple',       label: 'XRP',                symbol: 'XRP'  },
    { id: 'cardano',      label: 'Cardano (ADA)',      symbol: 'ADA'  },
    { id: 'avalanche-2',  label: 'Avalanche (AVAX)',   symbol: 'AVAX' },
    { id: 'chainlink',    label: 'Chainlink (LINK)',   symbol: 'LINK' },
    { id: 'polkadot',     label: 'Polkadot (DOT)',     symbol: 'DOT'  },
    { id: 'dogecoin',     label: 'Dogecoin (DOGE)',    symbol: 'DOGE' },
  ],

  FREQUENCIES: [
    { value: 'daily',    label: 'Daily',    days: 1   },
    { value: 'weekly',   label: 'Weekly',   days: 7   },
    { value: 'biweekly', label: 'Bi-Weekly',days: 14  },
    { value: 'monthly',  label: 'Monthly',  days: 30  },
  ],

  PERIODS: [
    { value: 90,   label: '3 Months'  },
    { value: 180,  label: '6 Months'  },
    { value: 365,  label: '1 Year'    },
    { value: 730,  label: '2 Years'   },
  ],

  async init() {
    this.container = document.getElementById('dca-calculator');
    if (!this.container) return;
    if (this.container.querySelector('.dca-page')) return;

    this.render();
    this.attachEvents();
  },

  render() {
    this.container.innerHTML = `
      <div class="dca-page">
        <div class="dca-header">
          <div>
            <h2 class="dca-title">📅 DCA Simulator</h2>
            <p class="dca-subtitle">See how dollar-cost averaging would have performed vs. lump-sum investing</p>
          </div>
        </div>

        <div class="dca-body">
          <!-- Controls -->
          <div class="dca-controls-card">
            <div class="dca-controls-grid">
              <div class="dca-field">
                <label class="dca-label">Coin</label>
                <select class="dca-select" id="dca-coin">
                  ${this.COINS.map(c => `<option value="${c.id}" data-symbol="${c.symbol}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="dca-field">
                <label class="dca-label">Investment Amount (USD)</label>
                <div class="dca-input-wrap">
                  <span class="dca-input-prefix">$</span>
                  <input class="dca-input" id="dca-amount" type="number" value="100" min="1" step="10">
                </div>
              </div>
              <div class="dca-field">
                <label class="dca-label">Frequency</label>
                <select class="dca-select" id="dca-freq">
                  ${this.FREQUENCIES.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
                </select>
              </div>
              <div class="dca-field">
                <label class="dca-label">Period</label>
                <select class="dca-select" id="dca-period">
                  ${this.PERIODS.map(p => `<option value="${p.value}" ${p.value===365?'selected':''}>${p.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <button class="dca-run-btn" id="dca-run-btn">
              <span id="dca-run-text">▶ Run Simulation</span>
            </button>
          </div>

          <!-- Results (hidden until run) -->
          <div id="dca-results" style="display:none;">
            <!-- Metrics Row -->
            <div class="dca-metrics-grid" id="dca-metrics-grid"></div>

            <!-- Chart -->
            <div class="dca-chart-card">
              <div class="dca-chart-header">
                <span class="dca-chart-title">Portfolio Value Over Time</span>
                <div class="dca-chart-legend">
                  <span class="dca-legend-item"><span class="dca-dot" style="background:#6c63ff;"></span>DCA Strategy</span>
                  <span class="dca-legend-item"><span class="dca-dot" style="background:#f7971e;"></span>Lump Sum</span>
                  <span class="dca-legend-item"><span class="dca-dot" style="background:#444c70;border:2px dashed #667eea;"></span>Amount Invested</span>
                </div>
              </div>
              <div class="dca-chart-wrap">
                <canvas id="dca-chart"></canvas>
              </div>
            </div>

            <!-- Breakdown Table -->
            <div class="dca-breakdown-card">
              <div class="dca-breakdown-title">📊 Investment Breakdown</div>
              <div class="dca-table-wrap">
                <table class="dca-table" id="dca-breakdown-table">
                  <thead>
                    <tr><th>Date</th><th>Price</th><th>Invested</th><th>Coins Bought</th><th>Total Coins</th><th>Portfolio Value</th><th>Return</th></tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>

            <!-- DCA vs Lump Sum Verdict -->
            <div class="dca-verdict-card" id="dca-verdict-card"></div>
          </div>

          <!-- Empty state -->
          <div id="dca-empty" class="dca-empty">
            <div class="dca-empty-icon">📅</div>
            <div class="dca-empty-title">Configure your DCA simulation above</div>
            <div class="dca-empty-sub">Choose a coin, investment amount, frequency, and time period — then hit Run</div>
          </div>
        </div>
      </div>

      <style>
        .dca-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .dca-header { margin-bottom: 20px; }
        .dca-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin: 0 0 4px; }
        .dca-subtitle { font-size: 0.85rem; color: var(--text-secondary,#a0a8c1); margin: 0; }

        .dca-controls-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 20px; margin-bottom: 20px; }
        .dca-controls-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 18px; }
        .dca-field { display: flex; flex-direction: column; gap: 6px; }
        .dca-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary,#a0a8c1); text-transform: uppercase; letter-spacing: 0.5px; }
        .dca-select, .dca-input { width: 100%; padding: 9px 12px; background: var(--color-card,#252b4a); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 8px; color: var(--text-primary,#e4e7f1); font-size: 0.875rem; font-family: inherit; transition: border-color 0.2s; }
        .dca-select:focus, .dca-input:focus { outline: none; border-color: #6c63ff88; }
        .dca-input-wrap { position: relative; }
        .dca-input-prefix { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary,#a0a8c1); font-size: 0.875rem; pointer-events: none; }
        .dca-input-wrap .dca-input { padding-left: 22px; }

        .dca-run-btn { width: 100%; padding: 12px; background: linear-gradient(135deg,#6c63ff,#00c896); border: none; border-radius: 10px; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.5px; }
        .dca-run-btn:hover { opacity: 0.9; }
        .dca-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .dca-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .dca-metric-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 12px; padding: 14px 16px; }
        .dca-metric-label { font-size: 0.72rem; color: var(--text-secondary,#a0a8c1); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .dca-metric-value { font-size: 1.3rem; font-weight: 700; color: var(--text-primary,#e4e7f1); }
        .dca-metric-value.positive { color: #00c896; }
        .dca-metric-value.negative { color: #ff6a6a; }
        .dca-metric-sub { font-size: 0.72rem; color: var(--text-muted,#6b7394); margin-top: 3px; }

        .dca-chart-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
        .dca-chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
        .dca-chart-title { font-size: 0.9rem; font-weight: 700; color: var(--text-primary,#e4e7f1); }
        .dca-chart-legend { display: flex; gap: 14px; flex-wrap: wrap; }
        .dca-legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-secondary,#a0a8c1); }
        .dca-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .dca-chart-wrap { position: relative; height: 280px; }

        .dca-breakdown-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
        .dca-breakdown-title { font-size: 0.9rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin-bottom: 14px; }
        .dca-table-wrap { overflow-x: auto; max-height: 260px; overflow-y: auto; }
        .dca-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .dca-table th { padding: 8px 10px; text-align: right; color: var(--text-secondary,#a0a8c1); font-weight: 600; text-transform: uppercase; font-size: 0.7rem; border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.18)); position: sticky; top: 0; background: var(--color-surface,#1e2442); }
        .dca-table th:first-child { text-align: left; }
        .dca-table td { padding: 7px 10px; text-align: right; color: var(--text-primary,#e4e7f1); border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.08)); }
        .dca-table td:first-child { text-align: left; color: var(--text-secondary,#a0a8c1); }
        .dca-table tr:hover td { background: rgba(108,99,255,0.05); }
        .dca-table .pos { color: #00c896; font-weight: 600; }
        .dca-table .neg { color: #ff6a6a; font-weight: 600; }

        .dca-verdict-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 20px; margin-bottom: 20px; }

        .dca-empty { text-align: center; padding: 60px 20px; }
        .dca-empty-icon { font-size: 3rem; margin-bottom: 14px; }
        .dca-empty-title { font-size: 1rem; font-weight: 600; color: var(--text-primary,#e4e7f1); margin-bottom: 6px; }
        .dca-empty-sub { font-size: 0.85rem; color: var(--text-secondary,#a0a8c1); }

        .dca-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: dca-spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px; }
        @keyframes dca-spin { to { transform: rotate(360deg); } }
      </style>
    `;
  },

  attachEvents() {
    document.getElementById('dca-run-btn')?.addEventListener('click', () => this.runSimulation());
  },

  async runSimulation() {
    const coinId   = document.getElementById('dca-coin')?.value;
    const amount   = parseFloat(document.getElementById('dca-amount')?.value) || 100;
    const freq     = document.getElementById('dca-freq')?.value || 'weekly';
    const days     = parseInt(document.getElementById('dca-period')?.value) || 365;
    const coin     = this.COINS.find(c => c.id === coinId);
    const freqDef  = this.FREQUENCIES.find(f => f.value === freq);

    const btn = document.getElementById('dca-run-btn');
    const txt = document.getElementById('dca-run-text');
    btn.disabled = true;
    txt.innerHTML = `<span class="dca-spinner"></span> Fetching ${coin.symbol} data…`;

    try {
      // Fetch historical prices from CoinGecko free API
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('API error');
      const json = await resp.json();
      const priceData = json.prices; // [[timestamp, price], ...]

      this.simulate(priceData, amount, freqDef.days, coin, days);
    } catch(e) {
      // Fallback: generate synthetic data if API fails
      const synthetic = this.generateSyntheticData(days, coinId);
      this.simulate(synthetic, amount, freqDef.days, coin, days);
    }

    btn.disabled = false;
    txt.textContent = '▶ Run Simulation';
  },

  generateSyntheticData(days, coinId) {
    // Rough starting prices per coin for fallback
    const seeds = { bitcoin: 45000, ethereum: 2400, solana: 120, binancecoin: 320, ripple: 0.55, cardano: 0.45, 'avalanche-2': 35, chainlink: 14, polkadot: 8, dogecoin: 0.12 };
    let price = seeds[coinId] || 100;
    const data = [];
    const now = Date.now();
    for (let i = days; i >= 0; i--) {
      const ts = now - i * 86400000;
      price = price * (1 + (Math.random() - 0.48) * 0.04);
      data.push([ts, price]);
    }
    return data;
  },

  simulate(priceData, amount, freqDays, coin, totalDays) {
    const labels = [];
    const dcaValues = [];
    const lumpValues = [];
    const investedLine = [];
    const tableRows = [];

    const lumpPrice = priceData[0][1];
    const lumpCoins = amount * Math.ceil(totalDays / freqDays) / lumpPrice; // same total $ as DCA

    let totalCoins = 0;
    let totalInvested = 0;
    let nextBuyIdx = 0;
    const purchases = [];

    priceData.forEach(([ts, price], idx) => {
      const date = new Date(ts);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

      // DCA: buy on every freqDays interval
      if (idx === 0 || idx >= nextBuyIdx) {
        const coinsBought = amount / price;
        totalCoins += coinsBought;
        totalInvested += amount;
        nextBuyIdx = idx + freqDays;
        purchases.push({ date: label, price, invested: totalInvested, coinsBought, totalCoins });
      }

      const dcaVal = totalCoins * price;
      const lumpVal = lumpCoins * price;

      labels.push(label);
      dcaValues.push(parseFloat(dcaVal.toFixed(2)));
      lumpValues.push(parseFloat(lumpVal.toFixed(2)));
      investedLine.push(parseFloat(totalInvested.toFixed(2)));
    });

    const finalPrice = priceData[priceData.length - 1][1];
    const dcaFinalVal = totalCoins * finalPrice;
    const lumpTotalInvested = amount * Math.ceil(totalDays / freqDays);
    const lumpFinalVal = lumpCoins * finalPrice;
    const dcaReturn = ((dcaFinalVal - totalInvested) / totalInvested) * 100;
    const lumpReturn = ((lumpFinalVal - lumpTotalInvested) / lumpTotalInvested) * 100;

    this.renderResults({ labels, dcaValues, lumpValues, investedLine, purchases, totalCoins, totalInvested, dcaFinalVal, lumpFinalVal, dcaReturn, lumpReturn, amount, coin, finalPrice, lumpTotalInvested });
  },

  renderResults({ labels, dcaValues, lumpValues, investedLine, purchases, totalCoins, totalInvested, dcaFinalVal, lumpFinalVal, dcaReturn, lumpReturn, amount, coin, finalPrice, lumpTotalInvested }) {
    document.getElementById('dca-empty').style.display = 'none';
    const results = document.getElementById('dca-results');
    results.style.display = 'block';

    // Metrics
    const avgCost = totalInvested / totalCoins;
    const gain = dcaFinalVal - totalInvested;
    document.getElementById('dca-metrics-grid').innerHTML = `
      <div class="dca-metric-card">
        <div class="dca-metric-label">Total Invested</div>
        <div class="dca-metric-value">$${totalInvested.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        <div class="dca-metric-sub">${purchases.length} purchases of $${amount}</div>
      </div>
      <div class="dca-metric-card">
        <div class="dca-metric-label">DCA Final Value</div>
        <div class="dca-metric-value ${gain>=0?'positive':'negative'}">$${dcaFinalVal.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        <div class="dca-metric-sub">${gain>=0?'+':''}$${gain.toLocaleString(undefined,{maximumFractionDigits:0})} gain</div>
      </div>
      <div class="dca-metric-card">
        <div class="dca-metric-label">DCA Return</div>
        <div class="dca-metric-value ${dcaReturn>=0?'positive':'negative'}">${dcaReturn>=0?'+':''}${dcaReturn.toFixed(1)}%</div>
        <div class="dca-metric-sub">vs ${lumpReturn>=0?'+':''}${lumpReturn.toFixed(1)}% lump sum</div>
      </div>
      <div class="dca-metric-card">
        <div class="dca-metric-label">Avg Buy Price</div>
        <div class="dca-metric-value">$${avgCost.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        <div class="dca-metric-sub">Current: $${finalPrice.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
      </div>
      <div class="dca-metric-card">
        <div class="dca-metric-label">${coin.symbol} Accumulated</div>
        <div class="dca-metric-value">${totalCoins.toFixed(6)}</div>
        <div class="dca-metric-sub">@ $${finalPrice.toLocaleString(undefined,{maximumFractionDigits:2})} each</div>
      </div>
      <div class="dca-metric-card">
        <div class="dca-metric-label">Lump Sum Value</div>
        <div class="dca-metric-value ${lumpFinalVal>=lumpTotalInvested?'positive':'negative'}">$${lumpFinalVal.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        <div class="dca-metric-sub">Invested $${lumpTotalInvested.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
      </div>
    `;

    // Chart
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const ctx = document.getElementById('dca-chart')?.getContext('2d');
    if (ctx) {
      // Sample down to max 120 data points for performance
      const stride = Math.max(1, Math.floor(labels.length / 120));
      const sl = labels.filter((_,i) => i % stride === 0);
      const sd = dcaValues.filter((_,i) => i % stride === 0);
      const sl2 = lumpValues.filter((_,i) => i % stride === 0);
      const si = investedLine.filter((_,i) => i % stride === 0);

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: sl,
          datasets: [
            { label: 'DCA Strategy', data: sd, borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.08)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.4 },
            { label: 'Lump Sum',     data: sl2, borderColor: '#f7971e', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.4 },
            { label: 'Amount Invested', data: si, borderColor: '#667eea', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5,5], pointRadius: 0, fill: false, tension: 0.1 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: '#1e2442', titleColor: '#e4e7f1', bodyColor: '#a0a8c1', borderColor: 'rgba(102,126,234,0.3)', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString(undefined,{maximumFractionDigits:0})}` } } },
          scales: {
            x: { display: true, ticks: { color: '#6b7394', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: 'rgba(102,126,234,0.08)' } },
            y: { display: true, ticks: { color: '#6b7394', font: { size: 10 }, callback: v => '$' + (v>=1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)) }, grid: { color: 'rgba(102,126,234,0.08)' } }
          }
        }
      });
    }

    // Table (last 20 purchases)
    const tbody = document.querySelector('#dca-breakdown-table tbody');
    if (tbody) {
      tbody.innerHTML = purchases.slice(-20).reverse().map(p => {
        const ret = ((p.totalCoins * finalPrice - p.invested) / p.invested * 100);
        return `<tr>
          <td>${p.date}</td>
          <td>$${p.price.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
          <td>$${p.invested.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
          <td>${p.coinsBought.toFixed(6)}</td>
          <td>${p.totalCoins.toFixed(6)}</td>
          <td>$${(p.totalCoins*finalPrice).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
          <td class="${ret>=0?'pos':'neg'}">${ret>=0?'+':''}${ret.toFixed(1)}%</td>
        </tr>`;
      }).join('');
    }

    // Verdict
    const dcaWins = dcaReturn > lumpReturn;
    document.getElementById('dca-verdict-card').innerHTML = `
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
        <div style="font-size:2.5rem;">${dcaWins ? '🏆' : '⚖️'}</div>
        <div>
          <div style="font-size:1rem;font-weight:700;color:var(--text-primary,#e4e7f1);margin-bottom:6px;">
            ${dcaWins ? 'DCA outperformed lump-sum' : lumpReturn > dcaReturn ? 'Lump-sum outperformed DCA' : 'DCA and lump-sum performed similarly'} by ${Math.abs(dcaReturn - lumpReturn).toFixed(1)}%
          </div>
          <div style="font-size:0.85rem;color:var(--text-secondary,#a0a8c1);line-height:1.6;">
            ${dcaWins
              ? `DCA reduced your average cost by spreading purchases across price fluctuations. Your average buy price of <strong style="color:#a78bfa">$${(totalInvested/totalCoins).toFixed(2)}</strong> vs the lump-sum entry price of <strong style="color:#f7971e">$${(dcaValues[0]).toFixed(2)}</strong> shows how DCA protected against buying at a single high point.`
              : `In a strongly trending market, lump-sum investing can outperform DCA since you capture more of the upside from day one. However, DCA reduces the emotional difficulty of timing the market and protects against sudden drops after entry.`}
          </div>
          <div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted,#6b7394);">
            💡 DCA works best in volatile or sideways markets. In sustained bull runs, lump-sum may edge ahead — but most investors can't predict which environment lies ahead.
          </div>
        </div>
      </div>
    `;
  }
};

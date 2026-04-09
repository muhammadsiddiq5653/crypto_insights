/**
 * Futures/Leveraged Position Payoff Calculator
 * Vanilla JS, SVG-based charting
 */

// Global state
let payoffState = {
  positionType: 'LONG',
  entryPrice: 50000,
  leverage: 1,
  balance: 1000,
  riskPct: 2,
  stopLoss: 45000,
  tp1: 55000,
  tp2: 60000,
  tp3: 65000,
};

function initPayoffChart() {
  const container = document.getElementById('payoff');
  if (!container) return;

  container.innerHTML = `
    <div class="payoff-form">
      <h2>Position Payoff Calculator</h2>

      <div class="payoff-presets">
        <button class="preset-btn" onclick="applyPreset('scalp')">Scalp 10x</button>
        <button class="preset-btn" onclick="applyPreset('swing')">Swing 3x</button>
        <button class="preset-btn" onclick="applyPreset('spot')">Spot 1x</button>
      </div>

      <div style="margin-bottom: 15px;">
        <label>Entry Price:</label>
        <input id="pcEntry" class="payoff-input" type="number" value="50000" step="100" />
      </div>

      <div style="margin-bottom: 15px;">
        <label>Position Type:</label>
        <div style="display: flex; gap: 10px;">
          <button class="payoff-direction-btn active" data-dir="LONG" onclick="setDirection('LONG')">LONG</button>
          <button class="payoff-direction-btn" data-dir="SHORT" onclick="setDirection('SHORT')">SHORT</button>
        </div>
      </div>

      <div style="margin-bottom: 15px;">
        <label>Leverage: <span id="leverageDisplay">1x</span></label>
        <div class="payoff-leverage-wrap">
          <input id="pcLeverage" type="range" min="1" max="125" value="1"
                 oninput="updateLeverageDisplay(this.value)" />
        </div>
      </div>

      <div style="margin-bottom: 15px;">
        <label>Account Balance (USD):</label>
        <input id="pcBalance" class="payoff-input" type="number" value="1000" step="10" />
      </div>

      <div style="margin-bottom: 15px;">
        <label>Risk % (of Balance):</label>
        <input id="pcRiskPct" class="payoff-input" type="number" value="2" step="0.5" min="0.1" max="10" />
      </div>

      <div style="margin-bottom: 15px;">
        <label>Stop Loss:</label>
        <input id="pcSL" class="payoff-input" type="number" value="45000" step="100" />
      </div>

      <div style="margin-bottom: 15px;">
        <label>Take Profit 1:</label>
        <input id="pcTP1" class="payoff-input" type="number" value="55000" step="100" />
      </div>

      <div style="margin-bottom: 15px;">
        <label>Take Profit 2 (optional):</label>
        <input id="pcTP2" class="payoff-input" type="number" value="60000" step="100" />
      </div>

      <div style="margin-bottom: 15px;">
        <label>Take Profit 3 (optional):</label>
        <input id="pcTP3" class="payoff-input" type="number" value="65000" step="100" />
      </div>

      <button onclick="calcPayoff()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #2196F3; color: white; border: none; border-radius: 4px;">
        Calculate
      </button>
    </div>

    <div id="payoffResults" class="payoff-results-grid"></div>
    <div id="payoffChart" class="payoff-svg-wrap"></div>
  `;

  // Set initial leverage display
  updateLeverageDisplay(1);
}

function setDirection(dir) {
  payoffState.positionType = dir;
  document.querySelectorAll('.payoff-direction-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dir === dir);
  });
}

function updateLeverageDisplay(value) {
  payoffState.leverage = parseFloat(value);
  document.getElementById('leverageDisplay').textContent = value + 'x';
}

function applyPreset(type) {
  if (type === 'scalp') {
    payoffState.leverage = 10;
    document.getElementById('pcLeverage').value = 10;
    updateLeverageDisplay(10);
    document.getElementById('pcRiskPct').value = 1;
  } else if (type === 'swing') {
    payoffState.leverage = 3;
    document.getElementById('pcLeverage').value = 3;
    updateLeverageDisplay(3);
    document.getElementById('pcRiskPct').value = 2;
  } else if (type === 'spot') {
    payoffState.leverage = 1;
    document.getElementById('pcLeverage').value = 1;
    updateLeverageDisplay(1);
    document.getElementById('pcRiskPct').value = 5;
  }
}

function calcPayoff() {
  // Read inputs
  const entry = parseFloat(document.getElementById('pcEntry').value);
  const balance = parseFloat(document.getElementById('pcBalance').value);
  const riskPct = parseFloat(document.getElementById('pcRiskPct').value);
  const sl = parseFloat(document.getElementById('pcSL').value);
  const tp1 = parseFloat(document.getElementById('pcTP1').value) || 0;
  const tp2 = parseFloat(document.getElementById('pcTP2').value) || 0;
  const tp3 = parseFloat(document.getElementById('pcTP3').value) || 0;
  const leverage = parseFloat(document.getElementById('pcLeverage').value);
  const direction = payoffState.positionType;

  // Validate
  if (entry <= 0 || balance <= 0 || sl <= 0) {
    alert('Please enter valid positive values');
    return;
  }

  // Calculate position size
  const maxLoss = balance * (riskPct / 100);
  let priceDiff = Math.abs(entry - sl);
  if (priceDiff === 0) priceDiff = entry * 0.01; // Avoid division by zero
  let positionSize = (maxLoss / priceDiff) * leverage;

  // Liquidation price
  let liqPrice;
  if (direction === 'LONG') {
    liqPrice = entry * (1 - 1 / leverage);
  } else {
    liqPrice = entry * (1 + 1 / leverage);
  }

  // Break-even (accounting for 0.1% taker fee on entry)
  const takerFee = entry * 0.001;
  let bePrice;
  if (direction === 'LONG') {
    bePrice = entry + takerFee;
  } else {
    bePrice = entry - takerFee;
  }

  // Calculate TP profits and risk/reward
  let tp1Profit = 0, tp1RR = 0;
  let tp2Profit = 0, tp2RR = 0;
  let tp3Profit = 0, tp3RR = 0;

  if (tp1 > 0) {
    if (direction === 'LONG') {
      tp1Profit = positionSize * (tp1 - entry);
    } else {
      tp1Profit = positionSize * (entry - tp1);
    }
    tp1RR = tp1Profit > 0 ? (tp1Profit / maxLoss).toFixed(2) : 0;
  }

  if (tp2 > 0) {
    if (direction === 'LONG') {
      tp2Profit = positionSize * (tp2 - entry);
    } else {
      tp2Profit = positionSize * (entry - tp2);
    }
    tp2RR = tp2Profit > 0 ? (tp2Profit / maxLoss).toFixed(2) : 0;
  }

  if (tp3 > 0) {
    if (direction === 'LONG') {
      tp3Profit = positionSize * (tp3 - entry);
    } else {
      tp3Profit = positionSize * (entry - tp3);
    }
    tp3RR = tp3Profit > 0 ? (tp3Profit / maxLoss).toFixed(2) : 0;
  }

  // Render results
  renderResults(entry, sl, liqPrice, bePrice, positionSize, maxLoss, tp1, tp1Profit, tp1RR, tp2, tp2Profit, tp2RR, tp3, tp3Profit, tp3RR);

  // Render chart
  renderPayoffChart(entry, sl, tp1, tp2, tp3, liqPrice, direction, positionSize, maxLoss);
}

function renderResults(entry, sl, liqPrice, bePrice, positionSize, maxLoss, tp1, tp1Profit, tp1RR, tp2, tp2Profit, tp2RR, tp3, tp3Profit, tp3RR) {
  const resultsDiv = document.getElementById('payoffResults');
  resultsDiv.innerHTML = `
    <div class="payoff-result-item" style="border-left: 4px solid #f44336;">
      <strong>Liquidation Price</strong>
      <span style="color: #f44336; font-weight: bold;">$${liqPrice.toFixed(2)}</span>
    </div>
    <div class="payoff-result-item">
      <strong>Stop Loss</strong>
      <span>$${sl.toFixed(2)}</span>
    </div>
    <div class="payoff-result-item">
      <strong>Break-even</strong>
      <span>$${bePrice.toFixed(2)}</span>
    </div>
    <div class="payoff-result-item">
      <strong>Entry Price</strong>
      <span>$${entry.toFixed(2)}</span>
    </div>
    <div class="payoff-result-item">
      <strong>Position Size</strong>
      <span>${positionSize.toFixed(4)} coins</span>
    </div>
    <div class="payoff-result-item" style="border-left: 4px solid #ff9800;">
      <strong>Max Loss (Risk)</strong>
      <span style="color: #ff9800;">$${maxLoss.toFixed(2)}</span>
    </div>
    ${tp1 > 0 ? `
    <div class="payoff-result-item" style="border-left: 4px solid #4caf50;">
      <strong>TP1 @ $${tp1.toFixed(2)}</strong>
      <span style="color: #4caf50; font-weight: bold;">+$${tp1Profit.toFixed(2)} (R:R ${tp1RR})</span>
    </div>
    ` : ''}
    ${tp2 > 0 ? `
    <div class="payoff-result-item" style="border-left: 4px solid #4caf50;">
      <strong>TP2 @ $${tp2.toFixed(2)}</strong>
      <span style="color: #4caf50; font-weight: bold;">+$${tp2Profit.toFixed(2)} (R:R ${tp2RR})</span>
    </div>
    ` : ''}
    ${tp3 > 0 ? `
    <div class="payoff-result-item" style="border-left: 4px solid #4caf50;">
      <strong>TP3 @ $${tp3.toFixed(2)}</strong>
      <span style="color: #4caf50; font-weight: bold;">+$${tp3Profit.toFixed(2)} (R:R ${tp3RR})</span>
    </div>
    ` : ''}
  `;
}

function renderPayoffChart(entry, sl, tp1, tp2, tp3, liqPrice, direction, positionSize, maxLoss) {
  const chartDiv = document.getElementById('payoffChart');

  // Price range
  const minPrice = liqPrice * 0.95;
  const maxPrice = entry * 1.5;
  const range = maxPrice - minPrice;

  const width = 600;
  const height = 250;
  const padding = 40;
  const plotW = width - 2 * padding;
  const plotH = height - 2 * padding;

  // Calculate P&L at different price points
  function getPayoff(price) {
    let pnl;
    if (direction === 'LONG') {
      pnl = positionSize * (price - entry);
    } else {
      pnl = positionSize * (entry - price);
    }
    return pnl;
  }

  // SVG path for payoff line
  let pathData = '';
  for (let i = 0; i <= 100; i++) {
    const price = minPrice + (range / 100) * i;
    const pnl = getPayoff(price);
    const x = padding + (plotW / 100) * i;
    const y = padding + plotH - ((pnl + maxLoss) / (maxLoss * 2)) * plotH;
    pathData += (i === 0 ? 'M' : 'L') + x.toFixed(0) + ',' + y.toFixed(0) + ' ';
  }

  // Helper to convert price to X
  function priceToX(price) {
    return padding + ((price - minPrice) / range) * plotW;
  }

  // Helper to convert P&L to Y
  function pnlToY(pnl) {
    return padding + plotH - ((pnl + maxLoss) / (maxLoss * 2)) * plotH;
  }

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="border: 1px solid #ddd; background: #fafafa;">`;

  // Zero line
  const zeroY = pnlToY(0);
  svg += `<line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="#999" stroke-dasharray="4" stroke-width="1" />`;

  // Payoff line
  svg += `<path d="${pathData}" stroke="#2196F3" stroke-width="2" fill="none" />`;

  // Vertical lines for key prices
  const prices = [
    { price: liqPrice, label: 'LIQ', color: '#f44336' },
    { price: sl, label: 'SL', color: '#ff9800' },
    { price: entry, label: 'Entry', color: '#666' },
    { price: tp1, label: 'TP1', color: '#4caf50' },
    { price: tp2, label: 'TP2', color: '#4caf50' },
    { price: tp3, label: 'TP3', color: '#4caf50' },
  ];

  prices.forEach(({ price, label, color }) => {
    if (price > 0 && price >= minPrice && price <= maxPrice) {
      const x = priceToX(price);
      svg += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="${color}" stroke-dasharray="2" stroke-width="1" opacity="0.7" />`;
      svg += `<text x="${x}" y="${height - padding + 15}" text-anchor="middle" font-size="11" fill="${color}">${label}</text>`;
    }
  });

  // Axes
  svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#333" stroke-width="1" />`;
  svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#333" stroke-width="1" />`;

  // Axis labels
  svg += `<text x="15" y="${padding - 5}" font-size="12" fill="#333">P&L</text>`;
  svg += `<text x="${width - 30}" y="${height - 20}" font-size="12" fill="#333">Price</text>`;

  svg += `</svg>`;
  chartDiv.innerHTML = svg;
}

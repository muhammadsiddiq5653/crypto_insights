/**
 * dashboardWidgets.js - Enhanced dashboard widgets
 * Portfolio card, winners/losers, market heatmap, and signal summary
 */

let dashboardWidgetsInterval = null;

function initDashboardWidgets() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) return;

  // Check if already initialized
  if (document.getElementById('dashWidgets')) {
    refreshDashboardWidgets();
    return;
  }

  // Create widgets container
  const dashWidgets = document.createElement('div');
  dashWidgets.id = 'dashWidgets';
  dashWidgets.className = 'dw-grid';

  // Widget 1: Portfolio Value Card
  const portfolioCard = createPortfolioCard();
  dashWidgets.appendChild(portfolioCard);

  // Widget 2: Winners/Losers
  const winnersLosersCard = createWinnersLosersCard();
  dashWidgets.appendChild(winnersLosersCard);

  // Widget 3: Market Heatmap
  const heatmapCard = createMarketHeatmap();
  dashWidgets.appendChild(heatmapCard);

  // Widget 4: Signal Summary
  const signalCard = createSignalSummary();
  dashWidgets.appendChild(signalCard);

  // Append to dashboard
  dashboard.appendChild(dashWidgets);

  // Set up refresh interval (60 seconds)
  if (dashboardWidgetsInterval) clearInterval(dashboardWidgetsInterval);
  dashboardWidgetsInterval = setInterval(refreshDashboardWidgets, 60000);

  // Initial refresh with prices
  refreshDashboardWidgets();
}

function createPortfolioCard() {
  const card = document.createElement('div');
  card.className = 'dw-card dw-portfolio-card';
  card.id = 'portfolioCard';
  card.innerHTML = `
    <div class="dw-card-title">📊 Portfolio Value</div>
    <div class="dw-portfolio-stats">
      <div class="dw-stat">
        <span class="dw-stat-label">Total Value</span>
        <span class="dw-stat-value" id="portfolioTotal">$0.00</span>
      </div>
      <div class="dw-stat">
        <span class="dw-stat-label">Total Cost</span>
        <span class="dw-stat-value" id="portfolioCost">$0.00</span>
      </div>
      <div class="dw-stat">
        <span class="dw-stat-label">P&L</span>
        <span class="dw-stat-value" id="portfolioPnL">$0.00</span>
      </div>
      <div class="dw-stat">
        <span class="dw-stat-label">Today's Change</span>
        <span class="dw-stat-value" id="portfolioChange">$0.00</span>
      </div>
    </div>
    <div class="dw-portfolio-msg" id="portfolioMsg"></div>
  `;
  return card;
}

function createWinnersLosersCard() {
  const card = document.createElement('div');
  card.className = 'dw-card dw-winners-losers';
  card.id = 'winnersLosersCard';
  card.innerHTML = `
    <div class="dw-card-title">🏆 Winners & Losers</div>
    <div style="display: flex; gap: 20px; margin-top: 15px;">
      <div class="dw-wl-col">
        <h4 style="color: #22c55e; margin: 0 0 10px 0; font-size: 14px;">Top Gainers</h4>
        <div class="dw-wl-list" id="gainers"></div>
      </div>
      <div class="dw-wl-col">
        <h4 style="color: #ef4444; margin: 0 0 10px 0; font-size: 14px;">Top Losers</h4>
        <div class="dw-wl-list" id="losers"></div>
      </div>
    </div>
  `;
  return card;
}

function createMarketHeatmap() {
  const card = document.createElement('div');
  card.className = 'dw-card dw-market-heatmap';
  card.id = 'heatmapCard';
  card.innerHTML = `
    <div class="dw-card-title">🔥 Market Heatmap</div>
    <div class="dw-heatmap" id="heatmapGrid"></div>
  `;
  return card;
}

function createSignalSummary() {
  const card = document.createElement('div');
  card.className = 'dw-card dw-signal-summary';
  card.id = 'signalCard';
  card.innerHTML = `
    <div class="dw-card-title">📈 Signal Summary</div>
    <div class="dw-signal-stats">
      <div class="dw-stat">
        <span class="dw-stat-label">Total Logged</span>
        <span class="dw-stat-value" id="signalTotal">0</span>
      </div>
      <div class="dw-stat">
        <span class="dw-stat-label">Win Rate</span>
        <span class="dw-stat-value" id="signalWinRate">0%</span>
      </div>
      <div class="dw-stat">
        <span class="dw-stat-label">Last Signal</span>
        <span class="dw-stat-value" id="signalLast">-</span>
      </div>
    </div>
    <button class="dw-btn" id="viewSignalsBtn">View All →</button>
  `;
  return card;
}

function refreshDashboardWidgets() {
  // Fetch latest prices if not already available
  if (!window._latestPrices) {
    fetch('/api/crypto/prices')
      .then(res => res.json())
      .then(data => {
        window._latestPrices = data;
        updatePortfolioWidget();
        updateWinnersLosersWidget();
        updateHeatmapWidget();
        updateSignalWidget();
      })
      .catch(err => console.error('Failed to fetch prices:', err));
  } else {
    updatePortfolioWidget();
    updateWinnersLosersWidget();
    updateHeatmapWidget();
    updateSignalWidget();
  }
}

function updatePortfolioWidget() {
  const portfolio = JSON.parse(localStorage.getItem('tp_portfolio') || '[]');
  const prices = window._latestPrices || {};

  if (portfolio.length === 0) {
    const msg = document.getElementById('portfolioMsg');
    if (msg) msg.textContent = 'Add holdings in Portfolio section.';
    return;
  }

  let totalValue = 0;
  let totalCost = 0;

  portfolio.forEach(holding => {
    const price = prices[holding.symbol]?.price || 0;
    const value = holding.qty * price;
    const cost = holding.qty * holding.avgPrice;
    totalValue += value;
    totalCost += cost;
  });

  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  document.getElementById('portfolioTotal').textContent = '$' + totalValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  document.getElementById('portfolioCost').textContent = '$' + totalCost.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const pnlEl = document.getElementById('portfolioPnL');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + pnl.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  pnlEl.style.color = pnl >= 0 ? '#22c55e' : '#ef4444';
}

function updateWinnersLosersWidget() {
  const prices = window._latestPrices || {};
  const coins = Object.entries(prices).map(([symbol, data]) => ({
    symbol,
    change: data.change24h || 0
  }));

  coins.sort((a, b) => b.change - a.change);

  const gainersContainer = document.getElementById('gainers');
  const losersContainer = document.getElementById('losers');

  if (gainersContainer) {
    gainersContainer.innerHTML = coins.slice(0, 3)
      .map(c => `<div class="dw-wl-item up">
        <span>${c.symbol}</span>
        <span style="color: #22c55e;">▲ ${Math.abs(c.change).toFixed(2)}%</span>
      </div>`)
      .join('');
  }

  if (losersContainer) {
    losersContainer.innerHTML = coins.slice(-3).reverse()
      .map(c => `<div class="dw-wl-item down">
        <span>${c.symbol}</span>
        <span style="color: #ef4444;">▼ ${Math.abs(c.change).toFixed(2)}%</span>
      </div>`)
      .join('');
  }
}

function updateHeatmapWidget() {
  const heatmapCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX'];
  const prices = window._latestPrices || {};
  const grid = document.getElementById('heatmapGrid');

  if (!grid) return;

  grid.innerHTML = heatmapCoins.map(symbol => {
    const data = prices[symbol];
    const change = data?.change24h || 0;
    let bgColor = '#4b5563';

    if (change > 5) bgColor = '#0d472a';
    else if (change > 2) bgColor = '#15803d';
    else if (change > 0) bgColor = '#4ade80';
    else if (change < -5) bgColor = '#4f0f1f';
    else if (change < -2) bgColor = '#b91c1c';
    else if (change < 0) bgColor = '#fca5a5';

    return `<div class="dw-heatmap-tile" style="background-color: ${bgColor};">
      <div>${symbol}</div>
      <div style="font-size: 12px; margin-top: 4px;">${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%</div>
    </div>`;
  }).join('');
}

function updateSignalWidget() {
  const signals = JSON.parse(localStorage.getItem('tp_signal_history') || '[]');

  const totalEl = document.getElementById('signalTotal');
  const winRateEl = document.getElementById('signalWinRate');
  const lastEl = document.getElementById('signalLast');

  if (totalEl) totalEl.textContent = signals.length;

  if (signals.length > 0) {
    const wins = signals.filter(s => s.closed && s.profit > 0).length;
    const winRate = signals.length > 0 ? Math.round((wins / signals.length) * 100) : 0;
    if (winRateEl) winRateEl.textContent = winRate + '%';

    const last = signals[signals.length - 1];
    if (lastEl) {
      const timeAgo = getTimeAgo(new Date(last.timestamp));
      lastEl.textContent = `${last.symbol} ${last.direction} ${timeAgo}`;
    }
  }

  const viewBtn = document.getElementById('viewSignalsBtn');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      if (typeof switchSection === 'function') {
        switchSection('signal-history');
      }
    });
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

function cleanupDashboardWidgets() {
  if (dashboardWidgetsInterval) {
    clearInterval(dashboardWidgetsInterval);
    dashboardWidgetsInterval = null;
  }
}

window.initDashboardWidgets = initDashboardWidgets;
window.refreshDashboardWidgets = refreshDashboardWidgets;
window.cleanupDashboardWidgets = cleanupDashboardWidgets;

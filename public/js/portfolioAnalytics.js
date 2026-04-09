/**
 * Portfolio Analytics Module
 * Renders deep portfolio analytics with tabs: Overview, Performance, Risk, Signals
 * Reads from localStorage: tp_portfolio, tp_trade_journal, tp_signal_history
 */

function initPortfolioAnalytics() {
  const container = document.getElementById('portfolio-analytics');
  if (!container) return;

  // Load data from localStorage
  const portfolio = JSON.parse(localStorage.getItem('tp_portfolio') || '[]');
  const journal = JSON.parse(localStorage.getItem('tp_trade_journal') || '[]');
  const signals = JSON.parse(localStorage.getItem('tp_signal_history') || '[]');

  // Check if data exists
  if (portfolio.length === 0 && journal.length === 0 && signals.length === 0) {
    container.innerHTML = `
      <div class="pa-empty-state">
        <h3>No Analytics Data Available</h3>
        <p>Start by adding trades and portfolio positions to see detailed analytics.</p>
        <p>Your data will appear here once you:</p>
        <ul>
          <li>Add portfolio holdings</li>
          <li>Log trades in your trade journal</li>
          <li>Track trading signals</li>
        </ul>
      </div>
    `;
    return;
  }

  // Create tabs structure
  container.innerHTML = `
    <div class="pa-tabs">
      <div class="pa-tab-buttons">
        <button class="pa-tab-btn active" data-tab="overview">Overview</button>
        <button class="pa-tab-btn" data-tab="performance">Performance</button>
        <button class="pa-tab-btn" data-tab="risk">Risk</button>
        <button class="pa-tab-btn" data-tab="signals">Signals</button>
      </div>
      <div class="pa-panels">
        <div id="overview-panel" class="pa-panel active"></div>
        <div id="performance-panel" class="pa-panel"></div>
        <div id="risk-panel" class="pa-panel"></div>
        <div id="signals-panel" class="pa-panel"></div>
      </div>
    </div>
  `;

  // Render tab content
  renderOverview(portfolio);
  renderPerformance(portfolio, journal, signals);
  renderRisk(portfolio, journal, signals);
  renderSignals(signals);

  // Tab switching
  container.querySelectorAll('.pa-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      container.querySelectorAll('.pa-tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.pa-panel').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      document.getElementById(`${tabName}-panel`).classList.add('active');
    });
  });
}

function renderOverview(portfolio) {
  const panel = document.getElementById('overview-panel');
  if (portfolio.length === 0) {
    panel.innerHTML = '<p>No portfolio data available.</p>';
    return;
  }

  const totalValue = portfolio.reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0);
  const totalInvested = portfolio.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0);
  const totalPnL = totalValue - totalInvested;
  const roiPercent = totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : 0;

  // Best and worst performers
  let bestPerformer = null, worstPerformer = null;
  let bestGain = -Infinity, worstGain = Infinity;
  portfolio.forEach(pos => {
    const gain = ((pos.currentPrice - pos.avgPrice) / pos.avgPrice) * 100;
    if (gain > bestGain) {
      bestGain = gain;
      bestPerformer = { ...pos, gain };
    }
    if (gain < worstGain) {
      worstGain = gain;
      worstPerformer = { ...pos, gain };
    }
  });

  // Allocation chart data
  const allocationHtml = portfolio.map(pos => {
    const pct = (pos.currentPrice * pos.quantity / totalValue * 100).toFixed(1);
    const color = `hsl(${Math.random() * 360}, 65%, 55%)`;
    return `
      <div class="pa-allocation-bar">
        <div class="pa-bar-label">${pos.symbol} <span>${pct}%</span></div>
        <div class="pa-bar-container">
          <div class="pa-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="pa-stat-grid">
      <div class="pa-stat-card">
        <div class="pa-stat-label">Portfolio Value</div>
        <div class="pa-stat-value">$${totalValue.toFixed(2)}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Total Invested</div>
        <div class="pa-stat-value">$${totalInvested.toFixed(2)}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Total P&L</div>
        <div class="pa-stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}">$${totalPnL.toFixed(2)}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">ROI</div>
        <div class="pa-stat-value ${roiPercent >= 0 ? 'positive' : 'negative'}">${roiPercent}%</div>
      </div>
    </div>

    ${bestPerformer ? `
      <div class="pa-stat-grid" style="margin-top: 20px;">
        <div class="pa-stat-card highlight positive">
          <div class="pa-stat-label">Best Performer</div>
          <div class="pa-stat-value">${bestPerformer.symbol}</div>
          <div class="pa-stat-value" style="font-size: 0.9em; margin-top: 8px;">+${bestPerformer.gain.toFixed(2)}%</div>
        </div>
        <div class="pa-stat-card highlight negative">
          <div class="pa-stat-label">Worst Performer</div>
          <div class="pa-stat-value">${worstPerformer.symbol}</div>
          <div class="pa-stat-value" style="font-size: 0.9em; margin-top: 8px;">${worstPerformer.gain.toFixed(2)}%</div>
        </div>
      </div>
    ` : ''}

    <div style="margin-top: 30px;">
      <h4>Portfolio Allocation</h4>
      <div style="margin-top: 15px;">
        ${allocationHtml}
      </div>
    </div>
  `;
}

function renderPerformance(portfolio, journal, signals) {
  const panel = document.getElementById('performance-panel');

  // Monthly P&L breakdown
  const monthlyPnL = {};
  journal.forEach(trade => {
    const closeDate = new Date(trade.closeDate || trade.openDate);
    const monthKey = closeDate.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyPnL[monthKey]) monthlyPnL[monthKey] = 0;
    monthlyPnL[monthKey] += trade.pnl || 0;
  });

  const sortedMonths = Object.keys(monthlyPnL).sort();
  const maxMonthlyValue = Math.max(...Object.values(monthlyPnL).map(Math.abs), 1);

  const monthlyChartHtml = sortedMonths.map(month => {
    const value = monthlyPnL[month];
    const pct = (Math.abs(value) / maxMonthlyValue * 100).toFixed(0);
    const isProfit = value >= 0;
    return `
      <div class="pa-monthly-chart-item">
        <div class="pa-month-bar ${isProfit ? 'profit' : 'loss'}" style="height: ${pct}%;" title="$${value.toFixed(2)}"></div>
        <div class="pa-month-label">${month}</div>
      </div>
    `;
  }).join('');

  // Win/Loss streaks
  const streaks = calculateStreaks(signals);

  // Best trading day
  const bestDay = findBestTradingDay(signals);

  // Average hold time
  const avgHoldTime = calculateAverageHoldTime(journal);

  panel.innerHTML = `
    <div>
      <h4>Monthly P&L</h4>
      <div class="pa-monthly-chart">
        ${monthlyChartHtml || '<p>No trade data available.</p>'}
      </div>
    </div>

    <div class="pa-stat-grid" style="margin-top: 30px;">
      <div class="pa-stat-card">
        <div class="pa-stat-label">Longest Win Streak</div>
        <div class="pa-stat-value">${streaks.winStreak}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Longest Loss Streak</div>
        <div class="pa-stat-value">${streaks.lossStreak}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Best Trading Day</div>
        <div class="pa-stat-value">${bestDay || 'N/A'}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Avg Hold Time</div>
        <div class="pa-stat-value">${avgHoldTime}</div>
      </div>
    </div>
  `;
}

function renderRisk(portfolio, journal, signals) {
  const panel = document.getElementById('risk-panel');

  // Sharpe Ratio
  const monthlyReturns = calculateMonthlyReturns(journal);
  const sharpeRatio = calculateSharpeRatio(monthlyReturns);

  // Max Drawdown
  const maxDrawdown = calculateMaxDrawdown(portfolio, journal);

  // Portfolio concentration
  const totalValue = portfolio.reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0);
  const sortedByValue = [...portfolio].sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity));
  const top1Pct = totalValue > 0 ? ((sortedByValue[0]?.currentPrice * sortedByValue[0]?.quantity || 0) / totalValue * 100).toFixed(1) : 0;
  const top3Pct = totalValue > 0 ? (sortedByValue.slice(0, 3).reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0) / totalValue * 100).toFixed(1) : 0;

  // Volatility
  const tradeReturns = journal.map(trade => trade.returnPercent || 0);
  const volatility = tradeReturns.length > 0 ? calculateStdDev(tradeReturns).toFixed(2) : 'N/A';

  // Risk rating
  const riskRating = calculateRiskRating(top3Pct, tradeReturns, journal);

  panel.innerHTML = `
    <div class="pa-stat-grid">
      <div class="pa-stat-card">
        <div class="pa-stat-label">Sharpe Ratio</div>
        <div class="pa-stat-value">${sharpeRatio}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Max Drawdown</div>
        <div class="pa-stat-value">${maxDrawdown}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Top 1 Concentration</div>
        <div class="pa-stat-value">${top1Pct}%</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Top 3 Concentration</div>
        <div class="pa-stat-value">${top3Pct}%</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Volatility (Std Dev)</div>
        <div class="pa-stat-value">${volatility}%</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Risk Rating</div>
        <div class="pa-stat-value risk-${riskRating.toLowerCase()}">${riskRating}</div>
      </div>
    </div>
  `;
}

function renderSignals(signals) {
  const panel = document.getElementById('signals-panel');
  if (signals.length === 0) {
    panel.innerHTML = '<p>No signal data available.</p>';
    return;
  }

  // Win Rate by coin
  const bySymbol = {};
  signals.forEach(sig => {
    if (!bySymbol[sig.symbol]) bySymbol[sig.symbol] = { wins: 0, total: 0 };
    bySymbol[sig.symbol].total++;
    if (sig.outcome === 'win') bySymbol[sig.symbol].wins++;
  });

  const coinWrHtml = Object.entries(bySymbol).map(([symbol, data]) => {
    const wr = ((data.wins / data.total) * 100).toFixed(1);
    return `
      <div class="pa-coin-wr-row">
        <span class="pa-symbol">${symbol}</span>
        <span class="pa-wr">${wr}% (${data.wins}/${data.total})</span>
      </div>
    `;
  }).join('');

  // Win Rate by direction
  const byDirection = { LONG: { wins: 0, total: 0 }, SHORT: { wins: 0, total: 0 } };
  signals.forEach(sig => {
    const dir = sig.direction || 'LONG';
    if (!byDirection[dir]) byDirection[dir] = { wins: 0, total: 0 };
    byDirection[dir].total++;
    if (sig.outcome === 'win') byDirection[dir].wins++;
  });

  // Win Rate by hour
  const byHour = {};
  signals.forEach(sig => {
    const hour = new Date(sig.timestamp).getHours();
    if (!byHour[hour]) byHour[hour] = { wins: 0, total: 0 };
    byHour[hour].total++;
    if (sig.outcome === 'win') byHour[hour].wins++;
  });
  const topHour = Object.entries(byHour).reduce((best, [h, d]) =>
    (d.total > 0 && d.wins / d.total > (best.wr || 0)) ? { hour: h, wr: d.wins / d.total, ...d } : best, {});

  // Best performing setup
  const setupStats = {};
  signals.forEach(sig => {
    const setup = sig.setup || 'Unknown';
    if (!setupStats[setup]) setupStats[setup] = { wins: 0, total: 0 };
    setupStats[setup].total++;
    if (sig.outcome === 'win') setupStats[setup].wins++;
  });
  const bestSetup = Object.entries(setupStats).reduce((best, [setup, data]) =>
    (data.wins / data.total > (best.wr || 0)) ? { setup, ...data, wr: data.wins / data.total } : best, {});

  panel.innerHTML = `
    <div>
      <h4>Win Rate by Coin</h4>
      <div class="pa-signal-breakdown">
        ${coinWrHtml}
      </div>
    </div>

    <div class="pa-stat-grid" style="margin-top: 30px;">
      <div class="pa-stat-card">
        <div class="pa-stat-label">LONG Win Rate</div>
        <div class="pa-stat-value">${byDirection.LONG.total > 0 ? ((byDirection.LONG.wins / byDirection.LONG.total) * 100).toFixed(1) : 'N/A'}%</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">SHORT Win Rate</div>
        <div class="pa-stat-value">${byDirection.SHORT.total > 0 ? ((byDirection.SHORT.wins / byDirection.SHORT.total) * 100).toFixed(1) : 'N/A'}%</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Best Trading Hour</div>
        <div class="pa-stat-value">${topHour.hour !== undefined ? `${topHour.hour}:00 (${(topHour.wr * 100).toFixed(1)}%)` : 'N/A'}</div>
      </div>
      <div class="pa-stat-card">
        <div class="pa-stat-label">Best Setup</div>
        <div class="pa-stat-value">${bestSetup.setup ? bestSetup.setup : 'N/A'}</div>
      </div>
    </div>
  `;
}

// Helper functions

function calculateStreaks(signals) {
  let winStreak = 0, lossStreak = 0;
  let maxWinStreak = 0, maxLossStreak = 0;

  signals.forEach(sig => {
    if (sig.outcome === 'win') {
      winStreak++;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
      lossStreak = 0;
    } else {
      lossStreak++;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
      winStreak = 0;
    }
  });

  return { winStreak: maxWinStreak, lossStreak: maxLossStreak };
}

function findBestTradingDay(signals) {
  const dayStats = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  signals.forEach(sig => {
    const day = dayNames[new Date(sig.timestamp).getDay()];
    if (!dayStats[day]) dayStats[day] = { wins: 0, total: 0 };
    dayStats[day].total++;
    if (sig.outcome === 'win') dayStats[day].wins++;
  });

  let bestDay = null, bestWR = 0;
  Object.entries(dayStats).forEach(([day, data]) => {
    const wr = data.wins / data.total;
    if (wr > bestWR && data.total >= 2) {
      bestWR = wr;
      bestDay = day;
    }
  });

  return bestDay;
}

function calculateAverageHoldTime(journal) {
  const validTrades = journal.filter(t => t.openDate && t.closeDate);
  if (validTrades.length === 0) return 'N/A';

  const avgMs = validTrades.reduce((sum, t) => {
    return sum + (new Date(t.closeDate) - new Date(t.openDate));
  }, 0) / validTrades.length;

  const hours = Math.floor(avgMs / 3600000);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

function calculateMonthlyReturns(journal) {
  const monthly = {};
  journal.forEach(trade => {
    const date = new Date(trade.closeDate || trade.openDate);
    const key = date.toISOString().substring(0, 7);
    if (!monthly[key]) monthly[key] = [];
    monthly[key].push(trade.returnPercent || 0);
  });

  return Object.values(monthly).map(returns => {
    return returns.reduce((a, b) => a + b, 0) / returns.length;
  });
}

function calculateSharpeRatio(monthlyReturns) {
  if (monthlyReturns.length < 2) return 'N/A';
  const avgReturn = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const riskFreeRate = 0.05 / 12;
  const stdDev = calculateStdDev(monthlyReturns);
  const sharpe = (avgReturn - riskFreeRate) / (stdDev || 1);
  return isFinite(sharpe) ? sharpe.toFixed(2) : 'N/A';
}

function calculateMaxDrawdown(portfolio, journal) {
  if (journal.length === 0) return 'N/A';

  const values = [];
  let runningValue = 0;
  journal.forEach(trade => {
    runningValue += trade.pnl || 0;
    values.push(runningValue);
  });

  let maxVal = values[0], maxDD = 0;
  values.forEach(val => {
    if (val > maxVal) maxVal = val;
    const dd = ((maxVal - val) / Math.abs(maxVal || 1)) * 100;
    maxDD = Math.max(maxDD, dd);
  });

  return maxDD.toFixed(2) + '%';
}

function calculateRiskRating(concentration, returns, journal) {
  let score = 0;

  if (concentration > 40) score += 2; // High concentration
  else if (concentration > 25) score += 1;

  const winRate = returns.filter(r => r > 0).length / (returns.length || 1);
  if (winRate < 0.4) score += 2;
  else if (winRate < 0.5) score += 1;

  const avgDrawdown = journal.filter(t => t.pnl < 0).length / (journal.length || 1);
  if (avgDrawdown > 0.5) score += 1;

  if (score >= 4) return 'High';
  if (score >= 2) return 'Medium';
  return 'Low';
}

function calculateStdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

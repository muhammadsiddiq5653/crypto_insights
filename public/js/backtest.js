// ── BACKTESTING TOOL ─────────────────────────────────────────────────
// Two strategies:
// 1. DCA (Dollar Cost Averaging) — invest $X every interval for N periods
// 2. RSI Strategy — buy when RSI < threshold, sell when RSI > threshold

let backtestChart = null;

function initBacktest() {
    renderBacktestUI();
}

function renderBacktestUI() {
    const container = document.getElementById('backtestContent');
    if (!container) return;

    // Populate coin options
    const cryptoOptions = (window._cryptoList || [
        {id:'bitcoin', name:'Bitcoin (BTC)'},
        {id:'ethereum', name:'Ethereum (ETH)'},
        {id:'binancecoin', name:'BNB'},
    ]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    container.innerHTML = `
    <div class="backtest-header">
        <div class="backtest-strategy-tabs">
            <button class="bt-tab active" data-tab="dca" onclick="switchBTTab('dca', this)">📅 DCA Strategy</button>
            <button class="bt-tab" data-tab="rsi" onclick="switchBTTab('rsi', this)">📊 RSI Strategy</button>
        </div>
    </div>

    <!-- DCA Panel -->
    <div class="bt-panel" id="btPanelDca">
        <div class="bt-form">
            <div class="bt-form-grid">
                <label>Coin
                    <select id="btDcaCoin">${cryptoOptions}</select>
                </label>
                <label>Invest Amount (USD)
                    <input type="number" id="btDcaAmount" value="100" min="1">
                </label>
                <label>Frequency
                    <select id="btDcaFreq">
                        <option value="daily">Daily</option>
                        <option value="weekly" selected>Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </label>
                <label>Duration
                    <select id="btDcaDuration">
                        <option value="90">3 Months</option>
                        <option value="180">6 Months</option>
                        <option value="365" selected>1 Year</option>
                        <option value="730">2 Years</option>
                        <option value="1095">3 Years</option>
                    </select>
                </label>
            </div>
            <button class="btn-primary bt-run-btn" onclick="runDCABacktest()">
                ▶ Run DCA Backtest
            </button>
        </div>
    </div>

    <!-- RSI Panel -->
    <div class="bt-panel" id="btPanelRsi" style="display:none">
        <div class="bt-form">
            <div class="bt-form-grid">
                <label>Coin
                    <select id="btRsiCoin">${cryptoOptions}</select>
                </label>
                <label>Capital (USD)
                    <input type="number" id="btRsiCapital" value="1000" min="100">
                </label>
                <label>RSI Buy Below
                    <input type="number" id="btRsiBuy" value="35" min="1" max="50">
                </label>
                <label>RSI Sell Above
                    <input type="number" id="btRsiSell" value="65" min="50" max="99">
                </label>
                <label>Duration
                    <select id="btRsiDuration">
                        <option value="90">3 Months</option>
                        <option value="180" selected>6 Months</option>
                        <option value="365">1 Year</option>
                    </select>
                </label>
                <label>Position Size %
                    <input type="number" id="btRsiPosSize" value="50" min="10" max="100">
                </label>
            </div>
            <button class="btn-primary bt-run-btn" onclick="runRSIBacktest()">
                ▶ Run RSI Backtest
            </button>
        </div>
    </div>

    <!-- Results -->
    <div id="backtestResults" class="backtest-results" style="display:none"></div>

    <div class="backtest-disclaimer">
        ⚠️ <strong>Disclaimer:</strong> Backtesting results are based on historical prices and do not guarantee future performance.
        Past returns do not predict future results. This is for educational purposes only.
    </div>`;
}

function switchBTTab(tab, btn) {
    document.querySelectorAll('.bt-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('btPanelDca').style.display = tab === 'dca' ? 'block' : 'none';
    document.getElementById('btPanelRsi').style.display = tab === 'rsi' ? 'block' : 'none';
    document.getElementById('backtestResults').style.display = 'none';
}

// ── DCA BACKTEST ──────────────────────────────────────────────────────

async function runDCABacktest() {
    const coinId   = document.getElementById('btDcaCoin')?.value;
    const amount   = parseFloat(document.getElementById('btDcaAmount')?.value) || 100;
    const freq     = document.getElementById('btDcaFreq')?.value || 'weekly';
    const duration = parseInt(document.getElementById('btDcaDuration')?.value) || 365;

    showBTLoading('Fetching historical price data…');

    try {
        const data = await apiRequest(`/api/crypto/${coinId}/history?days=${duration}`);
        if (!data || !data.prices || data.prices.length < 10) throw new Error('Insufficient historical data');

        const prices = data.prices; // [[timestamp, price], ...]
        const intervalDays = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 30;

        const trades = [];
        let totalInvested = 0;
        let totalCoins = 0;
        let prevTimestamp = 0;

        prices.forEach(([ts, price]) => {
            const daysSinceLast = (ts - prevTimestamp) / 86400000;
            if (prevTimestamp === 0 || daysSinceLast >= intervalDays) {
                const coinsAcquired = amount / price;
                totalInvested += amount;
                totalCoins += coinsAcquired;
                trades.push({ ts, price, coinsAcquired, totalInvested, totalCoins, portfolioValue: totalCoins * price });
                prevTimestamp = ts;
            }
        });

        // Final value using last price
        const lastPrice = prices[prices.length - 1][1];
        const finalValue = totalCoins * lastPrice;
        const totalReturn = ((finalValue - totalInvested) / totalInvested) * 100;
        const avgCost = totalInvested / totalCoins;

        // Buy-and-hold comparison
        const firstPrice = prices[0][1];
        const bhCoins = totalInvested / firstPrice;
        const bhValue = bhCoins * lastPrice;
        const bhReturn = ((bhValue - totalInvested) / totalInvested) * 100;

        renderBTResults({
            strategy: 'DCA',
            coinName: document.getElementById('btDcaCoin')?.options[document.getElementById('btDcaCoin').selectedIndex]?.text || coinId,
            totalInvested,
            finalValue,
            totalReturn,
            avgCost,
            lastPrice,
            totalCoins,
            numTrades: trades.length,
            bhReturn,
            bhValue,
            priceData: prices,
            tradeData: trades,
            freq,
            amount
        });

    } catch (e) {
        showBTError('Failed to run backtest: ' + e.message);
    }
}

// ── RSI BACKTEST ──────────────────────────────────────────────────────

async function runRSIBacktest() {
    const coinId   = document.getElementById('btRsiCoin')?.value;
    const capital  = parseFloat(document.getElementById('btRsiCapital')?.value) || 1000;
    const buyBelow = parseFloat(document.getElementById('btRsiBuy')?.value) || 35;
    const sellAbove= parseFloat(document.getElementById('btRsiSell')?.value) || 65;
    const duration = parseInt(document.getElementById('btRsiDuration')?.value) || 180;
    const posSize  = parseFloat(document.getElementById('btRsiPosSize')?.value) / 100 || 0.5;

    showBTLoading('Running RSI strategy simulation…');

    try {
        const data = await apiRequest(`/api/crypto/${coinId}/history?days=${duration}`);
        if (!data || !data.prices || data.prices.length < 20) throw new Error('Insufficient historical data');

        const prices = data.prices;
        const rsiValues = computeRSISeries(prices.map(p => p[1]), 14);

        let cash = capital;
        let holdings = 0;
        let avgCost = 0;
        const trades = [];
        const portfolioValues = [];

        for (let i = 14; i < prices.length; i++) {
            const [ts, price] = prices[i];
            const rsi = rsiValues[i];

            if (rsi !== null) {
                if (rsi < buyBelow && cash > 0) {
                    // Buy signal
                    const invest = cash * posSize;
                    const coins = invest / price;
                    const totalCost = holdings * avgCost + invest;
                    holdings += coins;
                    avgCost = totalCost / holdings;
                    cash -= invest;
                    trades.push({ type: 'BUY', ts, price, rsi, qty: coins, cash, holdings });
                } else if (rsi > sellAbove && holdings > 0) {
                    // Sell signal
                    const sellQty = holdings * posSize;
                    const proceeds = sellQty * price;
                    cash += proceeds;
                    holdings -= sellQty;
                    const pnl = proceeds - sellQty * avgCost;
                    trades.push({ type: 'SELL', ts, price, rsi, qty: sellQty, pnl, cash, holdings });
                }
            }

            portfolioValues.push([ts, cash + holdings * price]);
        }

        const finalValue = cash + holdings * prices[prices.length-1][1];
        const totalReturn = ((finalValue - capital) / capital) * 100;

        // Buy and hold comparison
        const bhCoins = capital / prices[14][1];
        const bhValue = bhCoins * prices[prices.length-1][1];
        const bhReturn = ((bhValue - capital) / capital) * 100;

        const wins  = trades.filter(t => t.type === 'SELL' && t.pnl >= 0).length;
        const sells = trades.filter(t => t.type === 'SELL').length;

        renderBTResults({
            strategy: 'RSI',
            coinName: document.getElementById('btRsiCoin')?.options[document.getElementById('btRsiCoin').selectedIndex]?.text || coinId,
            totalInvested: capital,
            finalValue,
            totalReturn,
            lastPrice: prices[prices.length-1][1],
            numTrades: trades.length,
            winRate: sells > 0 ? (wins / sells) * 100 : 0,
            bhReturn,
            bhValue,
            priceData: prices,
            portfolioValues,
            tradeData: trades,
            buyBelow,
            sellAbove,
            cash,
            holdings
        });

    } catch (e) {
        showBTError('Failed to run RSI backtest: ' + e.message);
    }
}

// ── RSI COMPUTATION ───────────────────────────────────────────────────

function computeRSISeries(prices, period = 14) {
    const rsi = new Array(prices.length).fill(null);
    if (prices.length < period + 1) return rsi;

    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i-1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsi[period] = 100 - 100 / (1 + (avgGain / (avgLoss || 0.001)));

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i-1];
        const g = diff > 0 ? diff : 0;
        const l = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period-1) + g) / period;
        avgLoss = (avgLoss * (period-1) + l) / period;
        rsi[i] = 100 - 100 / (1 + (avgGain / (avgLoss || 0.001)));
    }
    return rsi;
}

// ── RENDER RESULTS ────────────────────────────────────────────────────

function renderBTResults(r) {
    const container = document.getElementById('backtestResults');
    if (!container) return;

    const returnClass = r.totalReturn >= 0 ? 'positive' : 'negative';
    const vsClass = r.totalReturn >= r.bhReturn ? 'positive' : 'negative';

    let extraStats = '';
    if (r.strategy === 'DCA') {
        extraStats = `
        <div class="bt-stat"><div class="bt-stat-val">${r.numTrades}</div><div class="bt-stat-label">DCA Buys</div></div>
        <div class="bt-stat"><div class="bt-stat-val">${formatCurrency(r.avgCost)}</div><div class="bt-stat-label">Avg Buy Price</div></div>
        <div class="bt-stat"><div class="bt-stat-val">${r.totalCoins?.toFixed(6)}</div><div class="bt-stat-label">Total Coins</div></div>
        <div class="bt-stat"><div class="bt-stat-val">${formatCurrency(r.lastPrice)}</div><div class="bt-stat-label">Current Price</div></div>`;
    } else {
        extraStats = `
        <div class="bt-stat"><div class="bt-stat-val">${r.numTrades}</div><div class="bt-stat-label">Total Signals</div></div>
        <div class="bt-stat"><div class="bt-stat-val">${r.winRate?.toFixed(1)}%</div><div class="bt-stat-label">Win Rate (Sells)</div></div>
        <div class="bt-stat"><div class="bt-stat-val">${formatCurrency(r.cash)}</div><div class="bt-stat-label">Remaining Cash</div></div>
        <div class="bt-stat"><div class="bt-stat-val">RSI<${r.buyBelow} / >${r.sellAbove}</div><div class="bt-stat-label">Strategy Params</div></div>`;
    }

    container.style.display = 'block';
    container.innerHTML = `
    <div class="bt-results-header">
        <h3>${r.strategy} Backtest — ${escapeHtml(r.coinName)}</h3>
    </div>
    <div class="bt-stats-grid">
        <div class="bt-stat ${returnClass}">
            <div class="bt-stat-val">${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn.toFixed(2)}%</div>
            <div class="bt-stat-label">${r.strategy} Return</div>
        </div>
        <div class="bt-stat ${vsClass}">
            <div class="bt-stat-val">${r.bhReturn >= 0 ? '+' : ''}${r.bhReturn.toFixed(2)}%</div>
            <div class="bt-stat-label">Buy & Hold Return</div>
        </div>
        <div class="bt-stat">
            <div class="bt-stat-val">${formatCurrency(r.totalInvested)}</div>
            <div class="bt-stat-label">Total Invested</div>
        </div>
        <div class="bt-stat ${returnClass}">
            <div class="bt-stat-val">${formatCurrency(r.finalValue)}</div>
            <div class="bt-stat-label">Final Portfolio Value</div>
        </div>
        <div class="bt-stat ${returnClass}">
            <div class="bt-stat-val">${formatCurrency(r.finalValue - r.totalInvested)}</div>
            <div class="bt-stat-label">Net Profit / Loss</div>
        </div>
        ${extraStats}
    </div>

    <div class="bt-vs-banner ${vsClass}">
        ${r.totalReturn >= r.bhReturn
            ? `✅ ${r.strategy} outperformed Buy & Hold by ${(r.totalReturn - r.bhReturn).toFixed(2)}%`
            : `⚠️ Buy & Hold outperformed ${r.strategy} by ${(r.bhReturn - r.totalReturn).toFixed(2)}%`
        }
    </div>

    <div class="bt-chart-wrap">
        <canvas id="btChart" height="300"></canvas>
    </div>

    ${r.tradeData && r.tradeData.length > 0 ? `
    <div class="bt-trades-title">📋 Trade History (Last 30)</div>
    <div class="bt-trades-wrap">
        <table class="bt-trades-table">
            <thead><tr>
                <th>Date</th>
                <th>Type</th>
                <th>Price</th>
                ${r.strategy === 'RSI' ? '<th>RSI</th><th>P&L</th>' : '<th>Invested</th><th>Portfolio</th>'}
            </tr></thead>
            <tbody>
            ${r.tradeData.slice(0, 30).map(t => `
                <tr>
                    <td class="dim">${new Date(t.ts).toLocaleDateString()}</td>
                    <td><span class="trade-badge ${t.type?.toLowerCase() || 'buy'}">${t.type || 'BUY'}</span></td>
                    <td>${formatCurrency(t.price)}</td>
                    ${r.strategy === 'RSI'
                        ? `<td>${t.rsi?.toFixed(1) || '—'}</td><td class="${(t.pnl||0) >= 0 ? 'positive' : 'negative'}">${t.pnl != null ? (t.pnl >= 0 ? '+' : '') + formatCurrency(t.pnl) : '—'}</td>`
                        : `<td>${formatCurrency(r.amount)}</td><td>${formatCurrency(t.portfolioValue)}</td>`
                    }
                </tr>`).join('')}
            </tbody>
        </table>
    </div>` : ''}`;

    // Render chart
    renderBTChart(r);
}

function renderBTChart(r) {
    const canvas = document.getElementById('btChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (backtestChart) { backtestChart.destroy(); backtestChart = null; }

    const priceLabels = r.priceData.slice(-200).map(p => new Date(p[0]).toLocaleDateString());
    const priceSeries = r.priceData.slice(-200).map(p => p[1]);

    const datasets = [{
        label: 'Price',
        data: priceSeries,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102,126,234,0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'price'
    }];

    if (r.strategy === 'DCA' && r.tradeData) {
        // Portfolio value over time for DCA
        const portLabels = r.tradeData.map(t => new Date(t.ts).toLocaleDateString());
        const portValues = r.tradeData.map(t => t.portfolioValue);
        // This is sparse — use priceData aligned with last trade value
    }

    if (r.strategy === 'RSI' && r.portfolioValues) {
        const portSeries = r.portfolioValues.slice(-200).map(p => p[1]);
        datasets.push({
            label: 'Portfolio Value',
            data: portSeries,
            borderColor: '#48bb78',
            backgroundColor: 'rgba(72,187,120,0.05)',
            fill: false,
            tension: 0.3,
            yAxisID: 'portfolio'
        });
    }

    backtestChart = new Chart(canvas, {
        type: 'line',
        data: { labels: priceLabels, datasets },
        options: {
            responsive: true,
            interaction: { intersect: false, mode: 'index' },
            plugins: { legend: { labels: { color: '#a0aec0' } } },
            scales: {
                price: { type: 'linear', position: 'left', ticks: { color: '#a0aec0', callback: v => '$' + formatLargeNumber(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
                portfolio: r.strategy === 'RSI' ? { type: 'linear', position: 'right', ticks: { color: '#48bb78', callback: v => '$' + v.toFixed(0) }, grid: { display: false } } : undefined,
                x: { ticks: { color: '#718096', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function showBTLoading(msg) {
    const container = document.getElementById('backtestResults');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = `<div class="bt-loading"><div class="spinner"></div><p>${msg}</p></div>`;
}

function showBTError(msg) {
    const container = document.getElementById('backtestResults');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = `<div class="bt-error">❌ ${escapeHtml(msg)}</div>`;
}

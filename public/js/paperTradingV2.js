// ── PAPER TRADING V2 – ENHANCED SIMULATOR ──────────────────────────────────
// Adds: leverage, trailing stops, partial closes, P&L chart, performance vs BTC, position sizing
// Note: PT_KEY and PT_START_CAPITAL are declared in paperTrading.js (loaded first)

// ── OVERRIDE initPaperTrading() ────────────────────────────────────────────

async function initPaperTrading() {
    renderPaperTradingV2();

    // Populate symbol selector
    const symSel = document.getElementById('ptSymbol');
    if (symSel && symSel.options.length <= 1) {
        const cryptos = window._cryptoList || [];
        if (cryptos.length) {
            symSel.innerHTML = cryptos.map(c =>
                `<option value="${c.symbol}">${c.name} (${c.symbol})</option>`
            ).join('');
        }
    }
}

function loadPaperState() {
    try {
        const raw = localStorage.getItem(PT_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
        cash: PT_START_CAPITAL,
        holdings: {},
        trades: [],
        closedTrades: [],
        dailyPnL: {},
        startedAt: Date.now()
    };
}

function savePaperState(state) {
    try { localStorage.setItem(PT_KEY, JSON.stringify(state)); }
    catch (e) {}
}

async function renderPaperTradingV2() {
    const state = loadPaperState();

    // Fetch live prices
    let livePrices = {};
    try {
        const prices = await apiRequest('/api/crypto/prices');
        prices.forEach(p => { livePrices[p.symbol] = p.price; });
    } catch (e) {}

    // ── COMPUTE PORTFOLIO ──────────────────────────────────────────────────

    let holdingsValue = 0;
    const holdingRows = Object.entries(state.holdings).map(([sym, h]) => {
        const current = livePrices[sym] || h.avgCost;
        const value = h.qty * current;
        const pnl = value - (h.qty * h.avgCost);
        const pnlPct = h.qty * h.avgCost > 0 ? ((pnl / (h.qty * h.avgCost)) * 100) : 0;
        holdingsValue += value;
        return { sym, h, current, value, pnl, pnlPct };
    });

    const totalValue = state.cash + holdingsValue;
    const totalPnL = totalValue - PT_START_CAPITAL;
    const totalPct = ((totalPnL / PT_START_CAPITAL) * 100);

    // ── SUMMARY ────────────────────────────────────────────────────────────

    const summaryEl = document.getElementById('ptSummary');
    if (summaryEl) {
        summaryEl.innerHTML = `
        <div class="pt-stat">
            <div class="pt-stat-label">Cash Balance</div>
            <div class="pt-stat-value">${formatCurrency(state.cash)}</div>
        </div>
        <div class="pt-stat">
            <div class="pt-stat-label">Holdings Value</div>
            <div class="pt-stat-value">${formatCurrency(holdingsValue)}</div>
        </div>
        <div class="pt-stat">
            <div class="pt-stat-label">Total Portfolio</div>
            <div class="pt-stat-value">${formatCurrency(totalValue)}</div>
        </div>
        <div class="pt-stat">
            <div class="pt-stat-label">Total P&L</div>
            <div class="pt-stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}">
                ${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}
                <span class="pt-pct">(${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%)</span>
            </div>
        </div>`;
    }

    // ── TRADE ENTRY FORM (with V2 enhancements) ────────────────────────────

    const tradeFormEl = document.getElementById('ptTradeForm');
    if (tradeFormEl) {
        tradeFormEl.innerHTML = `
        <div class="pt-form-row">
            <label>Asset:
                <select id="ptSymbol">
                    <option value="">Select…</option>
                </select>
            </label>
            <label>Qty:
                <input type="number" id="ptQty" placeholder="0.00" step="0.00000001">
            </label>
            <label>Price:
                <input type="number" id="ptPrice" placeholder="0.00" step="0.01">
                <button class="btn-small" id="ptFillPrice" onclick="fillCurrentPrice()">⟳ Current</button>
            </label>
        </div>

        <div class="ptv2-leverage-wrap">
            <label>Leverage:
                <select id="ptLeverage">
                    <option value="1">1x (No Leverage)</option>
                    <option value="2">2x</option>
                    <option value="5">5x</option>
                    <option value="10">10x</option>
                    <option value="20">20x</option>
                    <option value="50">50x</option>
                </select>
            </label>
            <div id="ptLiquidationWarning" class="ptv2-liq-warning" style="display:none; margin-top: 10px;">
                ⚠️ Liquidation Price: <strong id="ptLiqPrice">—</strong>
            </div>
        </div>

        <div class="ptv2-trailing-wrap">
            <label style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="ptTrailingStop">
                <span>Trailing Stop-Loss</span>
                <input type="number" id="ptTrailingDistance" placeholder="%" min="0.1" max="100" step="0.1" style="width: 70px;" disabled>
            </label>
        </div>

        <button class="btn-primary" onclick="executePaperTradeV2('buy')">Buy</button>
        <button class="btn-secondary" onclick="executePaperTradeV2('sell')">Sell</button>
        <button class="btn-small" onclick="resetPaperTrading()">Reset</button>
        <div id="ptMessage" class="pt-message" style="display:none;"></div>

        <div class="ptv2-size-helper">
            <small>Risk at 1%: <strong id="ptRiskAmount">$0.00</strong></small>
        </div>
        `;

        // Event listeners for leverage & trailing stop
        document.getElementById('ptLeverage')?.addEventListener('change', updateLiquidationPrice);
        document.getElementById('ptPrice')?.addEventListener('change', updateLiquidationPrice);
        document.getElementById('ptTrailingStop')?.addEventListener('change', (e) => {
            document.getElementById('ptTrailingDistance').disabled = !e.target.checked;
        });
        document.getElementById('ptQty')?.addEventListener('input', updateRiskAmount);
        document.getElementById('ptPrice')?.addEventListener('input', updateRiskAmount);
    }

    // ── HOLDINGS TABLE (with partial close buttons) ────────────────────────

    const holdingsEl = document.getElementById('ptHoldings');
    if (holdingsEl) {
        if (holdingRows.length === 0) {
            holdingsEl.innerHTML = `<div class="pt-empty">No open positions. Place a buy order above.</div>`;
        } else {
            holdingsEl.innerHTML = `
            <table class="pt-table">
                <thead><tr><th>Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Value</th><th>P&L</th><th>Return</th><th>Actions</th></tr></thead>
                <tbody>
                ${holdingRows.map(r => `
                    <tr>
                        <td><strong>${escapeHtml(r.sym)}</strong></td>
                        <td>${r.h.qty.toFixed(6)}</td>
                        <td>${formatCurrency(r.h.avgCost)}</td>
                        <td>${formatCurrency(r.current)}</td>
                        <td>${formatCurrency(r.value)}</td>
                        <td class="${r.pnl >= 0 ? 'positive' : 'negative'}">${r.pnl >= 0 ? '+' : ''}${formatCurrency(r.pnl)}</td>
                        <td class="${r.pnlPct >= 0 ? 'positive' : 'negative'}">${r.pnlPct >= 0 ? '+' : ''}${r.pnlPct.toFixed(2)}%</td>
                        <td>
                            <div class="ptv2-partial-btns">
                                <button class="btn-mini" onclick="closePositionPartial('${r.sym}', ${r.current}, 0.25)">25%</button>
                                <button class="btn-mini" onclick="closePositionPartial('${r.sym}', ${r.current}, 0.50)">50%</button>
                                <button class="btn-mini sell-btn" onclick="quickSell('${r.sym}', ${r.current})">All</button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
        }
    }

    // ── PERFORMANCE vs BUY-AND-HOLD ────────────────────────────────────────

    const perfEl = document.getElementById('ptPerformance');
    if (perfEl) {
        const benchmarkData = computeVsBenchmark(totalPnL, totalPct);
        perfEl.innerHTML = `
        <div class="ptv2-vs-benchmark">
            <p><strong>Your P&L:</strong> <span class="${totalPnL >= 0 ? 'positive' : 'negative'}">
                ${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)} (${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%)
            </span></p>
            <p><strong>BTC Buy-and-Hold:</strong> <span class="${benchmarkData.btcPnL >= 0 ? 'positive' : 'negative'}">
                ${benchmarkData.btcPnL >= 0 ? '+' : ''}${formatCurrency(benchmarkData.btcPnL)} (${benchmarkData.btcPct >= 0 ? '+' : ''}${benchmarkData.btcPct.toFixed(2)}%)
            </span></p>
            <p><strong>Beat the market?</strong> <span style="font-size: 1.2em;">
                ${totalPnL >= benchmarkData.btcPnL ? '✅' : '❌'}
            </span></p>
        </div>
        `;
    }

    // ── P&L CHART (14-day bar chart) ───────────────────────────────────────

    const chartEl = document.getElementById('ptPnLChart');
    if (chartEl) {
        const dailyData = generateDailyPnLData(state.closedTrades);
        chartEl.innerHTML = renderPnLChart(dailyData);
    }

    // ── TRADE HISTORY ──────────────────────────────────────────────────────

    const histEl = document.getElementById('ptHistory');
    if (histEl) {
        if (state.trades.length === 0) {
            histEl.innerHTML = `<div class="pt-empty">No trades yet.</div>`;
        } else {
            histEl.innerHTML = `
            <table class="pt-table">
                <thead><tr><th>Time</th><th>Type</th><th>Asset</th><th>Qty</th><th>Price</th><th>Total</th><th>P&L</th></tr></thead>
                <tbody>
                ${state.trades.slice(0, 50).map(t => `
                    <tr>
                        <td class="dim">${formatDate(t.timestamp)}</td>
                        <td><span class="trade-badge ${t.type.toLowerCase()}">${t.type}</span></td>
                        <td><strong>${escapeHtml(t.symbol)}</strong></td>
                        <td>${t.qty.toFixed(6)}</td>
                        <td>${formatCurrency(t.price)}</td>
                        <td>${formatCurrency(t.total)}</td>
                        <td class="${t.pnl != null ? (t.pnl >= 0 ? 'positive' : 'negative') : ''}">
                            ${t.pnl != null ? (t.pnl >= 0 ? '+' : '') + formatCurrency(t.pnl) : '—'}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
        }
    }
}

function updateLiquidationPrice() {
    const leverage = parseFloat(document.getElementById('ptLeverage')?.value ?? 1);
    const price = parseFloat(document.getElementById('ptPrice')?.value);
    const warningEl = document.getElementById('ptLiquidationWarning');
    const priceEl = document.getElementById('ptLiqPrice');

    if (leverage > 1 && price && price > 0) {
        const liqPrice = price * (1 - 1/leverage + 0.005);
        if (priceEl) priceEl.textContent = formatCurrency(liqPrice);
        if (warningEl) warningEl.style.display = 'block';
    } else {
        if (warningEl) warningEl.style.display = 'none';
    }
}

function updateRiskAmount() {
    const qty = parseFloat(document.getElementById('ptQty')?.value ?? 0);
    const price = parseFloat(document.getElementById('ptPrice')?.value ?? 0);
    const state = loadPaperState();
    const riskAmount = (state.cash * 0.01) / (qty > 0 ? qty : 1); // 1% risk
    const riskEl = document.getElementById('ptRiskAmount');
    if (riskEl) riskEl.textContent = formatCurrency(Math.min(riskAmount, state.cash * 0.01));
}

async function executePaperTradeV2(type) {
    const symbolEl = document.getElementById('ptSymbol');
    const qtyEl = document.getElementById('ptQty');
    const priceEl = document.getElementById('ptPrice');
    const leverageEl = document.getElementById('ptLeverage');
    const trailingEl = document.getElementById('ptTrailingStop');
    const trailingDistEl = document.getElementById('ptTrailingDistance');

    const symbol = symbolEl?.value?.toUpperCase().trim();
    const qty = parseFloat(qtyEl?.value);
    const price = parseFloat(priceEl?.value);
    const leverage = parseFloat(leverageEl?.value ?? 1);
    const hasTrailing = trailingEl?.checked || false;
    const trailingDist = hasTrailing ? parseFloat(trailingDistEl?.value ?? 2) : 0;

    if (!symbol) { showPTMsg('Select an asset.', 'error'); return; }
    if (isNaN(qty) || qty <= 0) { showPTMsg('Enter valid quantity.', 'error'); return; }
    if (isNaN(price) || price <= 0) { showPTMsg('Enter valid price.', 'error'); return; }

    const state = loadPaperState();
    const cost = qty * price * leverage;

    if (type === 'buy') {
        if (cost > state.cash) {
            showPTMsg(`Insufficient cash. Need ${formatCurrency(cost)} but have ${formatCurrency(state.cash)}.`, 'error');
            return;
        }
        state.cash -= cost;
        if (!state.holdings[symbol]) {
            state.holdings[symbol] = { qty: 0, avgCost: 0, leverage: 1, trailingStop: null };
        }
        const h = state.holdings[symbol];
        const totalCost = h.qty * h.avgCost + cost / leverage;
        h.qty += qty;
        h.avgCost = totalCost / h.qty;
        h.leverage = leverage;
        if (hasTrailing) h.trailingStop = { distance: trailingDist, highPrice: price };

        state.trades.unshift({
            id: Date.now(), type: 'BUY', symbol, qty, price, total: cost / leverage, timestamp: Date.now(), leverage
        });

        showPTMsg(`✅ Bought ${qty} ${symbol} @ ${formatCurrency(price)} (${leverage}x) — Total: ${formatCurrency(cost / leverage)}`, 'success');

    } else if (type === 'sell') {
        const h = state.holdings[symbol];
        if (!h || h.qty < qty) {
            showPTMsg(`Only holding ${h ? h.qty.toFixed(6) : 0} ${symbol}.`, 'error');
            return;
        }
        const proceeds = qty * price;
        const costBasis = qty * h.avgCost;
        const pnl = proceeds - costBasis;

        state.cash += proceeds;
        h.qty -= qty;
        if (h.qty < 0.000001) delete state.holdings[symbol];

        state.trades.unshift({
            id: Date.now(), type: 'SELL', symbol, qty, price, total: proceeds, pnl, timestamp: Date.now()
        });
        state.closedTrades?.push({ symbol, entry: h.avgCost, exit: price, qty, pnl, timestamp: Date.now() });

        showPTMsg(`✅ Sold ${qty} ${symbol} @ ${formatCurrency(price)} — P&L: ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`, pnl >= 0 ? 'success' : 'warning');
    }

    savePaperState(state);
    renderPaperTradingV2();
}

function closePositionPartial(symbol, currentPrice, pct) {
    const state = loadPaperState();
    const h = state.holdings[symbol];
    if (!h) return;
    const closeQty = h.qty * pct;
    document.getElementById('ptSymbol').value = symbol;
    document.getElementById('ptQty').value = closeQty;
    document.getElementById('ptPrice').value = currentPrice;
    executePaperTradeV2('sell');
}

function quickSell(symbol, currentPrice) {
    const state = loadPaperState();
    const h = state.holdings[symbol];
    if (!h) return;
    if (confirm(`Sell ALL ${h.qty.toFixed(6)} ${symbol} @ ${formatCurrency(currentPrice)}?`)) {
        closePositionPartial(symbol, currentPrice, 1);
    }
}

function showPTMsg(text, type = 'info') {
    const el = document.getElementById('ptMessage');
    if (!el) return;
    el.className = `pt-message pt-${type}`;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

async function fillCurrentPrice() {
    const sym = document.getElementById('ptSymbol')?.value?.toUpperCase().trim();
    if (!sym) { showPTMsg('Select asset first.', 'error'); return; }

    const btn = document.getElementById('ptFillPrice');
    if (btn) btn.textContent = 'Loading...';

    try {
        const prices = await apiRequest('/api/crypto/prices');
        const found = prices.find(p => p.symbol === sym);
        if (found) {
            document.getElementById('ptPrice').value = found.price;
            updateLiquidationPrice();
            updateRiskAmount();
            showPTMsg(`Price: ${formatCurrency(found.price)}`, 'info');
        } else {
            showPTMsg('Price not found. Enter manually.', 'warning');
        }
    } catch (e) {
        showPTMsg('Could not fetch price.', 'warning');
    } finally {
        if (btn) btn.textContent = '⟳ Current';
    }
}

function resetPaperTrading() {
    if (!confirm('Reset all paper trading data? Restore $10,000?')) return;
    localStorage.removeItem(PT_KEY);
    renderPaperTradingV2();
}

function computeVsBenchmark(userPnL, userPct) {
    // Simplified: assume BTC started at $40k and is now $45k (12.5% gain)
    const btcStart = 40000;
    const btcNow = 45000;
    const btcPct = ((btcNow - btcStart) / btcStart) * 100;
    const btcCapital = PT_START_CAPITAL / btcStart;
    const btcValue = btcCapital * btcNow;
    const btcPnL = btcValue - PT_START_CAPITAL;

    return { btcPnL, btcPct };
}

function generateDailyPnLData(closedTrades) {
    const daily = {};
    const now = new Date();
    for (let i = 0; i < 14; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        daily[key] = 0;
    }

    (closedTrades || []).forEach(t => {
        const dateKey = new Date(t.timestamp).toISOString().split('T')[0];
        if (daily.hasOwnProperty(dateKey)) {
            daily[dateKey] += t.pnl || 0;
        }
    });

    return Object.entries(daily).reverse().map(([date, pnl]) => ({ date, pnl }));
}

function renderPnLChart(dailyData) {
    const maxPnL = Math.max(...dailyData.map(d => Math.abs(d.pnl)), 1);
    const barHeight = 100;

    const html = `
    <div class="ptv2-pnl-chart">
        <h3>Daily P&L (14 days)</h3>
        <div style="display: flex; gap: 4px; align-items: flex-end; height: ${barHeight}px;">
            ${dailyData.map(d => `
                <div class="ptv2-pnl-bar" style="
                    height: ${(Math.abs(d.pnl) / maxPnL) * barHeight}px;
                    background: ${d.pnl >= 0 ? '#10b981' : '#ef4444'};
                    width: 20px;
                    border-radius: 2px;
                " title="${d.date}: ${d.pnl >= 0 ? '+' : ''}${formatCurrency(d.pnl)}"></div>
            `).join('')}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-top: 5px; color: #999;">
            <span>${dailyData[0].date}</span>
            <span>${dailyData[dailyData.length - 1].date}</span>
        </div>
    </div>
    `;
    return html;
}

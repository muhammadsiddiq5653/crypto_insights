// ── PAPER TRADING SIMULATOR ──────────────────────────────────────────
// Virtual trading with $10,000 start capital. Stored in localStorage.
// Uses live prices from the existing crypto API.

const PT_KEY = 'traderpro_paper_trading';
const PT_START_CAPITAL = 10000;

function loadPaperState() {
    try {
        const raw = localStorage.getItem(PT_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
        cash: PT_START_CAPITAL,
        holdings: {},   // { BTC: { qty, avgCost } }
        trades: [],     // trade history
        startedAt: Date.now()
    };
}

function savePaperState(state) {
    try { localStorage.setItem(PT_KEY, JSON.stringify(state)); }
    catch (e) {}
}

function resetPaperTrading() {
    if (!confirm('Reset paper trading? This will wipe all virtual trades and restore $10,000.')) return;
    localStorage.removeItem(PT_KEY);
    renderPaperTrading();
}

// ── EXECUTE A PAPER TRADE ─────────────────────────────────────────────

function executePaperTrade(type) {
    const symbolEl = document.getElementById('ptSymbol');
    const qtyEl    = document.getElementById('ptQty');
    const priceEl  = document.getElementById('ptPrice');
    const msgEl    = document.getElementById('ptMessage');

    const symbol   = symbolEl?.value?.toUpperCase().trim();
    const qty      = parseFloat(qtyEl?.value);
    const price    = parseFloat(priceEl?.value);

    if (!symbol) { showPTMsg('Please select an asset.', 'error'); return; }
    if (isNaN(qty) || qty <= 0) { showPTMsg('Enter a valid quantity.', 'error'); return; }
    if (isNaN(price) || price <= 0) { showPTMsg('Enter a valid price.', 'error'); return; }

    const state = loadPaperState();
    const cost  = qty * price;

    if (type === 'buy') {
        if (cost > state.cash) {
            showPTMsg(`Insufficient cash. You have ${formatCurrency(state.cash)} but need ${formatCurrency(cost)}.`, 'error');
            return;
        }
        state.cash -= cost;
        if (!state.holdings[symbol]) {
            state.holdings[symbol] = { qty: 0, avgCost: 0, name: symbol };
        }
        const h = state.holdings[symbol];
        const totalCost = h.qty * h.avgCost + cost;
        h.qty += qty;
        h.avgCost = totalCost / h.qty;

        state.trades.unshift({
            id: Date.now(), type: 'BUY', symbol, qty, price,
            total: cost, timestamp: Date.now()
        });
        showPTMsg(`✅ Bought ${qty} ${symbol} @ ${formatCurrency(price)} — Total: ${formatCurrency(cost)}`, 'success');

    } else if (type === 'sell') {
        const h = state.holdings[symbol];
        if (!h || h.qty < qty) {
            showPTMsg(`You only hold ${h ? h.qty.toFixed(6) : 0} ${symbol}.`, 'error');
            return;
        }
        const proceeds = qty * price;
        const costBasis = qty * h.avgCost;
        const pnl = proceeds - costBasis;

        state.cash += proceeds;
        h.qty -= qty;
        if (h.qty < 0.000001) delete state.holdings[symbol];

        state.trades.unshift({
            id: Date.now(), type: 'SELL', symbol, qty, price,
            total: proceeds, pnl, timestamp: Date.now()
        });
        showPTMsg(`✅ Sold ${qty} ${symbol} @ ${formatCurrency(price)} — P&L: ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`, pnl >= 0 ? 'success' : 'warning');
    }

    savePaperState(state);
    renderPaperTrading();
}

function showPTMsg(text, type = 'info') {
    const el = document.getElementById('ptMessage');
    if (!el) return;
    el.className = `pt-message pt-${type}`;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── FILL CURRENT PRICE ───────────────────────────────────────────────

async function fillCurrentPrice() {
    const sym = document.getElementById('ptSymbol')?.value?.toUpperCase().trim();
    if (!sym) { showPTMsg('Select an asset first.', 'error'); return; }

    const btn = document.getElementById('ptFillPrice');
    if (btn) btn.textContent = 'Loading...';

    try {
        const prices = await apiRequest('/api/crypto/prices');
        const found = prices.find(p => p.symbol === sym);
        if (found) {
            document.getElementById('ptPrice').value = found.price;
            showPTMsg(`Current price: ${formatCurrency(found.price)}`, 'info');
        } else {
            showPTMsg('Price not found. Enter manually.', 'warning');
        }
    } catch (e) {
        showPTMsg('Could not fetch price. Enter manually.', 'warning');
    } finally {
        if (btn) btn.textContent = '⟳ Current';
    }
}

// ── RENDER ───────────────────────────────────────────────────────────

async function renderPaperTrading() {
    const state = loadPaperState();

    // Fetch live prices to compute portfolio value
    let livePrices = {};
    try {
        const prices = await apiRequest('/api/crypto/prices');
        prices.forEach(p => { livePrices[p.symbol] = p.price; });
    } catch (e) {}

    // Compute portfolio value
    let holdingsValue = 0;
    const holdingRows = Object.entries(state.holdings).map(([sym, h]) => {
        const current = livePrices[sym] || h.avgCost;
        const value   = h.qty * current;
        const pnl     = value - (h.qty * h.avgCost);
        const pnlPct  = ((pnl / (h.qty * h.avgCost)) * 100);
        holdingsValue += value;
        return { sym, h, current, value, pnl, pnlPct };
    });

    const totalValue = state.cash + holdingsValue;
    const totalPnL   = totalValue - PT_START_CAPITAL;
    const totalPct   = ((totalPnL / PT_START_CAPITAL) * 100);

    // Summary bar
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

    // Holdings table
    const holdingsEl = document.getElementById('ptHoldings');
    if (holdingsEl) {
        if (holdingRows.length === 0) {
            holdingsEl.innerHTML = `<div class="pt-empty">No open positions. Place a buy order above.</div>`;
        } else {
            holdingsEl.innerHTML = `
            <table class="pt-table">
                <thead><tr><th>Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Value</th><th>P&L</th><th>Return</th><th></th></tr></thead>
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
                            <button class="btn-mini sell-btn" onclick="quickSell('${r.sym}', ${r.current})">Sell</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
        }
    }

    // Trade history
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

function quickSell(symbol, currentPrice) {
    const state = loadPaperState();
    const h = state.holdings[symbol];
    if (!h) return;

    if (confirm(`Sell ALL ${h.qty.toFixed(6)} ${symbol} @ ${formatCurrency(currentPrice)}?`)) {
        document.getElementById('ptSymbol').value = symbol;
        document.getElementById('ptQty').value = h.qty;
        document.getElementById('ptPrice').value = currentPrice;
        executePaperTrade('sell');
    }
}

function initPaperTrading() {
    renderPaperTrading();

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

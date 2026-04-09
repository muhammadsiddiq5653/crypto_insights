// Portfolio Tracker — localStorage-based, no server required

const PORTFOLIO_KEY = 'traderpro_portfolio';

function loadPortfolioFromStorage() {
    try {
        const raw = localStorage.getItem(PORTFOLIO_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function savePortfolioToStorage(holdings) {
    try {
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(holdings));
    } catch (e) {
        console.error('Failed to save portfolio:', e);
    }
}

function addHolding() {
    const type         = document.getElementById('holdingType').value;
    const symbol       = document.getElementById('holdingSymbol').value.trim().toUpperCase();
    const name         = document.getElementById('holdingName').value.trim();
    const qty          = parseFloat(document.getElementById('holdingQty').value);
    const buyPrice     = parseFloat(document.getElementById('holdingBuyPrice').value);
    const currentPrice = parseFloat(document.getElementById('holdingCurrentPrice').value);

    if (!symbol || !name || isNaN(qty) || qty <= 0 || isNaN(buyPrice) || buyPrice <= 0 || isNaN(currentPrice) || currentPrice <= 0) {
        alert('Please fill in all fields with valid values.');
        return;
    }

    const holdings = loadPortfolioFromStorage();

    holdings.push({
        id: Date.now(),
        type,
        symbol,
        name,
        qty,
        buyPrice,
        currentPrice
    });

    savePortfolioToStorage(holdings);
    renderPortfolio();

    // Clear form
    document.getElementById('holdingSymbol').value = '';
    document.getElementById('holdingName').value = '';
    document.getElementById('holdingQty').value = '';
    document.getElementById('holdingBuyPrice').value = '';
    document.getElementById('holdingCurrentPrice').value = '';
}

function removeHolding(id) {
    let holdings = loadPortfolioFromStorage();
    holdings = holdings.filter(h => h.id !== id);
    savePortfolioToStorage(holdings);
    renderPortfolio();
}

function clearPortfolio() {
    if (confirm('Remove all holdings from your portfolio?')) {
        localStorage.removeItem(PORTFOLIO_KEY);
        renderPortfolio();
    }
}

function exportPortfolio() {
    const holdings = loadPortfolioFromStorage();
    if (holdings.length === 0) {
        alert('No holdings to export.');
        return;
    }

    const headers = ['Type', 'Symbol', 'Name', 'Qty', 'Buy Price (USD)', 'Current Price (USD)', 'Invested', 'Current Value', 'P&L', 'Return %'];
    const rows = holdings.map(h => {
        const invested = h.qty * h.buyPrice;
        const current  = h.qty * h.currentPrice;
        const pnl      = current - invested;
        const ret      = ((pnl / invested) * 100).toFixed(2);
        return [h.type, h.symbol, h.name, h.qty, h.buyPrice, h.currentPrice,
                invested.toFixed(2), current.toFixed(2), pnl.toFixed(2), ret + '%'];
    });

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `traderpro-portfolio-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function renderPortfolio() {
    const holdings = loadPortfolioFromStorage();
    const tbody = document.getElementById('holdingsBody');
    if (!tbody) return;

    if (holdings.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="11">No holdings yet. Add your first position above.</td></tr>`;
        updatePortfolioSummary(0, 0);
        return;
    }

    let totalInvested = 0;
    let totalCurrent  = 0;

    tbody.innerHTML = holdings.map(h => {
        const invested = h.qty * h.buyPrice;
        const current  = h.qty * h.currentPrice;
        const pnl      = current - invested;
        const ret      = ((pnl / invested) * 100);

        totalInvested += invested;
        totalCurrent  += current;

        const pnlClass   = pnl >= 0 ? 'positive' : 'negative';
        const typeIcons  = { crypto: '₿', psx: '🇵🇰', forex: '💱', other: '📊' };
        const icon       = typeIcons[h.type] || '📊';

        return `
        <tr>
            <td><span class="holding-type">${icon} ${h.type.toUpperCase()}</span></td>
            <td><strong>${escapeHtml(h.symbol)}</strong></td>
            <td>${escapeHtml(h.name)}</td>
            <td>${h.qty.toLocaleString()}</td>
            <td>$${h.buyPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:6})}</td>
            <td>$${h.currentPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:6})}</td>
            <td>$${invested.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td>$${current.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td class="${pnlClass}">
                ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
            </td>
            <td class="${pnlClass}">
                ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%
            </td>
            <td>
                <button class="btn-icon-remove" onclick="removeHolding(${h.id})" title="Remove">✕</button>
            </td>
        </tr>`;
    }).join('');

    updatePortfolioSummary(totalInvested, totalCurrent);
}

function updatePortfolioSummary(invested, current) {
    const pnl = current - invested;
    const ret = invested > 0 ? ((pnl / invested) * 100) : 0;

    const fmt = (n) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const setEl = (id, val, cls) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = val;
        el.className = 'port-stat-value' + (cls ? ' ' + cls : '');
    };

    setEl('portTotalInvested', fmt(invested));
    setEl('portCurrentValue',  fmt(current));
    setEl('portPnL',  (pnl >= 0 ? '+' : '') + fmt(pnl),  pnl >= 0 ? 'positive' : 'negative');
    setEl('portReturn', (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%', ret >= 0 ? 'positive' : 'negative');
}

// Init portfolio when section loads
function initPortfolio() {
    renderPortfolio();
}

// ── WATCHLIST ────────────────────────────────────────────────────────
// localStorage-based watchlist. Star any asset across Crypto/PSX/Forex.

const WATCHLIST_KEY = 'traderpro_watchlist';

function loadWatchlist() {
    try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveWatchlist(list) {
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); }
    catch (e) {}
}

function isWatched(symbol, type = 'crypto') {
    return loadWatchlist().some(w => w.symbol === symbol && w.type === type);
}

function toggleWatch(symbol, name, type = 'crypto') {
    let list = loadWatchlist();
    const idx = list.findIndex(w => w.symbol === symbol && w.type === type);
    if (idx >= 0) {
        list.splice(idx, 1);
    } else {
        list.push({ symbol, name, type, addedAt: Date.now() });
    }
    saveWatchlist(list);
    refreshWatchlistBadges();
    if (document.getElementById('watchlist')?.classList.contains('active')) {
        renderWatchlistSection();
    }
}

function refreshWatchlistBadges() {
    const list = loadWatchlist();
    document.querySelectorAll('[data-watch-symbol]').forEach(btn => {
        const sym = btn.dataset.watchSymbol;
        const type = btn.dataset.watchType || 'crypto';
        const watched = list.some(w => w.symbol === sym && w.type === type);
        btn.classList.toggle('watched', watched);
        btn.title = watched ? 'Remove from Watchlist' : 'Add to Watchlist';
        btn.textContent = watched ? '★' : '☆';
    });

    // Update badge count in nav
    const badge = document.getElementById('watchlistCount');
    if (badge) {
        badge.textContent = list.length || '';
        badge.style.display = list.length ? 'inline' : 'none';
    }
}

async function renderWatchlistSection() {
    const container = document.getElementById('watchlistContent');
    if (!container) return;

    const list = loadWatchlist();

    if (list.length === 0) {
        container.innerHTML = `
        <div class="watchlist-empty">
            <div class="watchlist-empty-icon">☆</div>
            <h3>Your watchlist is empty</h3>
            <p>Click the ☆ star icon next to any asset in the Dashboard, Crypto, or PSX sections to add it here.</p>
        </div>`;
        return;
    }

    // Separate by type
    const cryptos = list.filter(w => w.type === 'crypto');
    const psxStocks = list.filter(w => w.type === 'psx');
    const forex = list.filter(w => w.type === 'forex');

    let html = '';

    // Fetch live crypto prices for watchlisted cryptos
    let liveprices = {};
    if (cryptos.length > 0) {
        try {
            const prices = await apiRequest('/api/crypto/prices');
            prices.forEach(p => { liveprices[p.symbol] = p; });
        } catch (e) {}
    }

    // Crypto rows
    if (cryptos.length > 0) {
        html += `<div class="wl-section-title">₿ Cryptocurrencies</div>`;
        html += `<div class="wl-grid">`;
        cryptos.forEach(w => {
            const p = liveprices[w.symbol];
            const cls = p ? getChangeClass(p.change24h) : '';
            html += `
            <div class="wl-card">
                <div class="wl-card-top">
                    <div>
                        <div class="wl-symbol">${escapeHtml(w.symbol)}</div>
                        <div class="wl-name">${escapeHtml(w.name)}</div>
                    </div>
                    <button class="wl-star watched" data-watch-symbol="${w.symbol}" data-watch-type="crypto"
                        onclick="toggleWatch('${w.symbol}','${w.name}','crypto')">★</button>
                </div>
                ${p ? `
                <div class="wl-price">${formatCurrency(p.price)}</div>
                <div class="wl-change ${cls}">${formatPercentage(p.change24h)}</div>
                <div class="wl-stats">
                    <span>Vol: ${formatLargeNumber(p.volume24h)}</span>
                    <span>MCap: ${formatLargeNumber(p.marketCap)}</span>
                </div>` : `<div class="wl-price dim">--</div>`}
                <button class="btn-mini wl-analyse" onclick="selectCryptoForAnalysis('${w.symbol}')">Analyse →</button>
            </div>`;
        });
        html += `</div>`;
    }

    // PSX Stocks
    if (psxStocks.length > 0) {
        html += `<div class="wl-section-title">🇵🇰 PSX Stocks</div>`;
        html += `<div class="wl-grid">`;
        psxStocks.forEach(w => {
            html += `
            <div class="wl-card">
                <div class="wl-card-top">
                    <div>
                        <div class="wl-symbol">${escapeHtml(w.symbol)}</div>
                        <div class="wl-name">${escapeHtml(w.name)}</div>
                    </div>
                    <button class="wl-star watched" data-watch-symbol="${w.symbol}" data-watch-type="psx"
                        onclick="toggleWatch('${w.symbol}','${w.name}','psx')">★</button>
                </div>
                <div class="wl-price dim">Visit PSX for live price</div>
                <a href="https://dps.psx.com.pk/symbol/${w.symbol}" target="_blank" rel="noopener" class="btn-mini wl-analyse">View on PSX ↗</a>
            </div>`;
        });
        html += `</div>`;
    }

    // Forex
    if (forex.length > 0) {
        html += `<div class="wl-section-title">💱 Forex Pairs</div>`;
        html += `<div class="wl-grid">`;

        let fxRates = {};
        try {
            const pairs = await apiRequest('/api/forex/pairs');
            pairs.forEach(p => { fxRates[p.symbol] = p; });
        } catch (e) {}

        forex.forEach(w => {
            const rate = fxRates[w.symbol];
            html += `
            <div class="wl-card">
                <div class="wl-card-top">
                    <div>
                        <div class="wl-symbol">${escapeHtml(w.symbol)}</div>
                        <div class="wl-name">${escapeHtml(w.name)}</div>
                    </div>
                    <button class="wl-star watched" data-watch-symbol="${w.symbol}" data-watch-type="forex"
                        onclick="toggleWatch('${w.symbol}','${w.name}','forex')">★</button>
                </div>
                <div class="wl-price">${rate ? rate.rate.toLocaleString(undefined,{maximumFractionDigits:4}) : '--'}</div>
            </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

// Create a watch button for any card
function createWatchButton(symbol, name, type = 'crypto') {
    const watched = isWatched(symbol, type);
    return `<button class="wl-star-btn ${watched ? 'watched' : ''}"
        data-watch-symbol="${symbol}" data-watch-type="${type}"
        onclick="event.stopPropagation(); toggleWatch('${symbol}','${name}','${type}')"
        title="${watched ? 'Remove from Watchlist' : 'Add to Watchlist'}">
        ${watched ? '★' : '☆'}
    </button>`;
}

// Init watchlist on section load
function initWatchlist() {
    renderWatchlistSection();
    refreshWatchlistBadges();
}

// ── GLOBAL MARKETS (US + UK) ───────────────────────────────────────────
// Handles US stocks (S&P 500 / NASDAQ), UK stocks (FTSE 100),
// global indices, and the global stock screener.

let gmCurrentMarket = 'us';
let gmUsStocks = [];
let gmUkStocks = [];
let gmIndicesData = null;

// ── INIT ──────────────────────────────────────────────────────────────

async function initGlobalMarkets() {
    // Load both markets in parallel
    await Promise.allSettled([
        loadUSMarkets(),
        loadUKMarkets(),
        loadGlobalIndices()
    ]);
}

function switchGlobalMarket(market, btn) {
    gmCurrentMarket = market;
    document.querySelectorAll('.gm-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.gm-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`gmPanel${market.charAt(0).toUpperCase() + market.slice(1)}`);
    if (panel) panel.classList.add('active');

    if (market === 'us' && gmUsStocks.length === 0) loadUSMarkets();
    if (market === 'uk' && gmUkStocks.length === 0) loadUKMarkets();
}

// ── US MARKETS ────────────────────────────────────────────────────────

async function loadUSMarkets() {
    const tbody = document.getElementById('usStocksBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="gm-loading"><div class="spinner"></div> Loading US stocks…</td></tr>`;

    try {
        const data = await apiRequest('/api/markets/us/stocks');
        gmUsStocks = Array.isArray(data) ? data : (data?.stocks || []);
        renderGlobalStocksTable('us', gmUsStocks);
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="gm-error">Failed to load US stocks. Check connection.</td></tr>`;
    }
}

async function loadUKMarkets() {
    const tbody = document.getElementById('ukStocksBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="gm-loading"><div class="spinner"></div> Loading UK stocks…</td></tr>`;

    try {
        const data = await apiRequest('/api/markets/uk/stocks');
        gmUkStocks = Array.isArray(data) ? data : (data?.stocks || []);
        renderGlobalStocksTable('uk', gmUkStocks);
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="gm-error">Failed to load UK stocks. Check connection.</td></tr>`;
    }
}

async function loadGlobalIndices() {
    const usEl  = document.getElementById('usIndices');
    const ukEl  = document.getElementById('ukIndices');

    try {
        const data = await apiRequest('/api/markets/indices');
        gmIndicesData = data;

        const allIndices = Array.isArray(data) ? data : (data?.indices || []);
        const usIndices = allIndices.filter(i => !['FTSE 100','FTSE 250'].includes(i.name));
        const ukIndices = allIndices.filter(i => ['FTSE 100','FTSE 250'].includes(i.name));

        if (usEl) usEl.innerHTML = renderIndicesRow(usIndices);
        if (ukEl) ukEl.innerHTML = renderIndicesRow(ukIndices);

        // Update dashboard tiles
        const sp500 = allIndices.find(i => i.symbol === '^GSPC' || i.name === 'S&P 500');
        const ftse  = allIndices.find(i => i.symbol === '^FTSE' || i.name === 'FTSE 100');
        if (sp500) {
            const el = document.getElementById('sp500Value');
            const chEl = document.getElementById('sp500Change');
            if (el) el.textContent = sp500.price?.toLocaleString() || sp500.current?.toLocaleString() || '--';
            if (chEl) {
                const chg = sp500.changePercent ?? sp500.change_pct ?? 0;
                chEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                chEl.className = 'tile-change ' + (chg >= 0 ? 'positive' : 'negative');
            }
            const dashEl = document.getElementById('dashSP500');
            if (dashEl) {
                dashEl.textContent = sp500.price?.toLocaleString() || '--';
                dashEl.className = 'mac-stat ' + ((sp500.changePercent ?? 0) >= 0 ? 'positive' : 'negative');
            }
        }
        if (ftse) {
            const el = document.getElementById('ftse100Value');
            const chEl = document.getElementById('ftse100Change');
            if (el) el.textContent = ftse.price?.toLocaleString() || ftse.current?.toLocaleString() || '--';
            if (chEl) {
                const chg = ftse.changePercent ?? ftse.change_pct ?? 0;
                chEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                chEl.className = 'tile-change ' + (chg >= 0 ? 'positive' : 'negative');
            }
            const dashEl = document.getElementById('dashFTSE');
            if (dashEl) {
                dashEl.textContent = ftse.price?.toLocaleString() || '--';
                dashEl.className = 'mac-stat ' + ((ftse.changePercent ?? 0) >= 0 ? 'positive' : 'negative');
            }
        }
    } catch (e) {
        if (usEl) usEl.innerHTML = `<div class="gm-error">Could not load indices.</div>`;
        if (ukEl) ukEl.innerHTML = `<div class="gm-error">Could not load indices.</div>`;
    }
}

function renderIndicesRow(indices) {
    if (!indices || !indices.length) return '<div class="gm-error">No index data available.</div>';
    return `<div class="gm-indices-row">${indices.map(idx => {
        const chg = idx.changePercent ?? idx.change_pct ?? 0;
        const chgClass = chg >= 0 ? 'positive' : 'negative';
        const price = idx.price ?? idx.current ?? 0;
        return `<div class="gm-index-card">
            <div class="gm-idx-name">${escapeHtml(idx.name || idx.symbol || '')}</div>
            <div class="gm-idx-price">${typeof price === 'number' ? price.toLocaleString() : price}</div>
            <div class="gm-idx-chg ${chgClass}">${chg >= 0 ? '+' : ''}${(+chg).toFixed(2)}%</div>
        </div>`;
    }).join('')}</div>`;
}

// ── STOCK TABLE RENDERING ─────────────────────────────────────────────

function renderGlobalStocksTable(market, stocks) {
    const tbody = document.getElementById(`${market}StocksBody`);
    if (!tbody) return;

    if (!stocks || !stocks.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="gm-empty">No data available.</td></tr>`;
        return;
    }

    tbody.innerHTML = stocks.map(s => {
        const chg = s.changePercent ?? s.change_pct ?? 0;
        const chgClass = chg >= 0 ? 'positive' : 'negative';
        const price = s.price ?? 0;
        const isCurrencyGBP = market === 'uk';
        const curr = isCurrencyGBP ? '£' : '$';

        return `<tr class="gm-stock-row">
            <td>
                <div class="gm-stock-name">
                    <strong>${escapeHtml(s.symbol || '')}</strong>
                    <small>${escapeHtml(s.name || '')}</small>
                </div>
            </td>
            <td><strong>${curr}${(+price).toFixed(2)}</strong></td>
            <td class="${chgClass}"><strong>${chg >= 0 ? '+' : ''}${(+chg).toFixed(2)}%</strong>
                <br><small class="dim">${curr}${Math.abs(s.change ?? 0).toFixed(2)}</small>
            </td>
            <td>${formatLargeNumber(s.volume || 0)}</td>
            <td>${s.marketCap ? formatLargeNumber(s.marketCap) : '—'}</td>
            <td>${s.pe ? (+s.pe).toFixed(1) : '—'}</td>
            <td class="positive">${s.high52w ? curr + (+s.high52w).toFixed(2) : '—'}</td>
            <td class="negative">${s.low52w ? curr + (+s.low52w).toFixed(2) : '—'}</td>
            <td>
                <button class="btn-mini" onclick="openStockDetail('${escapeHtml(s.symbol)}', '${market}')">Detail</button>
                <button class="btn-mini watch-btn" onclick="toggleWatch('${escapeHtml(s.symbol)}', '${escapeHtml(s.symbol)}', '${escapeHtml(s.name || s.symbol)}', this)">
                    ${typeof isWatched === 'function' && isWatched(s.symbol) ? '★' : '☆'}
                </button>
            </td>
        </tr>`;
    }).join('');
}

function filterGlobalStocks(market, query) {
    const stocks = market === 'us' ? gmUsStocks : gmUkStocks;
    const q = query.toLowerCase();
    const filtered = q
        ? stocks.filter(s => (s.symbol||'').toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q) || (s.sector||'').toLowerCase().includes(q))
        : stocks;
    renderGlobalStocksTable(market, filtered);
}

// ── STOCK DETAIL MODAL ────────────────────────────────────────────────

async function openStockDetail(symbol, market) {
    // Create or reuse modal
    let modal = document.getElementById('stockDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'stockDetailModal';
        modal.className = 'stock-detail-overlay';
        modal.innerHTML = `<div class="stock-detail-modal">
            <div class="stock-detail-header">
                <div>
                    <h3 id="sdTitle">Loading…</h3>
                    <div id="sdSubtitle" class="dim"></div>
                </div>
                <button onclick="document.getElementById('stockDetailModal').style.display='none'">✕</button>
            </div>
            <div id="sdBody" class="stock-detail-body"><div class="spinner"></div></div>
        </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    document.getElementById('sdTitle').textContent = symbol;
    document.getElementById('sdBody').innerHTML = `<div class="gm-loading"><div class="spinner"></div> Loading ${symbol}…</div>`;

    try {
        const data = await apiRequest(`/api/markets/stock/${symbol}`);
        const s = data?.stock || data || {};
        const isCurrencyGBP = market === 'uk';
        const curr = isCurrencyGBP ? '£' : '$';
        const chg = s.changePercent ?? 0;
        const chgClass = chg >= 0 ? 'positive' : 'negative';

        document.getElementById('sdTitle').textContent = `${symbol} — ${s.name || ''}`;
        document.getElementById('sdSubtitle').textContent = `${s.exchange || ''} · ${s.sector || ''}`;

        document.getElementById('sdBody').innerHTML = `
        <div class="sd-price-row">
            <div class="sd-price">${curr}${(+(s.price||0)).toFixed(2)}</div>
            <div class="sd-chg ${chgClass}">${chg >= 0 ? '+' : ''}${(+chg).toFixed(2)}% today</div>
        </div>
        <div class="sd-stats-grid">
            <div class="sd-stat"><div class="sd-stat-label">Market Cap</div><div class="sd-stat-val">${s.marketCap ? formatLargeNumber(s.marketCap) : '—'}</div></div>
            <div class="sd-stat"><div class="sd-stat-label">Volume</div><div class="sd-stat-val">${formatLargeNumber(s.volume||0)}</div></div>
            <div class="sd-stat"><div class="sd-stat-label">P/E Ratio</div><div class="sd-stat-val">${s.pe ? (+s.pe).toFixed(1) : '—'}</div></div>
            <div class="sd-stat"><div class="sd-stat-label">52w High</div><div class="sd-stat-val positive">${s.high52w ? curr + (+s.high52w).toFixed(2) : '—'}</div></div>
            <div class="sd-stat"><div class="sd-stat-label">52w Low</div><div class="sd-stat-val negative">${s.low52w ? curr + (+s.low52w).toFixed(2) : '—'}</div></div>
            <div class="sd-stat"><div class="sd-stat-label">Exchange</div><div class="sd-stat-val">${s.exchange || '—'}</div></div>
        </div>
        <div class="sd-tv-chart">
            <div class="sd-chart-title">Live Chart (TradingView)</div>
            <div id="sdChartContainer"></div>
        </div>
        <div class="sd-actions">
            <button class="btn-primary" onclick="logToJournalFromStock('${symbol}', ${s.price||0})">📓 Log Trade</button>
            <button class="btn-secondary watch-btn" onclick="toggleWatch('${symbol}', '${symbol}', '${s.name||symbol}', this)">${typeof isWatched === 'function' && isWatched(symbol) ? '★ Watching' : '☆ Watch'}</button>
        </div>`;

        // Load TradingView chart in modal
        setTimeout(() => {
            const container = document.getElementById('sdChartContainer');
            if (!container) return;
            const tvSym = market === 'uk' ? `LSE:${symbol.replace('.L','')}` : `NASDAQ:${symbol}`;
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
            script.async = true;
            script.innerHTML = JSON.stringify({
                symbol: tvSym, width: '100%', height: '220',
                locale: 'en', dateRange: '3M', colorTheme: 'dark',
                trendLineColor: 'rgba(102,126,234,1)',
                underLineColor: 'rgba(102,126,234,0.15)',
                isTransparent: true, autosize: true
            });
            const wrap = document.createElement('div');
            wrap.className = 'tradingview-widget-container';
            wrap.style.height = '220px';
            wrap.appendChild(document.createElement('div')).className = 'tradingview-widget-container__widget';
            wrap.appendChild(script);
            container.appendChild(wrap);
        }, 200);

    } catch (e) {
        document.getElementById('sdBody').innerHTML = `<div class="gm-error">Could not load ${symbol} details.</div>`;
    }
}

function logToJournalFromStock(symbol, price) {
    document.getElementById('stockDetailModal').style.display = 'none';
    switchSection('journal');
    setTimeout(() => {
        if (typeof openJournalForm === 'function') {
            openJournalForm();
            setTimeout(() => {
                const symEl = document.getElementById('jfSymbol');
                const entryEl = document.getElementById('jfEntry');
                const mktEl = document.getElementById('jfMarket');
                if (symEl) symEl.value = symbol;
                if (entryEl) entryEl.value = price;
                if (mktEl) mktEl.value = 'US/UK Stock';
            }, 100);
        }
    }, 400);
}

// ── GLOBAL SCREENER ───────────────────────────────────────────────────

function runGlobalScreener() {
    const market    = document.getElementById('gmsMarket')?.value || 'us';
    const changeDir = document.getElementById('gmsChange')?.value || 'all';
    const sortBy    = document.getElementById('gmsSort')?.value || 'marketCap';

    const stocks = market === 'us' ? gmUsStocks : gmUkStocks;
    if (!stocks.length) {
        const results = document.getElementById('gmsResults');
        if (results) results.innerHTML = `<div class="gm-screener-hint">Loading data, please wait…</div>`;
        if (market === 'us') loadUSMarkets().then(runGlobalScreener);
        else loadUKMarkets().then(runGlobalScreener);
        return;
    }

    const isCurrencyGBP = market === 'uk';
    const curr = isCurrencyGBP ? '£' : '$';

    let filtered = [...stocks];

    if (changeDir === 'up') filtered = filtered.filter(s => (s.changePercent ?? 0) > 0);
    else if (changeDir === 'down') filtered = filtered.filter(s => (s.changePercent ?? 0) < 0);
    else if (changeDir === 'up2') filtered = filtered.filter(s => (s.changePercent ?? 0) >= 2);
    else if (changeDir === 'down2') filtered = filtered.filter(s => (s.changePercent ?? 0) <= -2);

    filtered.sort((a, b) => {
        const av = a[sortBy] ?? 0;
        const bv = b[sortBy] ?? 0;
        if (sortBy === 'changePercent') return bv - av;
        return bv - av;
    });

    const results = document.getElementById('gmsResults');
    if (!results) return;

    if (!filtered.length) {
        results.innerHTML = `<div class="gm-screener-hint">No stocks match these filters.</div>`;
        return;
    }

    results.innerHTML = `
    <div class="gm-screener-summary">${filtered.length} stocks found from ${market === 'us' ? 'US' : 'UK'} market</div>
    <div class="gm-screener-cards">
        ${filtered.map(s => {
            const chg = s.changePercent ?? 0;
            const chgClass = chg >= 0 ? 'positive' : 'negative';
            return `<div class="gm-screener-card" onclick="openStockDetail('${s.symbol}', '${market}')">
                <div class="gms-top">
                    <div>
                        <strong>${escapeHtml(s.symbol)}</strong>
                        <div class="dim" style="font-size:0.7rem">${escapeHtml(s.name || '')}</div>
                    </div>
                    <span class="${chgClass}" style="font-weight:800">${chg >= 0 ? '+' : ''}${(+chg).toFixed(2)}%</span>
                </div>
                <div class="gms-price">${curr}${(+(s.price||0)).toFixed(2)}</div>
                <div class="gms-stats">
                    <span>MCap: ${s.marketCap ? formatLargeNumber(s.marketCap) : '—'}</span>
                    <span>P/E: ${s.pe ? (+s.pe).toFixed(1) : '—'}</span>
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

// ── DASHBOARD HELPERS ─────────────────────────────────────────────────

function setAcademyTrack(trackId) {
    document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.academy-track').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`[data-track="${trackId}"]`);
    if (btn) btn.classList.add('active');
    const track = document.getElementById(`track-${trackId}`);
    if (track) track.classList.add('active');
}

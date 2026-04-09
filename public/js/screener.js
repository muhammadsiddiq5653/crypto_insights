// ── CRYPTO SCREENER ───────────────────────────────────────────────────
// Screens all tracked coins using live price + analysis data.
// Filters: RSI oversold/overbought, volume spike, MA trend, signal.

const SCREENER_PRESETS = {
    oversold:  { label: '🔥 RSI Oversold (<30)',  rsiMax: 30,  rsiMin: 0,   volSpike: false, signal: 'all' },
    overbought:{ label: '⚠️ RSI Overbought (>70)', rsiMax: 100, rsiMin: 70,  volSpike: false, signal: 'all' },
    volSpike:  { label: '📊 Volume Spike (2×)',    rsiMax: 100, rsiMin: 0,   volSpike: true,  signal: 'all' },
    buySignal: { label: '✅ Buy Signals',           rsiMax: 100, rsiMin: 0,   volSpike: false, signal: 'BUY' },
    sellSignal:{ label: '🔴 Sell Signals',          rsiMax: 100, rsiMin: 0,   volSpike: false, signal: 'SELL' },
    custom:    { label: '⚙️ Custom',                rsiMax: 100, rsiMin: 0,   volSpike: false, signal: 'all' }
};

let screenerResults = [];
let screenerLoading = false;

// ── MAIN RENDER ───────────────────────────────────────────────────────

async function initScreener() {
    renderScreenerUI();
    await runScreener();
}

function renderScreenerUI() {
    const container = document.getElementById('screenerContent');
    if (!container) return;

    container.innerHTML = `
    <div class="screener-header">
        <div class="screener-presets">
            ${Object.entries(SCREENER_PRESETS).map(([key, p]) =>
                `<button class="screener-preset-btn ${key === 'oversold' ? 'active' : ''}"
                    data-preset="${key}">${p.label}</button>`
            ).join('')}
        </div>
        <div class="screener-custom-filters" id="screenerCustomFilters" style="display:none">
            <div class="screener-filter-row">
                <label>RSI Min <input type="number" id="scRsiMin" value="0" min="0" max="100"></label>
                <label>RSI Max <input type="number" id="scRsiMax" value="100" min="0" max="100"></label>
                <label>Signal
                    <select id="scSignal">
                        <option value="all">All</option>
                        <option value="BUY">BUY</option>
                        <option value="HOLD">HOLD</option>
                        <option value="SELL">SELL</option>
                    </select>
                </label>
                <label>
                    <input type="checkbox" id="scVolSpike"> Volume Spike (2×)
                </label>
                <button class="btn-primary" onclick="runScreener()">Run Screener</button>
            </div>
        </div>
    </div>

    <div class="screener-summary" id="screenerSummary">
        <div class="screener-stat"><span id="scStatTotal">—</span><small>Scanned</small></div>
        <div class="screener-stat buy"><span id="scStatBuy">—</span><small>BUY Signals</small></div>
        <div class="screener-stat hold"><span id="scStatHold">—</span><small>HOLD Signals</small></div>
        <div class="screener-stat sell"><span id="scStatSell">—</span><small>SELL Signals</small></div>
        <div class="screener-stat oversold"><span id="scStatOversold">—</span><small>RSI Oversold</small></div>
        <div class="screener-stat overbought"><span id="scStatOverbought">—</span><small>RSI Overbought</small></div>
    </div>

    <div class="screener-table-wrap">
        <table class="screener-table" id="screenerTable">
            <thead>
                <tr>
                    <th onclick="sortScreener('name')">Coin ⇅</th>
                    <th onclick="sortScreener('price')">Price ⇅</th>
                    <th onclick="sortScreener('change24h')">24h % ⇅</th>
                    <th onclick="sortScreener('rsi')">RSI ⇅</th>
                    <th onclick="sortScreener('signal')">Signal ⇅</th>
                    <th onclick="sortScreener('confidence')">Confidence ⇅</th>
                    <th onclick="sortScreener('volume')">Volume ⇅</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody id="screenerBody">
                <tr><td colspan="8" class="screener-loading">
                    <div class="spinner"></div> Scanning markets…
                </td></tr>
            </tbody>
        </table>
    </div>`;

    // Bind preset buttons
    document.querySelectorAll('.screener-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.screener-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const preset = btn.dataset.preset;
            const customFilters = document.getElementById('screenerCustomFilters');
            if (preset === 'custom') {
                customFilters.style.display = 'block';
            } else {
                customFilters.style.display = 'none';
                applyPreset(preset);
            }
        });
    });
}

function applyPreset(key) {
    const p = SCREENER_PRESETS[key];
    if (!p) return;
    const rsiMin = document.getElementById('scRsiMin');
    const rsiMax = document.getElementById('scRsiMax');
    const signal = document.getElementById('scSignal');
    const volSpike = document.getElementById('scVolSpike');
    if (rsiMin) rsiMin.value = p.rsiMin;
    if (rsiMax) rsiMax.value = p.rsiMax;
    if (signal) signal.value = p.signal;
    if (volSpike) volSpike.checked = p.volSpike;
    runScreener();
}

// ── SCREENER LOGIC ────────────────────────────────────────────────────

let screenerSortKey = 'signal';
let screenerSortDir = 1;

async function runScreener() {
    if (screenerLoading) return;
    screenerLoading = true;

    const tbody = document.getElementById('screenerBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="screener-loading"><div class="spinner"></div> Scanning ${window._cryptoList ? window._cryptoList.length : 24} coins…</td></tr>`;

    try {
        // Get live prices
        const prices = await apiRequest('/api/crypto/prices');
        if (!prices || !prices.length) throw new Error('No price data');

        // Get analysis for each coin in parallel (limit concurrency)
        const results = [];
        const batchSize = 6;

        for (let i = 0; i < prices.length; i += batchSize) {
            const batch = prices.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(async (coin) => {
                    try {
                        const analysis = await apiRequest(`/api/crypto/${coin.id}/analysis`);
                        return {
                            id: coin.id,
                            symbol: coin.symbol,
                            name: coin.name,
                            price: coin.price,
                            change24h: coin.change24h,
                            volume: coin.volume24h || 0,
                            marketCap: coin.marketCap || 0,
                            rsi: analysis?.indicators?.rsi?.value ?? null,
                            signal: analysis?.overall?.signal || 'HOLD',
                            confidence: analysis?.overall?.confidence || 0,
                            macdSignal: analysis?.indicators?.macd?.signal || '—',
                            bbPosition: analysis?.indicators?.bollingerBands?.position || '—',
                            volRatio: analysis?.indicators?.volume?.ratio || 1,
                            aboveMA200: analysis?.indicators?.movingAverages?.above200MA ?? null,
                        };
                    } catch (e) {
                        return {
                            id: coin.id, symbol: coin.symbol, name: coin.name,
                            price: coin.price, change24h: coin.change24h,
                            volume: coin.volume24h || 0, marketCap: coin.marketCap || 0,
                            rsi: null, signal: 'HOLD', confidence: 0,
                            macdSignal: '—', bbPosition: '—', volRatio: 1, aboveMA200: null
                        };
                    }
                })
            );
            batchResults.forEach(r => { if (r.status === 'fulfilled') results.push(r.value); });
        }

        screenerResults = results;
        renderScreenerResults();
        updateScreenerSummary();

    } catch (e) {
        const tbody = document.getElementById('screenerBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="screener-error">Failed to load screener data. Please try again.</td></tr>`;
    } finally {
        screenerLoading = false;
    }
}

function getScreenerFilters() {
    const rsiMin = parseFloat(document.getElementById('scRsiMin')?.value ?? 0);
    const rsiMax = parseFloat(document.getElementById('scRsiMax')?.value ?? 100);
    const signal = document.getElementById('scSignal')?.value || 'all';
    const volSpike = document.getElementById('scVolSpike')?.checked || false;
    return { rsiMin, rsiMax, signal, volSpike };
}

function renderScreenerResults() {
    const tbody = document.getElementById('screenerBody');
    if (!tbody || !screenerResults.length) return;

    const filters = getScreenerFilters();

    let filtered = screenerResults.filter(r => {
        if (r.rsi !== null) {
            if (r.rsi < filters.rsiMin || r.rsi > filters.rsiMax) return false;
        }
        if (filters.signal !== 'all' && r.signal !== filters.signal) return false;
        if (filters.volSpike && r.volRatio < 2) return false;
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        let av = a[screenerSortKey] ?? 0;
        let bv = b[screenerSortKey] ?? 0;
        if (screenerSortKey === 'name' || screenerSortKey === 'signal') {
            av = String(av); bv = String(bv);
            return screenerSortDir * av.localeCompare(bv);
        }
        return screenerSortDir * (av - bv);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="screener-empty">No coins match the current filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(r => {
        const rsiClass = r.rsi === null ? '' : r.rsi < 30 ? 'rsi-oversold' : r.rsi > 70 ? 'rsi-overbought' : 'rsi-neutral';
        const sigClass = r.signal === 'BUY' ? 'signal-buy' : r.signal === 'SELL' ? 'signal-sell' : 'signal-hold';
        const chgClass = (r.change24h || 0) >= 0 ? 'positive' : 'negative';
        const volBadge = r.volRatio >= 2 ? `<span class="vol-spike-badge">2×+</span>` : '';
        const maLabel = r.aboveMA200 === true ? '<span class="ma-above">↑MA200</span>' : r.aboveMA200 === false ? '<span class="ma-below">↓MA200</span>' : '';

        return `<tr class="screener-row" onclick="navigateToAnalysis('${r.id}', '${r.symbol}')">
            <td>
                <div class="sc-coin-name">
                    <strong>${escapeHtml(r.symbol)}</strong>
                    <small>${escapeHtml(r.name)}</small>
                </div>
            </td>
            <td>${formatCurrency(r.price)}</td>
            <td class="${chgClass}">${(r.change24h || 0) >= 0 ? '+' : ''}${(r.change24h || 0).toFixed(2)}%</td>
            <td>
                <span class="rsi-badge ${rsiClass}">${r.rsi !== null ? r.rsi.toFixed(1) : '—'}</span>
            </td>
            <td>
                <span class="signal-badge ${sigClass}">${r.signal}</span>
            </td>
            <td>
                <div class="confidence-bar">
                    <div class="conf-fill ${sigClass}" style="width:${r.confidence}%"></div>
                    <span>${r.confidence}%</span>
                </div>
            </td>
            <td>
                ${formatLargeNumber(r.volume)} ${volBadge}
                ${maLabel}
            </td>
            <td>
                <button class="btn-mini" onclick="event.stopPropagation(); navigateToAnalysis('${r.id}', '${r.symbol}')">Analyse</button>
                <button class="btn-mini watch-btn" onclick="event.stopPropagation(); toggleWatch('${r.id}', '${r.symbol}', '${r.name}', this)">
                    ${typeof isWatched === 'function' && isWatched(r.id) ? '★' : '☆'}
                </button>
            </td>
        </tr>`;
    }).join('');
}

function updateScreenerSummary() {
    if (!screenerResults.length) return;
    const buy  = screenerResults.filter(r => r.signal === 'BUY').length;
    const sell = screenerResults.filter(r => r.signal === 'SELL').length;
    const hold = screenerResults.filter(r => r.signal === 'HOLD').length;
    const oversold   = screenerResults.filter(r => r.rsi !== null && r.rsi < 30).length;
    const overbought = screenerResults.filter(r => r.rsi !== null && r.rsi > 70).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('scStatTotal', screenerResults.length);
    set('scStatBuy', buy);
    set('scStatHold', hold);
    set('scStatSell', sell);
    set('scStatOversold', oversold);
    set('scStatOverbought', overbought);
}

function sortScreener(key) {
    if (screenerSortKey === key) screenerSortDir *= -1;
    else { screenerSortKey = key; screenerSortDir = 1; }
    renderScreenerResults();
}

function navigateToAnalysis(coinId, symbol) {
    // Navigate to Markets/Analysis section and load the coin
    switchSection('markets');
    setTimeout(() => {
        const searchInput = document.getElementById('cryptoSearchInput') || document.getElementById('analysisSymbol');
        if (searchInput) {
            searchInput.value = symbol;
            searchInput.dispatchEvent(new Event('input'));
        }
        if (typeof loadAnalysis === 'function') loadAnalysis(coinId);
    }, 300);
}

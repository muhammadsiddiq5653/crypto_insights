// ── ENHANCED SCREENER V2 ──────────────────────────────────────────────────
// Advanced multi-criteria filtering with sortable results table.

const SCREENER_V2_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'MATIC', 'DOT', 'LTC', 'ATOM', 'UNI', 'FIL', 'NEAR', 'TRX', 'SHIB', 'ETC'];

let screenerV2Results = [];
let screenerV2Loading = false;
let screenerV2SortKey = 'symbol';
let screenerV2SortDir = 1;

// Override initScreener() to use enhanced version
async function initScreener() {
    renderScreenerV2UI();
    // Don't auto-run on init — user clicks "Scan & Filter"
}

function renderScreenerV2UI() {
    const container = document.getElementById('screener');
    if (!container) return;

    container.innerHTML = `
    <div class="sv2-container">
        <h2>Advanced Crypto Screener</h2>

        <div class="sv2-filters">
            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>RSI Range:</span>
                    <input type="number" id="sv2RsiMin" min="0" max="100" value="0" placeholder="Min" class="sv2-input" style="width: 70px;">
                    <span>—</span>
                    <input type="number" id="sv2RsiMax" min="0" max="100" value="100" placeholder="Max" class="sv2-input" style="width: 70px;">
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>MACD Signal:</span>
                    <select id="sv2MACDSignal" class="sv2-select">
                        <option value="">Any</option>
                        <option value="bullish">Bullish</option>
                        <option value="bearish">Bearish</option>
                    </select>
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>Bollinger Band Position:</span>
                    <select id="sv2BBPosition" class="sv2-select">
                        <option value="">Any</option>
                        <option value="above_upper">Above Upper</option>
                        <option value="below_lower">Below Lower</option>
                        <option value="inside">Inside Bands</option>
                    </select>
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>Price vs 50MA:</span>
                    <select id="sv250MA" class="sv2-select">
                        <option value="">Any</option>
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                    </select>
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>Price vs 200MA:</span>
                    <select id="sv2200MA" class="sv2-select">
                        <option value="">Any</option>
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                    </select>
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>Volume Change 24h:</span>
                    <select id="sv2VolChange" class="sv2-select">
                        <option value="">Any</option>
                        <option value="spike">Spike (+50%)</option>
                        <option value="high">High (+20%)</option>
                        <option value="low">Low (-20%)</option>
                    </select>
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>Overall Signal:</span>
                    <select id="sv2Signal" class="sv2-select">
                        <option value="">Any</option>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                        <option value="NEUTRAL">NEUTRAL</option>
                    </select>
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>Min Confidence %:</span>
                    <input type="number" id="sv2Confidence" min="0" max="100" value="0" class="sv2-input" style="width: 70px;">
                </label>
            </div>

            <div class="sv2-filter-group">
                <label class="sv2-filter-row">
                    <span>24h Price Change:</span>
                    <select id="sv224hChange" class="sv2-select">
                        <option value="">Any</option>
                        <option value="up5">Up >5%</option>
                        <option value="up2">Up >2%</option>
                        <option value="down2">Down >2%</option>
                        <option value="down5">Down >5%</option>
                    </select>
                </label>
            </div>

            <button class="sv2-scan-btn" onclick="runScreenerV2()">Scan & Filter</button>
        </div>

        <div id="sv2MatchCount" class="sv2-match-count" style="display:none;"></div>

        <div id="sv2BulkActions" class="sv2-bulk-actions" style="display:none; margin: 15px 0;">
            <label style="margin-right: 20px;">
                <input type="checkbox" id="sv2SelectAll" onchange="toggleSelectAll()"> Select All
            </label>
            <button class="btn-secondary" onclick="addSelectedToWatchlist()">Add Selected to Watchlist</button>
        </div>

        <div class="sv2-results-table-wrap" id="sv2ResultsWrap" style="display:none;">
            <table class="sv2-results-table">
                <thead>
                    <tr>
                        <th style="width: 40px;"><input type="checkbox" id="sv2SelectAllCheck" onchange="toggleSelectAll()"></th>
                        <th onclick="sortScreenerV2('symbol')">Coin ⇅</th>
                        <th onclick="sortScreenerV2('price')">Price ⇅</th>
                        <th onclick="sortScreenerV2('change24h')">24h% ⇅</th>
                        <th onclick="sortScreenerV2('rsi')">RSI ⇅</th>
                        <th onclick="sortScreenerV2('macd')">MACD ⇅</th>
                        <th onclick="sortScreenerV2('signal')">Signal ⇅</th>
                        <th onclick="sortScreenerV2('confidence')">Confidence ⇅</th>
                        <th>BB Position</th>
                        <th>vs 50MA</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="sv2ResultsBody">
                    <tr><td colspan="11" class="screener-loading"><div class="spinner"></div> Scanning coins…</td></tr>
                </tbody>
            </table>
        </div>
    </div>
    `;
}

async function runScreenerV2() {
    if (screenerV2Loading) return;
    screenerV2Loading = true;

    const resultsWrap = document.getElementById('sv2ResultsWrap');
    const tbody = document.getElementById('sv2ResultsBody');
    if (resultsWrap) resultsWrap.style.display = 'block';
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="screener-loading"><div class="spinner"></div> Scanning ${SCREENER_V2_COINS.length} coins…</td></tr>`;

    try {
        // Fetch all coin prices
        const prices = await apiRequest('/api/crypto/prices');
        if (!prices || !prices.length) throw new Error('No price data');

        // Fetch analysis for each selected coin
        const results = [];
        const batchSize = 5;

        for (let i = 0; i < SCREENER_V2_COINS.length; i += batchSize) {
            const batch = SCREENER_V2_COINS.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(async (symbol) => {
                    try {
                        const priceData = prices.find(p => p.symbol === symbol);
                        if (!priceData) return null;

                        const analysis = await apiRequest(`/api/crypto/${priceData.id}/analysis`);
                        return {
                            symbol: symbol,
                            price: priceData.price,
                            change24h: priceData.change24h || 0,
                            volume24h: priceData.volume24h || 0,
                            rsi: analysis?.indicators?.rsi?.value ?? null,
                            macd: analysis?.indicators?.macd?.signal || '—',
                            bbPosition: analysis?.indicators?.bollingerBands?.position || '—',
                            ma50: analysis?.indicators?.movingAverages?.ma50 ?? null,
                            ma200: analysis?.indicators?.movingAverages?.ma200 ?? null,
                            signal: analysis?.overall?.signal || 'HOLD',
                            confidence: analysis?.overall?.confidence || 0,
                            aboveMA50: priceData.price > (analysis?.indicators?.movingAverages?.ma50 ?? priceData.price),
                            aboveMA200: priceData.price > (analysis?.indicators?.movingAverages?.ma200 ?? priceData.price),
                        };
                    } catch (e) {
                        return null;
                    }
                })
            );
            batchResults.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
        }

        screenerV2Results = results;
        renderScreenerV2Results();

    } catch (e) {
        const tbody = document.getElementById('sv2ResultsBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="screener-error">Failed to scan. Please try again.</td></tr>`;
    } finally {
        screenerV2Loading = false;
    }
}

function getScreenerV2Filters() {
    return {
        rsiMin: parseFloat(document.getElementById('sv2RsiMin')?.value ?? 0),
        rsiMax: parseFloat(document.getElementById('sv2RsiMax')?.value ?? 100),
        macdSignal: document.getElementById('sv2MACDSignal')?.value || '',
        bbPosition: document.getElementById('sv2BBPosition')?.value || '',
        ma50: document.getElementById('sv250MA')?.value || '',
        ma200: document.getElementById('sv2200MA')?.value || '',
        volChange: document.getElementById('sv2VolChange')?.value || '',
        signal: document.getElementById('sv2Signal')?.value || '',
        confidence: parseFloat(document.getElementById('sv2Confidence')?.value ?? 0),
        change24h: document.getElementById('sv224hChange')?.value || '',
    };
}

function renderScreenerV2Results() {
    const tbody = document.getElementById('sv2ResultsBody');
    const matchEl = document.getElementById('sv2MatchCount');
    const bulkEl = document.getElementById('sv2BulkActions');
    if (!tbody || !screenerV2Results.length) return;

    const filters = getScreenerV2Filters();

    let filtered = screenerV2Results.filter(r => {
        if (r.rsi !== null && (r.rsi < filters.rsiMin || r.rsi > filters.rsiMax)) return false;
        if (filters.signal && r.signal !== filters.signal) return false;
        if (filters.confidence > 0 && r.confidence < filters.confidence) return false;

        if (filters.macdSignal) {
            const macdLower = String(r.macd).toLowerCase();
            if (filters.macdSignal === 'bullish' && macdLower !== 'bullish') return false;
            if (filters.macdSignal === 'bearish' && macdLower !== 'bearish') return false;
        }

        if (filters.bbPosition) {
            const bbLower = String(r.bbPosition).toLowerCase();
            if (filters.bbPosition === 'above_upper' && !bbLower.includes('upper')) return false;
            if (filters.bbPosition === 'below_lower' && !bbLower.includes('lower')) return false;
            if (filters.bbPosition === 'inside' && (bbLower.includes('upper') || bbLower.includes('lower'))) return false;
        }

        if (filters.ma50) {
            if (filters.ma50 === 'above' && !r.aboveMA50) return false;
            if (filters.ma50 === 'below' && r.aboveMA50) return false;
        }

        if (filters.ma200) {
            if (filters.ma200 === 'above' && !r.aboveMA200) return false;
            if (filters.ma200 === 'below' && r.aboveMA200) return false;
        }

        if (filters.change24h) {
            const chg = r.change24h;
            if (filters.change24h === 'up5' && chg <= 5) return false;
            if (filters.change24h === 'up2' && chg <= 2) return false;
            if (filters.change24h === 'down2' && chg >= -2) return false;
            if (filters.change24h === 'down5' && chg >= -5) return false;
        }

        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        let av = a[screenerV2SortKey] ?? 0;
        let bv = b[screenerV2SortKey] ?? 0;
        if (screenerV2SortKey === 'symbol' || screenerV2SortKey === 'signal' || screenerV2SortKey === 'macd') {
            av = String(av); bv = String(bv);
            return screenerV2SortDir * av.localeCompare(bv);
        }
        return screenerV2SortDir * (av - bv);
    });

    if (matchEl) {
        matchEl.style.display = 'block';
        matchEl.textContent = `${filtered.length} of ${screenerV2Results.length} coins match your filters`;
    }
    if (bulkEl) bulkEl.style.display = 'block';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="screener-empty">No coins match your criteria.</td></tr>`;
        if (matchEl) matchEl.textContent = '0 coins match your filters';
        return;
    }

    tbody.innerHTML = filtered.map((r, idx) => {
        const rsiClass = r.rsi === null ? '' : r.rsi < 30 ? 'rsi-oversold' : r.rsi > 70 ? 'rsi-overbought' : 'rsi-neutral';
        const sigClass = r.signal === 'BUY' ? 'signal-buy' : r.signal === 'SELL' ? 'signal-sell' : 'signal-hold';
        const confClass = r.confidence > 70 ? 'conf-high' : r.confidence >= 50 ? 'conf-med' : 'conf-low';
        const chgClass = r.change24h >= 0 ? 'positive' : 'negative';
        const bbPos = r.bbPosition || '—';
        const ma50Text = r.aboveMA50 ? '↑ Above' : '↓ Below';

        return `<tr class="sv2-row" data-idx="${idx}">
            <td><input type="checkbox" class="sv2-coin-check" value="${r.symbol}"></td>
            <td><strong>${escapeHtml(r.symbol)}</strong></td>
            <td>${formatCurrency(r.price)}</td>
            <td class="${chgClass}">${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%</td>
            <td><span class="rsi-badge ${rsiClass}">${r.rsi !== null ? r.rsi.toFixed(1) : '—'}</span></td>
            <td>${escapeHtml(String(r.macd).substring(0, 10))}</td>
            <td><span class="signal-badge ${sigClass}">${r.signal}</span></td>
            <td><span class="${confClass}">${r.confidence}%</span></td>
            <td>${escapeHtml(bbPos.substring(0, 12))}</td>
            <td>${ma50Text}</td>
            <td class="sv2-actions">
                <button class="btn-mini" onclick="selectCryptoForAnalysis('${r.symbol}')">Analyze</button>
                <button class="btn-mini" onclick="switchSection('smart-alerts')">Alert</button>
            </td>
        </tr>`;
    }).join('');
}

function selectCryptoForAnalysis(symbol) {
    switchSection('markets');
    setTimeout(() => {
        const searchInput = document.getElementById('cryptoSearchInput') || document.getElementById('analysisSymbol');
        if (searchInput) {
            searchInput.value = symbol;
            searchInput.dispatchEvent(new Event('input'));
        }
    }, 300);
}

function sortScreenerV2(key) {
    if (screenerV2SortKey === key) screenerV2SortDir *= -1;
    else { screenerV2SortKey = key; screenerV2SortDir = 1; }
    renderScreenerV2Results();
}

function toggleSelectAll() {
    const allCheck = document.getElementById('sv2SelectAllCheck');
    const checks = document.querySelectorAll('.sv2-coin-check');
    checks.forEach(c => c.checked = allCheck ? allCheck.checked : false);
}

function addSelectedToWatchlist() {
    const checks = document.querySelectorAll('.sv2-coin-check:checked');
    if (checks.length === 0) {
        alert('Select at least one coin.');
        return;
    }
    const symbols = Array.from(checks).map(c => c.value);
    alert(`Added ${symbols.length} coins to watchlist: ${symbols.join(', ')}`);
    // TODO: Implement actual watchlist persistence
}

// TraderPro — Main Application Logic
// Multi-asset portal: Crypto, PSX, Forex, Stocks

const state = {
    cryptocurrencies: [],
    selectedCrypto: null,
    currentSection: 'dashboard',
    updateInterval: null,
    alertInterval: null,
    priceAlerts: [],
    cryptoPriceCache: {},
    forexRatesCache: null
};

// ── INIT ─────────────────────────────────────────────────────────────

async function initApp() {
    console.log('🚀 Initialising TraderPro...');

    try {
        // Init ticker bar first (non-blocking, shows at top immediately)
        if (typeof initTickerBar === 'function') initTickerBar();

        await loadCryptocurrencies();
        setupNavigation();
        setupMobileNav();
        setupCryptoSelector();
        setupNewsFilter();
        setupCoinSearch();
        setupFuturesSelector();
        setupAcademyTracks();
        setupNewsTabFilter();
        initGlossary();
        initPortfolio();

        // Load initial dashboard data in parallel
        await Promise.allSettled([
            loadDashboard(),
            loadFearGreed(),
            loadForexPKRSummary()
        ]);

        // Load global indices for dashboard tiles (non-blocking)
        if (typeof loadGlobalIndices === 'function') loadGlobalIndices();

        // Init dashboard widgets (non-blocking)
        if (typeof initDashboardWidgets === 'function') initDashboardWidgets();

        startAutoUpdate();
        updateLastUpdateTime();
        loadAlertsFromStorage();
        refreshWatchlistBadges();

        // Init new features
        if (typeof initUniversalSearch === 'function') initUniversalSearch();
        applyStoredTheme();

        console.log('✅ TraderPro ready!');
    } catch (error) {
        console.error('❌ Init failed:', error);
        showError('marketOverview', 'Failed to load. Please refresh the page.');
    }
}

// ── NAVIGATION ───────────────────────────────────────────────────────

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function setupMobileNav() {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
            document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchSection(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionName);
    if (target) {
        target.classList.add('active');
        state.currentSection = sectionName;

        // Lazy-load section content
        switch (sectionName) {
            case 'news':          loadNews(); break;
            case 'heatmap':       loadHeatmap(); break;
            case 'crypto':        loadCryptoTable(); break;
            case 'psx':           loadPSXSection(); break;
            case 'forex':         loadForexSection(); break;
            case 'converter':     loadPKRRates(); break;
            case 'portfolio':     renderPortfolio(); break;
            case 'glossary':      initGlossary(); break;
            case 'watchlist':     initWatchlist(); break;
            case 'papertrading':  initPaperTrading(); break;
            case 'calendar':      initCalendar(); break;
            case 'screener':      if (typeof initScreener === 'function') initScreener(); break;
            case 'journal':       if (typeof initTradeJournal === 'function') initTradeJournal(); break;
            case 'backtest':      if (typeof initBacktest === 'function') initBacktest(); break;
            case 'global-markets': if (typeof initGlobalMarkets === 'function') initGlobalMarkets(); break;
            case 'academy':         if (typeof initAcademyDynamic === 'function') initAcademyDynamic(); break;
            case 'signal-history':  if (typeof initSignalHistory === 'function') initSignalHistory(); break;
            case 'exchanges':           if (typeof initExchanges === 'function') initExchanges(); break;
            case 'trade-ideas':         if (typeof initTradeIdeas === 'function') initTradeIdeas(); break;
            case 'export-center':       if (typeof initExportCenter === 'function') initExportCenter(); break;
            case 'dashboard':           if (typeof initDashboardWidgets === 'function') initDashboardWidgets(); break;
            case 'mtf':                 if (typeof initMTF === 'function') initMTF(); break;
            case 'correlation':         if (typeof initCorrelation === 'function') initCorrelation(); break;
            case 'ai-coach':            if (typeof initAICoach === 'function') initAICoach(); break;
            case 'tax-calc':            if (typeof initTaxCalc === 'function') initTaxCalc(); break;
            case 'payoff':              if (typeof initPayoffChart === 'function') initPayoffChart(); break;
            case 'sentiment':           if (typeof initSentimentDash === 'function') initSentimentDash(); break;
            case 'portfolio-analytics': if (typeof initPortfolioAnalytics === 'function') initPortfolioAnalytics(); break;
            case 'smart-alerts':        if (typeof initSmartAlerts === 'function') initSmartAlerts(); break;
            case 'calculator':          if (typeof calcStandalonePosition === 'function') { /* auto-calc on input */ } break;
            case 'ml-predict':          if (typeof MLPredict !== 'undefined' && MLPredict.init) MLPredict.init(); break;
            case 'autotrade':           if (typeof AutoTrade !== 'undefined' && AutoTrade.init) AutoTrade.init(); break;
            case 'onchain-analytics':   if (typeof OnChainAnalytics !== 'undefined' && OnChainAnalytics.init) OnChainAnalytics.init(); break;
            case 'order-book-heatmap':  if (typeof OrderBookHeatmap !== 'undefined' && OrderBookHeatmap.init) OrderBookHeatmap.init(); break;
            case 'arbitrage-scanner':   if (typeof ArbitrageScanner !== 'undefined' && ArbitrageScanner.init) ArbitrageScanner.init(); break;
            case 'liquidation-heatmap': if (typeof LiquidationHeatmap !== 'undefined' && LiquidationHeatmap.init) LiquidationHeatmap.init(); break;
            case 'market-scanner':      if (typeof MarketScanner !== 'undefined' && MarketScanner.init) MarketScanner.init(); break;
            case 'algo-strategies':     if (typeof AlgoStrategies !== 'undefined' && AlgoStrategies.init) AlgoStrategies.init(); break;
            case 'ai-trading':          if (typeof AITrading !== 'undefined' && AITrading.init) AITrading.init(); break;
            case 'dca-calculator':      if (typeof DCACalculator !== 'undefined' && DCACalculator.init) DCACalculator.init(); break;
            case 'news-signals':        if (typeof NewsSentimentSignals !== 'undefined' && NewsSentimentSignals.init) NewsSentimentSignals.init(); break;
            case 'futures-scanner':     if (typeof FuturesScanner !== 'undefined' && FuturesScanner.init) FuturesScanner.init(); break;
            case 'strategy-builder':    if (typeof StrategyBuilder !== 'undefined' && StrategyBuilder.init) StrategyBuilder.init(); break;
        }
    }
}

// ── CRYPTOCURRENCIES ─────────────────────────────────────────────────

async function loadCryptocurrencies() {
    const cryptos = await apiRequest('/api/cryptocurrencies');
    state.cryptocurrencies = cryptos;
    window._cryptoList = cryptos; // expose for paper trading
    populateCryptoSelector(cryptos);
    populateNewsFilter(cryptos);
    populatePaperTradingSelector(cryptos);
    populateAlertSelector(cryptos);
    return cryptos;
}

function populatePaperTradingSelector(cryptos) {
    const sel = document.getElementById('ptSymbol');
    if (!sel) return;
    sel.innerHTML = cryptos.map(c =>
        `<option value="${c.symbol}">${c.name} (${c.symbol})</option>`
    ).join('');
}

function populateAlertSelector(cryptos) {
    const sel = document.getElementById('alertSymbol');
    if (!sel) return;
    sel.innerHTML = cryptos.map(c =>
        `<option value="${c.symbol}">${c.name} (${c.symbol})</option>`
    ).join('');
}

// ── DASHBOARD ────────────────────────────────────────────────────────

async function loadDashboard() {
    const container = document.getElementById('marketOverview');
    showLoading(container);

    try {
        const prices = await apiRequest('/api/crypto/prices');

        // Cache prices for alerts
        prices.forEach(p => { state.cryptoPriceCache[p.symbol] = p.price; });

        // Update summary tiles
        updateSummaryTiles(prices);

        // Mini market grid (top 12)
        container.innerHTML = prices.slice(0, 12).map(crypto => createMarketCard(crypto)).join('');

        // Sidebar list
        updateSidebarCryptoList(prices);
        updateTopMovers(prices);
        updateTickerTape(prices);

        // Cache latest prices for signal engine
        window._latestPrices = {};
        prices.forEach(p => { window._latestPrices[p.symbol] = p.price; });

    } catch (error) {
        showError(container, 'Failed to load market data. Retrying...');
    }
}

function updateSummaryTiles(prices) {
    const btc = prices.find(p => p.symbol === 'BTC');
    const eth = prices.find(p => p.symbol === 'ETH');

    if (btc) {
        setEl('btcPrice', formatCurrency(btc.price));
        setEl('btcChange', formatPercentage(btc.change24h), btc.change24h >= 0 ? 'positive' : 'negative');
    }
    if (eth) {
        setEl('ethPrice', formatCurrency(eth.price));
        setEl('ethChange', formatPercentage(eth.change24h), eth.change24h >= 0 ? 'positive' : 'negative');
    }
}

function setEl(id, text, extraClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (extraClass) {
        el.className = el.className.replace(/(positive|negative)/g, '') + ' ' + extraClass;
    }
}

function createMarketCard(crypto) {
    const cls = getChangeClass(crypto.change24h);
    return `
    <div class="market-card" data-symbol="${crypto.symbol}" onclick="selectCryptoForAnalysis('${crypto.symbol}')">
        <div class="market-card-header">
            <div>
                <div class="market-card-name">${escapeHtml(crypto.name)}</div>
                <div class="market-card-symbol">${escapeHtml(crypto.symbol)}</div>
            </div>
            <div class="market-card-change ${cls}">${formatPercentage(crypto.change24h)}</div>
        </div>
        <div class="market-card-price">${formatCurrency(crypto.price)}</div>
        <div class="market-card-stats">
            <div class="stat"><div class="stat-label">Mkt Cap</div><div class="stat-value">${formatLargeNumber(crypto.marketCap)}</div></div>
            <div class="stat"><div class="stat-label">24h Vol</div><div class="stat-value">${formatLargeNumber(crypto.volume24h)}</div></div>
        </div>
    </div>`;
}

function updateSidebarCryptoList(prices) {
    const container = document.getElementById('cryptoList');
    if (!container) return;
    container.innerHTML = prices.slice(0, 10).map(crypto => {
        const cls = getChangeClass(crypto.change24h);
        return `
        <div class="crypto-item" data-symbol="${crypto.symbol}" onclick="selectCryptoForAnalysis('${crypto.symbol}')">
            <div class="crypto-item-row">
                <span class="crypto-name">${escapeHtml(crypto.name)}</span>
                <span class="crypto-price">${formatCurrency(crypto.price)}</span>
            </div>
            <div class="crypto-item-row">
                <span class="crypto-symbol">${escapeHtml(crypto.symbol)}</span>
                <span class="crypto-change ${cls}">${formatPercentage(crypto.change24h)}</span>
            </div>
        </div>`;
    }).join('');
}

function updateTopMovers(prices) {
    const container = document.getElementById('topMovers');
    if (!container) return;

    const sorted = [...prices].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 5);
    container.innerHTML = sorted.map(p => {
        const cls = getChangeClass(p.change24h);
        return `
        <div class="mover-item">
            <span class="mover-symbol">${escapeHtml(p.symbol)}</span>
            <span class="mover-price">${formatCurrency(p.price)}</span>
            <span class="mover-change ${cls}">${formatPercentage(p.change24h)}</span>
        </div>`;
    }).join('');
}

function updateTickerTape(prices) {
    const tape = document.getElementById('tickerTape');
    if (!tape) return;

    const items = prices.slice(0, 10).map(p => {
        const dir = p.change24h >= 0 ? '▲' : '▼';
        const cls = p.change24h >= 0 ? 'tick-up' : 'tick-down';
        return `<span class="tick-item"><span class="tick-sym">${p.symbol}</span> <span class="tick-price">${formatCurrency(p.price)}</span> <span class="${cls}">${dir} ${Math.abs(p.change24h).toFixed(2)}%</span></span>`;
    }).join('');

    // Duplicate for seamless loop
    tape.innerHTML = items + items;
}

// ── HEATMAP ──────────────────────────────────────────────────────────

async function loadHeatmap() {
    const container = document.getElementById('heatmapGrid');
    if (!container) return;

    showLoading(container);
    try {
        const prices = await apiRequest('/api/crypto/prices');
        renderHeatmap(prices, container);
    } catch (e) {
        showError(container, 'Failed to load heatmap.');
    }
}

function renderHeatmap(prices, container) {
    container.innerHTML = prices.map(p => {
        const change = p.change24h;
        let bg;
        if      (change <= -5)  bg = '#c0392b';
        else if (change <= -2)  bg = '#e74c3c';
        else if (change <= -0.5)bg = '#e67e22';
        else if (change <   0.5)bg = '#555';
        else if (change <   2)  bg = '#27ae60';
        else if (change <   5)  bg = '#2ecc71';
        else                    bg = '#1abc9c';

        // Size based on market cap log scale
        const mc = Math.max(p.marketCap || 1, 1);
        const logSize = Math.log10(mc);
        const size = Math.max(80, Math.min(200, (logSize - 8) * 35));

        return `
        <div class="hm-cell" style="width:${size}px; height:${size * 0.6}px; background:${bg}"
             onclick="selectCryptoForAnalysis('${p.symbol}')" title="${p.name}: ${formatPercentage(p.change24h)}">
            <div class="hm-sym">${escapeHtml(p.symbol)}</div>
            <div class="hm-chg">${formatPercentage(p.change24h)}</div>
        </div>`;
    }).join('');
}

// ── CRYPTO TABLE ─────────────────────────────────────────────────────

async function loadCryptoTable() {
    const container = document.getElementById('cryptoFullTable');
    if (!container) return;

    showLoading(container);
    try {
        const prices = await apiRequest('/api/crypto/prices');
        renderCryptoTable(prices, container);
    } catch (e) {
        showError(container, 'Failed to load cryptocurrency data.');
    }
}

function renderCryptoTable(prices, container) {
    const rows = prices.map((p, i) => {
        const cls = getChangeClass(p.change24h);
        return `
        <tr onclick="selectCryptoForAnalysis('${p.symbol}')" style="cursor:pointer;">
            <td class="rank">${i + 1}</td>
            <td><strong>${escapeHtml(p.name)}</strong> <span class="dim">${escapeHtml(p.symbol)}</span></td>
            <td>${formatCurrency(p.price)}</td>
            <td class="${cls}">${formatPercentage(p.change24h)}</td>
            <td>${formatLargeNumber(p.marketCap)}</td>
            <td>${formatLargeNumber(p.volume24h)}</td>
            <td><button class="btn-mini" onclick="event.stopPropagation(); selectCryptoForAnalysis('${p.symbol}')">Analyse →</button></td>
        </tr>`;
    }).join('');

    container.innerHTML = `
    <table class="full-table">
        <thead>
            <tr><th>#</th><th>Asset</th><th>Price</th><th>24h %</th><th>Market Cap</th><th>24h Volume</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;

    // Search filter
    const searchEl = document.getElementById('cryptoSearchInput');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = prices.filter(p =>
                p.name.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q));
            renderCryptoTable(filtered, container);
        });
    }
}

// ── FEAR & GREED ─────────────────────────────────────────────────────

async function loadFearGreed() {
    try {
        const data = await apiRequest('/api/sentiment/fear-greed');
        updateFearGreedWidget(data);
    } catch (e) {
        console.log('Fear & Greed unavailable');
    }
}

function updateFearGreedWidget(data) {
    const valEl   = document.getElementById('fearGreedValue');
    const labelEl = document.getElementById('fearGreedLabel');
    const needle  = document.getElementById('gaugeNeedle');

    if (valEl)   valEl.textContent = data.value;
    if (labelEl) labelEl.textContent = data.label || data.classification;

    if (needle && data.value != null) {
        // Map 0–100 to -90° to +90°
        const deg = ((data.value / 100) * 180) - 90;
        needle.setAttribute('transform', `rotate(${deg}, 100, 100)`);
    }

    if (valEl) {
        const v = data.value;
        if (v <= 25)      valEl.style.color = '#e74c3c';
        else if (v <= 45) valEl.style.color = '#e67e22';
        else if (v <= 55) valEl.style.color = '#f1c40f';
        else if (v <= 75) valEl.style.color = '#2ecc71';
        else              valEl.style.color = '#1abc9c';
    }
}

// ── FOREX ────────────────────────────────────────────────────────────

async function loadForexPKRSummary() {
    try {
        const data = await apiRequest('/api/forex/pkr');
        const usd = data.find(r => r.code === 'USD');
        if (usd && usd.pkrRate) {
            setEl('usdpkrRate', `₨ ${usd.pkrRate.toLocaleString()}`);
            setEl('usdpkrChange', 'Forex');
            // Update dashboard MAC
            const dashUSD = document.getElementById('dashUSDPKR');
            if (dashUSD) dashUSD.textContent = `₨${usd.pkrRate.toLocaleString()}`;
        }
    } catch (e) { /* silent */ }

    // Also load KSE-100 for dashboard tile
    try {
        const psxData = await apiRequest('/api/psx/indices');
        const indices = Array.isArray(psxData) ? psxData : (psxData.data || []);
        const kse = indices.find(i => (i.name||'').includes('KSE-100'));
        if (kse) {
            const el100 = document.getElementById('kse100Value');
            const elChg = document.getElementById('kse100Change');
            const dashKSE = document.getElementById('dashKSE');
            if (el100) el100.textContent = kse.current?.toLocaleString() || '--';
            if (elChg) {
                const chg = kse.changePercent;
                if (chg != null) {
                    elChg.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
                    elChg.className = 'tile-change ' + (chg >= 0 ? 'positive' : 'negative');
                }
            }
            if (dashKSE) dashKSE.textContent = kse.current?.toLocaleString() || '--';
        }
    } catch (e) { /* silent */ }
}

async function loadForexSection() {
    const container = document.getElementById('forexGrid');
    if (!container) return;

    showLoading(container);
    try {
        const pairs = await apiRequest('/api/forex/pairs');
        container.innerHTML = pairs.map(p => `
        <div class="forex-card">
            <div class="forex-pair-header">
                <span class="forex-flag">${p.flag || '🌐'}</span>
                <div>
                    <div class="forex-symbol">${escapeHtml(p.symbol)}</div>
                    <div class="forex-label">${escapeHtml(p.label)}</div>
                </div>
            </div>
            <div class="forex-rate">
                ${p.rate != null ? p.rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4}) : 'N/A'}
            </div>
            <div class="forex-source">via ${escapeHtml(p.source || 'open.er-api.com')}</div>
        </div>`).join('');
    } catch (e) {
        showError(container, 'Failed to load forex data.');
    }
}

async function loadPKRRates() {
    const container = document.getElementById('pkrRatesGrid');
    if (!container) return;

    showLoading(container);
    try {
        const rates = await apiRequest('/api/forex/pkr');
        container.innerHTML = rates.map(r => `
        <div class="pkr-rate-card">
            <span class="pkr-flag">${r.flag}</span>
            <div class="pkr-info">
                <div class="pkr-code">${r.code}</div>
                <div class="pkr-name">${r.name}</div>
            </div>
            <div class="pkr-val">${r.pkrRate != null ? '₨ ' + r.pkrRate.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : 'N/A'}</div>
        </div>`).join('');
    } catch (e) {
        showError(container, 'Failed to load PKR rates.');
    }
}

// ── CURRENCY CONVERTER ───────────────────────────────────────────────

async function convertCurrency() {
    const amount = parseFloat(document.getElementById('convAmount').value);
    const from   = document.getElementById('convFrom').value;
    const to     = document.getElementById('convTo').value;
    const result = document.getElementById('convResult');

    if (isNaN(amount) || amount <= 0) {
        result.innerHTML = '<span class="conv-error">Please enter a valid amount.</span>';
        return;
    }

    result.innerHTML = '<span class="conv-loading">Converting...</span>';

    try {
        const data = await apiRequest(`/api/forex/convert?amount=${amount}&from=${from}&to=${to}`);
        result.innerHTML = `
        <div class="conv-output">
            <span class="conv-big">${amount.toLocaleString()} ${from}</span>
            <span class="conv-equals">=</span>
            <span class="conv-big highlight">${data.result.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:6})} ${to}</span>
            <div class="conv-rate">Rate: 1 ${from} = ${data.rate} ${to} · ${data.lastUpdate}</div>
        </div>`;
    } catch (e) {
        result.innerHTML = '<span class="conv-error">Conversion failed. Try again.</span>';
    }
}

function swapConverter() {
    const fromSel = document.getElementById('convFrom');
    const toSel   = document.getElementById('convTo');
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value   = tmp;
}

// ── PSX ──────────────────────────────────────────────────────────────

async function loadPSXSection() {
    loadPSXIndices();
    loadPSXSectors();
}

async function loadPSXIndices() {
    try {
        const data = await apiRequest('/api/psx/indices');
        const indices = Array.isArray(data) ? data : [];

        const idMap = { 'KSE-100': 'psxKSE100', 'KSE-30': 'psxKSE30', 'KMI-30': 'psxKMI30', 'All Share': 'psxAllShare' };
        indices.forEach(idx => {
            const elId = idMap[idx.name] || Object.keys(idMap).find(k => (idx.name||'').includes(k)) && idMap[Object.keys(idMap).find(k => (idx.name||'').includes(k))];
            if (!elId) return;
            const el = document.getElementById(elId);
            if (!el) return;
            const val = typeof idx.current === 'number' ? idx.current.toLocaleString() : (idx.current || '—');
            const chg = idx.changePercent;
            const chgClass = chg >= 0 ? 'positive' : 'negative';
            const chgStr = chg != null ? ` <span class="${chgClass} psx-idx-chg">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>` : '';
            el.innerHTML = `${val}${chgStr}`;
        });
        if (data.fallback) {
            const note = document.getElementById('psxFallbackNote');
            if (note) note.style.display = 'flex';
        }
    } catch (e) {
        ['psxKSE100','psxKSE30','psxKMI30'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<span class="dim">—</span>`;
        });
    }
}

async function loadPSXSectors() {
    const container = document.getElementById('psxSectors');
    if (!container) return;

    try {
        const sectors = await apiRequest('/api/psx/sectors');
        container.innerHTML = sectors.map(s => `
        <div class="sector-card">
            <div class="sector-icon-big">${s.icon}</div>
            <div class="sector-name">${escapeHtml(s.name)}</div>
            <div class="sector-desc">${escapeHtml(s.description)}</div>
        </div>`).join('');
    } catch (e) {
        container.innerHTML = '<span class="dim">Sector data unavailable</span>';
    }
}

// ── TECHNICAL ANALYSIS ───────────────────────────────────────────────

function setupCryptoSelector() {
    const selector = document.getElementById('cryptoSelector');
    if (!selector) return;
    selector.addEventListener('change', (e) => {
        if (e.target.value) {
            displayAnalysis(e.target.value);
            loadTradingViewChart(e.target.value);  // sync chart with selector
        }
    });
}

function populateCryptoSelector(cryptos) {
    const selector = document.getElementById('cryptoSelector');
    if (!selector) return;
    selector.innerHTML = '<option value="">Select asset...</option>' +
        cryptos.map(c => `<option value="${c.symbol}">${c.name} (${c.symbol})</option>`).join('');
}

function selectCryptoForAnalysis(symbol) {
    switchSection('markets');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.querySelector('[data-section="markets"]');
    if (navEl) navEl.classList.add('active');

    const selector = document.getElementById('cryptoSelector');
    if (selector) selector.value = symbol;

    displayAnalysis(symbol);
    loadTradingViewChart(symbol);
}

// ── TRADINGVIEW CHART ─────────────────────────────────────────────────

const TV_INTERVAL_MAP = {
    '1D': 'D', '1W': 'W', '1M': 'M', '3M': '3M', '1Y': '12M', 'ALL': 'ALL'
};
let currentTVSymbol = null;
let currentTVInterval = '1D';

function loadTradingViewChart(symbol, interval = '1D') {
    const wrap = document.getElementById('tvChartWrap');
    const container = document.getElementById('tvWidgetContainer');
    const title = document.getElementById('tvChartTitle');

    if (!wrap || !container) return;

    currentTVSymbol = symbol;
    currentTVInterval = interval;

    wrap.style.display = 'block';
    if (title) title.textContent = `${symbol} — Interactive Chart`;

    // Clear previous widget
    container.innerHTML = '';

    // Map crypto symbol to TradingView format
    const tvSymbol = getTVSymbol(symbol);

    // Build TradingView Advanced Chart widget
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const tvBg = currentTheme === 'light' ? 'rgba(255,255,255,1)' : 'rgba(10,14,39,1)';

    script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: tvSymbol,
        interval: TV_INTERVAL_MAP[interval] || 'D',
        timezone: 'Asia/Karachi',
        theme: currentTheme,
        style: '1',
        locale: 'en',
        enable_publishing: false,
        allow_symbol_change: true,
        hide_side_toolbar: false,
        withdateranges: true,
        details: true,
        hotlist: true,
        calendar: false,
        support_host: 'https://www.tradingview.com',
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        backgroundColor: tvBg,
        gridColor: 'rgba(102, 126, 234, 0.08)',
        studies: [
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
            'BB@tv-basicstudies',
            'Volume@tv-basicstudies'
        ],
        show_popup_button: true,
        popup_width: '1200',
        popup_height: '800',
        container_id: 'tvWidgetContainer'
    });

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '620px';
    widgetDiv.style.width = '100%';

    const outer = document.createElement('div');
    outer.className = 'tradingview-widget-container';
    outer.style.height = '620px';
    outer.style.width = '100%';
    outer.appendChild(widgetDiv);
    outer.appendChild(script);

    container.appendChild(outer);

    // Update timeframe button states
    document.querySelectorAll('.tv-tf-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === interval);
        btn.onclick = () => loadTradingViewChart(currentTVSymbol, btn.dataset.tf);
    });
}

function getTVSymbol(symbol) {
    // Map our symbols to TradingView's exchange:symbol format
    const map = {
        'BTC':  'BINANCE:BTCUSDT',
        'ETH':  'BINANCE:ETHUSDT',
        'BNB':  'BINANCE:BNBUSDT',
        'XRP':  'BINANCE:XRPUSDT',
        'ADA':  'BINANCE:ADAUSDT',
        'SOL':  'BINANCE:SOLUSDT',
        'DOGE': 'BINANCE:DOGEUSDT',
        'DOT':  'BINANCE:DOTUSDT',
        'MATIC':'BINANCE:MATICUSDT',
        'LTC':  'BINANCE:LTCUSDT',
        'AVAX': 'BINANCE:AVAXUSDT',
        'LINK': 'BINANCE:LINKUSDT',
        'UNI':  'BINANCE:UNIUSDT',
        'XLM':  'BINANCE:XLMUSDT',
        'XMR':  'BINANCE:XMRUSDT',
        'ETC':  'BINANCE:ETCUSDT',
        'ATOM': 'BINANCE:ATOMUSDT',
        'ALGO': 'BINANCE:ALGOUSDT',
        'VET':  'BINANCE:VETUSDT',
        'FIL':  'BINANCE:FILUSDT',
        'TRX':  'BINANCE:TRXUSDT',
        'SHIB': 'BINANCE:SHIBUSDT',
        'TON':  'BINANCE:TONUSDT',
        'NEAR': 'BINANCE:NEARUSDT',
    };
    return map[symbol] || `BINANCE:${symbol}USDT`;
}

// ── FUTURES ──────────────────────────────────────────────────────────

function setupFuturesSelector() {
    const sel = document.getElementById('futuresSelector');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a cryptocurrency...</option>' +
        (state.cryptocurrencies.length
            ? state.cryptocurrencies.map(c => `<option value="${c.symbol}">${c.name} (${c.symbol})</option>`).join('')
            : '');

    sel.addEventListener('change', (e) => {
        if (e.target.value) displayFuturesData(e.target.value);
    });
}

// ── NEWS ─────────────────────────────────────────────────────────────

function setupNewsFilter() {
    const sel = document.getElementById('newsSymbolFilter');
    if (!sel) return;
    sel.addEventListener('change', () => loadNews());
}

function populateNewsFilter(cryptos) {
    const sel = document.getElementById('newsSymbolFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="">All assets</option>' +
        cryptos.map(c => `<option value="${c.symbol}">${c.name}</option>`).join('');
}

function setupNewsTabFilter() {
    document.querySelectorAll('.news-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadNews(tab.dataset.filter);
        });
    });
}

async function loadNews(category = 'all') {
    const container = document.getElementById('newsContent');
    if (!container) return;

    showLoading(container);
    try {
        const symbolFilter = document.getElementById('newsSymbolFilter')?.value || '';
        const params = new URLSearchParams();
        if (symbolFilter) params.append('symbol', symbolFilter);
        if (category && category !== 'all') params.append('category', category);

        const news = await apiRequest('/api/news?' + params.toString());

        if (!news || news.length === 0) {
            container.innerHTML = `<div class="empty-state">No news available right now. Check back shortly.</div>`;
            return;
        }

        container.innerHTML = news.slice(0, 30).map(item => createNewsCard(item)).join('');
    } catch (e) {
        showError(container, 'Failed to load news.');
    }
}

// ── ACADEMY TRACKS ───────────────────────────────────────────────────

function setupAcademyTracks() {
    document.querySelectorAll('.track-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.academy-track').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const track = document.getElementById(`track-${btn.dataset.track}`);
            if (track) track.classList.add('active');
        });
    });
}

// ── PRICE ALERTS ─────────────────────────────────────────────────────

function setupAlertSelector() {
    const sel = document.getElementById('alertSymbol');
    if (!sel) return;
    if (state.cryptocurrencies.length) {
        sel.innerHTML = state.cryptocurrencies
            .map(c => `<option value="${c.symbol}">${c.name} (${c.symbol})</option>`).join('');
    }
}

const ALERTS_KEY = 'traderpro_alerts';

function loadAlertsFromStorage() {
    try {
        const raw = localStorage.getItem(ALERTS_KEY);
        state.priceAlerts = raw ? JSON.parse(raw) : [];
    } catch (e) {
        state.priceAlerts = [];
    }
    renderAlerts();
}

function saveAlerts() {
    try {
        localStorage.setItem(ALERTS_KEY, JSON.stringify(state.priceAlerts));
    } catch (e) {}
}

function addAlert() {
    const symbol    = document.getElementById('alertSymbol')?.value;
    const condition = document.getElementById('alertCondition')?.value;
    const price     = parseFloat(document.getElementById('alertPrice')?.value);

    if (!symbol || !condition || isNaN(price) || price <= 0) {
        alert('Please fill in all alert fields.');
        return;
    }

    state.priceAlerts.push({
        id: Date.now(),
        symbol,
        condition,
        targetPrice: price,
        triggered: false
    });

    saveAlerts();
    renderAlerts();
    document.getElementById('alertPrice').value = '';

    // Request browser notification permission
    if (Notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function removeAlert(id) {
    state.priceAlerts = state.priceAlerts.filter(a => a.id !== id);
    saveAlerts();
    renderAlerts();
}

function renderAlerts() {
    const container = document.getElementById('alertsList');
    if (!container) return;

    if (state.priceAlerts.length === 0) {
        container.innerHTML = '<div class="empty-state">No alerts set. Add one above to get notified.</div>';
        return;
    }

    container.innerHTML = state.priceAlerts.map(a => {
        const currentPrice = state.cryptoPriceCache[a.symbol];
        const statusClass  = a.triggered ? 'alert-triggered' : 'alert-active';
        const statusText   = a.triggered ? '✅ Triggered' : '⏳ Watching';

        return `
        <div class="alert-item ${statusClass}">
            <div class="alert-info">
                <strong>${escapeHtml(a.symbol)}</strong>
                <span>${a.condition === 'above' ? 'rises above' : 'drops below'}</span>
                <strong>${formatCurrency(a.targetPrice)}</strong>
                ${currentPrice ? `<span class="dim">· Current: ${formatCurrency(currentPrice)}</span>` : ''}
            </div>
            <div class="alert-status">${statusText}</div>
            <button class="btn-icon-remove" onclick="removeAlert(${a.id})">✕</button>
        </div>`;
    }).join('');
}

function checkAlerts(prices) {
    if (!state.priceAlerts.length) return;

    prices.forEach(p => { state.cryptoPriceCache[p.symbol] = p.price; });

    state.priceAlerts.forEach(alert => {
        if (alert.triggered) return;

        const current = state.cryptoPriceCache[alert.symbol];
        if (!current) return;

        const triggered =
            (alert.condition === 'above' && current >= alert.targetPrice) ||
            (alert.condition === 'below' && current <= alert.targetPrice);

        if (triggered) {
            alert.triggered = true;
            saveAlerts();
            renderAlerts();

            // Browser notification
            if (Notification && Notification.permission === 'granted') {
                new Notification('TraderPro Price Alert 🔔', {
                    body: `${alert.symbol} is ${alert.condition === 'above' ? 'above' : 'below'} ${formatCurrency(alert.targetPrice)}! Current: ${formatCurrency(current)}`,
                    icon: '/favicon.ico'
                });
            }
        }
    });
}

// ── RISK CALCULATOR ──────────────────────────────────────────────────

function calculatePosition() {
    const capital  = parseFloat(document.getElementById('calcCapital')?.value);
    const riskPct  = parseFloat(document.getElementById('calcRiskPct')?.value);
    const entry    = parseFloat(document.getElementById('calcEntry')?.value);
    const stopLoss = parseFloat(document.getElementById('calcStopLoss')?.value);
    const result   = document.getElementById('calcResult');

    if (!result) return;

    if (isNaN(capital) || isNaN(riskPct) || isNaN(entry) || isNaN(stopLoss)) {
        result.innerHTML = '<span class="calc-error">Please fill in all fields.</span>';
        return;
    }
    if (entry <= 0 || stopLoss <= 0 || entry === stopLoss) {
        result.innerHTML = '<span class="calc-error">Entry and stop loss must be different valid prices.</span>';
        return;
    }

    const riskAmount    = capital * (riskPct / 100);
    const riskPerShare  = Math.abs(entry - stopLoss);
    const positionSize  = riskAmount / riskPerShare;
    const positionValue = positionSize * entry;
    const direction     = stopLoss < entry ? 'Long (Buy)' : 'Short (Sell)';

    result.innerHTML = `
    <div class="calc-output">
        <div class="calc-row"><span>Direction</span><strong>${direction}</strong></div>
        <div class="calc-row"><span>Max Risk Amount</span><strong class="negative">${capital.toLocaleString()} × ${riskPct}% = ${riskAmount.toLocaleString(undefined, {maximumFractionDigits:2})}</strong></div>
        <div class="calc-row"><span>Risk Per Unit</span><strong>${riskPerShare.toLocaleString(undefined, {maximumFractionDigits:6})}</strong></div>
        <div class="calc-row highlight"><span>Position Size (Units)</span><strong>${positionSize.toLocaleString(undefined, {maximumFractionDigits:4})}</strong></div>
        <div class="calc-row"><span>Position Value</span><strong>${positionValue.toLocaleString(undefined, {maximumFractionDigits:2})}</strong></div>
    </div>`;
}

function calculateRR() {
    const entry  = parseFloat(document.getElementById('rrEntry')?.value);
    const stop   = parseFloat(document.getElementById('rrStop')?.value);
    const target = parseFloat(document.getElementById('rrTarget')?.value);
    const result = document.getElementById('rrResult');

    if (!result) return;

    if (isNaN(entry) || isNaN(stop) || isNaN(target)) {
        result.innerHTML = '<span class="calc-error">Please fill in all three prices.</span>';
        return;
    }

    const risk   = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    const ratio  = reward / risk;
    const minWin = (1 / (1 + ratio)) * 100;

    const cls = ratio >= 2 ? 'positive' : ratio >= 1 ? 'neutral-text' : 'negative';

    result.innerHTML = `
    <div class="calc-output">
        <div class="calc-row"><span>Risk (per unit)</span><strong class="negative">${risk.toLocaleString(undefined, {maximumFractionDigits:6})}</strong></div>
        <div class="calc-row"><span>Reward (per unit)</span><strong class="positive">${reward.toLocaleString(undefined, {maximumFractionDigits:6})}</strong></div>
        <div class="calc-row highlight"><span>Risk:Reward Ratio</span><strong class="${cls}">1 : ${ratio.toFixed(2)}</strong></div>
        <div class="calc-row"><span>Break-even Win Rate</span><strong>${minWin.toFixed(1)}%</strong></div>
        <div class="calc-note">${ratio >= 2 ? '✅ Good R:R — professional standard is 1:2 or better.' : ratio >= 1 ? '⚠️ Marginal R:R — consider moving your target further.' : '❌ Poor R:R — not recommended. Move your stop or target.'}</div>
    </div>`;
}

// ── AUTO UPDATE ──────────────────────────────────────────────────────

function startAutoUpdate() {
    state.updateInterval = setInterval(async () => {
        if (state.currentSection === 'dashboard') {
            const prices = await apiRequest('/api/crypto/prices').catch(() => null);
            if (prices) {
                updateSummaryTiles(prices);
                updateTickerTape(prices);
                updateTopMovers(prices);
                updateSidebarCryptoList(prices);
                checkAlerts(prices);
            }
        }
        if (state.currentSection === 'heatmap') loadHeatmap();
        updateLastUpdateTime();
    }, 30000);

    // Fear & Greed every 10 minutes
    setInterval(loadFearGreed, 600000);
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

// ── THEME TOGGLE ─────────────────────────────────────────────────────

function applyStoredTheme() {
    const stored = localStorage.getItem('traderpro_theme') || 'dark';
    applyTheme(stored);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('traderpro_theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    // Reload TradingView chart with correct theme if visible
    if (currentTVSymbol) {
        setTimeout(() => loadTradingViewChart(currentTVSymbol, currentTVInterval), 300);
    }
}

// ── CLEANUP ──────────────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
    if (state.updateInterval) clearInterval(state.updateInterval);
});

// ── BOOT ─────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ── UNIVERSAL SEARCH (Ctrl+K) ─────────────────────────────────────────
// Single overlay search across: crypto coins, PSX stocks,
// glossary terms, academy lessons, forex pairs, sections.

let usQuery = '';
let usResults = [];
let usSelectedIdx = -1;

const US_SECTIONS = [
    { id: 'dashboard',    label: 'Dashboard',        icon: '📊', type: 'section', keywords: 'home overview market' },
    { id: 'heatmap',      label: 'Market Heatmap',   icon: '🔥', type: 'section', keywords: 'heatmap heat map' },
    { id: 'crypto',       label: 'Crypto Prices',    icon: '₿',  type: 'section', keywords: 'cryptocurrency bitcoin prices' },
    { id: 'screener',     label: 'Crypto Screener',  icon: '🔍', type: 'section', keywords: 'screener scan filter rsi' },
    { id: 'psx',          label: 'PSX Stocks',       icon: '🇵🇰', type: 'section', keywords: 'pakistan stock exchange kse100' },
    { id: 'forex',        label: 'Forex / PKR',      icon: '💱', type: 'section', keywords: 'forex currency exchange rates' },
    { id: 'markets',      label: 'Technical Analysis',icon: '📈', type: 'section', keywords: 'technical analysis RSI MACD indicators' },
    { id: 'futures',      label: 'Futures',          icon: '📉', type: 'section', keywords: 'futures funding rate open interest' },
    { id: 'watchlist',    label: 'Watchlist',        icon: '⭐', type: 'section', keywords: 'watchlist watched favorites' },
    { id: 'portfolio',    label: 'Portfolio',        icon: '💼', type: 'section', keywords: 'portfolio holdings tracker' },
    { id: 'papertrading', label: 'Paper Trading',    icon: '📝', type: 'section', keywords: 'paper trading simulator virtual' },
    { id: 'journal',      label: 'Trade Journal',    icon: '📓', type: 'section', keywords: 'journal log trades diary' },
    { id: 'backtest',     label: 'Backtesting',      icon: '⏱️', type: 'section', keywords: 'backtest DCA strategy historical' },
    { id: 'converter',    label: 'Currency Converter',icon: '🔄', type: 'section', keywords: 'convert currency PKR USD' },
    { id: 'calculator',   label: 'Risk Calculator',  icon: '🧮', type: 'section', keywords: 'risk position size calculator' },
    { id: 'alerts',       label: 'Price Alerts',     icon: '🔔', type: 'section', keywords: 'alerts notifications price' },
    { id: 'calendar',     label: 'Economic Calendar',icon: '📅', type: 'section', keywords: 'calendar events FOMC SBP CPI' },
    { id: 'academy',      label: 'Trading Academy',  icon: '🎓', type: 'section', keywords: 'academy learn education basics' },
    { id: 'glossary',     label: 'Glossary',         icon: '📚', type: 'section', keywords: 'glossary terms dictionary definitions' },
    { id: 'news',         label: 'News',             icon: '📰', type: 'section', keywords: 'news market crypto psx' },
];

const US_FOREX = [
    { id: 'USDPKR', label: 'USD/PKR', icon: '💱', type: 'forex' },
    { id: 'EURUSD', label: 'EUR/USD', icon: '💱', type: 'forex' },
    { id: 'GBPUSD', label: 'GBP/USD', icon: '💱', type: 'forex' },
    { id: 'EURPKR', label: 'EUR/PKR', icon: '💱', type: 'forex' },
    { id: 'GBPPKR', label: 'GBP/PKR', icon: '💱', type: 'forex' },
    { id: 'JPYPKR', label: 'JPY/PKR', icon: '💱', type: 'forex' },
];

function initUniversalSearch() {
    // Create overlay HTML if not exists
    if (!document.getElementById('usOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'usOverlay';
        overlay.className = 'us-overlay';
        overlay.innerHTML = `
        <div class="us-modal" role="dialog" aria-label="Universal Search">
            <div class="us-search-row">
                <span class="us-icon">🔍</span>
                <input type="text" id="usInput" class="us-input"
                    placeholder="Search coins, stocks, glossary, sections… (Ctrl+K)"
                    autocomplete="off" spellcheck="false">
                <kbd class="us-esc" onclick="closeUniversalSearch()">ESC</kbd>
            </div>
            <div class="us-results" id="usResults"></div>
            <div class="us-footer">
                <span><kbd>↑↓</kbd> Navigate</span>
                <span><kbd>Enter</kbd> Select</span>
                <span><kbd>ESC</kbd> Close</span>
            </div>
        </div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) closeUniversalSearch(); });
        document.body.appendChild(overlay);
    }

    // Keyboard shortcut
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleUniversalSearch();
        }
        if (e.key === 'Escape') closeUniversalSearch();
    });

    const input = document.getElementById('usInput');
    if (input) {
        input.addEventListener('input', e => {
            usQuery = e.target.value;
            performUniversalSearch(usQuery);
        });
        input.addEventListener('keydown', handleUSKeyNav);
    }
}

function toggleUniversalSearch() {
    const overlay = document.getElementById('usOverlay');
    if (!overlay) return;
    if (overlay.classList.contains('visible')) {
        closeUniversalSearch();
    } else {
        openUniversalSearch();
    }
}

function openUniversalSearch() {
    const overlay = document.getElementById('usOverlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    const input = document.getElementById('usInput');
    if (input) {
        input.value = '';
        input.focus();
        usQuery = '';
        performUniversalSearch('');
    }
}

function closeUniversalSearch() {
    const overlay = document.getElementById('usOverlay');
    if (overlay) overlay.classList.remove('visible');
    usSelectedIdx = -1;
}

// ── SEARCH LOGIC ──────────────────────────────────────────────────────

function performUniversalSearch(query) {
    const q = query.toLowerCase().trim();
    usResults = [];
    usSelectedIdx = -1;

    if (!q) {
        // Show default: recent sections + quick actions
        usResults = [
            { icon: '⚡', label: 'Quick: Dashboard', sublabel: 'Go to market overview', type: 'section', id: 'dashboard' },
            { icon: '₿', label: 'Quick: Crypto Prices', sublabel: 'Live crypto prices', type: 'section', id: 'crypto' },
            { icon: '🇵🇰', label: 'Quick: PSX Stocks', sublabel: 'Pakistan Stock Exchange', type: 'section', id: 'psx' },
            { icon: '📓', label: 'Quick: Trade Journal', sublabel: 'Log your trades', type: 'section', id: 'journal' },
            { icon: '🔍', label: 'Quick: Crypto Screener', sublabel: 'Scan for RSI oversold / buy signals', type: 'section', id: 'screener' },
        ];
    } else {
        // Search sections
        const sectionMatches = US_SECTIONS.filter(s =>
            s.label.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q)
        ).slice(0, 4).map(s => ({ ...s, sublabel: 'Go to section' }));

        // Search crypto list
        const cryptoList = window._cryptoList || [];
        const cryptoMatches = cryptoList.filter(c =>
            c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
        ).slice(0, 6).map(c => ({
            id: c.id, label: c.name,
            sublabel: c.symbol + ' — View analysis',
            icon: '₿', type: 'crypto'
        }));

        // Search PSX stocks
        const psxList = window._psxList || [];
        const psxMatches = psxList.filter(s =>
            s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || (s.sector||'').toLowerCase().includes(q)
        ).slice(0, 4).map(s => ({
            id: s.symbol, label: s.name,
            sublabel: s.symbol + ' · ' + (s.sector || 'PSX'),
            icon: '🇵🇰', type: 'psx'
        }));

        // Search forex
        const forexMatches = US_FOREX.filter(f =>
            f.id.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
        ).slice(0, 3).map(f => ({ ...f, sublabel: 'View forex rate' }));

        // Search glossary
        const glossaryList = typeof GLOSSARY_TERMS !== 'undefined' ? GLOSSARY_TERMS : [];
        const glossaryMatches = glossaryList.filter(g =>
            g.term.toLowerCase().includes(q) || (g.definition||'').toLowerCase().includes(q)
        ).slice(0, 4).map(g => ({
            id: g.term, label: g.term,
            sublabel: (g.definition || '').slice(0, 80) + '…',
            icon: '📚', type: 'glossary'
        }));

        usResults = [...sectionMatches, ...cryptoMatches, ...psxMatches, ...forexMatches, ...glossaryMatches].slice(0, 16);
    }

    renderUSResults();
}

function renderUSResults() {
    const container = document.getElementById('usResults');
    if (!container) return;

    if (usResults.length === 0) {
        container.innerHTML = `<div class="us-no-results">No results for "${escapeHtml(usQuery)}"</div>`;
        return;
    }

    // Group by type
    const groups = {};
    usResults.forEach(r => {
        const g = r.type === 'section' ? 'Navigation' :
                  r.type === 'crypto' ? 'Crypto Coins' :
                  r.type === 'psx' ? 'PSX Stocks' :
                  r.type === 'forex' ? 'Forex Pairs' :
                  r.type === 'glossary' ? 'Glossary Terms' : 'Other';
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
    });

    let flatIdx = 0;
    let html = '';
    Object.entries(groups).forEach(([groupName, items]) => {
        html += `<div class="us-group-label">${groupName}</div>`;
        items.forEach(item => {
            const idx = flatIdx++;
            const isSelected = idx === usSelectedIdx;
            html += `<div class="us-result-item ${isSelected ? 'selected' : ''}"
                data-index="${idx}"
                onclick="selectUSResult(${idx})"
                onmouseenter="usSelectedIdx=${idx}; updateUSSelection()">
                <span class="us-result-icon">${item.icon}</span>
                <div class="us-result-text">
                    <div class="us-result-label">${highlightMatch(escapeHtml(item.label), usQuery)}</div>
                    <div class="us-result-sub">${escapeHtml(item.sublabel || '')}</div>
                </div>
                <span class="us-result-type">${item.type}</span>
            </div>`;
        });
    });

    container.innerHTML = html;
}

function highlightMatch(text, query) {
    if (!query) return text;
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark>$1</mark>');
}

function handleUSKeyNav(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        usSelectedIdx = Math.min(usSelectedIdx + 1, usResults.length - 1);
        updateUSSelection();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        usSelectedIdx = Math.max(usSelectedIdx - 1, 0);
        updateUSSelection();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (usSelectedIdx >= 0) selectUSResult(usSelectedIdx);
        else if (usResults.length > 0) selectUSResult(0);
    }
}

function updateUSSelection() {
    document.querySelectorAll('.us-result-item').forEach((el, i) => {
        el.classList.toggle('selected', i === usSelectedIdx);
        if (i === usSelectedIdx) el.scrollIntoView({ block: 'nearest' });
    });
}

function selectUSResult(idx) {
    const item = usResults[idx];
    if (!item) return;
    closeUniversalSearch();

    switch (item.type) {
        case 'section':
            if (typeof switchSection === 'function') switchSection(item.id);
            break;
        case 'crypto':
            if (typeof switchSection === 'function') switchSection('markets');
            setTimeout(() => {
                if (typeof loadAnalysis === 'function') loadAnalysis(item.id);
            }, 300);
            break;
        case 'psx':
            if (typeof switchSection === 'function') switchSection('psx');
            setTimeout(() => {
                const searchEl = document.getElementById('psxStockSearch');
                if (searchEl) { searchEl.value = item.id; searchEl.dispatchEvent(new Event('input')); }
            }, 300);
            break;
        case 'forex':
            if (typeof switchSection === 'function') switchSection('forex');
            break;
        case 'glossary':
            if (typeof switchSection === 'function') switchSection('glossary');
            setTimeout(() => {
                const searchEl = document.getElementById('glossarySearch');
                if (searchEl) {
                    searchEl.value = item.id;
                    searchEl.dispatchEvent(new Event('input'));
                }
            }, 300);
            break;
    }
}

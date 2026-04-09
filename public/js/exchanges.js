// ═══════════════════════════════════════════════════════════════════
//  exchanges.js — Exchange Explorer & Coin-to-Exchange Lookup
//  Covers: exchange list, live prices per exchange, where to buy coins,
//          use-case guide, and the exchange tab inside coin analysis.
// ═══════════════════════════════════════════════════════════════════

'use strict';

// ── State ────────────────────────────────────────────────────────────
let exState = {
    exchanges: [],          // full curated list
    activeTab: 'explorer',  // explorer | whereToBuy | priceCompare | useCases
    selectedExchange: null,
    coinQuery: '',
    coinResults: [],
    selectedCoin: null,     // { id, symbol, name } for where-to-buy
    coinExchanges: [],      // exchange list for selected coin
    useCases: [],
    loading: false
};

// ── Init ─────────────────────────────────────────────────────────────
async function initExchanges() {
    renderExchangeShell();
    switchExchangeTab('explorer');
    loadExchanges();
    loadUseCases();
}

function renderExchangeShell() {
    const sec = document.getElementById('exchanges');
    if (!sec) return;

    sec.innerHTML = `
    <div class="section-header">
      <h2>🏦 Exchange Explorer</h2>
      <p class="section-subtitle">Find the right exchange for every coin and use case</p>
    </div>

    <div class="ex-tabs">
      <button class="ex-tab active" data-tab="explorer"   onclick="switchExchangeTab('explorer')">🏦 All Exchanges</button>
      <button class="ex-tab"        data-tab="whereToBuy" onclick="switchExchangeTab('whereToBuy')">🔍 Where to Buy</button>
      <button class="ex-tab"        data-tab="priceCompare" onclick="switchExchangeTab('priceCompare')">📊 Price Compare</button>
      <button class="ex-tab"        data-tab="useCases"   onclick="switchExchangeTab('useCases')">🎯 Use Case Guide</button>
    </div>

    <div id="exTabContent">
      <div class="ex-loading">Loading exchanges…</div>
    </div>
    `;
}

function switchExchangeTab(tab) {
    exState.activeTab = tab;
    document.querySelectorAll('.ex-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });

    const content = document.getElementById('exTabContent');
    if (!content) return;

    switch (tab) {
        case 'explorer':    renderExplorerTab(content); break;
        case 'whereToBuy':  renderWhereToBuyTab(content); break;
        case 'priceCompare': renderPriceCompareTab(content); break;
        case 'useCases':    renderUseCasesTab(content); break;
    }
}

// ── Load Data ─────────────────────────────────────────────────────────
async function loadExchanges() {
    try {
        const res = await fetch('/api/exchanges');
        const json = await res.json();
        if (json.success) {
            exState.exchanges = json.data;
            if (exState.activeTab === 'explorer') {
                const c = document.getElementById('exTabContent');
                if (c) renderExplorerTab(c);
            }
        }
    } catch (e) {
        console.error('Failed to load exchanges:', e);
    }
}

async function loadUseCases() {
    try {
        const res = await fetch('/api/exchanges/guide/use-cases');
        const json = await res.json();
        if (json.success) {
            exState.useCases = json.data;
            if (exState.activeTab === 'useCases') {
                const c = document.getElementById('exTabContent');
                if (c) renderUseCasesTab(c);
            }
        }
    } catch (e) {
        console.error('Failed to load use cases:', e);
    }
}

// ── Explorer Tab ──────────────────────────────────────────────────────
function renderExplorerTab(container) {
    if (!exState.exchanges.length) {
        container.innerHTML = '<div class="ex-loading">Loading exchanges…</div>';
        return;
    }

    let filters = `
    <div class="ex-filter-bar">
      <input id="exSearchInput" class="ex-search" type="text" placeholder="Search exchanges…" oninput="filterExchanges(this.value)">
      <label class="ex-filter-check"><input type="checkbox" id="exPKR" onchange="filterExchanges()"> 🇵🇰 Pakistan Friendly</label>
      <label class="ex-filter-check"><input type="checkbox" id="exBeginner" onchange="filterExchanges()"> 🟢 Beginner Friendly</label>
      <label class="ex-filter-check"><input type="checkbox" id="exNoKYC" onchange="filterExchanges()"> 🎭 No KYC</label>
    </div>`;

    container.innerHTML = filters + `<div id="exGrid" class="ex-grid"></div>`;
    renderExchangeCards(exState.exchanges);
}

function filterExchanges(searchVal) {
    const q = (searchVal || document.getElementById('exSearchInput')?.value || '').toLowerCase();
    const pkr = document.getElementById('exPKR')?.checked;
    const beg = document.getElementById('exBeginner')?.checked;
    const nokyc = document.getElementById('exNoKYC')?.checked;

    let list = exState.exchanges;
    if (q) list = list.filter(e => e.name.toLowerCase().includes(q) || (e.country||'').toLowerCase().includes(q));
    if (pkr) list = list.filter(e => e.pakistanFriendly);
    if (beg) list = list.filter(e => e.beginnerFriendly);
    if (nokyc) list = list.filter(e => !e.requiresKYC);
    renderExchangeCards(list);
}

function renderExchangeCards(list) {
    const grid = document.getElementById('exGrid');
    if (!grid) return;
    if (!list.length) {
        grid.innerHTML = '<p class="ex-empty">No exchanges match your filters.</p>';
        return;
    }

    grid.innerHTML = list.map(ex => {
        const trust = ex.trustScore || ex.trust_score || 0;
        const trustStars = '★'.repeat(Math.round(trust)) + '☆'.repeat(Math.max(0, 10 - Math.round(trust)));
        const badge = (type) => ex.features?.includes(type) ? `<span class="ex-feat-badge">${type}</span>` : '';

        return `
        <div class="ex-card" onclick="showExchangeDetail('${ex.id}')">
          <div class="ex-card-header">
            <div class="ex-card-name">${ex.name}</div>
            <div class="ex-trust" title="Trust Score: ${trust}/10">${trustStars.slice(0,10)}</div>
          </div>
          <div class="ex-card-meta">
            <span>🌍 ${ex.country || 'Global'}</span>
            <span>📅 Est. ${ex.yearEstablished || '—'}</span>
          </div>
          <div class="ex-card-fees">
            <span class="ex-fee-item">Maker <strong>${ex.makerFee !== undefined ? ex.makerFee+'%' : '—'}</strong></span>
            <span class="ex-fee-item">Taker <strong>${ex.takerFee !== undefined ? ex.takerFee+'%' : '—'}</strong></span>
          </div>
          <div class="ex-card-badges">
            ${ex.pakistanFriendly ? '<span class="ex-badge pkr">🇵🇰 PK</span>' : ''}
            ${ex.beginnerFriendly ? '<span class="ex-badge beginner">🟢 Beginner</span>' : ''}
            ${(ex.requiresKYC === false || ex.requiresKYC === 'Optional' || (typeof ex.requiresKYC === 'string' && ex.requiresKYC.toLowerCase().includes('optional'))) ? '<span class="ex-badge nokyc">🎭 No KYC</span>' : ''}
          </div>
          <div class="ex-features-row">
            ${(ex.features||[]).slice(0,4).map(f => `<span class="ex-feat-badge">${f}</span>`).join('')}
          </div>
        </div>`;
    }).join('');
}

function showExchangeDetail(id) {
    const ex = exState.exchanges.find(e => e.id === id);
    if (!ex) return;
    exState.selectedExchange = ex;

    const trust = ex.trustScore || ex.trust_score || 0;
    const overlay = document.createElement('div');
    overlay.className = 'ex-overlay';
    overlay.id = 'exDetailOverlay';
    overlay.innerHTML = `
    <div class="ex-detail-modal">
      <button class="ex-detail-close" onclick="closeExchangeDetail()">✕</button>
      <h3>${ex.name}</h3>
      <div class="ex-detail-grid">
        <div class="ex-detail-col">
          <div class="ex-detail-row"><span>🌍 Country</span><strong>${ex.country || 'Global'}</strong></div>
          <div class="ex-detail-row"><span>📅 Founded</span><strong>${ex.yearEstablished || '—'}</strong></div>
          <div class="ex-detail-row"><span>⭐ Trust Score</span><strong>${trust}/10</strong></div>
          <div class="ex-detail-row"><span>🪙 Coins Listed</span><strong>${ex.coins || ex.coinsCount || '—'}</strong></div>
          <div class="ex-detail-row"><span>🔄 Trading Pairs</span><strong>${ex.pairs || ex.pairsCount || '—'}</strong></div>
        </div>
        <div class="ex-detail-col">
          <div class="ex-detail-row"><span>💸 Maker Fee</span><strong>${ex.makerFee !== undefined ? ex.makerFee+'%' : '—'}</strong></div>
          <div class="ex-detail-row"><span>💸 Taker Fee</span><strong>${ex.takerFee !== undefined ? ex.takerFee+'%' : '—'}</strong></div>
          <div class="ex-detail-row"><span>🪪 KYC Required</span><strong>${ex.requiresKYC || 'Unknown'}</strong></div>
          <div class="ex-detail-row"><span>🇵🇰 Pakistan Access</span><strong>${ex.pakistanFriendly ? '✅ Yes' : '⚠️ Limited'}</strong></div>
          <div class="ex-detail-row"><span>🟢 Beginner Friendly</span><strong>${ex.beginnerFriendly ? '✅ Yes' : '—'}</strong></div>
        </div>
      </div>
      ${ex.pakistanNote ? `<div class="ex-pk-note">🇵🇰 ${ex.pakistanNote}</div>` : ''}
      <div class="ex-detail-features">
        <p><strong>Features:</strong></p>
        <div class="ex-features-row">${(ex.features||[]).map(f=>`<span class="ex-feat-badge">${f}</span>`).join('')}</div>
      </div>
      ${ex.recommended && ex.recommended.length ? `
      <div class="ex-detail-recommended">
        <p><strong>Recommended for:</strong></p>
        <ul>${ex.recommended.map(r=>`<li>${r}</li>`).join('')}</ul>
      </div>` : ''}
      <a class="btn-primary ex-visit-btn" href="${ex.url}" target="_blank" rel="noopener">Visit ${ex.name} ↗</a>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeExchangeDetail(); });
}

function closeExchangeDetail() {
    const ov = document.getElementById('exDetailOverlay');
    if (ov) ov.remove();
}

// ── Where to Buy Tab ──────────────────────────────────────────────────
function renderWhereToBuyTab(container) {
    container.innerHTML = `
    <div class="wtb-search-box">
      <label class="wtb-label">Search for any coin to see where you can buy it:</label>
      <div class="wtb-input-row">
        <input id="wtbCoinInput" class="wtb-input" type="text" placeholder="e.g. Bitcoin, ETH, DOGE, Solana…" oninput="debouncedCoinSearch(this.value)">
        <button class="btn-primary" onclick="searchCoinForExchanges()">🔍 Find Exchanges</button>
      </div>
      <div id="wtbSuggestions" class="wtb-suggestions"></div>
    </div>
    <div id="wtbResults" class="wtb-results"></div>`;
}

let _wtbDebounce = null;
function debouncedCoinSearch(q) {
    clearTimeout(_wtbDebounce);
    if (!q || q.length < 2) {
        const sug = document.getElementById('wtbSuggestions');
        if (sug) sug.innerHTML = '';
        return;
    }
    _wtbDebounce = setTimeout(() => searchCoinsForSuggestions(q), 400);
}

async function searchCoinsForSuggestions(q) {
    const sug = document.getElementById('wtbSuggestions');
    if (!sug) return;
    sug.innerHTML = '<div class="wtb-sug-loading">Searching…</div>';

    try {
        const res = await fetch(`/api/crypto/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!json.success || !json.data.length) {
            sug.innerHTML = '<div class="wtb-sug-empty">No coins found</div>';
            return;
        }
        exState.coinResults = json.data;
        sug.innerHTML = json.data.slice(0, 8).map((c, i) => `
            <div class="wtb-sug-item" onclick="selectCoinForExchanges(${i})">
              <span class="wtb-sug-rank">#${c.market_cap_rank || '—'}</span>
              <span class="wtb-sug-name">${c.name}</span>
              <span class="wtb-sug-sym">${c.symbol?.toUpperCase()}</span>
            </div>`).join('');
    } catch (e) {
        sug.innerHTML = '<div class="wtb-sug-empty">Search failed</div>';
    }
}

function selectCoinForExchanges(idx) {
    const coin = exState.coinResults[idx];
    if (!coin) return;
    exState.selectedCoin = coin;
    const input = document.getElementById('wtbCoinInput');
    if (input) input.value = `${coin.name} (${coin.symbol?.toUpperCase()})`;
    const sug = document.getElementById('wtbSuggestions');
    if (sug) sug.innerHTML = '';
    loadCoinExchanges(coin.symbol);
}

async function searchCoinForExchanges() {
    const input = document.getElementById('wtbCoinInput');
    const q = input?.value?.trim();
    if (!q) return;
    // If there's a selected coin already use its symbol, otherwise search
    if (exState.selectedCoin && input.value.includes(exState.selectedCoin.name)) {
        loadCoinExchanges(exState.selectedCoin.symbol);
    } else {
        await searchCoinsForSuggestions(q);
    }
}

async function loadCoinExchanges(symbol) {
    const results = document.getElementById('wtbResults');
    if (!results) return;
    results.innerHTML = '<div class="ex-loading">Fetching exchange data…</div>';

    try {
        const res = await fetch(`/api/exchanges/coin/${symbol.toUpperCase()}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        // API returns array of exchange objects (each may have livePrice embedded)
        const exchanges = Array.isArray(json.data) ? json.data : (json.data.exchanges || []);
        exState.coinExchanges = exchanges;
        renderCoinExchangeResults(exchanges, symbol);
    } catch (e) {
        results.innerHTML = `<div class="ex-error">Could not load exchange data: ${e.message}</div>`;
    }
}

function renderCoinExchangeResults(exchanges, symbol) {
    const results = document.getElementById('wtbResults');
    if (!results) return;

    // Extract live prices from embedded livePrice field
    const withLive = exchanges.filter(e => e.livePrice != null);

    let html = `
    <div class="wtb-result-header">
      <h4>Where to buy <strong>${symbol?.toUpperCase()}</strong></h4>
    </div>
    <div class="wtb-ex-table-wrap">
      <table class="wtb-ex-table">
        <thead>
          <tr>
            <th>Exchange</th>
            <th>🇵🇰 PK Access</th>
            <th>Live Price</th>
            <th>Maker / Taker</th>
            <th>KYC</th>
            <th>Trust</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          ${exchanges.map(ex => `
          <tr class="wtb-ex-row">
            <td><strong>${ex.name}</strong>${ex.beginnerFriendly ? ' <span class="ex-badge beginner">🟢</span>' : ''}</td>
            <td>${ex.pakistanFriendly ? '✅ Yes' : '⚠️ Limited'}</td>
            <td class="mono">${ex.livePrice ? '$'+parseFloat(ex.livePrice).toLocaleString() : '—'}</td>
            <td class="mono">${ex.makerFee !== undefined ? ex.makerFee+'% / '+ex.takerFee+'%' : '—'}</td>
            <td>${typeof ex.requiresKYC === 'string' ? ex.requiresKYC.replace(' (limited without)','') : (ex.requiresKYC ? 'Required' : 'No')}</td>
            <td>${ex.trustScore || ex.trust_score || '—'}/10</td>
            <td><a href="${ex.tradeUrl || ex.url}" target="_blank" class="ex-visit-link">Trade ↗</a></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    if (withLive.length) {
        html += `
        <div class="wtb-live-prices">
          <h5>💰 Live ${symbol?.toUpperCase()} Prices</h5>
          <div class="wtb-prices-grid">
            ${withLive.map(ex => `
            <div class="wtb-price-card">
              <div class="wtb-price-exchange">${ex.name}</div>
              <div class="wtb-price-value">$${parseFloat(ex.livePrice).toLocaleString()}</div>
              <div class="wtb-price-vol">Vol: ${ex.volume24h ? '$'+formatVolume(ex.volume24h) : '—'}</div>
            </div>`).join('')}
          </div>
        </div>`;
    }

    results.innerHTML = html;
}

// ── Price Compare Tab ─────────────────────────────────────────────────
function renderPriceCompareTab(container) {
    container.innerHTML = `
    <div class="pc-search-box">
      <label class="wtb-label">Compare live prices for any coin across all major exchanges:</label>
      <div class="wtb-input-row">
        <input id="pcCoinInput" class="wtb-input" type="text" placeholder="e.g. BTC, ETH, SOL…" oninput="debouncedPCSearch(this.value)">
        <button class="btn-primary" onclick="loadPriceComparison()">📊 Compare Prices</button>
      </div>
      <div id="pcSuggestions" class="wtb-suggestions"></div>
    </div>
    <div id="pcResults"></div>`;
}

let _pcDebounce = null;
let _pcSelectedCoin = null;
function debouncedPCSearch(q) {
    clearTimeout(_pcDebounce);
    if (!q || q.length < 2) {
        const sug = document.getElementById('pcSuggestions');
        if (sug) sug.innerHTML = '';
        return;
    }
    _pcDebounce = setTimeout(async () => {
        const sug = document.getElementById('pcSuggestions');
        if (!sug) return;
        sug.innerHTML = '<div class="wtb-sug-loading">Searching…</div>';
        try {
            const res = await fetch(`/api/crypto/search?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            if (!json.success || !json.data.length) { sug.innerHTML = '<div class="wtb-sug-empty">No results</div>'; return; }
            sug.innerHTML = json.data.slice(0, 8).map((c, i) => `
                <div class="wtb-sug-item" onclick="selectPCCoin(${JSON.stringify(c).replace(/"/g,'&quot;')})">
                  <span class="wtb-sug-rank">#${c.market_cap_rank || '—'}</span>
                  <span class="wtb-sug-name">${c.name}</span>
                  <span class="wtb-sug-sym">${c.symbol?.toUpperCase()}</span>
                </div>`).join('');
        } catch { sug.innerHTML = ''; }
    }, 400);
}

function selectPCCoin(coin) {
    _pcSelectedCoin = coin;
    const input = document.getElementById('pcCoinInput');
    if (input) input.value = `${coin.name} (${coin.symbol?.toUpperCase()})`;
    const sug = document.getElementById('pcSuggestions');
    if (sug) sug.innerHTML = '';
}

async function loadPriceComparison() {
    const results = document.getElementById('pcResults');
    if (!results) return;

    const symbol = _pcSelectedCoin?.symbol || document.getElementById('pcCoinInput')?.value?.trim();
    if (!symbol) return;

    results.innerHTML = '<div class="ex-loading">Fetching live prices from all exchanges…</div>';

    try {
        const res = await fetch(`/api/exchanges/coin/${symbol.toUpperCase()}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        // API returns array of exchange objects with optional livePrice field
        const allExchanges = Array.isArray(json.data) ? json.data : (json.data.exchanges || []);
        const live = allExchanges.filter(e => e.livePrice != null);

        if (!live.length) {
            results.innerHTML = `
            <div class="pc-no-live">
              <p>⚠️ Live price data not available for <strong>${symbol?.toUpperCase()}</strong> at this time.</p>
              <p>This can happen on CoinGecko free tier rate limits. Try again in a minute, or check the "Where to Buy" tab.</p>
              <p>These exchanges list this coin:</p>
              <div class="ex-features-row">
                ${allExchanges.map(e=>`<span class="ex-feat-badge">${e.name}</span>`).join('')}
              </div>
            </div>`;
            return;
        }

        // Sort by price ascending to find best deal
        const sorted = [...live].sort((a, b) => parseFloat(a.livePrice||0) - parseFloat(b.livePrice||0));
        const minPrice = parseFloat(sorted[0]?.livePrice || 0);
        const maxPrice = parseFloat(sorted[sorted.length-1]?.livePrice || 0);

        results.innerHTML = `
        <div class="pc-header">
          <h4>💰 ${symbol?.toUpperCase()} Prices Across Exchanges</h4>
          <div class="pc-summary">
            <span class="pc-sum-item">📉 Lowest: <strong>$${minPrice.toLocaleString()}</strong> (${sorted[0]?.name || '?'})</span>
            <span class="pc-sum-item">📈 Highest: <strong>$${maxPrice.toLocaleString()}</strong> (${sorted[sorted.length-1]?.name || '?'})</span>
            <span class="pc-sum-item">🔄 Spread: <strong>${maxPrice > 0 ? ((maxPrice-minPrice)/minPrice*100).toFixed(2)+'%' : '—'}</strong></span>
          </div>
        </div>
        <table class="pc-table">
          <thead>
            <tr><th>Exchange</th><th>Price (USD)</th><th>24h Volume</th><th>Spread vs Best</th><th>Link</th></tr>
          </thead>
          <tbody>
            ${sorted.map((ex, i) => {
                const price = parseFloat(ex.livePrice || 0);
                const vol = parseFloat(ex.volume24h || 0);
                const spreadPct = minPrice > 0 ? ((price - minPrice) / minPrice * 100).toFixed(2) : '0.00';
                const isBest = i === 0;
                return `
                <tr class="${isBest ? 'pc-best-row' : ''}">
                  <td><strong>${ex.name}</strong>${isBest ? ' <span class="ex-badge beginner">Best Price</span>' : ''}</td>
                  <td class="mono">$${price.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td class="mono">${vol > 0 ? '$'+formatVolume(vol) : '—'}</td>
                  <td class="${parseFloat(spreadPct) > 1 ? 'pc-spread-high' : 'pc-spread-ok'}">+${spreadPct}%</td>
                  <td><a href="${ex.tradeUrl || ex.url}" target="_blank" class="ex-visit-link">Trade ↗</a></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        results.innerHTML = `<div class="ex-error">Failed to load price data: ${e.message}</div>`;
    }
}

// ── Use Cases Tab ──────────────────────────────────────────────────────
function renderUseCasesTab(container) {
    if (!exState.useCases.length) {
        container.innerHTML = '<div class="ex-loading">Loading guide…</div>';
        return;
    }

    container.innerHTML = `
    <div class="uc-intro">
      <p>Not sure which exchange to use? Find the best one for your specific situation:</p>
    </div>
    <div class="uc-grid">
      ${exState.useCases.map(uc => `
      <div class="uc-card">
        <div class="uc-icon">${uc.icon || '🏦'}</div>
        <h4 class="uc-title">${uc.useCase || uc.title || ''}</h4>
        <p class="uc-desc">${uc.description || ''}</p>
        <div class="uc-exchanges">
          ${(uc.exchanges || []).map(id => {
              const ex = exState.exchanges.find(e => e.id === id);
              return ex ? `<div class="uc-exchange-item" onclick="showExchangeDetail('${ex.id}')">
                <span class="uc-ex-name">${ex.name}</span>
                <span class="uc-ex-fee">${ex.takerFee !== undefined ? ex.takerFee+'%' : ''}</span>
              </div>` : `<div class="uc-exchange-item"><span class="uc-ex-name">${id}</span></div>`;
          }).join('')}
        </div>
        ${(uc.reasoning || uc.reason) ? `<p class="uc-reasoning">💡 ${uc.reasoning || uc.reason}</p>` : ''}
      </div>`).join('')}
    </div>`;
}

// ── Coin Analysis Exchange Tab ─────────────────────────────────────────
// Called from coin analysis page when exchange tab is clicked
async function renderCoinAnalysisExchangeTab(symbol, container) {
    container.innerHTML = '<div class="ex-loading">Loading exchange data for ' + symbol + '…</div>';

    try {
        const res = await fetch(`/api/exchanges/coin/${symbol.toUpperCase()}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        // API returns array of exchange objects with optional livePrice field
        const exchanges = Array.isArray(json.data) ? json.data : (json.data.exchanges || []);
        const withLive = exchanges.filter(e => e.livePrice != null);

        let html = `
        <div class="coa-ex-section">
          <h5>🏦 Where to Buy ${symbol?.toUpperCase()}</h5>
          <div class="coa-ex-cards">
            ${exchanges.map(ex => `
            <div class="coa-ex-card ${ex.pakistanFriendly ? 'pk-friendly' : ''}">
              <div class="coa-ex-name">${ex.name}</div>
              <div class="coa-ex-tags">
                ${ex.pakistanFriendly ? '<span class="ex-badge pkr">🇵🇰</span>' : ''}
                ${ex.beginnerFriendly ? '<span class="ex-badge beginner">🟢</span>' : ''}
                ${(ex.requiresKYC === false || (typeof ex.requiresKYC === 'string' && ex.requiresKYC.toLowerCase().includes('optional'))) ? '<span class="ex-badge nokyc">No KYC</span>' : ''}
              </div>
              <div class="coa-ex-fees">
                ${ex.livePrice ? '<strong>$'+parseFloat(ex.livePrice).toLocaleString()+'</strong> · ' : ''}Fees: ${ex.makerFee !== undefined ? ex.makerFee+'%/'+ex.takerFee+'%' : '—'}
              </div>
              <a href="${ex.tradeUrl || ex.url}" target="_blank" class="ex-visit-link">Trade ↗</a>
            </div>`).join('')}
          </div>
          ${withLive.length ? `
          <h5 style="margin-top:1.2rem">💰 Live Prices</h5>
          <div class="wtb-prices-grid">
            ${withLive.slice(0, 8).map(ex => `
            <div class="wtb-price-card">
              <div class="wtb-price-exchange">${ex.name}</div>
              <div class="wtb-price-value">$${parseFloat(ex.livePrice).toLocaleString()}</div>
              <div class="wtb-price-vol">Vol: ${ex.volume24h ? '$'+formatVolume(ex.volume24h) : '—'}</div>
            </div>`).join('')}
          </div>` : ''}
        </div>`;

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="ex-error">Failed to load: ${e.message}</div>`;
    }
}

// ── Top Coins Loader (used by market sections) ────────────────────────
async function loadTopCoins(limit, currency, onSuccess) {
    try {
        const res = await fetch(`/api/crypto/top?limit=${limit}&currency=${currency || 'usd'}`);
        const json = await res.json();
        if (json.success && typeof onSuccess === 'function') onSuccess(json.data);
    } catch (e) {
        console.error('Top coins error:', e);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatVolume(v) {
    v = parseFloat(v) || 0;
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
}

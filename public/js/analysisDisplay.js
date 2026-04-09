// Analysis Display - Shows technical indicators and trading signals

// Display full technical analysis for a cryptocurrency
async function displayAnalysis(symbol) {
    const container = document.getElementById('analysisContent');
    showLoading(container);

    // Clear previous signal card
    const signalWrap = document.getElementById('tradeSignalCard');
    if (signalWrap) signalWrap.innerHTML = '';

    try {
        // Fetch analysis data
        const analysis = await apiRequest(`/api/crypto/${symbol}/analysis`);

        // Build HTML
        let html = '';

        // Add chart
        html += createChartContainer(symbol);

        // Overall signal card (existing simple card)
        html += createOverallSignalCard(analysis.overall);

        // Individual indicators
        html += createIndicatorsGrid(analysis.indicators);

        container.innerHTML = html;

        // Load chart
        await loadChart(symbol, currentTimeframe);

        // Setup timeframe buttons
        setupTimeframeButtons(symbol);

        // Generate enhanced trade signal
        if (typeof loadAndShowSignal === 'function' && signalWrap) {
            const cryptos = window._cryptoList || [];
            const coinData = cryptos.find(c => c.symbol === symbol || c.id === symbol);
            const coinId   = coinData?.id || symbol.toLowerCase();
            const coinName = coinData?.name || symbol;
            const prices   = window._latestPrices || {};
            const price    = prices[symbol] || coinData?.price || 0;
            await loadAndShowSignal(coinId, symbol, coinName, price);
        }

        // Append exchange tab for this coin
        appendCoinExchangeSection(symbol);

    } catch (error) {
        console.error('Error displaying analysis:', error);
        showError(container, 'Failed to load technical analysis. Please try again.');
    }
}

// Create overall signal card
function createOverallSignalCard(overall) {
    const signalClass = getSignalClass(overall.signal);

    return `
    <div class="signal-card ${signalClass}">
      <div class="signal-header">
        <h3 class="signal-title">Overall Trading Signal</h3>
        <span class="signal-badge ${signalClass}">${escapeHtml(overall.signal)}</span>
      </div>
      
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: ${overall.confidence}%"></div>
      </div>
      <p style="color: var(--color-text-secondary); margin-bottom: 1rem;">
        Confidence: ${overall.confidence.toFixed(0)}%
      </p>
      
      <p style="font-size: 1.125rem; line-height: 1.6; margin-bottom: 1rem;">
        ${escapeHtml(overall.recommendation)}
      </p>
      
      <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: var(--color-text-muted);">
        <span>📈 Buy Signals: ${overall.breakdown.buy}</span>
        <span>📉 Sell Signals: ${overall.breakdown.sell}</span>
        <span>➖ Hold Signals: ${overall.breakdown.hold}</span>
      </div>
    </div>
  `;
}

// Create indicators grid
function createIndicatorsGrid(indicators) {
    let html = '<div class="indicators-grid">';

    // RSI
    html += createIndicatorCard(
        'RSI (Relative Strength Index)',
        indicators.rsi.value.toFixed(2),
        indicators.rsi.signal,
        indicators.rsi.description
    );

    // MACD
    html += createIndicatorCard(
        'MACD',
        `${indicators.macd.macdLine.toFixed(2)} / ${indicators.macd.signalLine.toFixed(2)}`,
        indicators.macd.signal,
        indicators.macd.description
    );

    // Bollinger Bands
    html += createIndicatorCard(
        'Bollinger Bands',
        `${formatCurrency(indicators.bollingerBands.middle)}`,
        indicators.bollingerBands.signal,
        indicators.bollingerBands.description
    );

    // Moving Averages
    html += createIndicatorCard(
        'Moving Averages',
        `SMA20: ${formatCurrency(indicators.movingAverages.sma20)}`,
        indicators.movingAverages.signal,
        indicators.movingAverages.description
    );

    // Volume
    html += createIndicatorCard(
        'Volume Analysis',
        formatLargeNumber(indicators.volume.current),
        indicators.volume.signal,
        indicators.volume.description
    );

    html += '</div>';
    return html;
}

// Create individual indicator card
function createIndicatorCard(name, value, signal, description) {
    const signalClass = getSignalClass(signal);

    return `
    <div class="indicator-card">
      <div class="indicator-name">${escapeHtml(name)}</div>
      <div class="indicator-value">${escapeHtml(value)}</div>
      <span class="indicator-signal ${signalClass}">${escapeHtml(signal)}</span>
      <p class="indicator-description">${escapeHtml(description)}</p>
    </div>
  `;
}

// Display beginner-friendly explanation
function createExplanationCard(title, content) {
    return `
    <div class="education-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(content)}</p>
    </div>
  `;
}

// Append Exchange tab section below the analysis indicators
function appendCoinExchangeSection(symbol) {
    const container = document.getElementById('analysisContent');
    if (!container) return;

    // Avoid duplicates
    const existing = container.querySelector('.coa-ex-wrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.className = 'coa-ex-wrap';
    wrap.innerHTML = `
    <div class="coa-ex-header">
      <h4>🏦 Where to Buy ${symbol?.toUpperCase()}</h4>
      <button class="btn-secondary coa-ex-toggle" onclick="toggleCoinExchangeTab(this, '${symbol}')">Load Exchange Data ↓</button>
    </div>
    <div class="coa-ex-body" id="coaExBody_${symbol}" style="display:none"></div>`;
    container.appendChild(wrap);
}

function toggleCoinExchangeTab(btn, symbol) {
    const body = document.getElementById(`coaExBody_${symbol}`);
    if (!body) return;
    if (body.style.display === 'none') {
        body.style.display = 'block';
        btn.textContent = 'Hide Exchange Data ↑';
        if (!body.dataset.loaded) {
            body.dataset.loaded = '1';
            if (typeof renderCoinAnalysisExchangeTab === 'function') {
                renderCoinAnalysisExchangeTab(symbol, body);
            }
        }
    } else {
        body.style.display = 'none';
        btn.textContent = 'Load Exchange Data ↓';
    }
}

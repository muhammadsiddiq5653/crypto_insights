/**
 * Multi-Timeframe Analysis Frontend
 * Vanilla JS - No frameworks
 */

// State management
const mtfState = {
  symbol: null,
  data: null,
  loading: false
};

// Debounce utility
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Initialize MTF module
function initMTF() {
  const container = document.getElementById('mtf');
  if (!container) {
    console.error('MTF container not found');
    return;
  }

  container.innerHTML = `
    <div class="mtf-coin-search">
      <input
        type="text"
        id="mtfCoinInput"
        class="mtf-input"
        placeholder="Search crypto (e.g., BTC, ETH)..."
      />
      <div id="mtfSuggestions" class="mtf-suggestions"></div>
      <button id="mtfAnalyzeBtn" class="mtf-analyze-btn">Analyze</button>
    </div>
    <div id="mtfResults" class="mtf-results"></div>
  `;

  setupSearchInput();
  setupAnalyzeButton();
  populateInitialCoins();
}

// Setup search input with debounced API calls
function setupSearchInput() {
  const input = document.getElementById('mtfCoinInput');
  const suggestionsContainer = document.getElementById('mtfSuggestions');

  const performSearch = debounce(async (query) => {
    if (!query.trim()) {
      suggestionsContainer.innerHTML = '';
      return;
    }

    try {
      const response = await fetch(`/api/crypto/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      renderSuggestions(results, suggestionsContainer);
    } catch (error) {
      console.error('Search error:', error);
      suggestionsContainer.innerHTML = '<div class="mtf-error">Search failed</div>';
    }
  }, 300);

  input.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });
}

// Render search suggestions
function renderSuggestions(results, container) {
  if (!results || results.length === 0) {
    container.innerHTML = '<div class="mtf-sug-item">No results found</div>';
    return;
  }

  const html = results
    .slice(0, 8)
    .map(coin => `
      <div class="mtf-sug-item" data-symbol="${coin.symbol}">
        <span class="mtf-sug-name">${coin.name}</span>
        <span class="mtf-sug-symbol">${coin.symbol}</span>
      </div>
    `)
    .join('');

  container.innerHTML = html;

  container.querySelectorAll('.mtf-sug-item').forEach(item => {
    item.addEventListener('click', () => {
      const symbol = item.dataset.symbol;
      document.getElementById('mtfCoinInput').value = symbol;
      container.innerHTML = '';
      mtfState.symbol = symbol;
    });
  });
}

// Pre-populate with available coins
function populateInitialCoins() {
  if (window._cryptoList && Array.isArray(window._cryptoList)) {
    const suggestionsContainer = document.getElementById('mtfSuggestions');
    renderSuggestions(window._cryptoList.slice(0, 8), suggestionsContainer);
  }
}

// Setup analyze button
function setupAnalyzeButton() {
  const btn = document.getElementById('mtfAnalyzeBtn');
  btn.addEventListener('click', () => {
    const input = document.getElementById('mtfCoinInput');
    const symbol = input.value.trim().toUpperCase();
    if (symbol) {
      mtfState.symbol = symbol;
      loadMTF(symbol);
    }
  });
}

// Load MTF data from API
async function loadMTF(symbol) {
  mtfState.loading = true;
  const resultsContainer = document.getElementById('mtfResults');
  resultsContainer.innerHTML = '<div class="mtf-loading">Loading analysis...</div>';

  try {
    const response = await fetch(`/api/crypto/symbol/mtf?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    mtfState.data = data;
    renderMTF(data);
  } catch (error) {
    console.error('MTF load error:', error);
    resultsContainer.innerHTML = `<div class="mtf-error">Failed to load analysis: ${error.message}</div>`;
  } finally {
    mtfState.loading = false;
  }
}

// Render MTF analysis results
function renderMTF(data) {
  const resultsContainer = document.getElementById('mtfResults');

  // Summary box
  const summary = generateSummary(data);
  let html = `
    <div class="mtf-summary-box ${summary.className}">
      <h3>${summary.title}</h3>
      <p>${summary.description}</p>
    </div>
  `;

  // Timeframe cards grid
  html += '<div class="mtf-grid">';

  const timeframes = ['1H', '4H', '1D', '1W'];
  timeframes.forEach(tf => {
    const tfData = data.timeframes[tf];
    if (tfData) {
      html += renderTimeframeCard(tf, tfData);
    }
  });

  html += '</div>';

  resultsContainer.innerHTML = html;
}

// Generate summary box content
function generateSummary(data) {
  const timeframes = Object.values(data.timeframes || {});
  const bullishCount = timeframes.filter(tf => {
    const signal = tf.overall_signal || '';
    return signal.includes('BULLISH') || signal.includes('LONG') || signal.includes('BUY');
  }).length;
  const bearishCount = timeframes.filter(tf => {
    const signal = tf.overall_signal || '';
    return signal.includes('BEARISH') || signal.includes('SHORT') || signal.includes('SELL');
  }).length;

  let className = 'neutral';
  let title = 'Mixed Signal';
  let description = `${bullishCount} bullish, ${bearishCount} bearish`;

  if (bullishCount === 4) {
    className = 'bullish';
    title = 'Strong LONG Setup';
    description = '4/4 timeframes bullish — Excellent uptrend opportunity';
  } else if (bearishCount === 4) {
    className = 'bearish';
    title = 'Strong SHORT Setup';
    description = '4/4 timeframes bearish — Strong downtrend signal';
  } else if (bullishCount > bearishCount) {
    className = 'bullish';
    title = 'LONG Bias';
    description = `${bullishCount}/4 timeframes bullish — Favorable for buys`;
  } else if (bearishCount > bullishCount) {
    className = 'bearish';
    title = 'SHORT Bias';
    description = `${bearishCount}/4 timeframes bearish — Favorable for shorts`;
  }

  return { className, title, description };
}

// Render individual timeframe card
function renderTimeframeCard(timeframe, tfData) {
  const signal = tfData.overall_signal || 'NEUTRAL';
  const signalClass = getSignalColor(signal);
  const confidence = tfData.confidence || 0;
  const indicators = tfData.indicators || {};

  const trendAlignment = calculateTrendAlignment(indicators);

  let html = `
    <div class="mtf-card ${signalClass}">
      <div class="mtf-card-header">
        <span class="mtf-tf-label">${timeframe}</span>
        <span class="mtf-signal-badge">${signal}</span>
      </div>

      <div class="mtf-confidence">
        <div class="mtf-confidence-fill" style="width: ${confidence}%"></div>
      </div>
      <p class="mtf-confidence-text">${Math.round(confidence)}% Confidence</p>

      <table class="mtf-indicators-table">
  `;

  // RSI
  if (indicators.rsi) {
    html += renderIndicatorRow('RSI', indicators.rsi.value, indicators.rsi.signal);
  }

  // MACD
  if (indicators.macd) {
    html += renderIndicatorRow('MACD', indicators.macd.value, indicators.macd.signal);
  }

  // Bollinger Bands
  if (indicators.bollinger) {
    html += renderIndicatorRow('Bollinger', indicators.bollinger.value, indicators.bollinger.signal);
  }

  // Moving Average
  if (indicators.ma) {
    html += renderIndicatorRow('MA', indicators.ma.value, indicators.ma.signal);
  }

  // Volume
  if (indicators.volume) {
    html += renderIndicatorRow('Volume', indicators.volume.value, indicators.volume.signal);
  }

  // Trend Alignment
  html += `
        <tr class="mtf-ind-row mtf-trend-row">
          <td class="mtf-ind-name">Trend Alignment</td>
          <td class="mtf-ind-value">${trendAlignment}</td>
        </tr>
      </table>
    </div>
  `;

  return html;
}

// Render single indicator row
function renderIndicatorRow(name, value, signal) {
  const dotClass = getSignalColor(signal);
  const displayValue = typeof value === 'number' ? value.toFixed(2) : value;

  return `
    <tr class="mtf-ind-row">
      <td class="mtf-ind-name">${name}</td>
      <td class="mtf-ind-value">
        <span class="mtf-ind-dot ${dotClass}"></span>
        ${displayValue}
      </td>
    </tr>
  `;
}

// Calculate trend alignment (how many indicators agree)
function calculateTrendAlignment(indicators) {
  let agreementCount = 0;
  const total = Object.keys(indicators).length;

  if (total === 0) return '0/0';

  // Get the dominant signal from first indicator
  const firstSignal = Object.values(indicators)[0]?.signal || '';
  const isBullish = firstSignal.includes('BUY') || firstSignal.includes('BULLISH') || firstSignal.includes('LONG');

  for (const indicator of Object.values(indicators)) {
    const signal = indicator.signal || '';
    const indBullish = signal.includes('BUY') || signal.includes('BULLISH') || signal.includes('LONG');
    if (indBullish === isBullish) {
      agreementCount++;
    }
  }

  const direction = isBullish ? 'BULLISH' : 'BEARISH';
  return `${agreementCount}/${total} ${direction}`;
}

// Get CSS class for signal color
function getSignalColor(signal) {
  if (!signal) return 'neutral';

  const upperSignal = String(signal).toUpperCase();

  if (upperSignal.includes('BUY') || upperSignal.includes('BULLISH') || upperSignal.includes('LONG')) {
    return 'positive';
  }
  if (upperSignal.includes('SELL') || upperSignal.includes('BEARISH') || upperSignal.includes('SHORT')) {
    return 'negative';
  }

  return 'neutral';
}

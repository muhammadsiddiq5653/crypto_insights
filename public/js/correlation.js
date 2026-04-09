/**
 * Correlation Matrix Feature
 * Analyzes price correlations between selected cryptocurrencies
 * Vanilla JS, no frameworks
 */

let corrState = {
  coins: [],
  prices: {},
  loading: false
};

// Default popular coins
const DEFAULT_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'MATIC'];

/**
 * Initialize the correlation matrix section
 */
function initCorrelation() {
  const container = document.getElementById('correlation');
  if (!container) {
    console.error('Correlation container #correlation not found');
    return;
  }

  container.innerHTML = `
    <div class="corr-wrapper">
      <div class="corr-header">
        <h2>Cryptocurrency Correlation Matrix</h2>
        <p>Analyze how different cryptocurrencies move together. Select up to 10 coins to see their correlation coefficients.</p>
      </div>

      <div class="corr-coin-picker">
        <label>Select Coins (Max 10):</label>
        <div class="corr-checkboxes" id="corrCheckboxes"></div>
      </div>

      <button id="corrCalculateBtn" class="corr-calculate-btn">Calculate Correlation</button>
      <div id="corrLoading" class="corr-loading" style="display: none;">Loading price data...</div>

      <div id="corrMatrix" class="corr-results"></div>
    </div>
  `;

  populateCoinSelector();
  attachEventListeners();
}

/**
 * Populate coin selector with available coins
 */
function populateCoinSelector() {
  const checkboxesContainer = document.getElementById('corrCheckboxes');
  const allCoins = window._cryptoList ? window._cryptoList : [];
  const coinSet = new Set([...DEFAULT_COINS, ...allCoins.map(c => c.symbol || c)]);
  const coins = Array.from(coinSet).sort().slice(0, 50);

  checkboxesContainer.innerHTML = coins.map(coin => `
    <label class="corr-coin-checkbox">
      <input type="checkbox" value="${coin}" data-coin="${coin}">
      <span>${coin}</span>
    </label>
  `).join('');

  // Pre-check first 3 default coins
  DEFAULT_COINS.slice(0, 3).forEach(coin => {
    const checkbox = document.querySelector(`input[data-coin="${coin}"]`);
    if (checkbox) checkbox.checked = true;
  });
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  const calculateBtn = document.getElementById('corrCalculateBtn');
  const checkboxes = document.querySelectorAll('.corr-coin-checkbox input');

  calculateBtn.addEventListener('click', buildCorrelationMatrix);

  // Enforce max 10 coins
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checked = document.querySelectorAll('.corr-coin-checkbox input:checked');
      if (checked.length > 10) {
        checkbox.checked = false;
        alert('Maximum 10 coins allowed');
      }
    });
  });
}

/**
 * Build the correlation matrix
 * Fetches 30-day price history for each selected coin and computes Pearson correlation
 */
async function buildCorrelationMatrix() {
  const selectedCoins = Array.from(document.querySelectorAll('.corr-coin-checkbox input:checked'))
    .map(cb => cb.value);

  if (selectedCoins.length < 2) {
    alert('Please select at least 2 coins');
    return;
  }

  corrState.coins = selectedCoins;
  corrState.loading = true;
  showLoading(true);

  try {
    // Fetch price history for all selected coins
    const priceData = {};
    for (const coin of selectedCoins) {
      try {
        const response = await fetch(`/api/crypto/${coin}/history?days=30`);
        if (!response.ok) throw new Error(`Failed to fetch ${coin}`);
        const data = await response.json();
        priceData[coin] = data.prices || [];
      } catch (error) {
        console.error(`Error fetching ${coin}:`, error);
        priceData[coin] = [];
      }
    }

    corrState.prices = priceData;

    // Compute correlation matrix
    const matrix = computeCorrelationMatrix(selectedCoins, priceData);

    // Render results
    renderCorrelationMatrix(selectedCoins, matrix);
    renderInsights(selectedCoins, matrix);
  } catch (error) {
    console.error('Error building correlation matrix:', error);
    document.getElementById('corrMatrix').innerHTML = '<p class="corr-error">Error loading correlation data</p>';
  } finally {
    corrState.loading = false;
    showLoading(false);
  }
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {
  const loading = document.getElementById('corrLoading');
  if (loading) {
    loading.style.display = show ? 'block' : 'none';
  }
}

/**
 * Compute Pearson correlation coefficient between two price arrays
 */
function pearsonCorrelation(prices1, prices2) {
  const n = Math.min(prices1.length, prices2.length);
  if (n === 0) return 0;

  let sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;

  for (let i = 0; i < n; i++) {
    const x = prices1[i];
    const y = prices2[i];
    sum_x += x;
    sum_y += y;
    sum_xy += x * y;
    sum_x2 += x * x;
    sum_y2 += y * y;
  }

  const numerator = n * sum_xy - sum_x * sum_y;
  const denominator = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Compute correlation matrix for all coin pairs
 */
function computeCorrelationMatrix(coins, priceData) {
  const n = coins.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0; // Self-correlation
      } else if (j < i) {
        matrix[i][j] = matrix[j][i]; // Symmetric
      } else {
        const prices1 = priceData[coins[i]] || [];
        const prices2 = priceData[coins[j]] || [];
        matrix[i][j] = pearsonCorrelation(prices1, prices2);
      }
    }
  }

  return matrix;
}

/**
 * Determine correlation interpretation
 */
function getCorrelationLabel(r) {
  if (r > 0.8) return 'Strongly Correlated';
  if (r > 0.5) return 'Moderately Correlated';
  if (r > 0) return 'Weakly Correlated';
  if (r < -0.5) return 'Negatively Correlated';
  return 'Weakly Correlated';
}

/**
 * Get cell color based on correlation value
 */
function getCorrelationColor(r) {
  if (r === 1.0) return '#2d3748'; // Dark gray for diagonal
  if (r > 0.8) return 'rgba(72, 187, 120, 0.7)'; // Strong green
  if (r > 0.5) return 'rgba(72, 187, 120, 0.5)'; // Moderate green
  if (r > 0) return 'rgba(72, 187, 120, 0.2)'; // Slight green
  if (r < -0.8) return 'rgba(245, 101, 101, 0.7)'; // Strong red
  if (r < -0.5) return 'rgba(245, 101, 101, 0.5)'; // Moderate red
  return '#ffffff'; // White for near-zero
}

/**
 * Render correlation matrix table
 */
function renderCorrelationMatrix(coins, matrix) {
  let tableHtml = '<table class="corr-table"><thead><tr><th class="corr-header-cell">Coin</th>';

  coins.forEach(coin => {
    tableHtml += `<th class="corr-header-cell">${coin}</th>`;
  });
  tableHtml += '</tr></thead><tbody>';

  coins.forEach((coin1, i) => {
    tableHtml += `<tr><td class="corr-header-cell">${coin1}</td>`;
    coins.forEach((coin2, j) => {
      const r = matrix[i][j];
      const bgColor = getCorrelationColor(r);
      const label = getCorrelationLabel(r);
      const isDiagonal = i === j;
      const textColor = isDiagonal || r > 0.5 || r < -0.5 ? '#fff' : '#000';

      tableHtml += `<td class="corr-cell" style="background-color: ${bgColor}; color: ${textColor};" title="${label}">
        ${r.toFixed(2)}
      </td>`;
    });
    tableHtml += '</tr>';
  });

  tableHtml += '</tbody></table>';
  document.getElementById('corrMatrix').innerHTML = tableHtml;
}

/**
 * Extract all correlation pairs and sort
 */
function getAllPairs(coins, matrix) {
  const pairs = [];
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      pairs.push({
        coin1: coins[i],
        coin2: coins[j],
        correlation: matrix[i][j]
      });
    }
  }
  return pairs;
}

/**
 * Render insights and correlations
 */
function renderInsights(coins, matrix) {
  const pairs = getAllPairs(coins, matrix);
  const sorted = pairs.sort((a, b) => b.correlation - a.correlation);
  const highest = sorted.slice(0, 5);
  const lowest = sorted.slice(-3).reverse();

  let insightsHtml = '<div class="corr-insights">';

  // Highest correlations
  insightsHtml += '<div class="corr-insight-section"><h3>Strongest Correlations</h3><ul>';
  highest.forEach(p => {
    const pct = Math.round(p.correlation * 100);
    insightsHtml += `<li class="corr-pair-item"><strong>${p.coin1} / ${p.coin2}</strong>: ${pct}%</li>`;
  });
  insightsHtml += '</ul></div>';

  // Lowest/negative correlations
  insightsHtml += '<div class="corr-insight-section"><h3>Lowest / Negative Correlations</h3><ul>';
  lowest.forEach(p => {
    const pct = Math.round(p.correlation * 100);
    insightsHtml += `<li class="corr-pair-item"><strong>${p.coin1} / ${p.coin2}</strong>: ${pct}%</li>`;
  });
  insightsHtml += '</ul></div>';

  // Plain English insight
  if (highest.length > 0) {
    const top = highest[0];
    const pct = Math.round(top.correlation * 100);
    const insight = `${top.coin1} and ${top.coin2} move together ${pct}% of the time. Consider diversifying into uncorrelated assets for better risk management.`;
    insightsHtml += `<div class="corr-insight-section"><p class="corr-plain-text">${insight}</p></div>`;
  }

  insightsHtml += '</div>';

  const resultsDiv = document.getElementById('corrMatrix');
  resultsDiv.innerHTML += insightsHtml;
}

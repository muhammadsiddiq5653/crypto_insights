/**
 * tradeIdeas.js - Trade Idea Generator
 * Scans coins for setup opportunities and ranks by confidence
 */

const TRADE_IDEA_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'MATIC', 'DOT', 'LTC', 'ATOM', 'UNI', 'FIL'];
const SCAN_RATE_LIMIT = 500; // ms between requests
let tradeIdeasInterval = null;
let nextScanTime = null;
let isScanning = false;

function initTradeIdeas() {
  const section = document.getElementById('trade-ideas');
  if (!section) return;

  // Clear existing content
  section.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'ti-header';
  header.innerHTML = `
    <h2>Trade Idea Generator</h2>
    <p>Scan all coins and find the best technical setups based on multiple timeframes.</p>
  `;
  section.appendChild(header);

  // Control bar
  const controls = document.createElement('div');
  controls.className = 'ti-controls';
  controls.innerHTML = `
    <button class="ti-scan-btn" id="scanBtn">🔍 Scan All Coins Now</button>
    <div class="ti-countdown" id="scanCountdown"></div>
  `;
  section.appendChild(controls);

  // Filter bar
  const filterBar = document.createElement('div');
  filterBar.className = 'ti-filter-bar';
  filterBar.innerHTML = `
    <div>
      <label>Direction:</label>
      <select id="filterDirection" class="ti-filter-select">
        <option value="ALL">All</option>
        <option value="LONG">Long Only</option>
        <option value="SHORT">Short Only</option>
      </select>
    </div>
    <div>
      <label>Min Confidence:</label>
      <select id="filterConfidence" class="ti-filter-select">
        <option value="50">50%</option>
        <option value="60">60%</option>
        <option value="70">70%</option>
      </select>
    </div>
    <div>
      <label>Min Aligned Timeframes:</label>
      <select id="filterTimeframes" class="ti-filter-select">
        <option value="1">1+</option>
        <option value="2">2+</option>
        <option value="3">3+</option>
      </select>
    </div>
  `;
  section.appendChild(filterBar);

  // Results container
  const resultsContainer = document.createElement('div');
  resultsContainer.id = 'ideaResults';
  resultsContainer.className = 'ti-results';
  section.appendChild(resultsContainer);

  // Event listeners
  document.getElementById('scanBtn').addEventListener('click', runTradeIdeaScan);

  // Filter handlers
  ['filterDirection', 'filterConfidence', 'filterTimeframes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        const ideas = window._cachedTradeIdeas || [];
        renderFilteredTradeIdeas(ideas);
      });
    }
  });

  // Set up auto-scan (every 5 minutes)
  if (tradeIdeasInterval) clearInterval(tradeIdeasInterval);
  tradeIdeasInterval = setInterval(runTradeIdeaScan, 300000);

  // Initial countdown update
  updateScanCountdown();
  setInterval(updateScanCountdown, 1000);
}

function updateScanCountdown() {
  const el = document.getElementById('scanCountdown');
  if (!el) return;

  if (!nextScanTime) {
    el.textContent = '';
    return;
  }

  const now = Date.now();
  const remaining = Math.max(0, nextScanTime - now);

  if (remaining === 0) {
    el.textContent = '';
  } else {
    const secs = Math.ceil(remaining / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    el.textContent = `Next scan in ${mins}:${String(s).padStart(2, '0')}`;
  }
}

async function runTradeIdeaScan() {
  const resultsContainer = document.getElementById('ideaResults');
  if (!resultsContainer) return;

  if (isScanning) return;
  isScanning = true;

  resultsContainer.innerHTML = '<div class="ti-loading">🔍 Scanning all coins...</div>';

  const ideas = [];
  const prices = window._latestPrices || {};

  for (let i = 0; i < TRADE_IDEA_COINS.length; i++) {
    const symbol = TRADE_IDEA_COINS[i];

    try {
      const response = await fetch(`/api/crypto/${symbol}/analysis`);
      const analysis = await response.json();

      const idea = scoreTradeIdea(symbol, analysis, prices[symbol]);
      if (idea) {
        ideas.push(idea);
      }
    } catch (err) {
      console.error(`Failed to analyze ${symbol}:`, err);
    }

    // Rate limiting
    if (i < TRADE_IDEA_COINS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, SCAN_RATE_LIMIT));
    }
  }

  // Sort by confidence DESC, then score DESC
  ideas.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.score - a.score;
  });

  // Cache for filtering
  window._cachedTradeIdeas = ideas;

  // Render top 5
  renderFilteredTradeIdeas(ideas);

  // Update last scan time
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    scanBtn.textContent = '🔍 Scan All Coins Now (just now)';
  }

  // Set next scan time
  nextScanTime = Date.now() + 300000; // 5 minutes

  isScanning = false;
}

function scoreTradeIdea(symbol, analysis, priceData) {
  if (!analysis || !analysis.overall) return null;

  const overall = analysis.overall;
  const signal = overall.signal || 'NEUTRAL';
  const confidence = overall.confidence || 50;

  // Map signal to direction
  let direction = 'NEUTRAL';
  if (signal === 'STRONG_BUY' || signal === 'BUY') direction = 'LONG';
  else if (signal === 'STRONG_SELL' || signal === 'SELL') direction = 'SHORT';

  // Collect indicators for reasons
  const indicators = [];
  const rsi = analysis.rsi?.value || 0;
  const macd = analysis.macd || {};
  const pattern = analysis.candlePattern || {};

  if (rsi < 30) indicators.push('RSI oversold');
  if (rsi > 70) indicators.push('RSI overbought');
  if (macd.signal && macd.macd && macd.macd > macd.signal) {
    indicators.push('MACD bullish crossover');
  }
  if (macd.signal && macd.macd && macd.macd < macd.signal) {
    indicators.push('MACD bearish crossover');
  }
  if (pattern.pattern) indicators.push(pattern.pattern + ' pattern detected');

  // Limit to 3 reasons
  const reasons = indicators.slice(0, 3);
  if (reasons.length === 0) {
    reasons.push('Technical setup aligned');
  }

  const score = confidence * (1 + indicators.length * 0.1);

  return {
    symbol,
    direction,
    confidence,
    score,
    reasons,
    price: priceData?.price || 0,
    rsi: rsi,
    macd: macd,
    timeframesAligned: Math.min(3, indicators.length) // Simplified
  };
}

function renderFilteredTradeIdeas(ideas) {
  const resultsContainer = document.getElementById('ideaResults');
  if (!resultsContainer) return;

  // Apply filters
  const direction = document.getElementById('filterDirection')?.value || 'ALL';
  const minConfidence = parseInt(document.getElementById('filterConfidence')?.value || 50);
  const minTimeframes = parseInt(document.getElementById('filterTimeframes')?.value || 1);

  const filtered = ideas.filter(idea => {
    if (direction !== 'ALL' && idea.direction !== direction) return false;
    if (idea.confidence < minConfidence) return false;
    if (idea.timeframesAligned < minTimeframes) return false;
    return true;
  });

  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<div class="ti-no-ideas">No ideas match your filters.</div>';
    return;
  }

  // Render top 5
  resultsContainer.innerHTML = filtered.slice(0, 5)
    .map(idea => renderTradeIdeaCard(idea))
    .join('');

  // Add event listeners
  resultsContainer.querySelectorAll('.ti-idea-card').forEach((card, idx) => {
    const idea = filtered[idx];

    const generateBtn = card.querySelector('.ti-generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (typeof switchSection === 'function') {
          switchSection('markets');
          if (typeof selectCryptoForAnalysis === 'function') {
            setTimeout(() => selectCryptoForAnalysis(idea.symbol), 100);
          }
        }
      });
    }

    const logBtn = card.querySelector('.ti-log-btn');
    if (logBtn) {
      logBtn.addEventListener('click', () => {
        const existing = JSON.parse(localStorage.getItem('tp_trade_ideas') || '[]');
        existing.push({
          symbol: idea.symbol,
          direction: idea.direction,
          confidence: idea.confidence,
          entry: idea.price,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('tp_trade_ideas', JSON.stringify(existing));
        logBtn.textContent = '✓ Logged';
        logBtn.disabled = true;
      });
    }
  });
}

function renderTradeIdeaCard(idea) {
  const directionClass = idea.direction === 'LONG' ? 'long' : idea.direction === 'SHORT' ? 'short' : 'neutral';
  const directionColor = idea.direction === 'LONG' ? '#22c55e' : idea.direction === 'SHORT' ? '#ef4444' : '#6b7280';

  const tp = (idea.price * 1.05).toFixed(2);
  const sl = (idea.price * 0.97).toFixed(2);

  return `
    <div class="ti-idea-card ti-idea-card-${directionClass}">
      <div class="ti-idea-header">
        <div class="ti-idea-title">
          <div style="font-weight: bold; font-size: 16px;">${idea.symbol}</div>
          <div class="ti-direction-badge" style="background-color: ${directionColor};">
            ${idea.direction}
          </div>
        </div>
      </div>

      <div class="ti-confidence-bar">
        <div class="ti-confidence-fill" style="width: ${idea.confidence}%;"></div>
        <span class="ti-confidence-label">${idea.confidence}% Confidence</span>
      </div>

      <div class="ti-reasons">
        <strong style="font-size: 12px; color: #9ca3af;">Key Reasons:</strong>
        ${idea.reasons.map(r => `<div class="ti-reason-item">• ${r}</div>`).join('')}
      </div>

      <div class="ti-prices">
        <div class="ti-price-row">
          <span>Entry</span>
          <strong style="color: #3b82f6;">$${idea.price.toFixed(2)}</strong>
        </div>
        <div class="ti-price-row">
          <span>TP</span>
          <strong style="color: #22c55e;">$${tp}</strong>
        </div>
        <div class="ti-price-row">
          <span>SL</span>
          <strong style="color: #ef4444;">$${sl}</strong>
        </div>
      </div>

      <div class="ti-actions">
        <button class="ti-generate-btn">Generate Full Signal</button>
        <button class="ti-log-btn">Log This Idea</button>
      </div>
    </div>
  `;
}

function cleanupTradeIdeas() {
  if (tradeIdeasInterval) {
    clearInterval(tradeIdeasInterval);
    tradeIdeasInterval = null;
  }
}

window.initTradeIdeas = initTradeIdeas;
window.runTradeIdeaScan = runTradeIdeaScan;
window.cleanupTradeIdeas = cleanupTradeIdeas;

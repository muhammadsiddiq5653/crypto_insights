/**
 * tickerBar.js - Live price ticker bar
 * Shows a scrolling marquee of top 10 cryptocurrencies at the top of the page
 */

const TICKER_COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'MATIC'];
const TICKER_UPDATE_INTERVAL = 30000; // 30 seconds
let tickerInterval = null;

function initTickerBar() {
  // Create ticker bar container
  const tickerBar = document.createElement('div');
  tickerBar.id = 'tickerBar';
  tickerBar.className = 'ticker-bar';

  // Create track for scrolling
  const tickerTrack = document.createElement('div');
  tickerTrack.className = 'ticker-track';

  // Render ticker items (duplicated for seamless loop)
  const tickerContent = document.createElement('div');
  tickerContent.className = 'ticker-content';

  // Render coins twice for seamless scroll
  for (let repeat = 0; repeat < 2; repeat++) {
    TICKER_COINS.forEach((coin, index) => {
      const item = document.createElement('div');
      item.className = 'ticker-item';
      item.dataset.symbol = coin;
      item.innerHTML = `
        <span class="ticker-symbol">${coin}</span>
        <span class="ticker-price">$0.00</span>
        <span class="ticker-change">▲ 0.00%</span>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        if (typeof switchSection === 'function') {
          switchSection('markets');
          if (typeof selectCryptoForAnalysis === 'function') {
            setTimeout(() => selectCryptoForAnalysis(coin), 100);
          }
        }
      });
      tickerContent.appendChild(item);

      // Add separator (except after last item of first set)
      if (repeat === 0 && index < TICKER_COINS.length - 1) {
        const sep = document.createElement('div');
        sep.className = 'ticker-sep';
        sep.textContent = '|';
        tickerContent.appendChild(sep);
      }
    });
  }

  tickerTrack.appendChild(tickerContent);
  tickerBar.appendChild(tickerTrack);

  // Inject as first child of body
  document.body.insertBefore(tickerBar, document.body.firstChild);

  // Adjust body padding-top to account for ticker height
  const tickerHeight = 44;
  document.body.style.paddingTop = tickerHeight + 'px';

  // Initial fetch and setup interval
  updateTicker();
  tickerInterval = setInterval(updateTicker, TICKER_UPDATE_INTERVAL);
}

function updateTicker() {
  fetch('/api/crypto/prices')
    .then(res => res.json())
    .then(data => {
      // Store latest prices globally for use by other modules
      window._latestPrices = data;

      // Update all ticker items
      const items = document.querySelectorAll('.ticker-item');
      items.forEach(item => {
        const symbol = item.dataset.symbol;
        const coinData = data[symbol];

        if (coinData) {
          const priceEl = item.querySelector('.ticker-price');
          const changeEl = item.querySelector('.ticker-change');
          const change = coinData.change24h || 0;

          // Format price with commas
          const price = coinData.price || 0;
          priceEl.textContent = '$' + price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });

          // Update change with color and direction
          const changeAbs = Math.abs(change).toFixed(2);
          const arrow = change >= 0 ? '▲' : '▼';
          changeEl.textContent = arrow + ' ' + changeAbs + '%';

          // Remove old classes
          item.classList.remove('up', 'down');

          // Add new class based on direction
          if (change > 0) {
            item.classList.add('up');
          } else if (change < 0) {
            item.classList.add('down');
          }
        }
      });
    })
    .catch(err => console.error('Ticker update failed:', err));
}

function cleanupTickerBar() {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}

// Export for use
window.initTickerBar = initTickerBar;
window.updateTicker = updateTicker;
window.cleanupTickerBar = cleanupTickerBar;

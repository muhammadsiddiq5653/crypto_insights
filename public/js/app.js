// Main Application Logic

// Application state
const state = {
    cryptocurrencies: [],
    selectedCrypto: null,
    currentSection: 'dashboard',
    updateInterval: null
};

// Initialize application
async function initApp() {
    console.log('🚀 Initializing Crypto Trading Portal...');

    try {
        // Load cryptocurrencies list
        await loadCryptocurrencies();

        // Load initial data
        await loadDashboard();

        // Setup navigation
        setupNavigation();

        // Setup crypto selector
        setupCryptoSelector();

        // Setup news filter
        setupNewsFilter();

        // Setup coin search
        setupCoinSearch();

        // Setup futures selector
        setupFuturesSelector();

        // Start auto-update
        startAutoUpdate();

        // Update last update time
        updateLastUpdateTime();

        console.log('✅ Application initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        showError('marketOverview', 'Failed to load application. Please refresh the page.');
    }
}

// Load list of cryptocurrencies
async function loadCryptocurrencies() {
    try {
        const cryptos = await apiRequest('/api/cryptocurrencies');
        state.cryptocurrencies = cryptos;

        // Populate crypto selector
        populateCryptoSelector(cryptos);

        // Populate news filter
        populateNewsFilter(cryptos);

        return cryptos;
    } catch (error) {
        console.error('Error loading cryptocurrencies:', error);
        throw error;
    }
}

// Load dashboard with market overview
async function loadDashboard() {
    const container = document.getElementById('marketOverview');
    showLoading(container);

    try {
        const prices = await apiRequest('/api/crypto/prices');

        let html = '';
        prices.forEach(crypto => {
            html += createMarketCard(crypto);
        });

        container.innerHTML = html;

        // Also update sidebar crypto list
        updateSidebarCryptoList(prices);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showError(container, 'Failed to load market data. Please try again.');
    }
}

// Create market card for dashboard
function createMarketCard(crypto) {
    const changeClass = getChangeClass(crypto.change24h);

    return `
    <div class="market-card" data-symbol="${crypto.symbol}">
      <div class="market-card-header">
        <div class="market-card-title">
          <div class="market-card-name">${escapeHtml(crypto.name)}</div>
          <div class="market-card-symbol">${escapeHtml(crypto.symbol)}</div>
        </div>
        <div class="market-card-change ${changeClass}">
          ${formatPercentage(crypto.change24h)}
        </div>
      </div>
      
      <div class="market-card-price">
        ${formatCurrency(crypto.price)}
      </div>
      
      <div class="market-card-stats">
        <div class="stat">
          <div class="stat-label">Market Cap</div>
          <div class="stat-value">${formatLargeNumber(crypto.marketCap)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">24h Volume</div>
          <div class="stat-value">${formatLargeNumber(crypto.volume24h)}</div>
        </div>
      </div>
    </div>
  `;
}

// Update sidebar crypto list
function updateSidebarCryptoList(prices) {
    const container = document.getElementById('cryptoList');
    if (!container) return;

    let html = '';
    prices.slice(0, 10).forEach(crypto => {
        const changeClass = getChangeClass(crypto.change24h);
        html += `
      <div class="crypto-item" data-symbol="${crypto.symbol}">
        <div class="crypto-item-header">
          <span class="crypto-name">${escapeHtml(crypto.name)}</span>
          <span class="crypto-price">${formatCurrency(crypto.price)}</span>
        </div>
        <div class="crypto-item-header">
          <span class="crypto-symbol">${escapeHtml(crypto.symbol)}</span>
          <span class="crypto-change ${changeClass}">${formatPercentage(crypto.change24h)}</span>
        </div>
      </div>
    `;
    });

    container.innerHTML = html;

    // Add click handlers
    const items = container.querySelectorAll('.crypto-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const symbol = item.dataset.symbol;
            selectCryptoForAnalysis(symbol);
        });
    });
}

// Setup navigation between sections
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// Switch between sections
function switchSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));

    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        state.currentSection = sectionName;

        // Load section-specific data
        if (sectionName === 'news' && !document.getElementById('newsContent').querySelector('.news-card')) {
            displayNews();
        }
    }
}

// Setup crypto selector for analysis
function setupCryptoSelector() {
    const selector = document.getElementById('cryptoSelector');
    if (!selector) return;

    selector.addEventListener('change', (e) => {
        const symbol = e.target.value;
        if (symbol) {
            displayAnalysis(symbol);
        }
    });
}

// Populate crypto selector dropdown
function populateCryptoSelector(cryptocurrencies) {
    const selector = document.getElementById('cryptoSelector');
    if (!selector) return;

    let html = '<option value="">Select a cryptocurrency...</option>';
    cryptocurrencies.forEach(crypto => {
        html += `<option value="${crypto.symbol}">${crypto.name} (${crypto.symbol})</option>`;
    });

    selector.innerHTML = html;
}

// Select a crypto for analysis (from dashboard or sidebar)
function selectCryptoForAnalysis(symbol) {
    // Switch to analysis section
    switchSection('analysis');

    // Update nav
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('[data-section="analysis"]').classList.add('active');

    // Update selector
    const selector = document.getElementById('cryptoSelector');
    if (selector) {
        selector.value = symbol;
    }

    // Load analysis
    displayAnalysis(symbol);
}

// Start auto-update for real-time data
function startAutoUpdate() {
    // Update every 30 seconds
    state.updateInterval = setInterval(async () => {
        if (state.currentSection === 'dashboard') {
            await loadDashboard();
        }
        updateLastUpdateTime();
    }, 30000);
}

// Update last update timestamp
function updateLastUpdateTime() {
    const element = document.getElementById('lastUpdate');
    if (element) {
        const now = new Date();
        element.textContent = `Updated: ${now.toLocaleTimeString()}`;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (state.updateInterval) {
        clearInterval(state.updateInterval);
    }
});

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

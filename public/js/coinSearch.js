// Coin Search and Custom Coin Management

let customCoins = JSON.parse(localStorage.getItem('customCoins') || '[]');

// Show coin search modal
function showCoinSearchModal() {
    const modal = document.getElementById('coinSearchModal');
    const searchInput = document.getElementById('coinSearchInput');

    if (modal && searchInput) {
        modal.style.display = 'flex';
        searchInput.value = '';
        searchInput.focus();
        document.getElementById('searchResults').innerHTML = '';
    }
}

// Hide coin search modal
function hideCoinSearchModal() {
    const modal = document.getElementById('coinSearchModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Search for coins
async function searchCoins(query) {
    if (!query || query.length < 2) {
        return;
    }

    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

    try {
        const results = await apiRequest(`/api/search/coins?query=${encodeURIComponent(query)}`);

        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No cryptocurrencies found</div>';
            return;
        }

        let html = '<div class="search-results-list">';
        results.forEach(coin => {
            const isAdded = customCoins.some(c => c.id === coin.id);
            html += `
        <div class="search-result-item" data-coin-id="${coin.id}">
          <div class="search-result-info">
            <img src="${coin.thumb}" alt="${coin.name}" class="coin-thumb" />
            <div>
              <div class="search-result-name">${escapeHtml(coin.name)}</div>
              <div class="search-result-symbol">${escapeHtml(coin.symbol)}</div>
            </div>
          </div>
          <button class="add-coin-btn ${isAdded ? 'added' : ''}" 
                  data-coin='${JSON.stringify(coin)}'
                  ${isAdded ? 'disabled' : ''}>
            ${isAdded ? '✓ Added' : '+ Add'}
          </button>
        </div>
      `;
        });
        html += '</div>';

        resultsContainer.innerHTML = html;

        // Add click handlers
        const addButtons = resultsContainer.querySelectorAll('.add-coin-btn:not(.added)');
        addButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const coin = JSON.parse(btn.dataset.coin);
                addCustomCoin(coin);
                btn.classList.add('added');
                btn.disabled = true;
                btn.textContent = '✓ Added';
            });
        });

    } catch (error) {
        console.error('Error searching coins:', error);
        resultsContainer.innerHTML = '<div class="error-message">Failed to search. Please try again.</div>';
    }
}

// Add custom coin
function addCustomCoin(coin) {
    // Check if already added
    if (customCoins.some(c => c.id === coin.id)) {
        return;
    }

    customCoins.push({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name
    });

    // Save to localStorage
    localStorage.setItem('customCoins', JSON.stringify(customCoins));

    // Update selectors
    updateCryptoSelectors();

    console.log(`Added ${coin.name} to custom coins`);
}

// Update crypto selectors with custom coins
function updateCryptoSelectors() {
    const selector = document.getElementById('cryptoSelector');
    const futuresSelector = document.getElementById('futuresSelector');

    if (!selector) return;

    // Get current cryptocurrencies
    const allCryptos = [...state.cryptocurrencies, ...customCoins];

    // Update analysis selector
    let html = '<option value="">Select a cryptocurrency...</option>';
    allCryptos.forEach(crypto => {
        html += `<option value="${crypto.symbol}">${crypto.name} (${crypto.symbol})</option>`;
    });
    selector.innerHTML = html;

    // Update futures selector
    if (futuresSelector) {
        futuresSelector.innerHTML = html;
    }
}

// Setup coin search
function setupCoinSearch() {
    const searchBtn = document.getElementById('searchCoinBtn');
    const closeBtn = document.getElementById('closeSearchModal');
    const searchInput = document.getElementById('coinSearchInput');
    const modal = document.getElementById('coinSearchModal');

    if (searchBtn) {
        searchBtn.addEventListener('click', showCoinSearchModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', hideCoinSearchModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideCoinSearchModal();
            }
        });
    }

    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchCoins(e.target.value);
            }, 500);
        });
    }
}

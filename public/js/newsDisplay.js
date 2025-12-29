// News Display - Shows crypto news with sentiment analysis

let currentNewsFilter = '';

// Display news articles
async function displayNews(symbol = '') {
    const container = document.getElementById('newsContent');
    showLoading(container);

    currentNewsFilter = symbol;

    try {
        const endpoint = symbol ? `/api/news?symbol=${symbol}` : '/api/news';
        const news = await apiRequest(endpoint);

        if (!news || news.length === 0) {
            container.innerHTML = `
        <div class="info-message">
          <span class="info-icon">📰</span>
          <p>No news articles found${symbol ? ' for ' + symbol : ''}. Check back later!</p>
        </div>
      `;
            return;
        }

        let html = '';
        news.forEach(article => {
            html += createNewsCard(article);
        });

        container.innerHTML = html;

        // Add click handlers to open links
        setupNewsCardListeners();

    } catch (error) {
        console.error('Error displaying news:', error);
        showError(container, 'Failed to load news. Please try again.');
    }
}

// Create news card HTML
function createNewsCard(article) {
    const sentimentClass = article.sentiment || 'neutral';
    const sentimentIcon = article.sentimentIcon || '➖';

    return `
    <div class="news-card ${sentimentClass}" data-link="${escapeHtml(article.link)}">
      <div class="news-header">
        <span class="news-sentiment" title="${sentimentClass}">${sentimentIcon}</span>
        <div class="news-meta">
          <span>${escapeHtml(article.source)}</span>
          <span>•</span>
          <span>${formatDate(article.pubDate)}</span>
        </div>
      </div>
      
      <h3 class="news-title">${escapeHtml(article.title)}</h3>
      
      ${article.description ? `
        <p class="news-description">${escapeHtml(article.description)}</p>
      ` : ''}
      
      ${article.cryptoMentions && article.cryptoMentions.length > 0 ? `
        <div class="news-tags">
          ${article.cryptoMentions.map(crypto =>
        `<span class="news-tag">${escapeHtml(crypto)}</span>`
    ).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Setup click listeners for news cards
function setupNewsCardListeners() {
    const newsCards = document.querySelectorAll('.news-card');
    newsCards.forEach(card => {
        card.addEventListener('click', () => {
            const link = card.dataset.link;
            if (link && link !== 'undefined') {
                window.open(link, '_blank', 'noopener,noreferrer');
            }
        });
    });
}

// Setup news filter
function setupNewsFilter() {
    const filter = document.getElementById('newsFilter');
    if (!filter) return;

    filter.addEventListener('change', (e) => {
        const symbol = e.target.value;
        displayNews(symbol);
    });
}

// Populate news filter with cryptocurrencies
function populateNewsFilter(cryptocurrencies) {
    const filter = document.getElementById('newsFilter');
    if (!filter) return;

    let html = '<option value="">All Cryptocurrencies</option>';
    cryptocurrencies.forEach(crypto => {
        html += `<option value="${crypto.symbol}">${crypto.name} (${crypto.symbol})</option>`;
    });

    filter.innerHTML = html;
}

// TraderPro Service Worker — PWA Support
// Enables offline fallback and install-to-homescreen

const CACHE_NAME = 'traderpro-v2';
const STATIC_ASSETS = [
    '/',
    '/css/index.css',
    '/js/utils.js',
    '/js/chartManager.js',
    '/js/analysisDisplay.js',
    '/js/newsDisplay.js',
    '/js/coinSearch.js',
    '/js/futuresDisplay.js',
    '/js/portfolio.js',
    '/js/glossary.js',
    '/js/watchlist.js',
    '/js/paperTrading.js',
    '/js/economicCalendar.js',
    '/js/screener.js',
    '/js/tradeJournal.js',
    '/js/universalSearch.js',
    '/js/backtest.js',
    '/js/newsSentiment.js',
    '/js/signalEngine.js',
    '/js/academy.js',
    '/js/exchanges.js',
    '/js/tickerBar.js',
    '/js/dashboardWidgets.js',
    '/js/tradeIdeas.js',
    '/js/screenerV2.js',
    '/js/paperTradingV2.js',
    '/js/exportCenter.js',
    '/js/mtf.js',
    '/js/correlation.js',
    '/js/aiCoach.js',
    '/js/taxCalc.js',
    '/js/payoffChart.js',
    '/js/sentiment.js',
    '/js/portfolioAnalytics.js',
    '/js/smartAlerts.js',
    '/js/app.js',
    '/manifest.json'
];

// Install: cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[SW] Some assets failed to cache:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => {
                    console.log('[SW] Removing old cache:', k);
                    return caches.delete(k);
                })
            )
        )
    );
    self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API calls: network first, no cache (live data must be fresh)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({
                    success: false,
                    error: 'You are offline. Please reconnect for live data.',
                    offline: true
                }), { headers: { 'Content-Type': 'application/json' } })
            )
        );
        return;
    }

    // Static assets: cache first, then network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cache successful GET responses
                if (event.request.method === 'GET' && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
            });
        })
    );
});

// Push notifications (future use)
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    self.registration.showNotification(data.title || 'TraderPro', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png'
    });
});

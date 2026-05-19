// Chart Manager — lightweight-charts candlestick (primary) + Chart.js line (fallback)

let lwChart = null;
let lwCandleSeries = null;
let lwVolumeSeries = null;
let lwChartContainer = null;

let priceChart = null; // Chart.js fallback
let currentTimeframe = '7';

// ── LIGHTWEIGHT-CHARTS (candlestick) ─────────────────────────────────

function initLwChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container || typeof LightweightCharts === 'undefined') return false;

    lwChartContainer = container;
    container.innerHTML = '';

    const chartHeight = container.clientHeight || 340;

    lwChart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: chartHeight,
        layout: {
            background: { color: 'transparent' },
            textColor: '#6b7394',
        },
        grid: {
            vertLines: { color: 'rgba(102, 126, 234, 0.08)' },
            horzLines: { color: 'rgba(102, 126, 234, 0.08)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(102, 126, 234, 0.2)',
            scaleMargins: { top: 0.08, bottom: 0.25 },
        },
        timeScale: {
            borderColor: 'rgba(102, 126, 234, 0.2)',
            timeVisible: true,
            secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
    });

    lwCandleSeries = lwChart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    lwVolumeSeries = lwChart.addHistogramSeries({
        color: 'rgba(102, 126, 234, 0.3)',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        scaleMargins: { top: 0.8, bottom: 0 },
    });
    lwChart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // Resize observer
    const ro = new ResizeObserver(() => {
        if (lwChart && lwChartContainer) {
            lwChart.applyOptions({ width: lwChartContainer.clientWidth });
        }
    });
    ro.observe(container);

    return true;
}

function updateLwChart(ohlcvData) {
    if (!lwCandleSeries || !ohlcvData || !ohlcvData.length) return;

    const candles = ohlcvData.map(d => ({
        time: Math.floor(d.time / 1000),
        open:  d.open,
        high:  d.high,
        low:   d.low,
        close: d.close,
    })).sort((a, b) => a.time - b.time);

    const volumes = ohlcvData.map(d => ({
        time:  Math.floor(d.time / 1000),
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.3)',
    })).sort((a, b) => a.time - b.time);

    lwCandleSeries.setData(candles);
    lwVolumeSeries.setData(volumes);
    lwChart.timeScale().fitContent();
}

function destroyLwChart() {
    if (lwChart) {
        lwChart.remove();
        lwChart = null;
        lwCandleSeries = null;
        lwVolumeSeries = null;
    }
}

// ── CHART.JS LINE CHART (fallback / portfolio views) ─────────────────

function initChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price (USD)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#667eea',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e2442',
                    titleColor: '#e4e7f1',
                    bodyColor: '#a0a8c1',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: ctx => 'Price: ' + formatCurrency(ctx.parsed.y),
                        title: ctx => formatDateTime(ctx[0].parsed.x),
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                    grid: { color: 'rgba(102, 126, 234, 0.1)', drawBorder: false },
                    ticks: { color: '#6b7394', maxRotation: 0 }
                },
                y: {
                    grid: { color: 'rgba(102, 126, 234, 0.1)', drawBorder: false },
                    ticks: { color: '#6b7394', callback: v => formatCurrency(v) }
                }
            }
        }
    });
}

function updateChart(chart, historicalData) {
    if (!chart || !historicalData || !historicalData.prices) return;

    const labels = historicalData.prices.map(p => new Date(p.timestamp));
    const prices = historicalData.prices.map(p => p.price);

    chart.data.labels = labels;
    chart.data.datasets[0].data = prices;

    const daysDiff = (labels[labels.length - 1] - labels[0]) / 86400000;
    chart.options.scales.x.time.unit = daysDiff <= 1 ? 'hour' : daysDiff <= 60 ? 'day' : 'week';

    chart.update('none');
}

// ── SHARED CONTAINER HTML ─────────────────────────────────────────────

function createChartContainer(symbol) {
    return `
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="chart-title">${symbol} Price Chart</h3>
        <div class="chart-type-toggle" style="display:flex;gap:6px;align-items:center;">
          <button class="timeframe-btn chart-type-btn active" data-type="candle" title="Candlestick">🕯</button>
          <button class="timeframe-btn chart-type-btn" data-type="line" title="Line">📈</button>
        </div>
        <div class="timeframe-buttons">
          <button class="timeframe-btn ${currentTimeframe === '1'  ? 'active' : ''}" data-days="1">24H</button>
          <button class="timeframe-btn ${currentTimeframe === '7'  ? 'active' : ''}" data-days="7">7D</button>
          <button class="timeframe-btn ${currentTimeframe === '30' ? 'active' : ''}" data-days="30">30D</button>
          <button class="timeframe-btn ${currentTimeframe === '90' ? 'active' : ''}" data-days="90">90D</button>
        </div>
      </div>
      <div id="lwChartContainer" style="height:340px;position:relative;"></div>
      <div style="height:340px;position:relative;display:none;"><canvas id="priceChart"></canvas></div>
    </div>
  `;
}

// ── MAIN LOAD FUNCTION ────────────────────────────────────────────────

let _currentChartSymbol = null;
let _currentChartType = 'candle'; // 'candle' | 'line'

async function loadChart(symbol, days = 7) {
    currentTimeframe = days.toString();
    _currentChartSymbol = symbol;

    try {
        const historicalData = await apiRequest(`/api/crypto/${symbol}/history?days=${days}`);

        destroyLwChart();
        if (priceChart) { priceChart.destroy(); priceChart = null; }

        await new Promise(r => setTimeout(r, 80));

        if (_currentChartType === 'candle' && typeof LightweightCharts !== 'undefined') {
            const lwWrap = document.getElementById('lwChartContainer');
            const lineWrap = lwWrap && lwWrap.nextElementSibling;
            if (lwWrap)   lwWrap.style.display = 'block';
            if (lineWrap) lineWrap.style.display = 'none';

            if (initLwChart('lwChartContainer')) {
                // Convert price-only history to synthetic OHLCV if no OHLCV available
                const ohlcv = _buildOhlcvFromHistory(historicalData);
                updateLwChart(ohlcv);
            }
        } else {
            const lwWrap = document.getElementById('lwChartContainer');
            const lineWrap = lwWrap && lwWrap.nextElementSibling;
            if (lwWrap)   lwWrap.style.display = 'none';
            if (lineWrap) lineWrap.style.display = 'block';

            priceChart = initChart('priceChart');
            if (priceChart) updateChart(priceChart, historicalData);
        }
    } catch (error) {
        console.error('Error loading chart:', error);
        showError('analysisContent', 'Failed to load price chart. Please try again.');
    }
}

// Build synthetic OHLCV bars from price-only history (groups into ~daily bars)
function _buildOhlcvFromHistory(historicalData) {
    if (!historicalData || !historicalData.prices) return [];

    const prices = historicalData.prices;
    if (!prices.length) return [];

    // Group into buckets (target ~100 bars regardless of timeframe)
    const bucketMs = Math.max(
        Math.floor((prices[prices.length - 1].timestamp - prices[0].timestamp) / 100),
        60000
    );

    const buckets = {};
    for (const p of prices) {
        const key = Math.floor(p.timestamp / bucketMs) * bucketMs;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(p.price);
    }

    return Object.entries(buckets).map(([ts, pts]) => ({
        time:   Number(ts),
        open:   pts[0],
        high:   Math.max(...pts),
        low:    Math.min(...pts),
        close:  pts[pts.length - 1],
        volume: 0,
    })).sort((a, b) => a.time - b.time);
}

// ── BUTTON SETUP ──────────────────────────────────────────────────────

function setupTimeframeButtons(symbol) {
    document.querySelectorAll('.timeframe-btn[data-days]').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.timeframe-btn[data-days]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            await loadChart(symbol, btn.dataset.days);
        });
    });

    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _currentChartType = btn.dataset.type;
            if (_currentChartSymbol) await loadChart(_currentChartSymbol, currentTimeframe);
        });
    });
}

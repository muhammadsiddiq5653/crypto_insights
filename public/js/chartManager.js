// Chart Manager for displaying price charts with Chart.js

let priceChart = null;
let currentTimeframe = '7';

// Initialize chart
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
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e2442',
                    titleColor: '#e4e7f1',
                    bodyColor: '#a0a8c1',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return 'Price: ' + formatCurrency(context.parsed.y);
                        },
                        title: function (context) {
                            return formatDateTime(context[0].parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM d'
                        }
                    },
                    grid: {
                        color: 'rgba(102, 126, 234, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7394',
                        maxRotation: 0
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(102, 126, 234, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7394',
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update chart with new data
function updateChart(chart, historicalData) {
    if (!chart || !historicalData || !historicalData.prices) return;

    const labels = historicalData.prices.map(p => new Date(p.timestamp));
    const prices = historicalData.prices.map(p => p.price);

    chart.data.labels = labels;
    chart.data.datasets[0].data = prices;

    // Update time unit based on data range
    const daysDiff = (labels[labels.length - 1] - labels[0]) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 1) {
        chart.options.scales.x.time.unit = 'hour';
    } else if (daysDiff <= 7) {
        chart.options.scales.x.time.unit = 'day';
    } else if (daysDiff <= 30) {
        chart.options.scales.x.time.unit = 'day';
    } else {
        chart.options.scales.x.time.unit = 'week';
    }

    chart.update('none'); // Update without animation for better performance
}

// Create chart container HTML
function createChartContainer(symbol) {
    return `
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="chart-title">${symbol} Price Chart</h3>
        <div class="timeframe-buttons">
          <button class="timeframe-btn ${currentTimeframe === '1' ? 'active' : ''}" data-days="1">24H</button>
          <button class="timeframe-btn ${currentTimeframe === '7' ? 'active' : ''}" data-days="7">7D</button>
          <button class="timeframe-btn ${currentTimeframe === '30' ? 'active' : ''}" data-days="30">30D</button>
          <button class="timeframe-btn ${currentTimeframe === '90' ? 'active' : ''}" data-days="90">90D</button>
        </div>
      </div>
      <div style="height: 400px; position: relative;">
        <canvas id="priceChart"></canvas>
      </div>
    </div>
  `;
}

// Load and display chart for a cryptocurrency
async function loadChart(symbol, days = 7) {
    currentTimeframe = days.toString();

    try {
        const historicalData = await apiRequest(`/api/crypto/${symbol}/history?days=${days}`);

        // Destroy existing chart if it exists
        if (priceChart) {
            priceChart.destroy();
            priceChart = null;
        }

        // Wait for DOM to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize new chart
        priceChart = initChart('priceChart');

        if (priceChart) {
            updateChart(priceChart, historicalData);
        }
    } catch (error) {
        console.error('Error loading chart:', error);
        showError('analysisContent', 'Failed to load price chart. Please try again.');
    }
}

// Setup timeframe button listeners
function setupTimeframeButtons(symbol) {
    const buttons = document.querySelectorAll('.timeframe-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const days = btn.dataset.days;

            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Reload chart
            await loadChart(symbol, days);
        });
    });
}

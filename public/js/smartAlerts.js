/**
 * Smart Alerts Center
 * Enhanced price alerts with multiple trigger types, unified feed, and notifications
 */

let alertsState = {
  alerts: [],
  feed: [],
  monitorInterval: null
};

const ALERT_TYPES = {
  PRICE_ABOVE: 'Price Above',
  PRICE_BELOW: 'Price Below',
  RSI_OVERSOLD: 'RSI Oversold (< 30)',
  RSI_OVERBOUGHT: 'RSI Overbought (> 70)',
  RSI_BELOW_CUSTOM: 'RSI Below Custom',
  RSI_ABOVE_CUSTOM: 'RSI Above Custom',
  MACD_BULLISH: 'MACD Bullish Crossover',
  MACD_BEARISH: 'MACD Bearish Crossover',
  VOLUME_SPIKE: 'Volume Spike (> 2x)',
  PRICE_CHANGE_24H: 'Price Change % (24h)',
  SIGNAL_GENERATED: 'Signal Generated'
};

const COIN_EMOJIS = {
  'BTC': '₿',
  'ETH': 'Ξ',
  'ADA': '₳',
  'XRP': '✕',
  'DOT': '◆'
};

function initSmartAlerts() {
  loadAlertsFromStorage();
  requestNotificationPermission();
  renderSmartAlerts();
  setupMonitoring();
}

function loadAlertsFromStorage() {
  const saved = localStorage.getItem('tp_smart_alerts');
  const feedSaved = localStorage.getItem('tp_alerts_feed');

  if (saved) {
    try {
      alertsState.alerts = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load alerts:', e);
      alertsState.alerts = [];
    }
  }

  if (feedSaved) {
    try {
      alertsState.feed = JSON.parse(feedSaved);
    } catch (e) {
      console.error('Failed to load feed:', e);
      alertsState.feed = [];
    }
  }
}

function saveAlertsToStorage() {
  localStorage.setItem('tp_smart_alerts', JSON.stringify(alertsState.alerts));
  localStorage.setItem('tp_alerts_feed', JSON.stringify(alertsState.feed));
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function renderSmartAlerts() {
  const container = document.getElementById('smart-alerts');
  if (!container) {
    console.error('smart-alerts container not found');
    return;
  }

  container.innerHTML = `
    <div class="sa-container">
      ${renderStatsBar()}
      ${renderAlertsFeed()}
      ${renderCreateAlertForm()}
      ${renderQuickAlerts()}
      ${renderActiveAlertsTable()}
    </div>
  `;

  attachEventListeners();
}

function renderStatsBar() {
  const total = alertsState.alerts.length;
  const active = alertsState.alerts.filter(a => a.active).length;
  const triggeredToday = alertsState.feed.filter(f => {
    const feedDate = new Date(f.timestamp);
    const today = new Date();
    return feedDate.toDateString() === today.toDateString();
  }).length;

  return `
    <div class="sa-stats-bar">
      <div class="sa-stat"><strong>Total</strong> ${total}</div>
      <div class="sa-stat"><strong>Active</strong> ${active}</div>
      <div class="sa-stat"><strong>Triggered Today</strong> ${triggeredToday}</div>
      <div class="sa-stat"><strong>Success Rate</strong> ${total > 0 ? ((triggeredToday / total) * 100).toFixed(1) : 0}%</div>
    </div>
  `;
}

function renderAlertsFeed() {
  const recent = alertsState.feed.slice(-20).reverse();
  const feedHTML = recent.map(item => {
    const time = getTimeAgo(item.timestamp);
    const emoji = COIN_EMOJIS[item.coin] || '◉';
    const priorityClass = item.priority ? item.priority.toLowerCase() : 'medium';
    return `
      <div class="sa-feed-item ${priorityClass}">
        <span class="emoji">${emoji}</span>
        <div class="content">
          <strong>${item.coin} - ${item.type}</strong>
          <p>${item.message}</p>
          <small>${time}</small>
        </div>
        <button class="dismiss-btn" data-feed-id="${item.id}">✕</button>
      </div>
    `;
  }).join('');

  return `
    <div class="sa-feed">
      <h3>Alerts Feed (Last 20)</h3>
      ${recent.length === 0 ? '<p>No alerts triggered yet</p>' : feedHTML}
      ${alertsState.feed.length > 0 ? '<button class="sa-clear-all-btn">Clear All Feed</button>' : ''}
    </div>
  `;
}

function renderCreateAlertForm() {
  const cryptoList = window._cryptoList || ['BTC', 'ETH', 'ADA', 'XRP', 'DOT', 'SOL', 'DOGE'];
  const coinOptions = cryptoList.map(c => `<option value="${c}">${c}</option>`).join('');
  const typeOptions = Object.entries(ALERT_TYPES).map(([key, val]) =>
    `<option value="${key}">${val}</option>`
  ).join('');

  return `
    <div class="sa-form">
      <h3>Create New Alert</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Coin</label>
          <select id="alert-coin" class="sa-input">
            ${coinOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Alert Type</label>
          <select id="alert-type" class="sa-input sa-type-select">
            ${typeOptions}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Value (Price/RSI/%) <span id="value-hint"></span></label>
          <input id="alert-value" type="number" class="sa-input" placeholder="e.g., 45000" step="0.01">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="alert-priority" class="sa-input">
            <option value="Low">Low</option>
            <option value="Medium" selected>Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group full-width">
          <label>Notes (optional)</label>
          <textarea id="alert-notes" class="sa-input" placeholder="Add a note..." rows="2"></textarea>
        </div>
      </div>
      <button id="add-alert-btn" class="sa-btn-primary">Add Alert</button>
    </div>
  `;
}

function renderQuickAlerts() {
  return `
    <div class="sa-quick-alerts">
      <h3>Quick Alerts</h3>
      <div class="sa-quick-btns">
        <button class="sa-quick-btn" data-preset="btc-rsi">BTC RSI Oversold</button>
        <button class="sa-quick-btn" data-preset="eth-drop">ETH Price Drop 5%</button>
        <button class="sa-quick-btn" data-preset="any-signal">Any LONG Signal</button>
      </div>
    </div>
  `;
}

function renderActiveAlertsTable() {
  const rows = alertsState.alerts.map(alert => {
    const status = alert.active ? (alert.triggered ? 'Triggered' : 'Watching') : 'Paused';
    return `
      <tr class="sa-alert-row" data-alert-id="${alert.id}">
        <td>${alert.coin}</td>
        <td>${ALERT_TYPES[alert.type] || alert.type}</td>
        <td>${alert.value || '-'}</td>
        <td><span class="sa-status-badge ${status.toLowerCase()}">${status}</span></td>
        <td>${alert.priority}</td>
        <td>
          <button class="sa-btn-toggle" data-alert-id="${alert.id}">
            ${alert.active ? 'Pause' : 'Resume'}
          </button>
          <button class="sa-btn-edit" data-alert-id="${alert.id}">Edit</button>
          <button class="sa-btn-delete" data-alert-id="${alert.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="sa-alerts-table-wrapper">
      <h3>Active Alerts</h3>
      ${alertsState.alerts.length === 0 ? '<p>No alerts configured yet</p>' : `
        <table class="sa-alerts-table">
          <thead>
            <tr>
              <th>Coin</th>
              <th>Type</th>
              <th>Value</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `}
      <button class="sa-btn-export" id="export-csv-btn">Export as CSV</button>
    </div>
  `;
}

function attachEventListeners() {
  document.getElementById('add-alert-btn')?.addEventListener('click', addAlert);
  document.getElementById('alert-type')?.addEventListener('change', updateValueHint);
  document.getElementById('export-csv-btn')?.addEventListener('click', exportAlertsCSV);

  document.querySelectorAll('.sa-quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => createQuickAlert(e.target.dataset.preset));
  });

  document.querySelectorAll('.sa-btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => deleteAlert(e.target.dataset.alertId));
  });

  document.querySelectorAll('.sa-btn-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => toggleAlert(e.target.dataset.alertId));
  });

  document.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', (e) => dismissFeedItem(e.target.dataset.feedId));
  });

  document.querySelector('.sa-clear-all-btn')?.addEventListener('click', clearAllFeed);
  updateValueHint();
}

function updateValueHint() {
  const type = document.getElementById('alert-type')?.value || '';
  const hints = {
    'PRICE_ABOVE': '(USD)',
    'PRICE_BELOW': '(USD)',
    'RSI_BELOW_CUSTOM': '(0-100)',
    'RSI_ABOVE_CUSTOM': '(0-100)',
    'VOLUME_SPIKE': '(multiplier)',
    'PRICE_CHANGE_24H': '(%)',
  };
  const hint = document.getElementById('value-hint');
  if (hint) hint.textContent = hints[type] || '';
}

function addAlert() {
  const coin = document.getElementById('alert-coin')?.value;
  const type = document.getElementById('alert-type')?.value;
  const value = parseFloat(document.getElementById('alert-value')?.value) || null;
  const priority = document.getElementById('alert-priority')?.value;
  const notes = document.getElementById('alert-notes')?.value;

  if (!coin || !type) {
    alert('Please fill in all required fields');
    return;
  }

  const alert = {
    id: Date.now(),
    coin,
    type,
    value,
    priority,
    notes,
    active: true,
    triggered: false,
    createdAt: new Date().toISOString()
  };

  alertsState.alerts.push(alert);
  saveAlertsToStorage();
  renderSmartAlerts();
}

function deleteAlert(alertId) {
  alertsState.alerts = alertsState.alerts.filter(a => a.id !== parseInt(alertId));
  saveAlertsToStorage();
  renderSmartAlerts();
}

function toggleAlert(alertId) {
  const alert = alertsState.alerts.find(a => a.id === parseInt(alertId));
  if (alert) {
    alert.active = !alert.active;
    saveAlertsToStorage();
    renderSmartAlerts();
  }
}

function dismissFeedItem(feedId) {
  alertsState.feed = alertsState.feed.filter(f => f.id !== parseInt(feedId));
  saveAlertsToStorage();
  renderSmartAlerts();
}

function clearAllFeed() {
  if (confirm('Clear all feed items?')) {
    alertsState.feed = [];
    saveAlertsToStorage();
    renderSmartAlerts();
  }
}

function createQuickAlert(preset) {
  let alert;
  if (preset === 'btc-rsi') {
    alert = { coin: 'BTC', type: 'RSI_OVERSOLD', value: 30, priority: 'High' };
  } else if (preset === 'eth-drop') {
    alert = { coin: 'ETH', type: 'PRICE_CHANGE_24H', value: -5, priority: 'Medium' };
  } else if (preset === 'any-signal') {
    alert = { coin: 'BTC', type: 'SIGNAL_GENERATED', priority: 'High' };
  }

  if (alert) {
    alert.id = Date.now();
    alert.active = true;
    alert.triggered = false;
    alert.notes = 'Quick alert';
    alert.createdAt = new Date().toISOString();
    alertsState.alerts.push(alert);
    saveAlertsToStorage();
    renderSmartAlerts();
  }
}

function setupMonitoring() {
  if (alertsState.monitorInterval) clearInterval(alertsState.monitorInterval);
  alertsState.monitorInterval = setInterval(checkAlerts, 60000);
  checkAlerts();
}

function checkAlerts() {
  alertsState.alerts.forEach(alert => {
    if (!alert.active) return;

    let triggered = false;
    let message = '';

    const currentPrice = window._latestPrices?.[alert.coin];
    const lastSignal = window._lastSignal;

    switch (alert.type) {
      case 'PRICE_ABOVE':
        if (currentPrice && currentPrice > alert.value) {
          triggered = true;
          message = `${alert.coin} price (${currentPrice}) exceeded ${alert.value}`;
        }
        break;
      case 'PRICE_BELOW':
        if (currentPrice && currentPrice < alert.value) {
          triggered = true;
          message = `${alert.coin} price (${currentPrice}) fell below ${alert.value}`;
        }
        break;
      case 'SIGNAL_GENERATED':
        if (lastSignal && lastSignal.type === 'LONG') {
          triggered = true;
          message = `New LONG signal generated for ${alert.coin}`;
        }
        break;
      case 'VOLUME_SPIKE':
        if (currentPrice?.volume && currentPrice?.avgVolume) {
          if (currentPrice.volume > currentPrice.avgVolume * 2) {
            triggered = true;
            message = `Volume spike detected for ${alert.coin}`;
          }
        }
        break;
      case 'PRICE_CHANGE_24H':
        if (currentPrice?.change24h !== undefined) {
          if (alert.value > 0 && currentPrice.change24h > alert.value) {
            triggered = true;
            message = `${alert.coin} up ${currentPrice.change24h}% in 24h`;
          } else if (alert.value < 0 && currentPrice.change24h < alert.value) {
            triggered = true;
            message = `${alert.coin} down ${Math.abs(currentPrice.change24h)}% in 24h`;
          }
        }
        break;
    }

    if (triggered) {
      onAlertTriggered(alert, message);
    }
  });
}

function onAlertTriggered(alert, message) {
  const feedItem = {
    id: Date.now(),
    coin: alert.coin,
    type: ALERT_TYPES[alert.type],
    message,
    priority: alert.priority,
    timestamp: new Date().toISOString()
  };

  alertsState.feed.push(feedItem);
  alert.triggered = true;
  saveAlertsToStorage();

  showNotification(alert.coin, feedItem.type, message);
  showToast(message);
  playAlertSound();
  renderSmartAlerts();
}

function showNotification(coin, type, message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${coin} Alert: ${type}`, {
      body: message,
      icon: '🔔'
    });
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'sa-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Web Audio API not available');
  }
}

function exportAlertsCSV() {
  const headers = ['Coin', 'Type', 'Value', 'Priority', 'Status', 'Created'];
  const rows = alertsState.alerts.map(a => [
    a.coin,
    ALERT_TYPES[a.type],
    a.value || '-',
    a.priority,
    a.active ? (a.triggered ? 'Triggered' : 'Watching') : 'Paused',
    new Date(a.createdAt).toLocaleString()
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart-alerts-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

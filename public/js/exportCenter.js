// ── EXPORT & REPORTING CENTER ──────────────────────────────────────────────
// Multi-format exports (CSV, JSON, Print) for trading data and analysis.

function initExportCenter() {
    renderExportCenterUI();
}

function renderExportCenterUI() {
    const container = document.getElementById('export-center');
    if (!container) return;

    container.innerHTML = `
    <div class="ec-container">
        <h2>Export & Reporting Center</h2>

        <div class="ec-grid">
            <!-- Portfolio Report -->
            <div class="ec-card">
                <h3 class="ec-card-title">📊 Portfolio Report</h3>
                <p class="ec-card-desc">Export current holdings with valuations and P&L</p>
                <button class="ec-export-btn" onclick="exportPortfolioCSV()">Export Portfolio CSV</button>
                <div id="ecPortfolioTime" class="ec-last-export"></div>
            </div>

            <!-- Trade Journal -->
            <div class="ec-card">
                <h3 class="ec-card-title">📓 Trade Journal</h3>
                <p class="ec-card-desc">Export all journal entries and trade notes</p>
                <button class="ec-export-btn" onclick="exportJournalCSV()">Export Journal CSV</button>
                <div id="ecJournalTime" class="ec-last-export"></div>
            </div>

            <!-- Signal History -->
            <div class="ec-card">
                <h3 class="ec-card-title">📈 Signal History</h3>
                <p class="ec-card-desc">Export trading signals with outcomes</p>
                <button class="ec-export-btn" onclick="exportSignalHistoryCSV()">Export Signal History CSV</button>
                <div id="ecSignalTime" class="ec-last-export"></div>
            </div>

            <!-- Tax Report -->
            <div class="ec-card">
                <h3 class="ec-card-title">🧾 Tax Report</h3>
                <p class="ec-card-desc">Export FIFO-calculated tax report</p>
                <button class="ec-export-btn" onclick="exportTaxReportCSV()">Export Tax Report CSV</button>
                <div id="ecTaxTime" class="ec-last-export"></div>
            </div>

            <!-- Full Backup -->
            <div class="ec-card ec-backup-section">
                <h3 class="ec-card-title">💾 Full Data Backup</h3>
                <p class="ec-card-desc">Backup all app data as JSON</p>
                <button class="ec-export-btn" onclick="exportFullBackup()">Download Full Backup JSON</button>
                <div style="margin-top: 10px;">
                    <label style="display: block; margin-top: 10px;">📥 Restore Backup:</label>
                    <input type="file" id="ecBackupImport" accept=".json" onchange="importFullBackup(event)" class="ec-import-input">
                </div>
                <div id="ecBackupTime" class="ec-last-export"></div>
            </div>

            <!-- Print Report -->
            <div class="ec-card">
                <h3 class="ec-card-title">🖨️ Print Summary</h3>
                <p class="ec-card-desc">Print formatted portfolio and performance report</p>
                <button class="ec-export-btn" onclick="printSummaryReport()">Print Summary</button>
            </div>
        </div>

        <!-- Weekly Summary -->
        <div class="ec-weekly-summary" id="ecWeeklySummary">
            <h3>Weekly Performance Summary</h3>
            <div class="ec-summary-text" id="ecWeeklySummaryText">
                Loading weekly stats…
            </div>
            <button class="ec-copy-btn" onclick="copySummaryToClipboard()">Copy to Clipboard</button>
        </div>
    </div>

    <style>
        .ec-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .ec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .ec-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #f9fafb;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ec-card-title { margin: 0; font-size: 1.1em; color: #111; }
        .ec-card-desc { margin: 0; font-size: 0.9em; color: #666; }
        .ec-export-btn {
            padding: 10px 15px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.2s;
        }
        .ec-export-btn:hover { background: #2563eb; }
        .ec-last-export { font-size: 0.8em; color: #999; }
        .ec-weekly-summary {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #fefef9;
        }
        .ec-summary-text {
            white-space: pre-wrap;
            background: white;
            padding: 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 12px;
        }
        .ec-copy-btn {
            padding: 8px 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .ec-copy-btn:hover { background: #059669; }
        .ec-import-input {
            display: block;
            margin-top: 8px;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
    </style>
    `;

    // Load weekly summary
    updateWeeklySummary();
}

// ── PORTFOLIO CSV ──────────────────────────────────────────────────────────

async function exportPortfolioCSV() {
    try {
        const prices = await apiRequest('/api/crypto/prices');
        let livePrices = {};
        prices.forEach(p => { livePrices[p.symbol] = p.price; });

        const portfolio = JSON.parse(localStorage.getItem('tp_portfolio') || '{}');
        let rows = [['Coin', 'Quantity', 'Avg Buy Price', 'Current Price', 'Current Value', 'P&L', 'P&L%']];

        Object.entries(portfolio).forEach(([coin, data]) => {
            const current = livePrices[coin] || data.avgPrice;
            const value = data.quantity * current;
            const pnl = value - (data.quantity * data.avgPrice);
            const pnlPct = ((pnl / (data.quantity * data.avgPrice)) * 100).toFixed(2);
            rows.push([coin, data.quantity.toFixed(6), data.avgPrice.toFixed(2), current.toFixed(2), value.toFixed(2), pnl.toFixed(2), pnlPct]);
        });

        downloadCSV(rows, 'portfolio_' + new Date().toISOString().split('T')[0] + '.csv');
        showExportSuccess('ecPortfolioTime');
    } catch (e) {
        alert('Failed to export portfolio: ' + e.message);
    }
}

// ── JOURNAL CSV ────────────────────────────────────────────────────────────

function exportJournalCSV() {
    try {
        const journal = JSON.parse(localStorage.getItem('tp_journal') || '[]');
        let rows = [['Date', 'Coin', 'Direction', 'Entry', 'Exit', 'P&L', 'Notes', 'Emotions', 'Setup']];

        journal.forEach(entry => {
            rows.push([
                formatDate(entry.timestamp || new Date().getTime()),
                entry.coin || '',
                entry.direction || '',
                entry.entry?.toFixed(2) || '',
                entry.exit?.toFixed(2) || '',
                entry.pnl?.toFixed(2) || '',
                entry.notes || '',
                entry.emotions || '',
                entry.setup || ''
            ]);
        });

        downloadCSV(rows, 'journal_' + new Date().toISOString().split('T')[0] + '.csv');
        showExportSuccess('ecJournalTime');
    } catch (e) {
        alert('Failed to export journal: ' + e.message);
    }
}

// ── SIGNAL HISTORY CSV ─────────────────────────────────────────────────────

function exportSignalHistoryCSV() {
    try {
        const signals = JSON.parse(localStorage.getItem('tp_signal_history') || '[]');
        let rows = [['Date', 'Coin', 'Direction', 'Entry', 'SL', 'TP1', 'TP2', 'TP3', 'Outcome', 'Notes', 'Win/Loss']];

        signals.forEach(sig => {
            rows.push([
                formatDate(sig.timestamp || new Date().getTime()),
                sig.coin || '',
                sig.direction || '',
                sig.entry?.toFixed(2) || '',
                sig.sl?.toFixed(2) || '',
                sig.tp1?.toFixed(2) || '',
                sig.tp2?.toFixed(2) || '',
                sig.tp3?.toFixed(2) || '',
                sig.outcome || '',
                sig.notes || '',
                sig.winloss || ''
            ]);
        });

        downloadCSV(rows, 'signals_' + new Date().toISOString().split('T')[0] + '.csv');
        showExportSuccess('ecSignalTime');
    } catch (e) {
        alert('Failed to export signals: ' + e.message);
    }
}

// ── TAX REPORT CSV ─────────────────────────────────────────────────────────

function exportTaxReportCSV() {
    try {
        const trades = JSON.parse(localStorage.getItem('tp_tax_trades') || '[]');
        let rows = [['Date', 'Coin', 'Type', 'Quantity', 'Price', 'Gross', 'Cost Basis', 'Gain/Loss', 'Notes']];

        trades.forEach(trade => {
            const gross = (trade.quantity * trade.price).toFixed(2);
            const costBasis = (trade.quantity * (trade.costPrice || trade.price)).toFixed(2);
            const gainLoss = (gross - costBasis).toFixed(2);
            rows.push([
                formatDate(trade.timestamp || new Date().getTime()),
                trade.coin || '',
                trade.type || '',
                trade.quantity?.toFixed(6) || '',
                trade.price?.toFixed(2) || '',
                gross,
                costBasis,
                gainLoss,
                trade.notes || ''
            ]);
        });

        downloadCSV(rows, 'tax_report_' + new Date().toISOString().split('T')[0] + '.csv');
        showExportSuccess('ecTaxTime');
    } catch (e) {
        alert('Failed to export tax report: ' + e.message);
    }
}

// ── FULL BACKUP JSON ───────────────────────────────────────────────────────

function exportFullBackup() {
    try {
        const backup = {};
        const prefix = 'tp_';

        for (let key in localStorage) {
            if (key.startsWith(prefix)) {
                try {
                    backup[key] = JSON.parse(localStorage.getItem(key));
                } catch {
                    backup[key] = localStorage.getItem(key);
                }
            }
        }

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadFile(blob, 'trader_backup_' + new Date().toISOString().split('T')[0] + '.json');
        showExportSuccess('ecBackupTime');
    } catch (e) {
        alert('Failed to export backup: ' + e.message);
    }
}

// ── IMPORT BACKUP JSON ─────────────────────────────────────────────────────

async function importFullBackup(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;

        const text = await file.text();
        const backup = JSON.parse(text);

        if (!confirm(`Restore ${Object.keys(backup).length} items from backup? This will overwrite current data.`)) {
            return;
        }

        Object.entries(backup).forEach(([key, value]) => {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        });

        alert('✅ Backup restored successfully!');
        window.location.reload();
    } catch (e) {
        alert('Failed to import backup: ' + e.message);
    }
}

// ── PRINT SUMMARY ──────────────────────────────────────────────────────────

function printSummaryReport() {
    const printWindow = window.open('', '', 'width=900,height=1200');
    const portfolio = JSON.parse(localStorage.getItem('tp_portfolio') || '{}');
    const signals = JSON.parse(localStorage.getItem('tp_signal_history') || '[]');
    const trades = JSON.parse(localStorage.getItem('tp_tax_trades') || '[]');

    const wins = trades.filter(t => (t.gainLoss || 0) > 0).length;
    const total = trades.length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 'N/A';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Trading Summary Report</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; }
            h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
            .section { margin-bottom: 30px; page-break-inside: avoid; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f0f0f0; font-weight: bold; }
            .stat { display: inline-block; margin-right: 30px; }
            .stat-label { font-size: 0.9em; color: #666; }
            .stat-value { font-size: 1.4em; font-weight: bold; }
            .positive { color: #10b981; }
            .negative { color: #ef4444; }
            @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
        </style>
    </head>
    <body>
        <h1>Trading Summary Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>

        <div class="section">
            <h2>Performance Stats</h2>
            <div class="stat">
                <div class="stat-label">Win Rate</div>
                <div class="stat-value">${winRate}%</div>
            </div>
            <div class="stat">
                <div class="stat-label">Total Trades</div>
                <div class="stat-value">${total}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Winning Trades</div>
                <div class="stat-value positive">${wins}</div>
            </div>
        </div>

        <div class="section">
            <h2>Current Holdings</h2>
            <table>
                <thead><tr><th>Asset</th><th>Quantity</th><th>Avg Price</th><th>Current Value</th></tr></thead>
                <tbody>
                ${Object.entries(portfolio).map(([coin, data]) =>
                    `<tr><td>${coin}</td><td>${data.quantity.toFixed(6)}</td><td>${data.avgPrice.toFixed(2)}</td><td>${(data.quantity * data.avgPrice).toFixed(2)}</td></tr>`
                ).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Recent Signals (Last 10)</h2>
            <table>
                <thead><tr><th>Date</th><th>Coin</th><th>Direction</th><th>Entry</th><th>Outcome</th></tr></thead>
                <tbody>
                ${signals.slice(0, 10).map(sig =>
                    `<tr><td>${formatDate(sig.timestamp)}</td><td>${sig.coin}</td><td>${sig.direction}</td><td>${sig.entry.toFixed(2)}</td><td>${sig.outcome || '—'}</td></tr>`
                ).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
}

// ── WEEKLY SUMMARY ─────────────────────────────────────────────────────────

function updateWeeklySummary() {
    try {
        const trades = JSON.parse(localStorage.getItem('tp_tax_trades') || '[]');
        const signals = JSON.parse(localStorage.getItem('tp_signal_history') || '[]');

        // Count this week's trades
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekTrades = trades.filter(t => (t.timestamp || 0) > oneWeekAgo);
        const weekSignals = signals.filter(s => (s.timestamp || 0) > oneWeekAgo);

        const wins = weekTrades.filter(t => (t.gainLoss || 0) > 0).length;
        const winRate = weekTrades.length > 0 ? ((wins / weekTrades.length) * 100).toFixed(1) : 0;

        // Find best performer
        let bestCoin = 'N/A';
        if (weekTrades.length > 0) {
            const coinGains = {};
            weekTrades.forEach(t => {
                coinGains[t.coin] = (coinGains[t.coin] || 0) + (t.gainLoss || 0);
            });
            bestCoin = Object.entries(coinGains).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        }

        const summary = `This week: ${weekTrades.length} trades logged, ${winRate}% win rate, ${weekSignals.length} signals generated, best performer: ${bestCoin}

--- Weekly Summary Email Template ---
Subject: Weekly Trading Report

Hi,

This week I completed ${weekTrades.length} trades with a ${winRate}% win rate.
Generated ${weekSignals.length} trading signals.
Best performing coin: ${bestCoin}

Looking forward to next week!`;

        const el = document.getElementById('ecWeeklySummaryText');
        if (el) el.textContent = summary;
    } catch (e) {
        console.error('Weekly summary error:', e);
    }
}

function copySummaryToClipboard() {
    const el = document.getElementById('ecWeeklySummaryText');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
        alert('✅ Summary copied to clipboard!');
    }).catch(() => {
        alert('Failed to copy. Please copy manually.');
    });
}

// ── UTILITIES ──────────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadFile(blob, filename);
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showExportSuccess(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = `✅ Last export: ${new Date().toLocaleTimeString()}`;
    setTimeout(() => { el.innerHTML = ''; }, 5000);
}

// Hook into page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExportCenter);
} else {
    initExportCenter();
}

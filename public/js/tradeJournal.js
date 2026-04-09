// ── TRADE JOURNAL ─────────────────────────────────────────────────────
// Log real or paper trades with entry/exit/reason/emotion/outcome.
// Tracks win rate, avg R:R, streaks. localStorage only.

const TJ_KEY = 'traderpro_trade_journal';

const EMOTIONS = ['😎 Confident', '😟 Anxious', '😤 FOMO', '😴 Bored', '🎯 Disciplined', '😡 Revenge', '🤔 Uncertain', '😊 Calm'];
const STRATEGIES = ['Trend Follow', 'Breakout', 'RSI Reversal', 'Support/Resistance', 'News Play', 'DCA', 'Scalp', 'Swing', 'Other'];
const MARKETS = ['Crypto', 'PSX', 'Forex', 'Futures', 'Other'];

function loadJournal() {
    try {
        const raw = localStorage.getItem(TJ_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { trades: [] };
}

function saveJournal(state) {
    try { localStorage.setItem(TJ_KEY, JSON.stringify(state)); } catch (e) {}
}

// ── RENDER MAIN JOURNAL UI ─────────────────────────────────────────────

function initTradeJournal() {
    renderJournalUI();
}

function renderJournalUI() {
    const container = document.getElementById('journalContent');
    if (!container) return;

    const state = loadJournal();
    const stats = computeJournalStats(state.trades);

    container.innerHTML = `
    <!-- Stats Bar -->
    <div class="journal-stats-bar">
        <div class="jstat ${stats.winRate >= 50 ? 'positive' : 'negative'}">
            <div class="jstat-val">${stats.winRate.toFixed(1)}%</div>
            <div class="jstat-label">Win Rate</div>
        </div>
        <div class="jstat">
            <div class="jstat-val">${stats.totalTrades}</div>
            <div class="jstat-label">Total Trades</div>
        </div>
        <div class="jstat ${stats.totalPnL >= 0 ? 'positive' : 'negative'}">
            <div class="jstat-val">${stats.totalPnL >= 0 ? '+' : ''}${formatCurrency(stats.totalPnL)}</div>
            <div class="jstat-label">Total P&L</div>
        </div>
        <div class="jstat">
            <div class="jstat-val">${stats.avgRR.toFixed(2)}</div>
            <div class="jstat-label">Avg R:R</div>
        </div>
        <div class="jstat positive">
            <div class="jstat-val">${stats.streak.current > 0 ? '+' : ''}${stats.streak.current}</div>
            <div class="jstat-label">${stats.streak.current >= 0 ? 'Win Streak' : 'Loss Streak'}</div>
        </div>
        <div class="jstat">
            <div class="jstat-val">${stats.avgHoldTime}</div>
            <div class="jstat-label">Avg Hold Time</div>
        </div>
        <div class="jstat">
            <div class="jstat-val">${stats.bestStrategy || '—'}</div>
            <div class="jstat-label">Best Strategy</div>
        </div>
        <div class="jstat">
            <div class="jstat-val">${stats.bestEmotion || '—'}</div>
            <div class="jstat-label">Best Emotion</div>
        </div>
    </div>

    <!-- Log New Trade Button -->
    <div class="journal-actions">
        <button class="btn-primary" onclick="openJournalForm()">+ Log New Trade</button>
        <button class="btn-secondary" onclick="exportJournalCSV()">📥 Export CSV</button>
        <div class="journal-search-wrap">
            <input type="text" id="journalSearch" placeholder="Search trades…" oninput="filterJournalTrades(this.value)">
        </div>
        <select id="journalMarketFilter" onchange="filterJournalTrades(document.getElementById('journalSearch').value)">
            <option value="all">All Markets</option>
            ${MARKETS.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <select id="journalResultFilter" onchange="filterJournalTrades(document.getElementById('journalSearch').value)">
            <option value="all">All Results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="breakeven">Breakeven</option>
        </select>
    </div>

    <!-- Trade Form Modal (hidden by default) -->
    <div class="journal-form-overlay" id="journalFormOverlay" style="display:none">
        <div class="journal-form-modal">
            <div class="journal-form-header">
                <h3 id="journalFormTitle">📝 Log Trade</h3>
                <button class="modal-close" onclick="closeJournalForm()">✕</button>
            </div>
            <div class="journal-form-body">
                <div class="journal-form-grid">
                    <label>Asset / Symbol
                        <input type="text" id="jfSymbol" placeholder="BTC, ENGRO, EUR/USD…">
                    </label>
                    <label>Market
                        <select id="jfMarket">
                            ${MARKETS.map(m => `<option value="${m}">${m}</option>`).join('')}
                        </select>
                    </label>
                    <label>Direction
                        <select id="jfDirection">
                            <option value="LONG">LONG (Buy)</option>
                            <option value="SHORT">SHORT (Sell)</option>
                        </select>
                    </label>
                    <label>Strategy
                        <select id="jfStrategy">
                            ${STRATEGIES.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </label>
                    <label>Entry Price
                        <input type="number" id="jfEntry" placeholder="0.00" step="any">
                    </label>
                    <label>Exit Price
                        <input type="number" id="jfExit" placeholder="0.00 (optional)" step="any">
                    </label>
                    <label>Position Size / Qty
                        <input type="number" id="jfQty" placeholder="1.0" step="any">
                    </label>
                    <label>Stop Loss Price
                        <input type="number" id="jfStopLoss" placeholder="0.00 (optional)" step="any">
                    </label>
                    <label>Take Profit Price
                        <input type="number" id="jfTakeProfit" placeholder="0.00 (optional)" step="any">
                    </label>
                    <label>Entry Date & Time
                        <input type="datetime-local" id="jfEntryDate">
                    </label>
                    <label>Exit Date & Time
                        <input type="datetime-local" id="jfExitDate">
                    </label>
                    <label>Result
                        <select id="jfResult">
                            <option value="open">Open (Ongoing)</option>
                            <option value="win">Win</option>
                            <option value="loss">Loss</option>
                            <option value="breakeven">Breakeven</option>
                        </select>
                    </label>
                </div>
                <label class="jf-full">Emotion During Trade
                    <div class="emotion-picker" id="emotionPicker">
                        ${EMOTIONS.map(e => `<button type="button" class="emotion-btn" data-emotion="${e}" onclick="selectEmotion(this)">${e}</button>`).join('')}
                    </div>
                    <input type="hidden" id="jfEmotion">
                </label>
                <label class="jf-full">Entry Reason / Setup
                    <textarea id="jfReason" rows="2" placeholder="Why did you enter? What was the setup?"></textarea>
                </label>
                <label class="jf-full">Lesson Learned / Notes
                    <textarea id="jfLesson" rows="2" placeholder="What did you learn? What would you do differently?"></textarea>
                </label>
                <div class="jf-pnl-preview" id="jfPnlPreview"></div>
            </div>
            <div class="journal-form-footer">
                <button class="btn-secondary" onclick="closeJournalForm()">Cancel</button>
                <button class="btn-primary" onclick="saveJournalTrade()">Save Trade</button>
            </div>
        </div>
    </div>

    <!-- Trades Table -->
    <div class="journal-table-wrap">
        <div id="journalTradeList"></div>
    </div>`;

    renderJournalTrades(state.trades);

    // Set default entry date to now
    const entryDate = document.getElementById('jfEntryDate');
    if (entryDate) entryDate.value = new Date().toISOString().slice(0, 16);

    // Live P&L preview
    ['jfEntry', 'jfExit', 'jfQty', 'jfDirection'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateJournalPnlPreview);
    });
}

// ── FORM HELPERS ──────────────────────────────────────────────────────

let editingTradeId = null;

function openJournalForm(tradeId = null) {
    editingTradeId = tradeId;
    const overlay = document.getElementById('journalFormOverlay');
    if (!overlay) return;

    if (tradeId) {
        const state = loadJournal();
        const trade = state.trades.find(t => t.id === tradeId);
        if (trade) populateJournalForm(trade);
        document.getElementById('journalFormTitle').textContent = '✏️ Edit Trade';
    } else {
        clearJournalForm();
        document.getElementById('journalFormTitle').textContent = '📝 Log New Trade';
    }

    overlay.style.display = 'flex';
}

function closeJournalForm() {
    const overlay = document.getElementById('journalFormOverlay');
    if (overlay) overlay.style.display = 'none';
    editingTradeId = null;
}

function clearJournalForm() {
    ['jfSymbol','jfReason','jfLesson'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['jfEntry','jfExit','jfQty','jfStopLoss','jfTakeProfit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const entryDate = document.getElementById('jfEntryDate');
    if (entryDate) entryDate.value = new Date().toISOString().slice(0, 16);
    const exitDate = document.getElementById('jfExitDate');
    if (exitDate) exitDate.value = '';
    document.getElementById('jfMarket').value = 'Crypto';
    document.getElementById('jfDirection').value = 'LONG';
    document.getElementById('jfStrategy').value = 'Trend Follow';
    document.getElementById('jfResult').value = 'open';
    document.getElementById('jfEmotion').value = '';
    document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
    const preview = document.getElementById('jfPnlPreview');
    if (preview) preview.innerHTML = '';
}

function populateJournalForm(trade) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('jfSymbol', trade.symbol);
    set('jfMarket', trade.market);
    set('jfDirection', trade.direction);
    set('jfStrategy', trade.strategy);
    set('jfEntry', trade.entry);
    set('jfExit', trade.exit);
    set('jfQty', trade.qty);
    set('jfStopLoss', trade.stopLoss);
    set('jfTakeProfit', trade.takeProfit);
    set('jfEntryDate', trade.entryDate ? trade.entryDate.slice(0,16) : '');
    set('jfExitDate', trade.exitDate ? trade.exitDate.slice(0,16) : '');
    set('jfResult', trade.result);
    set('jfEmotion', trade.emotion);
    set('jfReason', trade.reason);
    set('jfLesson', trade.lesson);

    document.querySelectorAll('.emotion-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.emotion === trade.emotion);
    });
}

function selectEmotion(btn) {
    document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('jfEmotion').value = btn.dataset.emotion;
}

function updateJournalPnlPreview() {
    const entry = parseFloat(document.getElementById('jfEntry')?.value);
    const exit  = parseFloat(document.getElementById('jfExit')?.value);
    const qty   = parseFloat(document.getElementById('jfQty')?.value);
    const dir   = document.getElementById('jfDirection')?.value;
    const preview = document.getElementById('jfPnlPreview');
    if (!preview) return;

    if (!isNaN(entry) && !isNaN(exit) && !isNaN(qty) && qty > 0) {
        const pnl = dir === 'LONG' ? (exit - entry) * qty : (entry - exit) * qty;
        const pct = ((exit - entry) / entry * 100) * (dir === 'LONG' ? 1 : -1);
        preview.innerHTML = `<span class="jf-pnl-label">Estimated P&L:</span>
            <span class="${pnl >= 0 ? 'positive' : 'negative'}">
                ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)
            </span>`;
    } else {
        preview.innerHTML = '';
    }
}

// ── SAVE / DELETE ─────────────────────────────────────────────────────

function saveJournalTrade() {
    const symbol = document.getElementById('jfSymbol')?.value?.trim().toUpperCase();
    if (!symbol) { alert('Please enter an asset symbol.'); return; }

    const entry = parseFloat(document.getElementById('jfEntry')?.value);
    if (isNaN(entry) || entry <= 0) { alert('Please enter a valid entry price.'); return; }

    const exit = parseFloat(document.getElementById('jfExit')?.value) || null;
    const qty  = parseFloat(document.getElementById('jfQty')?.value) || 1;
    const dir  = document.getElementById('jfDirection')?.value;
    let pnl = null;
    let rr  = null;

    if (exit !== null) {
        pnl = dir === 'LONG' ? (exit - entry) * qty : (entry - exit) * qty;
    }

    const stopLoss   = parseFloat(document.getElementById('jfStopLoss')?.value) || null;
    const takeProfit = parseFloat(document.getElementById('jfTakeProfit')?.value) || null;

    if (stopLoss && takeProfit && entry) {
        const risk   = Math.abs(entry - stopLoss);
        const reward = Math.abs(takeProfit - entry);
        rr = risk > 0 ? (reward / risk) : null;
    }

    const entryDateVal = document.getElementById('jfEntryDate')?.value;
    const exitDateVal  = document.getElementById('jfExitDate')?.value;

    let holdHours = null;
    if (entryDateVal && exitDateVal) {
        holdHours = (new Date(exitDateVal) - new Date(entryDateVal)) / 3600000;
    }

    const trade = {
        id: editingTradeId || Date.now(),
        symbol,
        market:      document.getElementById('jfMarket')?.value || 'Crypto',
        direction:   dir,
        strategy:    document.getElementById('jfStrategy')?.value || 'Other',
        entry,
        exit,
        qty,
        stopLoss,
        takeProfit,
        rr,
        pnl,
        entryDate:   entryDateVal || null,
        exitDate:    exitDateVal  || null,
        holdHours,
        result:      document.getElementById('jfResult')?.value || 'open',
        emotion:     document.getElementById('jfEmotion')?.value || '',
        reason:      document.getElementById('jfReason')?.value || '',
        lesson:      document.getElementById('jfLesson')?.value || '',
        createdAt:   editingTradeId ? undefined : Date.now()
    };

    const state = loadJournal();
    if (editingTradeId) {
        const idx = state.trades.findIndex(t => t.id === editingTradeId);
        if (idx >= 0) state.trades[idx] = { ...state.trades[idx], ...trade };
    } else {
        state.trades.unshift(trade);
    }
    saveJournal(state);
    closeJournalForm();
    renderJournalUI();
}

function deleteJournalTrade(id) {
    if (!confirm('Delete this trade journal entry?')) return;
    const state = loadJournal();
    state.trades = state.trades.filter(t => t.id !== id);
    saveJournal(state);
    renderJournalUI();
}

// ── RENDER TRADES ─────────────────────────────────────────────────────

function renderJournalTrades(trades) {
    const container = document.getElementById('journalTradeList');
    if (!container) return;

    if (!trades || trades.length === 0) {
        container.innerHTML = `<div class="journal-empty">
            <div class="empty-icon">📓</div>
            <p>No trades logged yet. Start tracking your trades to see patterns and improve your performance.</p>
        </div>`;
        return;
    }

    container.innerHTML = `
    <table class="journal-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Asset</th>
                <th>Market</th>
                <th>Dir</th>
                <th>Strategy</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>P&L</th>
                <th>R:R</th>
                <th>Result</th>
                <th>Emotion</th>
                <th>Notes</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
        ${trades.map(t => {
            const resClass = t.result === 'win' ? 'result-win' : t.result === 'loss' ? 'result-loss' : t.result === 'open' ? 'result-open' : 'result-be';
            const pnlClass = (t.pnl || 0) >= 0 ? 'positive' : 'negative';
            return `<tr>
                <td class="dim">${t.entryDate ? new Date(t.entryDate).toLocaleDateString() : (t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—')}</td>
                <td><strong>${escapeHtml(t.symbol)}</strong><br><small class="dim">${escapeHtml(t.direction)}</small></td>
                <td><small>${escapeHtml(t.market || '—')}</small></td>
                <td><span class="dir-badge ${t.direction === 'LONG' ? 'long' : 'short'}">${t.direction}</span></td>
                <td><small>${escapeHtml(t.strategy || '—')}</small></td>
                <td>${t.entry ? formatCurrency(t.entry) : '—'}</td>
                <td>${t.exit ? formatCurrency(t.exit) : '—'}</td>
                <td class="${pnlClass}">${t.pnl != null ? (t.pnl >= 0 ? '+' : '') + formatCurrency(t.pnl) : '—'}</td>
                <td>${t.rr ? '1:' + t.rr.toFixed(1) : '—'}</td>
                <td><span class="result-badge ${resClass}">${t.result?.toUpperCase() || '—'}</span></td>
                <td title="${escapeHtml(t.emotion || '')}">${t.emotion ? t.emotion.split(' ')[0] : '—'}</td>
                <td class="journal-notes-cell" title="${escapeHtml(t.reason || '')} ${escapeHtml(t.lesson || '')}">
                    ${t.reason ? '<span class="note-dot" title="' + escapeHtml(t.reason) + '">📝</span>' : ''}
                    ${t.lesson ? '<span class="note-dot" title="' + escapeHtml(t.lesson) + '">💡</span>' : ''}
                </td>
                <td>
                    <button class="btn-mini" onclick="openJournalForm(${t.id})">✏️</button>
                    <button class="btn-mini danger" onclick="deleteJournalTrade(${t.id})">🗑️</button>
                </td>
            </tr>`;
        }).join('')}
        </tbody>
    </table>`;
}

function filterJournalTrades(query) {
    const state = loadJournal();
    const mkt = document.getElementById('journalMarketFilter')?.value || 'all';
    const res = document.getElementById('journalResultFilter')?.value || 'all';
    const q = (query || '').toLowerCase();

    const filtered = state.trades.filter(t => {
        if (q && !t.symbol?.toLowerCase().includes(q) && !t.strategy?.toLowerCase().includes(q) && !t.reason?.toLowerCase().includes(q)) return false;
        if (mkt !== 'all' && t.market !== mkt) return false;
        if (res !== 'all' && t.result !== res) return false;
        return true;
    });
    renderJournalTrades(filtered);
}

// ── STATS ─────────────────────────────────────────────────────────────

function computeJournalStats(trades) {
    const closed = trades.filter(t => t.result !== 'open');
    const wins   = closed.filter(t => t.result === 'win');
    const total  = closed.length;
    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const totalPnL = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const rrVals = trades.filter(t => t.rr).map(t => t.rr);
    const avgRR = rrVals.length > 0 ? rrVals.reduce((a,b) => a+b, 0) / rrVals.length : 0;

    // Current streak
    let streak = 0;
    for (let i = 0; i < closed.length; i++) {
        if (i === 0) {
            streak = closed[i].result === 'win' ? 1 : -1;
        } else {
            if (closed[i].result === 'win' && streak > 0) streak++;
            else if (closed[i].result === 'loss' && streak < 0) streak--;
            else break;
        }
    }

    // Avg hold time
    const holdTimes = trades.filter(t => t.holdHours).map(t => t.holdHours);
    let avgHoldTime = '—';
    if (holdTimes.length > 0) {
        const avg = holdTimes.reduce((a,b) => a+b, 0) / holdTimes.length;
        avgHoldTime = avg < 24 ? `${avg.toFixed(1)}h` : `${(avg/24).toFixed(1)}d`;
    }

    // Best strategy by win rate
    const byStrategy = {};
    closed.forEach(t => {
        if (!byStrategy[t.strategy]) byStrategy[t.strategy] = { w: 0, t: 0 };
        byStrategy[t.strategy].t++;
        if (t.result === 'win') byStrategy[t.strategy].w++;
    });
    let bestStrategy = null, bestSWR = 0;
    Object.entries(byStrategy).forEach(([s, v]) => {
        const wr = v.t >= 2 ? v.w / v.t : 0;
        if (wr > bestSWR) { bestSWR = wr; bestStrategy = s; }
    });

    // Best emotion by win rate
    const byEmotion = {};
    closed.forEach(t => {
        if (!t.emotion) return;
        const e = t.emotion.split(' ').slice(1).join(' ') || t.emotion;
        if (!byEmotion[e]) byEmotion[e] = { w: 0, t: 0 };
        byEmotion[e].t++;
        if (t.result === 'win') byEmotion[e].w++;
    });
    let bestEmotion = null, bestEWR = 0;
    Object.entries(byEmotion).forEach(([e, v]) => {
        const wr = v.t >= 2 ? v.w / v.t : 0;
        if (wr > bestEWR) { bestEWR = wr; bestEmotion = e; }
    });

    return { winRate, totalTrades: total, totalPnL, avgRR, streak: { current: streak }, avgHoldTime, bestStrategy, bestEmotion };
}

// ── EXPORT ────────────────────────────────────────────────────────────

function exportJournalCSV() {
    const state = loadJournal();
    if (!state.trades.length) { alert('No trades to export.'); return; }

    const headers = ['Date','Symbol','Market','Direction','Strategy','Entry','Exit','Qty','StopLoss','TakeProfit','RR','PnL','Result','Emotion','Reason','Lesson'];
    const rows = state.trades.map(t => [
        t.entryDate || '',
        t.symbol || '',
        t.market || '',
        t.direction || '',
        t.strategy || '',
        t.entry || '',
        t.exit || '',
        t.qty || '',
        t.stopLoss || '',
        t.takeProfit || '',
        t.rr ? ('1:' + t.rr.toFixed(2)) : '',
        t.pnl != null ? t.pnl.toFixed(2) : '',
        t.result || '',
        t.emotion || '',
        (t.reason || '').replace(/,/g, ';'),
        (t.lesson || '').replace(/,/g, ';')
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_journal_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

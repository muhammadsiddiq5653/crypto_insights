// ── TRADE SIGNAL ENGINE v2 ────────────────────────────────────────────
// Candlestick patterns · RSI/MACD Divergence · Position Sizing · Signal History

const SIGNAL_HISTORY_KEY = 'tp_signal_history';

// ── SIGNAL CALCULATOR ─────────────────────────────────────────────────

function calculateTradeSignal(analysis, price, assetType = 'crypto') {
    if (!analysis || !price) return null;

    const indicators = analysis.indicators || {};
    const rsi  = indicators.rsi?.value ?? null;
    const macd = indicators.macd || {};
    const bb   = indicators.bollingerBands || {};
    const mas  = indicators.movingAverages || {};
    const vol  = indicators.volume || {};
    const overall = analysis.overall || {};

    const patterns  = indicators.candlestickPatterns || { patterns: [], signal: 'NEUTRAL', buyCount: 0, sellCount: 0 };
    const rsiDiv    = indicators.rsiDivergence  || { type: 'NONE', signal: 'NEUTRAL' };
    const macdDiv   = indicators.macdDivergence || { type: 'NONE', signal: 'NEUTRAL' };

    let bullish = 0, bearish = 0, total = 0;
    const reasons = [];

    // RSI
    if (rsi !== null) {
        total++;
        if (rsi < 30)      { bullish += 2; reasons.push('RSI ' + rsi.toFixed(1) + ' — strongly oversold'); }
        else if (rsi < 40) { bullish += 1; reasons.push('RSI ' + rsi.toFixed(1) + ' — approaching oversold'); }
        else if (rsi > 70) { bearish += 2; reasons.push('RSI ' + rsi.toFixed(1) + ' — strongly overbought'); }
        else if (rsi > 60) { bearish += 1; reasons.push('RSI ' + rsi.toFixed(1) + ' — approaching overbought'); }
    }

    // MACD
    if (macd.signal === 'BULLISH_CROSS' || macd.signal === 'BUY' || macd.signal === 'BULLISH') {
        bullish++; total++; reasons.push('MACD bullish crossover');
    } else if (macd.signal === 'BEARISH_CROSS' || macd.signal === 'SELL' || macd.signal === 'BEARISH') {
        bearish++; total++; reasons.push('MACD bearish crossover');
    }

    // BB
    if (bb.position === 'BELOW_LOWER') {
        bullish += 2; total++; reasons.push('Price below BB lower band — oversold bounce likely');
    } else if (bb.position === 'ABOVE_UPPER') {
        bearish += 2; total++; reasons.push('Price above BB upper band — pullback likely');
    }

    // MA
    if (mas.above200MA === true)  { bullish++; total++; reasons.push('Price above 200 MA — long-term uptrend'); }
    if (mas.above200MA === false) { bearish++; total++; reasons.push('Price below 200 MA — long-term downtrend'); }
    if (mas.above50MA === true)   { bullish++; total++; }
    if (mas.above50MA === false)  { bearish++; total++; }

    // Volume
    if (vol.ratio > 2) {
        if (bullish > bearish) { bullish++; reasons.push('Volume spike ' + (vol.ratio || 0).toFixed(1) + 'x — confirms buying interest'); }
        if (bearish > bullish) { bearish++; reasons.push('Volume spike ' + (vol.ratio || 0).toFixed(1) + 'x — confirms selling pressure'); }
    }

    // Candlestick patterns
    if (patterns.signal === 'BUY' && patterns.buyCount > 0) {
        const strong = patterns.patterns.filter(function(p){ return p.type === 'BUY'; });
        bullish += strong.length; total += strong.length;
        strong.forEach(function(p){ reasons.push(p.icon + ' ' + p.name + ': ' + p.desc); });
    } else if (patterns.signal === 'SELL' && patterns.sellCount > 0) {
        const strong = patterns.patterns.filter(function(p){ return p.type === 'SELL'; });
        bearish += strong.length; total += strong.length;
        strong.forEach(function(p){ reasons.push(p.icon + ' ' + p.name + ': ' + p.desc); });
    } else {
        (patterns.patterns || []).filter(function(p){ return p.type === 'NEUTRAL'; })
            .forEach(function(p){ reasons.push(p.icon + ' ' + p.name + ': ' + p.desc); });
    }

    // RSI Divergence (+2)
    if (rsiDiv.type === 'BULLISH')  { bullish += 2; total += 2; reasons.push('Bullish RSI Divergence — powerful reversal signal'); }
    if (rsiDiv.type === 'BEARISH')  { bearish += 2; total += 2; reasons.push('Bearish RSI Divergence — momentum fading'); }

    // MACD Divergence (+1)
    if (macdDiv.type === 'BULLISH') { bullish += 1; total += 1; reasons.push('Bullish MACD Divergence'); }
    if (macdDiv.type === 'BEARISH') { bearish += 1; total += 1; reasons.push('Bearish MACD Divergence'); }

    const netScore = bullish - bearish;
    const maxScore = Math.max(bullish, bearish, 1);
    const strength = Math.min(99, Math.round((maxScore / (total || 1)) * 100));

    let direction = 'NEUTRAL';
    if (netScore >= 2) direction = 'LONG';
    else if (netScore <= -2) direction = 'SHORT';

    if (direction === 'NEUTRAL') {
        return { direction:'NEUTRAL', strength, confidence: strength,
            entry: roundPrice(price), stopLoss: null, takeProfits: [],
            riskPct: 0, reward1Pct: 0,
            reasons: reasons.length ? reasons : ['Mixed signals — no clear directional bias'],
            assetType, rsi, macdSignal: macd.signal||'—', bbPosition: bb.position||'—',
            aboveMA200: mas.above200MA, bullishScore: bullish, bearishScore: bearish,
            patterns, rsiDiv, macdDiv };
    }

    const isLong  = direction === 'LONG';
    const bbUpper = bb.upper  || price * 1.04;
    const bbLower = bb.lower  || price * 0.96;
    const atr     = (bbUpper - bbLower) / 4;
    const entry   = price;

    let stopLoss = isLong
        ? Math.max(bbLower - atr * 0.5, price * 0.92)
        : Math.min(bbUpper + atr * 0.5, price * 1.08);
    stopLoss = Math.round(stopLoss * 10000) / 10000;

    const slDist = Math.abs(entry - stopLoss);
    const takeProfits = isLong ? [
        { label:'TP1 (1R)', price: roundPrice(entry + slDist),     rr:'1:1' },
        { label:'TP2 (2R)', price: roundPrice(entry + slDist * 2), rr:'1:2' },
        { label:'TP3 (3R)', price: roundPrice(entry + slDist * 3), rr:'1:3' },
    ] : [
        { label:'TP1 (1R)', price: roundPrice(entry - slDist),     rr:'1:1' },
        { label:'TP2 (2R)', price: roundPrice(entry - slDist * 2), rr:'1:2' },
        { label:'TP3 (3R)', price: roundPrice(entry - slDist * 3), rr:'1:3' },
    ];

    const riskPct    = Math.abs((entry - stopLoss) / entry * 100);
    const reward1Pct = Math.abs((takeProfits[0].price - entry) / entry * 100);

    return {
        direction, strength, confidence: overall.confidence || strength,
        entry: roundPrice(entry), stopLoss: roundPrice(stopLoss), takeProfits,
        riskPct: riskPct.toFixed(2), reward1Pct: reward1Pct.toFixed(2),
        reasons, rsi, macdSignal: macd.signal||'—', bbPosition: bb.position||'—',
        aboveMA200: mas.above200MA, assetType,
        bullishScore: bullish, bearishScore: bearish,
        patterns, rsiDiv, macdDiv, slDistance: roundPrice(slDist)
    };
}

function roundPrice(p) {
    if (!p) return p;
    if (p >= 10000) return Math.round(p);
    if (p >= 100)   return Math.round(p * 100) / 100;
    if (p >= 1)     return Math.round(p * 10000) / 10000;
    return Math.round(p * 1000000) / 1000000;
}

// ── SIGNAL DISPLAY ─────────────────────────────────────────────────────

function renderSignalCard(signal, coinName, symbol) {
    if (!signal) return '';

    const isLong    = signal.direction === 'LONG';
    const isShort   = signal.direction === 'SHORT';
    const isNeutral = signal.direction === 'NEUTRAL';

    const dirClass = isLong ? 'signal-long' : isShort ? 'signal-short' : 'signal-neutral';
    const dirLabel = isLong ? '📈 LONG / BUY' : isShort ? '📉 SHORT / SELL' : '↔️ NEUTRAL / WAIT';

    const strengthBar = '<div class="sig-strength-bar"><div class="sig-strength-fill ' + dirClass + '" style="width:' + signal.strength + '%"></div></div>';

    const tpRows = (signal.takeProfits || []).map(function(tp){
        return '<div class="sig-tp-row"><span class="sig-tp-label">' + tp.label + '</span><span class="sig-tp-price">' + formatCurrency(tp.price) + '</span><span class="sig-tp-rr dim">(' + tp.rr + ')</span></div>';
    }).join('');

    const reasonList = (signal.reasons || []).map(function(r){ return '<li>' + escapeHtml(r) + '</li>'; }).join('');

    const rsiDivBadge  = (signal.rsiDiv  && signal.rsiDiv.type  !== 'NONE') ? '<span class="div-badge ' + signal.rsiDiv.type.toLowerCase()  + '">' + signal.rsiDiv.type  + ' RSI DIV</span>'  : '';
    const macdDivBadge = (signal.macdDiv && signal.macdDiv.type !== 'NONE') ? '<span class="div-badge ' + signal.macdDiv.type.toLowerCase() + '">' + signal.macdDiv.type + ' MACD DIV</span>' : '';

    const patternPills = (signal.patterns && signal.patterns.patterns || []).map(function(p){
        return '<span class="pattern-pill ' + p.type.toLowerCase() + '" title="' + escapeHtml(p.desc) + '">' + p.icon + ' ' + escapeHtml(p.name) + '</span>';
    }).join('');

    const signalId = 'sig_' + Date.now();
    const tpJSON   = JSON.stringify(signal.takeProfits || []).replace(/"/g, "'");

    return '<div class="signal-card ' + dirClass + '" id="' + signalId + '">' +
        '<div class="signal-card-header">' +
            '<div>' +
                '<span class="signal-direction-badge ' + dirClass + '">' + dirLabel + '</span>' +
                '<div class="signal-asset-name">' + escapeHtml(coinName) + ' (' + escapeHtml(symbol) + ')</div>' +
                '<div class="signal-badges-row">' + rsiDivBadge + macdDivBadge + '</div>' +
            '</div>' +
            '<div class="signal-confidence">' +
                '<div class="signal-conf-num">' + signal.confidence + '%</div>' +
                '<div class="signal-conf-label">Confidence</div>' +
                strengthBar +
                '<div class="sig-score-row"><span class="score-bull">🟢 ' + (signal.bullishScore||0) + '</span> <span class="score-bear">🔴 ' + (signal.bearishScore||0) + '</span></div>' +
            '</div>' +
        '</div>' +

        (patternPills ? '<div class="signal-patterns-row">' + patternPills + '</div>' : '') +

        (!isNeutral ?
        '<div class="signal-levels">' +
            '<div class="sig-level-card entry"><div class="sig-level-icon">🎯</div><div class="sig-level-info"><div class="sig-level-label">Entry Point</div><div class="sig-level-price">' + formatCurrency(signal.entry) + '</div><div class="sig-level-note">Current market price</div></div></div>' +
            '<div class="sig-level-card sl"><div class="sig-level-icon">🛑</div><div class="sig-level-info"><div class="sig-level-label">Stop Loss</div><div class="sig-level-price">' + formatCurrency(signal.stopLoss) + '</div><div class="sig-level-note">Risk: -' + signal.riskPct + '%</div></div></div>' +
            '<div class="sig-level-card tp"><div class="sig-level-icon">🏆</div><div class="sig-level-info"><div class="sig-level-label">Take Profits</div><div class="sig-tp-list">' + tpRows + '</div></div></div>' +
        '</div>' +
        // Inline position sizer
        '<div class="pos-sizer" id="posSizer_' + signalId + '">' +
            '<div class="pos-sizer-title">💰 Position Size Calculator</div>' +
            '<div class="pos-sizer-inputs">' +
                '<div class="ps-input-group"><label>Account Balance ($)</label><input type="number" class="ps-input" id="psBalance_' + signalId + '" placeholder="10000" value="10000" oninput="calcPositionSize(\'' + signalId + '\',' + signal.entry + ',' + signal.stopLoss + ')"></div>' +
                '<div class="ps-input-group"><label>Risk per Trade (%)</label><input type="number" class="ps-input" id="psRisk_' + signalId + '" placeholder="1" value="1" min="0.1" max="10" step="0.1" oninput="calcPositionSize(\'' + signalId + '\',' + signal.entry + ',' + signal.stopLoss + ')"></div>' +
            '</div>' +
            '<div class="ps-results" id="psResults_' + signalId + '">' +
                '<div class="ps-result-item"><span>$ at Risk</span><strong id="psAtRisk_' + signalId + '">—</strong></div>' +
                '<div class="ps-result-item"><span>Position Size</span><strong id="psSize_' + signalId + '">—</strong></div>' +
                '<div class="ps-result-item"><span>Units</span><strong id="psUnits_' + signalId + '">—</strong></div>' +
                '<div class="ps-result-item"><span>Reward (TP1)</span><strong id="psReward_' + signalId + '" class="positive">—</strong></div>' +
            '</div>' +
            '<div class="ps-hint">Rule: Never risk more than 1-2% of your account per trade.</div>' +
        '</div>' +
        '<div class="signal-risk-note">⚠️ <strong>Risk Management:</strong> Always place your stop loss immediately after entry.</div>'
        :
        '<div class="signal-neutral-msg"><p>📊 No clear trade signal right now. Indicators are mixed — wait for stronger confluence before entering.</p></div>') +

        '<div class="signal-reasons"><div class="signal-reasons-title">📋 Signal Basis (' + (signal.reasons||[]).length + ' factors)</div><ul>' + reasonList + '</ul></div>' +

        '<div class="signal-indicators-row">' +
            '<span class="sig-ind">RSI: <strong class="' + (signal.rsi !== null ? (signal.rsi < 30 ? 'positive' : signal.rsi > 70 ? 'negative' : '') : '') + '">' + (signal.rsi !== null ? signal.rsi.toFixed(1) : '—') + '</strong></span>' +
            '<span class="sig-ind">MACD: <strong>' + (signal.macdSignal||'—') + '</strong></span>' +
            '<span class="sig-ind">BB: <strong>' + (signal.bbPosition||'—') + '</strong></span>' +
            '<span class="sig-ind">MA200: <strong class="' + (signal.aboveMA200 === true ? 'positive' : signal.aboveMA200 === false ? 'negative' : '') + '">' + (signal.aboveMA200 === true ? 'Above ↑' : signal.aboveMA200 === false ? 'Below ↓' : '—') + '</strong></span>' +
        '</div>' +

        (!isNeutral ? '<div class="signal-log-row"><button class="signal-log-btn" onclick="logSignalToHistory(\'' + escapeHtml(symbol) + '\',\'' + escapeHtml(coinName) + '\',\'' + signal.direction + '\',' + signal.entry + ',' + signal.stopLoss + ',' + JSON.stringify(signal.takeProfits||[]) + ')">📓 Log to Signal History</button></div>' : '') +

        '<div class="signal-disclaimer">⚠️ <strong>Not financial advice.</strong> Signals are auto-generated from technical indicators only. Always do your own research.</div>' +
    '</div>';
}

// ── POSITION SIZE CALCULATOR (inline in signal card) ──────────────────

function calcPositionSize(signalId, entry, stopLoss) {
    var balEl  = document.getElementById('psBalance_' + signalId);
    var riskEl = document.getElementById('psRisk_' + signalId);
    if (!balEl || !riskEl) return;

    var balance    = parseFloat(balEl.value)  || 10000;
    var riskPct    = parseFloat(riskEl.value) || 1;
    var slDistance = Math.abs(entry - stopLoss);
    if (!slDistance || !entry) return;

    var dollarRisk   = balance * (riskPct / 100);
    var units        = dollarRisk / slDistance;
    var positionSize = units * entry;
    var tp1          = entry > stopLoss ? entry + slDistance : entry - slDistance;
    var rewardAmt    = units * slDistance;

    function set(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; }
    set('psAtRisk_' + signalId,  '$' + dollarRisk.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}));
    set('psSize_' + signalId,    '$' + positionSize.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}));
    set('psUnits_' + signalId,   units >= 1 ? units.toFixed(4) : units.toFixed(6));
    set('psReward_' + signalId,  '+$' + rewardAmt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}));
}

// ── STANDALONE RISK CALCULATOR (full-page) ────────────────────────────

function calcStandalonePosition() {
    var balance  = parseFloat(document.getElementById('rcBalance')?.value)  || 0;
    var riskPct  = parseFloat(document.getElementById('rcRiskPct')?.value)  || 1;
    var entry    = parseFloat(document.getElementById('rcEntry')?.value)    || 0;
    var stopLoss = parseFloat(document.getElementById('rcSL')?.value)       || 0;

    if (!balance || !entry || !stopLoss) {
        var c = document.getElementById('rcResults'); if(c) c.innerHTML='<p class="dim" style="padding:1rem">Fill all fields above to calculate position size.</p>'; return;
    }

    var slDist   = Math.abs(entry - stopLoss);
    var dollarRisk = balance * (riskPct / 100);
    var units    = dollarRisk / slDist;
    var posSz    = units * entry;
    var slPct    = slDist / entry * 100;
    var isLong   = entry > stopLoss;

    var tp1 = isLong ? entry + slDist : entry - slDist;
    var tp2 = isLong ? entry + slDist*2 : entry - slDist*2;
    var tp3 = isLong ? entry + slDist*3 : entry - slDist*3;
    var rw1 = units * slDist, rw2 = rw1*2, rw3 = rw1*3;

    var container = document.getElementById('rcResults');
    if (!container) return;
    container.innerHTML =
        '<div class="rc-result"><span class="rc-label">$ at Risk</span><strong class="negative">$' + dollarRisk.toFixed(2) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">SL Distance</span><strong>' + roundPrice(slDist) + ' (' + slPct.toFixed(2) + '%)</strong></div>' +
        '<div class="rc-result"><span class="rc-label">Units to Buy</span><strong>' + (units >= 1 ? units.toFixed(4) : units.toFixed(6)) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">Position Size</span><strong>$' + posSz.toFixed(2) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">% of Account</span><strong>' + (posSz/balance*100).toFixed(1) + '%</strong></div>' +
        '<div class="rc-result"><span class="rc-label">Direction</span><strong class="' + (isLong?'positive':'negative') + '">' + (isLong?'LONG':'SHORT') + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">TP1 price</span><strong class="positive">' + roundPrice(tp1) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">Reward @ TP1</span><strong class="positive">+$' + rw1.toFixed(2) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">TP2 price</span><strong class="positive">' + roundPrice(tp2) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">Reward @ TP2</span><strong class="positive">+$' + rw2.toFixed(2) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">TP3 price</span><strong class="positive">' + roundPrice(tp3) + '</strong></div>' +
        '<div class="rc-result"><span class="rc-label">Reward @ TP3</span><strong class="positive">+$' + rw3.toFixed(2) + '</strong></div>';

    var guide = document.getElementById('rcLotGuide');
    if (guide) guide.innerHTML =
        '<div class="lot-guide-title">📐 Position Sizing Summary</div>' +
        '<ul>' +
        '<li>Max $ risk: <strong class="negative">$' + dollarRisk.toFixed(2) + '</strong></li>' +
        '<li>Buy <strong>' + (units >= 1 ? units.toFixed(4) : units.toFixed(6)) + '</strong> units at <strong>' + roundPrice(entry) + '</strong></li>' +
        '<li>Set Stop Loss at <strong class="negative">' + roundPrice(stopLoss) + '</strong> (−' + slPct.toFixed(2) + '%)</li>' +
        '<li>TP1: <strong class="positive">' + roundPrice(tp1) + '</strong> (+$' + rw1.toFixed(2) + ') — take half profits, move SL to breakeven</li>' +
        '<li>TP2: <strong class="positive">' + roundPrice(tp2) + '</strong> (+$' + rw2.toFixed(2) + ') — take more profits</li>' +
        '<li>TP3: <strong class="positive">' + roundPrice(tp3) + '</strong> (+$' + rw3.toFixed(2) + ') — final target</li>' +
        '</ul>' +
        '<div class="lot-guide-rule">📌 Golden Rule: After TP1 is hit, move your stop loss to entry price. You cannot lose on this trade.</div>';
}

// ── SIGNAL HISTORY & WIN RATE ──────────────────────────────────────────

function logSignalToHistory(symbol, name, direction, entry, stopLoss, takeProfits) {
    var history = JSON.parse(localStorage.getItem(SIGNAL_HISTORY_KEY) || '[]');
    history.unshift({ id: Date.now(), symbol, name, direction, entry, stopLoss, takeProfits,
        timestamp: new Date().toISOString(), outcome: 'OPEN', notes: '' });
    if (history.length > 100) history.pop();
    localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history));
    showToast('📓 ' + symbol + ' ' + direction + ' signal logged!');
    if (document.getElementById('signalHistoryTable')) renderSignalHistory();
}

function renderSignalHistory() {
    var container = document.getElementById('signalHistoryTable');
    if (!container) return;
    var history = JSON.parse(localStorage.getItem(SIGNAL_HISTORY_KEY) || '[]');

    if (!history.length) {
        container.innerHTML = '<div class="empty-state" style="padding:2rem">No signals logged yet. Generate a signal and click "Log to Signal History".</div>';
        updateWinRate(history); return;
    }

    var rows = history.map(function(sig){
        var date = new Date(sig.timestamp).toLocaleDateString();
        var dirClass = sig.direction==='LONG' ? 'signal-long' : sig.direction==='SHORT' ? 'signal-short' : 'signal-neutral';
        var tp1 = sig.takeProfits && sig.takeProfits[0] ? sig.takeProfits[0].price : '—';
        var opts = ['OPEN','TP1','TP2','TP3','SL','MANUAL'].map(function(o){
            return '<option value="' + o + '"' + (sig.outcome===o?' selected':'') + '>' + o + '</option>';
        }).join('');
        return '<tr><td class="dim">' + date + '</td>' +
            '<td><strong>' + escapeHtml(sig.symbol) + '</strong></td>' +
            '<td><span class="signal-direction-badge ' + dirClass + '" style="font-size:.65rem;padding:.15rem .5rem">' + sig.direction + '</span></td>' +
            '<td class="mono">' + formatCurrency(sig.entry) + '</td>' +
            '<td class="mono negative">' + formatCurrency(sig.stopLoss) + '</td>' +
            '<td class="mono positive">' + formatCurrency(tp1) + '</td>' +
            '<td><select class="sh-outcome-sel" onchange="updateSignalOutcome(' + sig.id + ',this.value)">' + opts + '</select></td>' +
            '<td><input type="text" class="sh-notes-input" value="' + escapeHtml(sig.notes||'') + '" placeholder="Notes…" onblur="updateSignalNotes(' + sig.id + ',this.value)"></td>' +
            '<td><button class="sh-del-btn" onclick="deleteSignalHistory(' + sig.id + ')">✕</button></td></tr>';
    }).join('');

    container.innerHTML = '<table class="sh-table"><thead><tr><th>Date</th><th>Asset</th><th>Direction</th><th>Entry</th><th>SL</th><th>TP1</th><th>Outcome</th><th>Notes</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    updateWinRate(history);
}

function updateWinRate(history) {
    var closed = history.filter(function(s){ return s.outcome !== 'OPEN'; });
    var wins   = closed.filter(function(s){ return ['TP1','TP2','TP3'].includes(s.outcome); });
    var losses = closed.filter(function(s){ return s.outcome === 'SL'; });
    var wr     = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
    var longs  = closed.filter(function(s){ return s.direction==='LONG'; });
    var shorts = closed.filter(function(s){ return s.direction==='SHORT'; });
    var lwr    = longs.length  ? Math.round(longs.filter(function(s){ return ['TP1','TP2','TP3'].includes(s.outcome); }).length / longs.length * 100) : 0;
    var swr    = shorts.length ? Math.round(shorts.filter(function(s){ return ['TP1','TP2','TP3'].includes(s.outcome); }).length / shorts.length * 100) : 0;

    var el = document.getElementById('shStats');
    if (!el) return;
    el.innerHTML =
        '<div class="sh-stat"><div class="sh-stat-val">' + history.length + '</div><div class="sh-stat-lbl">Total</div></div>' +
        '<div class="sh-stat"><div class="sh-stat-val">' + closed.length + '</div><div class="sh-stat-lbl">Closed</div></div>' +
        '<div class="sh-stat"><div class="sh-stat-val ' + (wr>=50?'positive':'negative') + '">' + wr + '%</div><div class="sh-stat-lbl">Win Rate</div></div>' +
        '<div class="sh-stat"><div class="sh-stat-val positive">' + wins.length + '</div><div class="sh-stat-lbl">Wins</div></div>' +
        '<div class="sh-stat"><div class="sh-stat-val negative">' + losses.length + '</div><div class="sh-stat-lbl">Losses</div></div>' +
        '<div class="sh-stat"><div class="sh-stat-val">' + lwr + '% / ' + swr + '%</div><div class="sh-stat-lbl">Long WR / Short WR</div></div>';
}

function updateSignalOutcome(id, outcome) {
    var history = JSON.parse(localStorage.getItem(SIGNAL_HISTORY_KEY) || '[]');
    var sig = history.find(function(s){ return s.id === id; });
    if (sig) { sig.outcome = outcome; localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history)); }
    updateWinRate(history);
}
function updateSignalNotes(id, notes) {
    var history = JSON.parse(localStorage.getItem(SIGNAL_HISTORY_KEY) || '[]');
    var sig = history.find(function(s){ return s.id === id; });
    if (sig) { sig.notes = notes; localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history)); }
}
function deleteSignalHistory(id) {
    var history = JSON.parse(localStorage.getItem(SIGNAL_HISTORY_KEY) || '[]').filter(function(s){ return s.id !== id; });
    localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history));
    renderSignalHistory();
}
function clearSignalHistory() {
    if (!confirm('Clear all signal history?')) return;
    localStorage.removeItem(SIGNAL_HISTORY_KEY);
    renderSignalHistory();
}
function exportSignalHistoryCSV() {
    var history = JSON.parse(localStorage.getItem(SIGNAL_HISTORY_KEY) || '[]');
    if (!history.length) return;
    var rows = [['Date','Symbol','Direction','Entry','SL','TP1','TP2','TP3','Outcome','Notes']];
    history.forEach(function(s){ rows.push([new Date(s.timestamp).toLocaleDateString(), s.symbol, s.direction, s.entry, s.stopLoss, s.takeProfits&&s.takeProfits[0]?s.takeProfits[0].price:'', s.takeProfits&&s.takeProfits[1]?s.takeProfits[1].price:'', s.takeProfits&&s.takeProfits[2]?s.takeProfits[2].price:'', s.outcome, s.notes]); });
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(function(r){ return r.join(','); }).join('\n'));
    a.download = 'signal_history.csv'; a.click();
}
function initSignalHistory() { renderSignalHistory(); }

// Toast notification
function showToast(msg) {
    var t = document.getElementById('toastMsg');
    if (!t) { t = document.createElement('div'); t.id = 'toastMsg'; t.className = 'toast-msg'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

// ── PSX SIGNAL ────────────────────────────────────────────────────────

function generatePSXSignal(stock) {
    var change = stock.changePercent || 0;
    var price  = stock.price || stock.lastTrade || 0;
    var direction = 'NEUTRAL', reasons = [];

    if (change > 2)       { direction = 'LONG';  reasons.push('Strong up day: +' + change.toFixed(2) + '%'); }
    else if (change < -2) { direction = 'SHORT'; reasons.push('Strong down day: ' + change.toFixed(2) + '%'); }

    if (!price || direction === 'NEUTRAL') return { direction:'NEUTRAL', reasons:['Insufficient data for PSX signal'], confidence:40 };

    var isLong = direction === 'LONG';
    var sl = isLong ? price * 0.95 : price * 1.05;
    var tps = isLong ?
        [{ label:'TP1', price:roundPrice(price*1.05), rr:'1:1' },{ label:'TP2', price:roundPrice(price*1.10), rr:'1:2' },{ label:'TP3', price:roundPrice(price*1.15), rr:'1:3' }] :
        [{ label:'TP1', price:roundPrice(price*0.95), rr:'1:1' },{ label:'TP2', price:roundPrice(price*0.90), rr:'1:2' },{ label:'TP3', price:roundPrice(price*0.85), rr:'1:3' }];
    reasons.push('T+2 settlement — plan exit before settlement');
    return { direction, confidence:55, strength:55, entry:roundPrice(price), stopLoss:roundPrice(sl), takeProfits:tps, riskPct:'5.00', reward1Pct:'5.00', reasons, assetType:'psx', patterns:{patterns:[]}, rsiDiv:{type:'NONE'}, macdDiv:{type:'NONE'} };
}

// ── INJECT SIGNAL INTO ANALYSIS ───────────────────────────────────────

async function loadAndShowSignal(coinId, symbol, coinName, price) {
    var container = document.getElementById('tradeSignalCard');
    if (!container) return;
    container.innerHTML = '<div class="signal-loading"><div class="spinner"></div> Calculating signal for ' + escapeHtml(symbol) + '…</div>';
    try {
        var analysis = await apiRequest('/api/crypto/' + coinId + '/analysis');
        var signal   = calculateTradeSignal(analysis, price, 'crypto');
        container.innerHTML = renderSignalCard(signal, coinName, symbol);
        var card = container.querySelector('.signal-card');
        if (card && signal.stopLoss) setTimeout(function(){ calcPositionSize(card.id, signal.entry, signal.stopLoss); }, 100);
    } catch(e) {
        container.innerHTML = '<div class="signal-error">Could not generate signal. Try again.</div>';
    }
}

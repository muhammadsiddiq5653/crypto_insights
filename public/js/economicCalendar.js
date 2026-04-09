// ── ECONOMIC CALENDAR ─────────────────────────────────────────────────
// Curated upcoming high-impact events for traders.
// Combines static recurring events + dynamically computed next dates.

// Impact levels
const IMPACT = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// Helper: get next occurrence of a weekday (0=Sun...6=Sat) at or after 'from'
function nextWeekday(dayOfWeek, from = new Date()) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    const diff = (dayOfWeek - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
    return d;
}

// Helper: next Nth weekday of a given month/year
function nthWeekdayOfMonth(n, dayOfWeek, year, month) {
    const d = new Date(year, month, 1);
    let count = 0;
    while (d.getMonth() === month) {
        if (d.getDay() === dayOfWeek) {
            count++;
            if (count === n) return new Date(d);
        }
        d.setDate(d.getDate() + 1);
    }
    return null;
}

function buildCalendarEvents() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const events = [];

    // ── PAKISTAN / SBP ────────────────────────────────────────────────
    // SBP Monetary Policy Committee meets ~6 times/year (bimonthly)
    // Approximate months: Jan, Mar, May, Jul, Sep, Nov
    const sbpMonths = [0, 2, 4, 6, 8, 10];
    sbpMonths.forEach(mon => {
        // Usually around 27th of the month
        const d = new Date(y, mon, 27);
        if (d >= now) {
            events.push({
                date: d,
                title: 'SBP Monetary Policy Decision',
                description: 'State Bank of Pakistan sets the policy interest rate. Directly impacts banking stocks (HBL, MCB, UBL) and overall KSE-100 direction.',
                category: 'pakistan',
                impact: IMPACT.HIGH,
                icon: '🇵🇰',
                tradingNote: 'High-impact for PSX. Rate hike = bearish short-term for equities, bullish for PKR. Rate cut = bullish for stocks, growth sectors rally.'
            });
        }
        // Next year if all done
        const dNext = new Date(y + 1, mon, 27);
        if (d < now) events.push({
            date: dNext,
            title: 'SBP Monetary Policy Decision',
            description: 'State Bank of Pakistan sets the policy interest rate.',
            category: 'pakistan',
            impact: IMPACT.HIGH,
            icon: '🇵🇰',
            tradingNote: 'High-impact for PSX. Watch banking sector (HBL, MCB, ABL) and cement sector (LUCK, DGKC).'
        });
    });

    // Pakistan Federal Budget (usually June)
    const budgetDate = new Date(y, 5, 12);
    events.push({
        date: budgetDate < now ? new Date(y + 1, 5, 12) : budgetDate,
        title: 'Pakistan Federal Budget',
        description: 'Annual federal budget announcement. One of the most market-moving events for PSX.',
        category: 'pakistan',
        impact: IMPACT.HIGH,
        icon: '🇵🇰💰',
        tradingNote: 'Watch for changes in corporate tax, import duties, PSDP spending. Cement, construction, and IT sector most affected.'
    });

    // IMF Review (approximately quarterly)
    [2, 5, 8, 11].forEach(mon => {
        const d = new Date(y, mon, 15);
        if (d >= now) events.push({
            date: d,
            title: 'IMF Programme Review',
            description: 'Pakistan IMF Extended Fund Facility review. Tranche releases directly impact PKR and market confidence.',
            category: 'pakistan',
            impact: IMPACT.HIGH,
            icon: '🌐',
            tradingNote: 'Approval = PKR strengthens, PSX rallies. Delay = PKR pressure, uncertainty in equities.'
        });
    });

    // ── US / GLOBAL ────────────────────────────────────────────────────
    // US CPI (Consumer Price Index) — released ~2nd week of each month
    for (let i = 0; i <= 3; i++) {
        const d = new Date(y, m + i, 10 + ((m + i) % 3));
        if (d >= now) events.push({
            date: d,
            title: 'US CPI Inflation Data',
            description: 'US Consumer Price Index — the key inflation measure. Determines Fed rate path.',
            category: 'us',
            impact: IMPACT.HIGH,
            icon: '🇺🇸',
            tradingNote: 'Higher-than-expected CPI = Fed keeps rates high = bearish for crypto and growth stocks. Lower CPI = bullish for BTC, tech.'
        });
    }

    // US Federal Reserve (FOMC) meetings — 8 per year, approx every 6 weeks
    const fomcDates = [
        new Date(y, 0, 29), new Date(y, 2, 19), new Date(y, 3, 30),
        new Date(y, 5, 11), new Date(y, 6, 30), new Date(y, 8, 17),
        new Date(y, 10, 5), new Date(y, 11, 17)
    ];
    fomcDates.forEach(d => {
        if (d >= now) events.push({
            date: d,
            title: 'US Federal Reserve (FOMC) Meeting',
            description: 'Federal Open Market Committee sets the US Federal Funds Rate. The most watched event globally.',
            category: 'us',
            impact: IMPACT.HIGH,
            icon: '🏦',
            tradingNote: 'Rate hike = USD strengthens, crypto falls, gold dips short-term. Rate cut = BTC often rallies strongly. Watch within 24h of announcement.'
        });
    });

    // US Non-Farm Payrolls — first Friday of every month
    for (let i = 0; i <= 3; i++) {
        const d = nthWeekdayOfMonth(1, 5, y, m + i); // 1st Friday
        if (d && d >= now) events.push({
            date: d,
            title: 'US Non-Farm Payrolls (NFP)',
            description: 'Monthly US jobs report. Strong jobs = hawkish Fed. Weak jobs = dovish pivot expectations.',
            category: 'us',
            impact: IMPACT.HIGH,
            icon: '📊',
            tradingNote: 'Very high volatility event for Forex (especially USD pairs). Crypto often reacts within minutes.'
        });
    }

    // Bitcoin Halving (next ~April 2028, last was April 2024)
    events.push({
        date: new Date(2028, 3, 15),
        title: 'Bitcoin Halving (Estimated)',
        description: 'Bitcoin block reward halves from 3.125 to 1.5625 BTC. Historically precedes major bull markets.',
        category: 'crypto',
        impact: IMPACT.HIGH,
        icon: '₿',
        tradingNote: 'Historically BTC has entered a bull cycle 6–18 months after each halving (2012, 2016, 2020, 2024). Past performance ≠ future results.'
    });

    // Ethereum Shanghai/upgrade events — placeholder
    // Crypto: End of Quarter (options expiry — last Friday of March, June, Sep, Dec)
    [2, 5, 8, 11].forEach(mon => {
        // Last Friday of quarter-end month
        const lastDay = new Date(y, mon + 1, 0);
        while (lastDay.getDay() !== 5) lastDay.setDate(lastDay.getDate() - 1);
        if (lastDay >= now) events.push({
            date: new Date(lastDay),
            title: 'Crypto Options Expiry (CME / Deribit)',
            description: 'Quarterly crypto options expire. Often causes increased volatility around expiry date.',
            category: 'crypto',
            impact: IMPACT.MEDIUM,
            icon: '📅',
            tradingNote: 'Watch for "max pain" price manipulation near expiry. Volume typically spikes 24–48h before.'
        });
    });

    // ECB Rate Decision (usually 6 weeks)
    [1, 3, 5, 7, 9, 11].forEach(mon => {
        const d = new Date(y, mon, 6);
        if (d >= now) events.push({
            date: d,
            title: 'ECB Interest Rate Decision',
            description: 'European Central Bank sets rates. Impacts EUR/USD, EUR/PKR, and global risk sentiment.',
            category: 'global',
            impact: IMPACT.MEDIUM,
            icon: '🇪🇺',
            tradingNote: 'ECB hawkishness = EUR strength vs USD/PKR. Affects Pakistani importers and export businesses.'
        });
    });

    // PSX Earnings Season (approx quarterly)
    [0, 3, 6, 9].forEach(mon => {
        const d = new Date(y, mon, 20);
        if (d >= now) events.push({
            date: d,
            title: 'PSX Earnings Season',
            description: 'Major PSX companies report quarterly results. Watch banking sector (Mar, Jun, Sep, Dec), cement, oil & gas.',
            category: 'pakistan',
            impact: IMPACT.MEDIUM,
            icon: '📈',
            tradingNote: 'Better-than-expected earnings = stock spikes. Miss = sharp drop. Check individual company announcements on PSX website.'
        });
    });

    // Sort by date
    return events
        .filter(e => e.date >= now)
        .sort((a, b) => a.date - b.date)
        .slice(0, 40);
}

function renderCalendar(filterCat = 'all', filterImpact = 'all') {
    const container = document.getElementById('calendarContent');
    if (!container) return;

    let events = buildCalendarEvents();

    if (filterCat !== 'all') {
        events = events.filter(e => e.category === filterCat);
    }
    if (filterImpact !== 'all') {
        events = events.filter(e => e.impact === filterImpact);
    }

    if (events.length === 0) {
        container.innerHTML = `<div class="empty-state">No events match your filter.</div>`;
        return;
    }

    // Group by month
    const grouped = {};
    events.forEach(e => {
        const key = e.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    });

    let html = '';
    Object.entries(grouped).forEach(([monthLabel, evts]) => {
        html += `<div class="cal-month-label">${monthLabel}</div>`;
        evts.forEach(ev => {
            const daysUntil = Math.ceil((ev.date - new Date()) / 86400000);
            const urgency = daysUntil <= 3 ? 'cal-urgent' : daysUntil <= 7 ? 'cal-soon' : '';
            html += `
            <div class="cal-event ${ev.impact}-impact ${urgency}" onclick="toggleCalEventDetail(this)">
                <div class="cal-event-left">
                    <div class="cal-date-block">
                        <div class="cal-day">${ev.date.getDate()}</div>
                        <div class="cal-month-short">${ev.date.toLocaleString('en-US',{month:'short'})}</div>
                    </div>
                    <div class="cal-event-info">
                        <div class="cal-event-title">
                            <span class="cal-icon">${ev.icon}</span>
                            ${escapeHtml(ev.title)}
                        </div>
                        <div class="cal-event-desc">${escapeHtml(ev.description)}</div>
                        <div class="cal-trading-note" style="display:none">
                            <strong>📊 Trading Note:</strong> ${escapeHtml(ev.tradingNote)}
                        </div>
                    </div>
                </div>
                <div class="cal-event-right">
                    <span class="cal-impact-badge ${ev.impact}">${ev.impact.toUpperCase()}</span>
                    <span class="cal-countdown">${daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}</span>
                    <span class="cal-cat-badge ${ev.category}">${categoryLabel(ev.category)}</span>
                </div>
            </div>`;
        });
    });

    container.innerHTML = html;
}

function toggleCalEventDetail(el) {
    const note = el.querySelector('.cal-trading-note');
    if (note) {
        note.style.display = note.style.display === 'none' ? 'block' : 'none';
        el.classList.toggle('expanded');
    }
}

function categoryLabel(cat) {
    return { pakistan: '🇵🇰 PK', us: '🇺🇸 US', crypto: '₿ Crypto', global: '🌐 Global' }[cat] || cat;
}

function initCalendar() {
    renderCalendar();

    document.querySelectorAll('.cal-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;
            document.querySelectorAll(`.cal-filter-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat    = document.querySelector('.cal-filter-btn[data-group="cat"].active')?.dataset.value || 'all';
            const impact = document.querySelector('.cal-filter-btn[data-group="impact"].active')?.dataset.value || 'all';
            renderCalendar(cat, impact);
        });
    });
}

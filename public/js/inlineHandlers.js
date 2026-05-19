'use strict';

/**
 * inlineHandlers.js — replaces every inline onclick= / oninput= in index.html.
 *
 * This allows the Content Security Policy to drop 'unsafe-inline' from scriptSrc.
 * All handlers are registered via addEventListener after DOMContentLoaded.
 *
 * Pattern for navigation:
 *   Elements with [data-section] switch the visible section via switchSection().
 *   Elements with [data-track] also call setAcademyTrack() after 300 ms.
 *   Inner elements with their own [data-section] automatically take precedence
 *   (event.stopPropagation is not needed — closest() picks the nearest match).
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Universal data-section click delegation ────────────────────────────
  // Covers: jp-step, summary-tile, market-access-card, mac-links spans,
  //         bpg-card, "View All" button — anything with data-section.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-section]');
    if (!el) return;

    // Skip nav-items and mobile-nav-items (handled by setupNavigation in app.js)
    if (el.classList.contains('nav-item') || el.classList.contains('mobile-nav-item')) return;

    e.stopPropagation(); // prevent double-firing when inner & outer both have data-section
    const section = el.dataset.section;
    const track   = el.dataset.track;
    if (typeof switchSection === 'function') switchSection(section);
    if (track && typeof setAcademyTrack === 'function') {
      setTimeout(() => setAcademyTrack(track), 300);
    }
  });

  // ── 2. Header buttons ─────────────────────────────────────────────────────
  document.getElementById('headerSearchBtn')
    ?.addEventListener('click', () => { if (typeof openUniversalSearch === 'function') openUniversalSearch(); });

  document.getElementById('themeToggleBtn')
    ?.addEventListener('click', () => { if (typeof toggleTheme === 'function') toggleTheme(); });

  // ── 3. Global market tabs ─────────────────────────────────────────────────
  document.querySelectorAll('.gm-tab[data-market]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof switchGlobalMarket === 'function') switchGlobalMarket(btn.dataset.market, btn);
    });
  });

  // ── 4. Global screener ────────────────────────────────────────────────────
  document.getElementById('runGlobalScreenerBtn')
    ?.addEventListener('click', () => { if (typeof runGlobalScreener === 'function') runGlobalScreener(); });

  // ── 5. Portfolio ──────────────────────────────────────────────────────────
  document.getElementById('addHoldingBtn')
    ?.addEventListener('click', () => { if (typeof addHolding === 'function') addHolding(); });

  document.getElementById('clearPortfolioBtn')
    ?.addEventListener('click', () => { if (typeof clearPortfolio === 'function') clearPortfolio(); });

  document.getElementById('exportPortfolioBtn')
    ?.addEventListener('click', () => { if (typeof exportPortfolio === 'function') exportPortfolio(); });

  // ── 6. Currency converter ─────────────────────────────────────────────────
  document.getElementById('convSwapBtn')
    ?.addEventListener('click', () => { if (typeof swapConverter === 'function') swapConverter(); });

  document.getElementById('convertCurrencyBtn')
    ?.addEventListener('click', () => { if (typeof convertCurrency === 'function') convertCurrency(); });

  // ── 7. Risk calculator — preset buttons ──────────────────────────────────
  document.querySelectorAll('[data-risk-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = btn.dataset.riskPct;
      const field = document.getElementById('rcRiskPct');
      if (field) { field.value = pct; field.dispatchEvent(new Event('input')); }
    });
  });

  // ── 8. Risk calculator — oninput wiring ──────────────────────────────────
  ['rcBalance', 'rcRiskPct', 'rcEntry', 'rcSL'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (typeof calcStandalonePosition === 'function') calcStandalonePosition();
    });
  });

  // ── 9. R:R calculator ─────────────────────────────────────────────────────
  document.getElementById('calculateRRBtn')
    ?.addEventListener('click', () => { if (typeof calculateRR === 'function') calculateRR(); });

  // ── 10. Signal history ───────────────────────────────────────────────────
  document.getElementById('exportSignalHistoryBtn')
    ?.addEventListener('click', () => { if (typeof exportSignalHistoryCSV === 'function') exportSignalHistoryCSV(); });

  document.getElementById('clearSignalHistoryBtn')
    ?.addEventListener('click', () => { if (typeof clearSignalHistory === 'function') clearSignalHistory(); });

  // ── 11. Price alerts ─────────────────────────────────────────────────────
  document.getElementById('addAlertBtn')
    ?.addEventListener('click', () => { if (typeof addAlert === 'function') addAlert(); });

  // ── 12. Paper trading ────────────────────────────────────────────────────
  document.getElementById('ptFillPriceBtn')
    ?.addEventListener('click', () => { if (typeof fillCurrentPrice === 'function') fillCurrentPrice(); });

  document.getElementById('ptBuyBtn')
    ?.addEventListener('click', () => { if (typeof executePaperTrade === 'function') executePaperTrade('buy'); });

  document.getElementById('ptSellBtn')
    ?.addEventListener('click', () => { if (typeof executePaperTrade === 'function') executePaperTrade('sell'); });

  document.getElementById('ptResetBtn')
    ?.addEventListener('click', () => { if (typeof resetPaperTrading === 'function') resetPaperTrading(); });

  // ── 13. Global stock search (oninput) ────────────────────────────────────
  document.getElementById('usStockSearch')?.addEventListener('input', function () {
    if (typeof filterGlobalStocks === 'function') filterGlobalStocks('us', this.value);
  });
  document.getElementById('ukStockSearch')?.addEventListener('input', function () {
    if (typeof filterGlobalStocks === 'function') filterGlobalStocks('uk', this.value);
  });

});

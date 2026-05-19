'use strict';

/**
 * SignalActionPanel — unified "act on this signal" modal
 *
 * Flow:  SignalActionPanel.open(signal)
 *   1. Renders signal header + reasons immediately
 *   2. Computes Kelly sizing immediately
 *   3. Async: runs LLM agent council, fills AI section when ready
 *   4. "Log This Trade" pre-fills TradeJournal with all computed fields
 */
const SignalActionPanel = (() => {

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function fmtPrice(p) {
    if (!p || isNaN(p)) return '—';
    if (p >= 1000) return '$' + p.toLocaleString('en', { maximumFractionDigits: 2 });
    if (p >= 1)    return '$' + p.toFixed(4);
    return '$' + p.toFixed(6);
  }

  let currentSignal = null;
  let currentKelly  = null;

  function getCapital() {
    return parseFloat(localStorage.getItem('sap_capital') || '10000');
  }

  // ── Open ───────────────────────────────────────────────────────────────

  function open(signal) {
    if (!signal) return;
    currentSignal = signal;
    currentKelly  = computeKelly(signal, getCapital());

    ensureModal();
    renderPanel();
    document.getElementById('sap-overlay').style.display = 'flex';

    if (typeof LLMTradeEngine !== 'undefined') {
      LLMTradeEngine.analyzeSignal(signal)
        .then(renderAiSection)
        .catch(() => {
          const el = document.getElementById('sap-ai-body');
          if (el) el.innerHTML = '<div class="sap-ai-note">AI analysis unavailable — add an OpenRouter key in Settings to enable.</div>';
        });
    } else {
      const el = document.getElementById('sap-ai-body');
      if (el) el.innerHTML = '<div class="sap-ai-note">LLM engine not loaded.</div>';
    }
  }

  function close() {
    const el = document.getElementById('sap-overlay');
    if (el) el.style.display = 'none';
  }

  // ── Kelly helper ───────────────────────────────────────────────────────

  function computeKelly(signal, capital) {
    if (typeof KellyPositionSizer === 'undefined') return null;
    if (!signal?.price || signal.direction === 'NEUTRAL') return null;
    return KellyPositionSizer.fromSignal(signal, capital);
  }

  // ── Modal shell ────────────────────────────────────────────────────────

  function ensureModal() {
    if (document.getElementById('sap-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id        = 'sap-overlay';
    overlay.className = 'sap-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    injectStyles();
  }

  // ── Full panel render ──────────────────────────────────────────────────

  function renderPanel() {
    const overlay = document.getElementById('sap-overlay');
    if (!overlay || !currentSignal) return;

    const sig      = currentSignal;
    const kelly    = currentKelly;
    const capital  = getCapital();
    const isLong   = sig.direction === 'LONG';
    const isShort  = sig.direction === 'SHORT';
    const dirClass = isLong ? 'sap-long' : isShort ? 'sap-short' : 'sap-neutral';
    const dirLabel = isLong ? '▲ LONG' : isShort ? '▼ SHORT' : '— NEUTRAL';

    const reasonsHtml = (sig.reasons || []).length
      ? `<ul class="sap-reasons">${(sig.reasons).map(r => `<li>${esc(r)}</li>`).join('')}</ul>`
      : '';

    const sourcesHtml = (sig.sources || []).length
      ? sig.sources.map(s => `<span class="sap-source-chip">${esc(s)}</span>`).join('')
      : '';

    overlay.innerHTML = `
      <div class="sap-panel" role="dialog" aria-modal="true">

        <!-- Header -->
        <div class="sap-header ${dirClass}-bg">
          <div class="sap-header-left">
            <div class="sap-symbol">${esc(sig.symbol)}</div>
            <div class="sap-dir-badge ${dirClass}">${dirLabel}</div>
            <div class="sap-conf-label">${esc(String(sig.confidence))}% confidence</div>
            ${sourcesHtml ? `<div class="sap-sources">${sourcesHtml}</div>` : ''}
          </div>
          <div class="sap-header-right">
            ${sig.price ? `<div class="sap-price">${esc(fmtPrice(sig.price))}</div>` : ''}
            <button class="sap-close-btn" onclick="SignalActionPanel.close()" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="sap-conf-track"><div class="sap-conf-fill ${dirClass}" style="width:${esc(String(sig.confidence))}%"></div></div>

        <!-- Body -->
        <div class="sap-body">

          <!-- Why this signal -->
          ${reasonsHtml ? `
          <div class="sap-section">
            <div class="sap-section-title">Why This Signal</div>
            ${reasonsHtml}
          </div>
          ` : ''}

          <!-- AI Reasoning (populated async) -->
          <div class="sap-section">
            <div class="sap-section-title">🤖 AI Agent Council</div>
            <div id="sap-ai-body" class="sap-ai-loading">
              <div class="sap-spinner"></div>
              <span>Running multi-agent analysis…</span>
            </div>
          </div>

          <!-- Kelly Position Sizing -->
          ${sig.direction !== 'NEUTRAL' ? `
          <div class="sap-section">
            <div class="sap-section-title">
              📐 Position Sizing
              <span class="sap-capital-wrap">
                Capital: <input
                  class="sap-capital-input"
                  id="sap-capital-input"
                  type="number"
                  value="${esc(String(capital))}"
                  min="100"
                  step="500"
                  onchange="SignalActionPanel.updateCapital(this.value)"
                /> USD
              </span>
            </div>
            <div id="sap-kelly-body">${kellyHtml(kelly, capital)}</div>
          </div>
          ` : ''}

          <!-- Action buttons -->
          <div class="sap-actions">
            ${sig.direction !== 'NEUTRAL' ? `
            <button class="sap-btn-primary" onclick="SignalActionPanel.logTrade()">
              📝 Log This Trade
            </button>
            ` : ''}
            <button class="sap-btn-secondary" onclick="switchSection && switchSection('dashboard'); SignalActionPanel.close()">
              Open in Cockpit →
            </button>
            <button class="sap-btn-ghost" onclick="SignalActionPanel.close()">Dismiss</button>
          </div>

          <div class="sap-disclaimer">⚠ Not financial advice. Auto-generated from technical indicators.</div>
        </div>
      </div>
    `;
  }

  // ── Kelly HTML fragment ────────────────────────────────────────────────

  function kellyHtml(kelly, capital) {
    if (!kelly) return '<div class="sap-kelly-skip">No sizing recommended for neutral signals.</div>';

    const pctDelta = p => p >= 0
      ? `<span style="color:#2dd882">+${p.toFixed(2)}%</span>`
      : `<span style="color:#ff5f57">${p.toFixed(2)}%</span>`;

    const entryDeltaSl  = ((kelly.stopLoss  - kelly.entryPrice) / kelly.entryPrice * 100);
    const entryDeltaTp  = ((kelly.takeProfit - kelly.entryPrice) / kelly.entryPrice * 100);

    return `
      <div class="sap-kelly-banner" style="border-color:${kelly.sizeColor};background:${kelly.sizeColor}12">
        <span class="sap-kelly-rating" style="color:${kelly.sizeColor}">${esc(kelly.sizeRating)}</span>
        <span class="sap-kelly-rec">Recommended: <strong>$${kelly.dollarAmount.toLocaleString('en',{maximumFractionDigits:0})}</strong> (${esc(String(kelly.recommendedPct))}% of $${capital.toLocaleString()})</span>
      </div>
      <div class="sap-kelly-grid">
        <div class="sap-kstat">
          <div class="sap-kstat-label">Entry</div>
          <div class="sap-kstat-value">${esc(fmtPrice(kelly.entryPrice))}</div>
          <div class="sap-kstat-sub">${esc(String(kelly.units))} units</div>
        </div>
        <div class="sap-kstat">
          <div class="sap-kstat-label">Stop Loss</div>
          <div class="sap-kstat-value" style="color:#ff5f57">${esc(fmtPrice(kelly.stopLoss))}</div>
          <div class="sap-kstat-sub">${pctDelta(entryDeltaSl)} · Max loss $${kelly.maxLoss.toLocaleString('en',{maximumFractionDigits:0})}</div>
        </div>
        <div class="sap-kstat">
          <div class="sap-kstat-label">Take Profit</div>
          <div class="sap-kstat-value" style="color:#2dd882">${esc(fmtPrice(kelly.takeProfit))}</div>
          <div class="sap-kstat-sub">${pctDelta(entryDeltaTp)} · Max gain $${kelly.maxGain.toLocaleString('en',{maximumFractionDigits:0})}</div>
        </div>
        <div class="sap-kstat">
          <div class="sap-kstat-label">Risk : Reward</div>
          <div class="sap-kstat-value" style="color:${kelly.rewardRiskRatio >= 2 ? '#2dd882' : kelly.rewardRiskRatio >= 1.5 ? '#f59e0b' : '#ff5f57'}">${esc(kelly.riskRewardLabel)}</div>
          <div class="sap-kstat-sub">Win rate: 55% assumed</div>
        </div>
      </div>
    `;
  }

  // ── AI section (async update) ──────────────────────────────────────────

  function renderAiSection(data) {
    const el = document.getElementById('sap-ai-body');
    if (!el) return;
    if (!data?.result) {
      el.innerHTML = '<div class="sap-ai-note">Analysis failed — could not fetch indicator data.</div>';
      return;
    }

    const { result, agents, llmText } = data;
    const dirColor = result.direction === 'LONG' ? '#2dd882'
                   : result.direction === 'SHORT' ? '#ff5f57' : '#f59e0b';

    const agentRows = (agents || []).map(a => {
      const col = a.verdict === 'LONG' ? '#2dd882' : a.verdict === 'SHORT' ? '#ff5f57' : '#f59e0b';
      const reasonRows = (a.reasons || []).slice(0, 2).map(r => {
        const dot = r.bias === 'BULLISH' ? '#2dd882' : r.bias === 'BEARISH' ? '#ff5f57' : r.bias === 'WARNING' ? '#f59e0b' : '#888';
        return `<div class="sap-agent-reason"><span class="sap-dot" style="background:${dot}"></span>${esc(r.factor)}: ${esc(r.detail)}</div>`;
      }).join('');
      return `
        <div class="sap-agent-card">
          <div class="sap-agent-header">
            <span class="sap-agent-icon">${esc(a.icon)}</span>
            <div class="sap-agent-meta">
              <div class="sap-agent-name">${esc(a.name)}</div>
              <div class="sap-agent-summary">${esc(a.summary)}</div>
            </div>
            <div class="sap-agent-verdict" style="color:${col}">${esc(a.verdict)} · ${esc(String(a.confidence))}%</div>
          </div>
          ${reasonRows ? `<div class="sap-agent-reasons">${reasonRows}</div>` : ''}
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="sap-chief" style="border-color:${dirColor}30;background:${dirColor}08">
        <span class="sap-chief-signal" style="color:${dirColor}">${esc(result.signal)}</span>
        <div class="sap-chief-right">
          <span class="sap-chief-conf">${esc(String(result.confidence))}% confidence</span>
          <span class="sap-chief-source">${esc(result.source || 'Rule Engine')}</span>
        </div>
      </div>
      <div class="sap-agents">${agentRows}</div>
      ${llmText ? `<div class="sap-llm-text">${esc(llmText).replace(/\n/g, '<br/>')}</div>` : ''}
    `;
  }

  // ── Public actions ─────────────────────────────────────────────────────

  function logTrade() {
    if (!currentSignal || typeof TradeJournal === 'undefined') return;
    TradeJournal.logFromSignal(currentSignal, currentKelly);
    close();
  }

  function updateCapital(val) {
    const capital = parseFloat(val) || 10000;
    localStorage.setItem('sap_capital', String(capital));
    if (!currentSignal) return;
    currentKelly = computeKelly(currentSignal, capital);
    const body = document.getElementById('sap-kelly-body');
    if (body) body.innerHTML = kellyHtml(currentKelly, capital);
  }

  // ── Styles ─────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('sap-styles')) return;
    const s = document.createElement('style');
    s.id = 'sap-styles';
    s.textContent = `
      .sap-overlay {
        position: fixed; inset: 0; z-index: 9000;
        background: rgba(0,0,0,0.6);
        display: none; align-items: center; justify-content: center;
        backdrop-filter: blur(4px);
        padding: 1rem;
      }

      .sap-panel {
        background: var(--color-bg-primary, #0f1117);
        border: 1px solid var(--color-border, #2a2d3e);
        border-radius: 16px;
        width: 100%; max-width: 680px;
        max-height: 90vh;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        animation: sap-slide-in 0.2s ease;
      }
      @keyframes sap-slide-in {
        from { opacity: 0; transform: translateY(24px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1); }
      }

      .sap-header {
        display: flex; align-items: flex-start; justify-content: space-between;
        padding: 1.25rem 1.5rem 1rem;
        gap: 1rem;
      }
      .sap-long-bg  { background: rgba(45,216,130,0.06); }
      .sap-short-bg { background: rgba(255,95,87,0.06); }
      .sap-neutral-bg { background: rgba(245,158,11,0.06); }

      .sap-header-left { display: flex; flex-direction: column; gap: 0.35rem; }
      .sap-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex-shrink: 0; }

      .sap-symbol { font-size: 2rem; font-weight: 800; color: var(--color-text-primary, #fff); line-height: 1; }
      .sap-price  { font-size: 1.1rem; font-weight: 600; color: var(--color-text-muted, #8892a4); }

      .sap-dir-badge {
        display: inline-block; font-size: 0.85rem; font-weight: 700;
        padding: 0.25rem 0.6rem; border-radius: 6px; letter-spacing: 0.05em;
      }
      .sap-long    { background: rgba(45,216,130,0.15);  color: #2dd882; }
      .sap-short   { background: rgba(255,95,87,0.15);   color: #ff5f57; }
      .sap-neutral { background: rgba(245,158,11,0.15);  color: #f59e0b; }

      .sap-conf-label { font-size: 0.8rem; color: var(--color-text-muted, #8892a4); }

      .sap-sources { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.1rem; }
      .sap-source-chip {
        font-size: 0.7rem; padding: 0.15rem 0.45rem;
        background: var(--color-bg-secondary, #1a1d2e);
        border: 1px solid var(--color-border, #2a2d3e);
        border-radius: 4px; color: var(--color-text-muted, #8892a4);
      }

      .sap-conf-track { height: 3px; background: var(--color-border, #2a2d3e); }
      .sap-conf-fill  { height: 100%; border-radius: 0; transition: width 0.4s ease; }
      .sap-conf-fill.sap-long    { background: #2dd882; }
      .sap-conf-fill.sap-short   { background: #ff5f57; }
      .sap-conf-fill.sap-neutral { background: #f59e0b; }

      .sap-close-btn {
        background: transparent; border: 1px solid var(--color-border, #2a2d3e);
        color: var(--color-text-muted, #8892a4);
        border-radius: 8px; width: 32px; height: 32px;
        cursor: pointer; font-size: 0.9rem;
        transition: all 0.15s;
      }
      .sap-close-btn:hover { border-color: #ff5f57; color: #ff5f57; }

      .sap-body {
        overflow-y: auto; padding: 1.25rem 1.5rem;
        display: flex; flex-direction: column; gap: 1.25rem;
      }

      .sap-section {}
      .sap-section-title {
        font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--color-text-muted, #8892a4);
        margin-bottom: 0.6rem;
        display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      }

      .sap-reasons { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.35rem; }
      .sap-reasons li {
        font-size: 0.85rem; color: var(--color-text-secondary, #c0c9d6);
        padding: 0.4rem 0.6rem;
        background: var(--color-bg-secondary, #1a1d2e);
        border-radius: 6px;
        border-left: 3px solid var(--color-border, #2a2d3e);
      }

      /* AI section */
      .sap-ai-loading {
        display: flex; align-items: center; gap: 0.75rem;
        color: var(--color-text-muted, #8892a4); font-size: 0.875rem;
        padding: 0.75rem;
      }
      .sap-spinner {
        width: 18px; height: 18px; border-radius: 50%;
        border: 2px solid var(--color-border, #2a2d3e);
        border-top-color: var(--color-accent-primary, #6378dc);
        animation: spin 0.8s linear infinite; flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .sap-ai-note { font-size: 0.8rem; color: var(--color-text-muted, #8892a4); padding: 0.5rem; }

      .sap-chief {
        display: flex; align-items: center; justify-content: space-between;
        border: 1px solid; border-radius: 10px; padding: 0.75rem 1rem;
        margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;
      }
      .sap-chief-signal { font-size: 1.1rem; font-weight: 800; }
      .sap-chief-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
      .sap-chief-conf   { font-size: 0.85rem; color: var(--color-text-primary, #fff); font-weight: 600; }
      .sap-chief-source { font-size: 0.72rem; color: var(--color-text-muted, #8892a4); }

      .sap-agents { display: flex; flex-direction: column; gap: 0.5rem; }
      .sap-agent-card {
        background: var(--color-bg-secondary, #1a1d2e);
        border: 1px solid var(--color-border, #2a2d3e);
        border-radius: 8px; padding: 0.6rem 0.75rem;
      }
      .sap-agent-header { display: flex; align-items: center; gap: 0.6rem; }
      .sap-agent-icon   { font-size: 1.1rem; flex-shrink: 0; }
      .sap-agent-meta   { flex: 1; min-width: 0; }
      .sap-agent-name   { font-size: 0.8rem; font-weight: 600; color: var(--color-text-primary, #fff); }
      .sap-agent-summary { font-size: 0.72rem; color: var(--color-text-muted, #8892a4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sap-agent-verdict { font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
      .sap-agent-reasons { margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.2rem; }
      .sap-agent-reason  { font-size: 0.75rem; color: var(--color-text-muted, #8892a4); display: flex; align-items: flex-start; gap: 0.4rem; }
      .sap-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 0.3rem; }

      .sap-llm-text {
        font-size: 0.8rem; color: var(--color-text-secondary, #c0c9d6);
        background: var(--color-bg-secondary, #1a1d2e);
        border: 1px solid var(--color-border, #2a2d3e);
        border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem;
        line-height: 1.55;
      }

      /* Kelly */
      .sap-capital-wrap {
        font-weight: 400; font-size: 0.75rem; color: var(--color-text-muted, #8892a4);
        display: inline-flex; align-items: center; gap: 0.3rem; text-transform: none; letter-spacing: 0;
      }
      .sap-capital-input {
        width: 90px; background: var(--color-bg-secondary, #1a1d2e);
        border: 1px solid var(--color-border, #2a2d3e);
        border-radius: 6px; color: var(--color-text-primary, #fff);
        font-size: 0.8rem; padding: 0.2rem 0.4rem; outline: none;
      }
      .sap-capital-input:focus { border-color: var(--color-accent-primary, #6378dc); }

      .sap-kelly-banner {
        border: 1px solid; border-radius: 8px; padding: 0.6rem 0.85rem;
        display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;
        flex-wrap: wrap;
      }
      .sap-kelly-rating { font-size: 0.9rem; font-weight: 800; }
      .sap-kelly-rec    { font-size: 0.8rem; color: var(--color-text-muted, #8892a4); }

      .sap-kelly-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem;
      }
      @media(max-width:500px) { .sap-kelly-grid { grid-template-columns: repeat(2, 1fr); } }

      .sap-kstat {
        background: var(--color-bg-secondary, #1a1d2e);
        border: 1px solid var(--color-border, #2a2d3e);
        border-radius: 8px; padding: 0.6rem 0.5rem; text-align: center;
      }
      .sap-kstat-label { font-size: 0.68rem; color: var(--color-text-muted, #8892a4); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
      .sap-kstat-value { font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary, #fff); }
      .sap-kstat-sub   { font-size: 0.68rem; color: var(--color-text-muted, #8892a4); margin-top: 0.15rem; }

      .sap-kelly-skip { font-size: 0.8rem; color: var(--color-text-muted, #8892a4); }

      /* Actions */
      .sap-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }

      .sap-btn-primary {
        background: linear-gradient(135deg, var(--color-accent-primary, #6378dc), #4f62c8);
        color: #fff; border: none; border-radius: 10px;
        font-size: 0.9rem; font-weight: 600; padding: 0.65rem 1.25rem;
        cursor: pointer; transition: all 0.2s;
        box-shadow: 0 4px 16px rgba(99,120,220,0.3);
        flex: 1; min-width: 140px;
      }
      .sap-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,120,220,0.4); }

      .sap-btn-secondary {
        background: transparent;
        border: 1px solid var(--color-accent-primary, #6378dc);
        color: var(--color-accent-primary, #6378dc);
        border-radius: 10px; font-size: 0.875rem; font-weight: 600;
        padding: 0.65rem 1rem; cursor: pointer; transition: all 0.2s;
        flex: 1; min-width: 120px;
      }
      .sap-btn-secondary:hover { background: rgba(99,120,220,0.08); }

      .sap-btn-ghost {
        background: transparent; border: 1px solid var(--color-border, #2a2d3e);
        color: var(--color-text-muted, #8892a4);
        border-radius: 10px; font-size: 0.875rem; padding: 0.65rem 1rem;
        cursor: pointer; transition: all 0.2s;
      }
      .sap-btn-ghost:hover { border-color: var(--color-text-muted, #8892a4); }

      .sap-disclaimer {
        font-size: 0.72rem; color: var(--color-text-muted, #8892a4);
        text-align: center; padding-top: 0.25rem;
      }
    `;
    document.head.appendChild(s);
  }

  return { open, close, logTrade, updateCapital };

})();

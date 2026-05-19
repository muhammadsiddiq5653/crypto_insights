'use strict';

/**
 * upgradeModal.js — Pro plan upgrade prompt.
 *
 * Shows when the user hits a gated Pro feature (API returns 402 UPGRADE_REQUIRED).
 * Wire up via UpgradeModal.interceptFetch() at app init.
 * When Stripe is integrated, replace CHECKOUT_URL with a real /api/billing/checkout link.
 */

const UpgradeModal = (() => {

  const PRO_FEATURES = [
    { icon: '📊', title: 'Multi-Timeframe Signals', desc: '1H · 4H · 1D · 1W consensus — see if all timeframes agree before entering.' },
    { icon: '🧠', title: 'AI Trade Engine', desc: '3-agent AI council reasons over signals, on-chain data, and macro context.' },
    { icon: '🐋', title: 'On-Chain Analytics', desc: 'Whale wallet flows, exchange netflow, MVRV & SOPR ratio — data the chart hides.' },
    { icon: '🔮', title: 'Prediction Markets', desc: 'Polymarket odds on crypto outcomes — crowd probability meets technical signals.' },
    { icon: '🌍', title: 'Macro Sentiment', desc: 'Fed rates, CPI, GDP, yield curve — macro tailwinds/headwinds for your trades.' },
    { icon: '🤖', title: 'ML Price Prediction', desc: 'Ensemble model (Ridge + Random Forest + Gradient Boost) forecasts 1h / 24h / 7d.' },
    { icon: '🔔', title: 'Server-Side Alerts', desc: 'Slack alerts fire even when your browser is closed — price & RSI triggers.' },
    { icon: '📡', title: 'Live Kline Data (Binance)', desc: 'Full candlestick data proxied server-side — faster, cached, no rate limits.' },
  ];

  const FREE_FEATURES = [
    'Crypto, PSX, Forex & US/UK stock prices',
    'Technical analysis (RSI, MACD, Bollinger, MA)',
    'Trading signals for 24 coins',
    'Paper trading — $10,000 virtual portfolio',
    'Trade journal & portfolio tracker',
    'Crypto screener & market scanner',
    'Trading Academy (30+ lessons)',
    'Price alerts (browser-based)',
  ];

  function injectStyles() {
    if (document.getElementById('upgrade-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'upgrade-modal-styles';
    s.textContent = `
      #upgrade-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9900;
        display: flex; align-items: center; justify-content: center; padding: 1rem;
        animation: um-fade-in 0.18s ease;
      }
      @keyframes um-fade-in { from { opacity:0 } to { opacity:1 } }
      #upgrade-modal {
        background: #0d1117; border: 1px solid rgba(99,120,220,0.25); border-radius: 16px;
        max-width: 680px; width: 100%; max-height: 90vh; overflow-y: auto;
        padding: 2rem; position: relative; animation: um-slide-up 0.2s ease;
        box-shadow: 0 24px 80px rgba(0,0,0,0.6);
      }
      @keyframes um-slide-up { from { transform:translateY(20px); opacity:0 } to { transform:none; opacity:1 } }
      #upgrade-modal .um-close {
        position: absolute; top: 1rem; right: 1rem; background: rgba(255,255,255,0.07);
        border: none; color: #8892a4; font-size: 1.25rem; width: 32px; height: 32px;
        border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      #upgrade-modal .um-close:hover { background: rgba(255,255,255,0.15); color: #fff; }
      .um-badge { display: inline-block; background: linear-gradient(135deg,#5b72ff22,#a855f722);
        border: 1px solid rgba(99,120,220,0.4); color: #a5b4fc; border-radius: 20px;
        font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
        padding: 0.2rem 0.7rem; margin-bottom: 0.75rem; }
      .um-title { font-size: 1.5rem; font-weight: 800; color: #e8eaf0; margin: 0 0 0.5rem; letter-spacing: -0.03em; }
      .um-subtitle { color: #8892a4; font-size: 0.9rem; margin: 0 0 1.5rem; }
      .um-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
      @media (max-width: 560px) { .um-columns { grid-template-columns: 1fr; } }
      .um-col-header { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
        margin-bottom: 0.75rem; }
      .um-col-header.pro { color: #a5b4fc; }
      .um-col-header.free { color: #6b7280; }
      .um-pro-feature { display: flex; gap: 0.75rem; margin-bottom: 0.875rem; }
      .um-pro-feature .um-fi { font-size: 1.25rem; flex-shrink: 0; width: 1.75rem; }
      .um-pro-feature .um-ft { font-size: 0.8125rem; font-weight: 600; color: #e8eaf0; margin-bottom: 0.15rem; }
      .um-pro-feature .um-fd { font-size: 0.75rem; color: #8892a4; line-height: 1.45; }
      .um-free-item { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8125rem;
        color: #6b7280; margin-bottom: 0.5rem; }
      .um-free-item::before { content: '✓'; color: #4b5563; flex-shrink: 0; }
      .um-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0 0 1.5rem; }
      .um-plans { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
      @media (max-width: 560px) { .um-plans { grid-template-columns: 1fr; } }
      .um-plan {
        border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.1rem 1rem;
        cursor: pointer; transition: border-color 0.15s, background 0.15s; position: relative;
        background: rgba(255,255,255,0.02);
      }
      .um-plan:hover { border-color: rgba(99,120,220,0.4); background: rgba(99,120,220,0.05); }
      .um-plan.selected { border-color: #5b72ff; background: rgba(91,114,255,0.08); }
      .um-plan.popular { border-color: rgba(168,85,247,0.5); }
      .um-popular-badge {
        position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg,#5b72ff,#a855f7); color: #fff;
        font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
        padding: 0.2rem 0.6rem; border-radius: 20px; white-space: nowrap;
      }
      .um-plan-name { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
        color: #8892a4; margin-bottom: 0.5rem; }
      .um-plan-price { font-size: 1.625rem; font-weight: 800; color: #e8eaf0; line-height: 1; margin-bottom: 0.2rem; }
      .um-plan-price span { font-size: 0.85rem; font-weight: 500; color: #8892a4; }
      .um-plan-note { font-size: 0.72rem; color: #6b7280; margin-top: 0.35rem; min-height: 1.4em; }
      .um-plan-note.highlight { color: #a78bfa; }
      .um-seat-counter { font-size: 0.7rem; color: #f59e0b; font-weight: 600; margin-top: 0.4rem; }
      .um-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
      .um-btn-primary {
        background: linear-gradient(135deg,#5b72ff,#a855f7); color: #fff;
        border: none; border-radius: 8px; padding: 0.75rem 1.5rem;
        font-size: 0.9375rem; font-weight: 700; cursor: pointer; text-decoration: none;
        display: inline-flex; align-items: center; gap: 0.5rem; transition: opacity 0.15s;
      }
      .um-btn-primary:hover { opacity: 0.88; }
      .um-btn-secondary {
        background: transparent; color: #8892a4; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; padding: 0.75rem 1.25rem; font-size: 0.875rem; cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
      }
      .um-btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: #e8eaf0; }
      .um-feature-pill { display: inline-block; background: rgba(99,120,220,0.12); border: 1px solid rgba(99,120,220,0.2);
        border-radius: 6px; color: #a5b4fc; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.6rem;
        margin: 0 0.25rem 0.25rem 0; }
    `;
    document.head.appendChild(s);
  }

  function buildHTML(featureName) {
    const featLabel = featureName ? `<div style="margin-bottom:1rem"><span class="um-feature-pill">🔒 ${featureName}</span> is a Pro feature</div>` : '';
    return `
      <div id="upgrade-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="um-title">
        <div id="upgrade-modal">
          <button class="um-close" id="um-close-btn" aria-label="Close">✕</button>

          <div class="um-badge">⚡ Pro Plan</div>
          <h2 class="um-title" id="um-title">Unlock the full TraderPro cockpit</h2>
          <p class="um-subtitle">${featLabel}Get every signal, every data source, every edge — for one flat price.</p>

          <div class="um-columns">
            <div>
              <div class="um-col-header pro">✨ Pro features</div>
              ${PRO_FEATURES.map(f => `
                <div class="um-pro-feature">
                  <div class="um-fi">${f.icon}</div>
                  <div>
                    <div class="um-ft">${f.title}</div>
                    <div class="um-fd">${f.desc}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div>
              <div class="um-col-header free">✓ Always free</div>
              ${FREE_FEATURES.map(f => `<div class="um-free-item">${f}</div>`).join('')}
            </div>
          </div>

          <hr class="um-divider">

          <div class="um-plans">
            <div class="um-plan" data-plan="monthly" id="um-plan-monthly">
              <div class="um-plan-name">Monthly</div>
              <div class="um-plan-price">$19<span>/mo</span></div>
              <div class="um-plan-note">Cancel any time.</div>
            </div>
            <div class="um-plan popular selected" data-plan="annual" id="um-plan-annual">
              <div class="um-popular-badge">⭐ Most Popular</div>
              <div class="um-plan-name">Annual</div>
              <div class="um-plan-price">$149<span>/yr</span></div>
              <div class="um-plan-note highlight">= $12.40/mo · Save 35%</div>
            </div>
            <div class="um-plan" data-plan="lifetime" id="um-plan-lifetime">
              <div class="um-plan-name">Lifetime</div>
              <div class="um-plan-price">$199<span> once</span></div>
              <div class="um-plan-note">Pay once, own forever.</div>
              <div class="um-seat-counter">🔥 <span id="um-seats-left">147</span> of 200 seats left</div>
            </div>
          </div>

          <div class="um-actions">
            <button class="um-btn-primary" id="um-upgrade-btn">🚀 Upgrade to Pro</button>
            <button class="um-btn-secondary" id="um-dismiss-btn">Maybe later</button>
          </div>
        </div>
      </div>
    `;
  }

  function show(featureName) {
    if (document.getElementById('upgrade-modal-overlay')) return;
    injectStyles();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML(featureName);
    document.body.appendChild(wrapper.firstElementChild);

    const overlay = document.getElementById('upgrade-modal-overlay');
    const close = () => overlay?.remove();

    let selectedPlan = 'annual';

    // Plan card selection
    ['monthly', 'annual', 'lifetime'].forEach(plan => {
      document.getElementById(`um-plan-${plan}`)?.addEventListener('click', () => {
        selectedPlan = plan;
        ['monthly', 'annual', 'lifetime'].forEach(p => {
          document.getElementById(`um-plan-${p}`)?.classList.toggle('selected', p === plan);
        });
        const btn = document.getElementById('um-upgrade-btn');
        const labels = { monthly: '🚀 Upgrade — $19/mo', annual: '🚀 Upgrade — $149/yr', lifetime: '🚀 Get Lifetime Access — $199' };
        btn.textContent = labels[plan];
      });
    });

    document.getElementById('um-close-btn')?.addEventListener('click', close);
    document.getElementById('um-dismiss-btn')?.addEventListener('click', close);
    overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.getElementById('um-upgrade-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('um-upgrade-btn');
      btn.textContent = 'Loading…';
      btn.disabled = true;
      try {
        const res  = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          btn.textContent = data.error || 'Error — try again';
          btn.disabled = false;
        }
      } catch {
        btn.textContent = 'Error — try again';
        btn.disabled = false;
      }
    });

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /**
   * Monkey-patch the global fetch so any 402 UPGRADE_REQUIRED response automatically
   * opens the upgrade modal. Call once at app init.
   */
  function interceptFetch() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(...args) {
      const res = await originalFetch(...args);
      if (res.status === 402) {
        // Clone the response so it can still be consumed by the caller
        const clone = res.clone();
        clone.json().then(body => {
          if (body?.code === 'UPGRADE_REQUIRED') {
            show(body.requiredPlan ? `${body.requiredPlan.charAt(0).toUpperCase() + body.requiredPlan.slice(1)} plan required` : null);
          }
        }).catch(() => {});
      }
      return res;
    };
  }

  return { show, interceptFetch };
})();

// Auto-intercept fetch on load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => UpgradeModal.interceptFetch());
}

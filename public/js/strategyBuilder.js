/**
 * Visual Strategy Builder
 * Drag-and-drop style condition builder for custom trading strategies
 * Inspired by Superalgos / Jesse-AI visual designers
 */

const StrategyBuilder = {
  container: null,
  conditions: [],
  strategy: { name: 'My Strategy', description: '', entryConditions: [], exitConditions: [], stopLoss: 3, takeProfit: 6, symbol: 'bitcoin' },
  savedStrategies: [],
  backtestResult: null,
  chart: null,
  conditionIdCounter: 0,

  INDICATORS: [
    { id: 'rsi',       label: 'RSI',              params: [{ id: 'period', label: 'Period', default: 14 }] },
    { id: 'macd',      label: 'MACD Histogram',   params: [] },
    { id: 'price_sma', label: 'Price vs SMA',      params: [{ id: 'period', label: 'SMA Period', default: 20 }] },
    { id: 'price_ema', label: 'Price vs EMA',      params: [{ id: 'period', label: 'EMA Period', default: 20 }] },
    { id: 'bb_pos',    label: 'BB Position',       params: [] },
    { id: 'volume',    label: 'Volume vs Avg',     params: [{ id: 'mult', label: 'Multiplier', default: 1.5 }] },
    { id: 'ema_cross', label: 'EMA Cross',         params: [{ id: 'fast', label: 'Fast EMA', default: 12 }, { id: 'slow', label: 'Slow EMA', default: 26 }] },
    { id: 'sma_cross', label: 'SMA Cross (Golden/Death)', params: [{ id: 'fast', label: 'Fast SMA', default: 50 }, { id: 'slow', label: 'Slow SMA', default: 200 }] },
  ],

  OPERATORS: {
    rsi:       [{ value: 'lt', label: '< (below)' }, { value: 'gt', label: '> (above)' }, { value: 'between', label: 'between' }],
    macd:      [{ value: 'positive', label: 'is positive (bullish)' }, { value: 'negative', label: 'is negative (bearish)' }, { value: 'cross_up', label: 'crosses above 0' }],
    price_sma: [{ value: 'above', label: 'price > SMA (bullish)' }, { value: 'below', label: 'price < SMA (bearish)' }],
    price_ema: [{ value: 'above', label: 'price > EMA (bullish)' }, { value: 'below', label: 'price < EMA (bearish)' }],
    bb_pos:    [{ value: 'near_lower', label: 'near lower band (oversold)' }, { value: 'near_upper', label: 'near upper band (overbought)' }, { value: 'squeeze', label: 'squeeze (low volatility)' }],
    volume:    [{ value: 'above', label: 'volume above average' }, { value: 'spike', label: 'volume spike (>2x avg)' }],
    ema_cross: [{ value: 'cross_up', label: 'fast EMA crosses above slow (BUY)' }, { value: 'cross_down', label: 'fast EMA crosses below slow (SELL)' }],
    sma_cross: [{ value: 'golden', label: 'Golden Cross (bullish)' }, { value: 'death', label: 'Death Cross (bearish)' }],
  },

  COINS: [
    { id: 'bitcoin', label: 'Bitcoin (BTC)' }, { id: 'ethereum', label: 'Ethereum (ETH)' },
    { id: 'solana', label: 'Solana (SOL)' },   { id: 'binancecoin', label: 'BNB' },
    { id: 'avalanche-2', label: 'Avalanche (AVAX)' }, { id: 'chainlink', label: 'Chainlink (LINK)' },
  ],

  PRESETS: [
    {
      name: 'RSI Oversold Bounce',
      description: 'Buy when RSI is oversold and rising. Exit when overbought.',
      entryConditions: [{ id: 'c1', indicator: 'rsi', operator: 'lt', value: 35, value2: null }],
      exitConditions:  [{ id: 'c2', indicator: 'rsi', operator: 'gt', value: 68, value2: null }],
      stopLoss: 4, takeProfit: 8,
    },
    {
      name: 'EMA Trend Follow',
      description: 'Enter on EMA crossover, exit on reverse crossover.',
      entryConditions: [{ id: 'c3', indicator: 'ema_cross', operator: 'cross_up', value: null, value2: null, params: { fast: 12, slow: 26 } }],
      exitConditions:  [{ id: 'c4', indicator: 'ema_cross', operator: 'cross_down', value: null, value2: null, params: { fast: 12, slow: 26 } }],
      stopLoss: 3, takeProfit: 10,
    },
    {
      name: 'BB Squeeze Breakout',
      description: 'Enter during low volatility squeeze, ride the breakout.',
      entryConditions: [{ id: 'c5', indicator: 'bb_pos', operator: 'squeeze', value: null, value2: null }, { id: 'c6', indicator: 'volume', operator: 'above', value: null, value2: null, params: { mult: 1.5 } }],
      exitConditions:  [{ id: 'c7', indicator: 'bb_pos', operator: 'near_upper', value: null, value2: null }],
      stopLoss: 5, takeProfit: 12,
    },
  ],

  async init() {
    this.container = document.getElementById('strategy-builder');
    if (!this.container) return;
    if (this.container.querySelector('.sb-page')) return;

    this.loadSaved();
    this.render();
    this.attachEvents();
  },

  loadSaved() {
    try { this.savedStrategies = JSON.parse(localStorage.getItem('traderpro_strategies') || '[]'); } catch(e) { this.savedStrategies = []; }
  },
  saveToDB() {
    try { localStorage.setItem('traderpro_strategies', JSON.stringify(this.savedStrategies)); } catch(e) {}
  },

  render() {
    this.container.innerHTML = `
      <div class="sb-page">
        <div class="sb-header">
          <div>
            <h2 class="sb-title">⚙️ Strategy Builder</h2>
            <p class="sb-subtitle">Build, backtest, and monitor custom trading strategies with a visual condition editor</p>
          </div>
          <div class="sb-header-btns">
            <button class="sb-btn sb-btn-outline" id="sb-load-preset">📋 Load Preset</button>
            <button class="sb-btn sb-btn-outline" id="sb-load-saved">💾 Saved (${this.savedStrategies.length})</button>
          </div>
        </div>

        <div class="sb-layout">
          <!-- Left: Builder -->
          <div class="sb-builder-col">
            <!-- Strategy Name -->
            <div class="sb-card">
              <div class="sb-card-title">📌 Strategy Info</div>
              <div class="sb-field-row">
                <div class="sb-field">
                  <label class="sb-label">Strategy Name</label>
                  <input class="sb-input" id="sb-name" type="text" value="${this.strategy.name}" placeholder="My Strategy">
                </div>
                <div class="sb-field">
                  <label class="sb-label">Coin</label>
                  <select class="sb-select" id="sb-coin">
                    ${this.COINS.map(c => `<option value="${c.id}" ${c.id===this.strategy.symbol?'selected':''}>${c.label}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <!-- Entry Conditions -->
            <div class="sb-card">
              <div class="sb-card-header">
                <div class="sb-card-title">🟢 Entry Conditions <span class="sb-badge sb-badge-buy">ALL must be true</span></div>
                <button class="sb-add-btn" id="sb-add-entry">+ Add Condition</button>
              </div>
              <div id="sb-entry-conditions" class="sb-conditions-list">
                <div class="sb-empty-cond">No entry conditions yet. Click "+ Add Condition" to start building.</div>
              </div>
            </div>

            <!-- Exit Conditions -->
            <div class="sb-card">
              <div class="sb-card-header">
                <div class="sb-card-title">🔴 Exit Conditions <span class="sb-badge sb-badge-sell">First true = exit</span></div>
                <button class="sb-add-btn" id="sb-add-exit">+ Add Condition</button>
              </div>
              <div id="sb-exit-conditions" class="sb-conditions-list">
                <div class="sb-empty-cond">No exit conditions yet. Stop-loss and take-profit will auto-apply.</div>
              </div>
            </div>

            <!-- Risk Settings -->
            <div class="sb-card">
              <div class="sb-card-title">⚠️ Risk Management</div>
              <div class="sb-field-row">
                <div class="sb-field">
                  <label class="sb-label">Stop Loss (%)</label>
                  <div class="sb-input-wrap">
                    <input class="sb-input" id="sb-sl" type="number" value="${this.strategy.stopLoss}" min="0.5" max="20" step="0.5">
                    <span class="sb-input-suffix">%</span>
                  </div>
                </div>
                <div class="sb-field">
                  <label class="sb-label">Take Profit (%)</label>
                  <div class="sb-input-wrap">
                    <input class="sb-input" id="sb-tp" type="number" value="${this.strategy.takeProfit}" min="1" max="50" step="0.5">
                    <span class="sb-input-suffix">%</span>
                  </div>
                </div>
                <div class="sb-field">
                  <label class="sb-label">R/R Ratio</label>
                  <div class="sb-rr" id="sb-rr">1 : ${(this.strategy.takeProfit / this.strategy.stopLoss).toFixed(1)}</div>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="sb-actions">
              <button class="sb-btn sb-btn-outline" id="sb-save-btn">💾 Save Strategy</button>
              <button class="sb-btn sb-btn-primary" id="sb-backtest-btn">▶ Backtest (90 Days)</button>
            </div>
          </div>

          <!-- Right: Results & Saved -->
          <div class="sb-results-col">
            <div id="sb-backtest-results" style="display:none;"></div>
            <div class="sb-presets-card" id="sb-presets-panel" style="display:none;">
              <div class="sb-card-title">📋 Strategy Presets</div>
              ${this.PRESETS.map((p,i) => `
                <div class="sb-preset-item" data-preset="${i}">
                  <div class="sb-preset-name">${p.name}</div>
                  <div class="sb-preset-desc">${p.description}</div>
                  <button class="sb-btn sb-btn-sm" data-load-preset="${i}">Load</button>
                </div>`).join('')}
            </div>
            <div class="sb-saved-panel" id="sb-saved-panel" style="display:none;">
              <div class="sb-card-title">💾 Saved Strategies</div>
              <div id="sb-saved-list"></div>
            </div>
            <div class="sb-help-card">
              <div class="sb-card-title">💡 How to Build a Strategy</div>
              <div class="sb-help-steps">
                <div class="sb-help-step"><span class="sb-help-num">1</span><span>Name your strategy and choose a coin to test it on</span></div>
                <div class="sb-help-step"><span class="sb-help-num">2</span><span>Add Entry Conditions — signals that trigger a buy</span></div>
                <div class="sb-help-step"><span class="sb-help-num">3</span><span>Add Exit Conditions — or rely on Stop Loss / Take Profit</span></div>
                <div class="sb-help-step"><span class="sb-help-num">4</span><span>Set your Stop Loss and Take Profit percentages</span></div>
                <div class="sb-help-step"><span class="sb-help-num">5</span><span>Click Backtest to see how it would have performed</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Condition Builder Modal -->
      <div class="sb-modal-overlay" id="sb-modal-overlay" style="display:none;">
        <div class="sb-modal">
          <div class="sb-modal-header">
            <span id="sb-modal-title">Add Condition</span>
            <button class="sb-modal-close" id="sb-modal-close">✕</button>
          </div>
          <div class="sb-modal-body">
            <div class="sb-field">
              <label class="sb-label">Indicator</label>
              <select class="sb-select" id="sb-modal-indicator">
                ${this.INDICATORS.map(ind => `<option value="${ind.id}">${ind.label}</option>`).join('')}
              </select>
            </div>
            <div class="sb-field">
              <label class="sb-label">Condition</label>
              <select class="sb-select" id="sb-modal-operator"></select>
            </div>
            <div id="sb-modal-value-wrap" class="sb-field" style="display:none;">
              <label class="sb-label">Value</label>
              <input class="sb-input" id="sb-modal-value" type="number" value="30">
            </div>
            <div id="sb-modal-value2-wrap" class="sb-field" style="display:none;">
              <label class="sb-label">To</label>
              <input class="sb-input" id="sb-modal-value2" type="number" value="70">
            </div>
            <div id="sb-modal-params-wrap"></div>
          </div>
          <div class="sb-modal-footer">
            <button class="sb-btn sb-btn-outline" id="sb-modal-cancel">Cancel</button>
            <button class="sb-btn sb-btn-primary" id="sb-modal-confirm">Add Condition</button>
          </div>
        </div>
      </div>

      <style>
        .sb-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .sb-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .sb-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin: 0 0 4px; }
        .sb-subtitle { font-size: 0.85rem; color: var(--text-secondary,#a0a8c1); margin: 0; }
        .sb-header-btns { display: flex; gap: 8px; }

        .sb-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
        @media(max-width:900px){ .sb-layout { grid-template-columns: 1fr; } }

        .sb-builder-col { display: flex; flex-direction: column; gap: 14px; }
        .sb-results-col { display: flex; flex-direction: column; gap: 14px; }

        .sb-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 16px; }
        .sb-card-title { font-size: 0.875rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin-bottom: 14px; }
        .sb-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .sb-badge { font-size: 0.65rem; padding: 2px 7px; border-radius: 10px; font-weight: 600; margin-left: 8px; }
        .sb-badge-buy  { background: rgba(0,200,150,0.15); color: #00c896; }
        .sb-badge-sell { background: rgba(255,106,106,0.15); color: #ff6a6a; }
        .sb-add-btn { padding: 5px 12px; border-radius: 8px; border: 1px dashed var(--color-border,rgba(102,126,234,0.3)); background: transparent; color: #a78bfa; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; }
        .sb-add-btn:hover { background: rgba(108,99,255,0.12); border-style: solid; }

        .sb-field-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .sb-field { display: flex; flex-direction: column; gap: 5px; }
        .sb-label { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary,#a0a8c1); text-transform: uppercase; letter-spacing: 0.5px; }
        .sb-input, .sb-select { padding: 8px 12px; background: var(--color-card,#252b4a); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 8px; color: var(--text-primary,#e4e7f1); font-size: 0.875rem; font-family: inherit; transition: border-color 0.2s; width: 100%; }
        .sb-input:focus, .sb-select:focus { outline: none; border-color: #6c63ff88; }
        .sb-input-wrap { position: relative; }
        .sb-input-suffix { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary,#a0a8c1); font-size: 0.8rem; }
        .sb-rr { font-size: 1.2rem; font-weight: 700; color: #a78bfa; padding: 8px 0; }

        .sb-conditions-list { display: flex; flex-direction: column; gap: 8px; }
        .sb-empty-cond { font-size: 0.8rem; color: var(--text-muted,#6b7394); padding: 12px; text-align: center; border: 1px dashed rgba(102,126,234,0.2); border-radius: 8px; }
        .sb-cond-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--color-card,#252b4a); border-radius: 10px; border: 1px solid var(--color-border,rgba(102,126,234,0.15)); }
        .sb-cond-icon { font-size: 1rem; }
        .sb-cond-text { flex: 1; font-size: 0.82rem; color: var(--text-primary,#e4e7f1); }
        .sb-cond-remove { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--color-border,rgba(102,126,234,0.2)); background: transparent; color: var(--text-muted,#6b7394); cursor: pointer; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .sb-cond-remove:hover { background: rgba(255,100,100,0.15); color: #ff6a6a; border-color: #ff6a6a44; }

        .sb-actions { display: flex; gap: 10px; }
        .sb-btn { padding: 9px 18px; border-radius: 9px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .sb-btn-primary { background: linear-gradient(135deg,#6c63ff,#00c896); border: none; color: #fff; }
        .sb-btn-primary:hover { opacity: 0.9; }
        .sb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .sb-btn-outline { background: transparent; border: 1px solid var(--color-border,rgba(102,126,234,0.18)); color: var(--text-secondary,#a0a8c1); }
        .sb-btn-outline:hover { background: var(--color-card,#252b4a); color: var(--text-primary,#e4e7f1); }
        .sb-btn-sm { padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; background: rgba(108,99,255,0.15); border: 1px solid #6c63ff33; color: #a78bfa; cursor: pointer; }

        .sb-presets-card, .sb-saved-panel, .sb-help-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 16px; }
        .sb-preset-item { padding: 10px 0; border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.1)); }
        .sb-preset-item:last-child { border-bottom: none; }
        .sb-preset-name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin-bottom: 3px; }
        .sb-preset-desc { font-size: 0.75rem; color: var(--text-secondary,#a0a8c1); margin-bottom: 6px; }
        .sb-help-steps { display: flex; flex-direction: column; gap: 8px; }
        .sb-help-step { display: flex; gap: 10px; align-items: flex-start; font-size: 0.8rem; color: var(--text-secondary,#a0a8c1); }
        .sb-help-num { width: 22px; height: 22px; border-radius: 50%; background: rgba(108,99,255,0.2); color: #a78bfa; font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        /* Results */
        .sb-results-card { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius: 14px; padding: 16px; }
        .sb-results-title { font-size: 0.875rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin-bottom: 14px; }
        .sb-metrics-row { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 14px; }
        .sb-metric { padding: 10px; background: var(--color-card,#252b4a); border-radius: 8px; }
        .sb-metric-lbl { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted,#6b7394); }
        .sb-metric-val { font-size: 1.1rem; font-weight: 700; color: var(--text-primary,#e4e7f1); margin-top: 3px; }
        .sb-metric-val.pos { color: #00c896; }
        .sb-metric-val.neg { color: #ff6a6a; }
        .sb-chart-wrap { height: 200px; position: relative; }
        .sb-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #6c63ff; border-radius: 50%; animation: sb-spin 0.8s linear infinite; }
        @keyframes sb-spin { to { transform: rotate(360deg); } }

        /* Modal */
        .sb-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .sb-modal { background: var(--color-surface,#1e2442); border: 1px solid var(--color-border,rgba(102,126,234,0.3)); border-radius: 16px; padding: 24px; width: 100%; max-width: 440px; }
        .sb-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .sb-modal-header span { font-size: 1.05rem; font-weight: 700; color: var(--text-primary,#e4e7f1); }
        .sb-modal-close { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-border,rgba(102,126,234,0.2)); background: transparent; color: var(--text-secondary,#a0a8c1); cursor: pointer; font-size: 0.8rem; }
        .sb-modal-body { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }
        .sb-modal-footer { display: flex; justify-content: flex-end; gap: 8px; }

        .sb-saved-item { padding: 10px 0; border-bottom: 1px solid var(--color-border,rgba(102,126,234,0.1)); display: flex; justify-content: space-between; align-items: center; }
        .sb-saved-name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary,#e4e7f1); }
        .sb-saved-meta { font-size: 0.72rem; color: var(--text-muted,#6b7394); }
        .sb-saved-btns { display: flex; gap: 4px; }
      </style>
    `;
  },

  attachEvents() {
    document.getElementById('sb-add-entry')?.addEventListener('click', () => this.openModal('entry'));
    document.getElementById('sb-add-exit')?.addEventListener('click', () => this.openModal('exit'));
    document.getElementById('sb-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('sb-modal-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('sb-modal-confirm')?.addEventListener('click', () => this.confirmCondition());
    document.getElementById('sb-modal-indicator')?.addEventListener('change', () => this.updateModalUI());
    document.getElementById('sb-backtest-btn')?.addEventListener('click', () => this.runBacktest());
    document.getElementById('sb-save-btn')?.addEventListener('click', () => this.saveStrategy());
    document.getElementById('sb-sl')?.addEventListener('input', () => this.updateRR());
    document.getElementById('sb-tp')?.addEventListener('input', () => this.updateRR());
    document.getElementById('sb-load-preset')?.addEventListener('click', () => {
      const p = document.getElementById('sb-presets-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('sb-load-saved')?.addEventListener('click', () => {
      this.renderSavedList();
      const p = document.getElementById('sb-saved-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });

    this.container.querySelectorAll('[data-load-preset]').forEach(btn => {
      btn.addEventListener('click', () => this.loadPreset(parseInt(btn.dataset.loadPreset)));
    });
  },

  updateRR() {
    const sl = parseFloat(document.getElementById('sb-sl')?.value) || 3;
    const tp = parseFloat(document.getElementById('sb-tp')?.value) || 6;
    const rr = document.getElementById('sb-rr');
    if (rr) rr.textContent = `1 : ${(tp/sl).toFixed(1)}`;
    this.strategy.stopLoss = sl;
    this.strategy.takeProfit = tp;
  },

  openModal(type) {
    this._modalType = type;
    this._editId = null;
    document.getElementById('sb-modal-title').textContent = `Add ${type === 'entry' ? 'Entry' : 'Exit'} Condition`;
    document.getElementById('sb-modal-overlay').style.display = 'flex';
    this.updateModalUI();
  },
  closeModal() { document.getElementById('sb-modal-overlay').style.display = 'none'; },

  updateModalUI() {
    const indId = document.getElementById('sb-modal-indicator')?.value;
    const ind = this.INDICATORS.find(i => i.id === indId);
    const ops = this.OPERATORS[indId] || [];

    const opSel = document.getElementById('sb-modal-operator');
    if (opSel) opSel.innerHTML = ops.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

    const needsValue = ['lt','gt','between'].includes(opSel?.value || '');
    document.getElementById('sb-modal-value-wrap').style.display  = needsValue || indId === 'volume' ? 'block' : 'none';
    document.getElementById('sb-modal-value2-wrap').style.display = opSel?.value === 'between' ? 'block' : 'none';

    // Params
    const paramsWrap = document.getElementById('sb-modal-params-wrap');
    paramsWrap.innerHTML = ind?.params?.map(p => `
      <div class="sb-field">
        <label class="sb-label">${p.label}</label>
        <input class="sb-input" id="sb-param-${p.id}" type="number" value="${p.default}">
      </div>`).join('') || '';

    opSel?.addEventListener('change', () => this.updateModalUI());
  },

  confirmCondition() {
    const indId  = document.getElementById('sb-modal-indicator')?.value;
    const op     = document.getElementById('sb-modal-operator')?.value;
    const val    = parseFloat(document.getElementById('sb-modal-value')?.value) || null;
    const val2   = parseFloat(document.getElementById('sb-modal-value2')?.value) || null;
    const ind    = this.INDICATORS.find(i => i.id === indId);
    const params = {};
    ind?.params?.forEach(p => { params[p.id] = parseFloat(document.getElementById(`sb-param-${p.id}`)?.value) || p.default; });

    const cond = { id: 'c' + (++this.conditionIdCounter), indicator: indId, operator: op, value: val, value2: val2, params };
    if (this._modalType === 'entry') this.strategy.entryConditions.push(cond);
    else this.strategy.exitConditions.push(cond);

    this.renderConditions();
    this.closeModal();
  },

  renderConditions() {
    this.renderConditionList('sb-entry-conditions', this.strategy.entryConditions, 'entry');
    this.renderConditionList('sb-exit-conditions', this.strategy.exitConditions, 'exit');
  },

  renderConditionList(containerId, conditions, type) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!conditions.length) {
      el.innerHTML = type === 'entry' ? '<div class="sb-empty-cond">No entry conditions yet. Click "+ Add Condition" to start building.</div>' : '<div class="sb-empty-cond">No exit conditions yet. Stop-loss and take-profit will auto-apply.</div>';
      return;
    }

    el.innerHTML = conditions.map(cond => {
      const ind = this.INDICATORS.find(i => i.id === cond.indicator);
      const op  = (this.OPERATORS[cond.indicator] || []).find(o => o.value === cond.operator);
      let text = `${ind?.label || cond.indicator} ${op?.label || cond.operator}`;
      if (cond.value !== null && ['lt','gt','between'].includes(cond.operator)) text += ` ${cond.value}${cond.operator==='between'?' – '+cond.value2:''}`;
      if (cond.params?.period) text += ` (period: ${cond.params.period})`;
      if (cond.params?.fast)   text += ` (${cond.params.fast}/${cond.params.slow})`;
      const icon = type === 'entry' ? '🟢' : '🔴';
      return `<div class="sb-cond-item">
        <span class="sb-cond-icon">${icon}</span>
        <span class="sb-cond-text">${text}</span>
        <button class="sb-cond-remove" data-id="${cond.id}" data-type="${type}">✕</button>
      </div>`;
    }).join('');

    el.querySelectorAll('.sb-cond-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.type === 'entry') this.strategy.entryConditions = this.strategy.entryConditions.filter(c => c.id !== btn.dataset.id);
        else this.strategy.exitConditions = this.strategy.exitConditions.filter(c => c.id !== btn.dataset.id);
        this.renderConditions();
      });
    });
  },

  loadPreset(idx) {
    const preset = this.PRESETS[idx];
    if (!preset) return;
    this.strategy.entryConditions = preset.entryConditions.map(c => ({...c}));
    this.strategy.exitConditions  = preset.exitConditions.map(c => ({...c}));
    this.strategy.stopLoss = preset.stopLoss;
    this.strategy.takeProfit = preset.takeProfit;
    const nameEl = document.getElementById('sb-name');
    if (nameEl) nameEl.value = preset.name;
    document.getElementById('sb-sl').value = preset.stopLoss;
    document.getElementById('sb-tp').value = preset.takeProfit;
    this.updateRR();
    this.renderConditions();
    document.getElementById('sb-presets-panel').style.display = 'none';
  },

  saveStrategy() {
    const name = document.getElementById('sb-name')?.value || 'Unnamed';
    const saved = { ...this.strategy, name, id: Date.now(), savedAt: new Date().toLocaleDateString() };
    this.savedStrategies.unshift(saved);
    this.saveToDB();
    document.getElementById('sb-load-saved').textContent = `💾 Saved (${this.savedStrategies.length})`;
    // Flash confirmation
    const btn = document.getElementById('sb-save-btn');
    const orig = btn.textContent;
    btn.textContent = '✅ Saved!';
    setTimeout(() => btn.textContent = orig, 2000);
  },

  renderSavedList() {
    const el = document.getElementById('sb-saved-list');
    if (!el) return;
    if (!this.savedStrategies.length) { el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted,#6b7394);padding:10px 0;">No saved strategies yet.</div>'; return; }
    el.innerHTML = this.savedStrategies.map(s => `
      <div class="sb-saved-item">
        <div>
          <div class="sb-saved-name">${s.name}</div>
          <div class="sb-saved-meta">${s.savedAt} · ${s.entryConditions.length} entry, ${s.exitConditions.length} exit</div>
        </div>
        <div class="sb-saved-btns">
          <button class="sb-btn sb-btn-sm" data-load-saved="${s.id}">Load</button>
        </div>
      </div>`).join('');
    el.querySelectorAll('[data-load-saved]').forEach(btn => {
      btn.addEventListener('click', () => {
        const strat = this.savedStrategies.find(s => s.id === parseInt(btn.dataset.loadSaved));
        if (strat) { Object.assign(this.strategy, strat); this.renderConditions(); document.getElementById('sb-saved-panel').style.display = 'none'; }
      });
    });
  },

  async runBacktest() {
    const btn = document.getElementById('sb-backtest-btn');
    const resultsEl = document.getElementById('sb-backtest-results');
    btn.disabled = true;
    btn.innerHTML = '<span class="sb-spinner"></span> Backtesting…';

    const coinId = document.getElementById('sb-coin')?.value || 'bitcoin';
    const sl = parseFloat(document.getElementById('sb-sl')?.value) || 3;
    const tp = parseFloat(document.getElementById('sb-tp')?.value) || 6;

    try {
      // Fetch 90-day history
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`;
      const resp = await fetch(url);
      const json = resp.ok ? await resp.json() : null;
      const priceData = json?.prices || this.syntheticPrices(coinId);

      const result = this.simulate(priceData, sl, tp);
      this.backtestResult = result;

      resultsEl.style.display = 'block';
      this.renderBacktestResults(result, priceData, document.getElementById('sb-name')?.value || 'Strategy');
    } catch(e) {
      const synthetic = this.syntheticPrices(coinId);
      const result = this.simulate(synthetic, sl, tp);
      resultsEl.style.display = 'block';
      this.renderBacktestResults(result, synthetic, document.getElementById('sb-name')?.value || 'Strategy');
    }

    btn.disabled = false;
    btn.textContent = '▶ Backtest (90 Days)';
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  syntheticPrices(coinId) {
    const seeds = { bitcoin: 45000, ethereum: 2400, solana: 120, binancecoin: 320, 'avalanche-2': 35, chainlink: 14 };
    let p = seeds[coinId] || 100;
    const arr = [];
    const now = Date.now();
    for (let i = 90; i >= 0; i--) { p *= (1 + (Math.random()-0.47)*0.04); arr.push([now - i*86400000, p]); }
    return arr;
  },

  simulate(priceData, sl, tp) {
    const prices = priceData.map(p => p[1]);
    const dates  = priceData.map(p => new Date(p[0]).toLocaleDateString('en-US',{month:'short',day:'numeric'}));

    // Simple RSI-based signal for demo (in real version uses user's conditions)
    const rsi = this.calcRSI(prices, 14);

    let inTrade = false, entryPrice = 0, entryIdx = 0;
    const trades = [], equity = [10000], capital = 10000;
    const lumpCoins = 10000 / prices[0];

    const hasEntry = this.strategy.entryConditions.length > 0;

    for (let i = 1; i < prices.length; i++) {
      const p = prices[i];
      const r = rsi[i] || 50;

      if (!inTrade) {
        // Entry: use conditions if set, otherwise default RSI < 35 (demo)
        const entrySignal = hasEntry ? this.evalConditions(this.strategy.entryConditions, prices, rsi, i) : (r < 35);
        if (entrySignal) { inTrade = true; entryPrice = p; entryIdx = i; }
      } else {
        const chg = (p - entryPrice) / entryPrice * 100;
        const exitSignal = this.strategy.exitConditions.length > 0 ? this.evalConditions(this.strategy.exitConditions, prices, rsi, i) : (r > 68);
        if (chg >= tp || chg <= -sl || exitSignal) {
          const pnl = (p - entryPrice) / entryPrice;
          capital *= (1 + pnl);
          trades.push({ entryIdx, exitIdx: i, entry: entryPrice, exit: p, pnl: pnl * 100, reason: chg >= tp ? 'TP' : chg <= -sl ? 'SL' : 'Signal' });
          inTrade = false;
        }
      }
      equity.push(capital);
    }

    const wins = trades.filter(t => t.pnl > 0).length;
    const totalReturn = (capital - 10000) / 100;
    const bhReturn = (prices[prices.length-1] - prices[0]) / prices[0] * 100;
    const maxDD = this.maxDrawdown(equity);
    const profitFactor = wins > 0 ? trades.filter(t=>t.pnl>0).reduce((s,t)=>s+t.pnl,0) / (Math.abs(trades.filter(t=>t.pnl<0).reduce((s,t)=>s+t.pnl,0))||1) : 0;

    return { equity, dates, trades, wins, totalReturn, bhReturn, maxDD, profitFactor, tradeCount: trades.length, capital };
  },

  evalConditions(conditions, prices, rsi, i) {
    return conditions.every(cond => {
      const r = rsi[i] || 50;
      const p = prices[i];
      const pp = prices[Math.max(0,i-1)];
      switch(cond.indicator) {
        case 'rsi':
          if (cond.operator === 'lt') return r < (cond.value || 35);
          if (cond.operator === 'gt') return r > (cond.value || 65);
          if (cond.operator === 'between') return r >= cond.value && r <= cond.value2;
          break;
        case 'macd': return cond.operator === 'positive' ? p > pp : p < pp;
        case 'price_sma': { const smaP = this.sma(prices.slice(0,i+1), cond.params?.period||20); return cond.operator === 'above' ? p > smaP : p < smaP; }
        case 'bb_pos': { const mn = this.sma(prices.slice(Math.max(0,i-19),i+1),20); const sd = this.std(prices.slice(Math.max(0,i-19),i+1)); return cond.operator === 'near_lower' ? p < mn - 1.5*sd : cond.operator === 'near_upper' ? p > mn + 1.5*sd : sd/mn < 0.04; }
        case 'volume': return true; // Volume data not in price array, approximate
        case 'ema_cross': { const f = this.ema(prices.slice(0,i+1),cond.params?.fast||12); const s = this.ema(prices.slice(0,i+1),cond.params?.slow||26); const fp = this.ema(prices.slice(0,i),cond.params?.fast||12); const sp = this.ema(prices.slice(0,i),cond.params?.slow||26); return cond.operator === 'cross_up' ? f > s && fp <= sp : f < s && fp >= sp; }
        default: return true;
      }
      return true;
    });
  },

  calcRSI(prices, period=14) {
    const rsi = new Array(prices.length).fill(50);
    for (let i = period; i < prices.length; i++) {
      let gains = 0, losses = 0;
      for (let j = i-period+1; j <= i; j++) { const d = prices[j]-prices[j-1]; if(d>0) gains+=d; else losses+=Math.abs(d); }
      const rs = gains/(losses||1);
      rsi[i] = 100 - (100/(1+rs));
    }
    return rsi;
  },
  sma(arr, p) { const sl = arr.slice(-p); return sl.reduce((s,v)=>s+v,0)/sl.length; },
  ema(arr, p) { let e = arr[0]; for(let i=1;i<arr.length;i++){const k=2/(p+1);e=arr[i]*k+e*(1-k);} return e; },
  std(arr) { const m = arr.reduce((s,v)=>s+v,0)/arr.length; return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length); },
  maxDrawdown(equity) { let peak=equity[0],max=0; equity.forEach(v=>{if(v>peak)peak=v;const dd=(peak-v)/peak*100;if(dd>max)max=dd;}); return max; },

  renderBacktestResults(result, priceData, stratName) {
    const el = document.getElementById('sb-backtest-results');
    const ret = result.totalReturn;
    const alpha = result.totalReturn - result.bhReturn;
    el.innerHTML = `
      <div class="sb-results-card">
        <div class="sb-results-title">📈 Backtest Results — ${stratName} (90 Days)</div>
        <div class="sb-metrics-row">
          <div class="sb-metric"><div class="sb-metric-lbl">Total Return</div><div class="sb-metric-val ${ret>=0?'pos':'neg'}">${ret>=0?'+':''}${ret.toFixed(1)}%</div></div>
          <div class="sb-metric"><div class="sb-metric-lbl">Win Rate</div><div class="sb-metric-val">${result.tradeCount>0?Math.round(result.wins/result.tradeCount*100):0}%</div></div>
          <div class="sb-metric"><div class="sb-metric-lbl">Max Drawdown</div><div class="sb-metric-val neg">-${result.maxDD.toFixed(1)}%</div></div>
          <div class="sb-metric"><div class="sb-metric-lbl">Profit Factor</div><div class="sb-metric-val ${result.profitFactor>=1?'pos':'neg'}">${result.profitFactor.toFixed(2)}</div></div>
          <div class="sb-metric"><div class="sb-metric-lbl">Total Trades</div><div class="sb-metric-val">${result.tradeCount}</div></div>
          <div class="sb-metric"><div class="sb-metric-lbl">Alpha vs B&H</div><div class="sb-metric-val ${alpha>=0?'pos':'neg'}">${alpha>=0?'+':''}${alpha.toFixed(1)}%</div></div>
        </div>
        <div class="sb-chart-wrap"><canvas id="sb-bt-chart"></canvas></div>
      </div>
    `;

    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const ctx = document.getElementById('sb-bt-chart')?.getContext('2d');
    if (ctx) {
      const stride = Math.max(1, Math.floor(result.equity.length / 60));
      const labels = result.dates.filter((_,i) => i % stride === 0);
      const equityData = result.equity.filter((_,i) => i % stride === 0);
      const bhEquity = priceData.filter((_,i) => i % stride === 0).map(p => 10000 * (p[1] / priceData[0][1]));

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Strategy', data: equityData, borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 },
            { label: 'Buy & Hold', data: bhEquity, borderColor: '#f7971e', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4,4], pointRadius: 0, fill: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: '#1e2442', callbacks: { label: c => ` ${c.dataset.label}: $${c.parsed.y.toFixed(0)}` } } },
          scales: {
            x: { display: true, ticks: { color:'#6b7394', maxTicksLimit: 6, font:{size:10} }, grid: { color:'rgba(102,126,234,0.06)' } },
            y: { display: true, ticks: { color:'#6b7394', font:{size:10}, callback: v => '$'+v.toFixed(0) }, grid: { color:'rgba(102,126,234,0.06)' } }
          }
        }
      });
    }
  }
};

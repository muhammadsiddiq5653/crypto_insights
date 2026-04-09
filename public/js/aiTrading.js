/**
 * AI Trading Assistant
 * Context-aware trading chat that reads live market signals, portfolio, and indicators
 */

const AITrading = {
  container: null,
  messages: [],
  isThinking: false,
  marketContext: null,
  portfolioContext: null,
  lastContextFetch: 0,
  CONTEXT_TTL: 120000, // 2 minutes

  PERSONALITIES: {
    conservative: { label: '🛡️ Conservative', risk: 'low', leverage: false },
    balanced:     { label: '⚖️ Balanced',     risk: 'medium', leverage: false },
    aggressive:   { label: '🚀 Aggressive',   risk: 'high',  leverage: true  },
  },

  currentPersonality: 'balanced',

  QUICK_PROMPTS: [
    { label: '📊 Market Overview', text: 'Give me a quick market overview. What are the strongest and weakest coins right now?' },
    { label: '🎯 Top Opportunities', text: 'What are the top 3 trading opportunities right now based on technical signals?' },
    { label: '⚠️ Risk Check', text: 'Analyze my current portfolio for risk. Any positions I should be worried about?' },
    { label: '📈 Trend Analysis', text: 'What are the dominant market trends? Are we in a bull or bear phase?' },
    { label: '🔍 BTC Analysis', text: 'Give me a deep technical analysis of Bitcoin right now.' },
    { label: '💡 Strategy Advice', text: 'Given the current market conditions, what trading strategy would you recommend?' },
  ],

  KNOWLEDGE_BASE: {
    indicators: {
      rsi: { name: 'RSI', overbought: 70, oversold: 30, desc: 'Measures momentum; extremes signal reversals' },
      macd: { name: 'MACD', desc: 'Trend & momentum; crossovers signal entries/exits' },
      bb: { name: 'Bollinger Bands', desc: 'Volatility bands; squeezes precede breakouts' },
      sma: { name: 'SMA', desc: 'Trend direction; 50/200 crossovers signal major trends' },
    },
    patterns: {
      goldenCross: { signal: 'bullish', desc: 'SMA50 crosses above SMA200 — strong long-term bullish signal' },
      deathCross:  { signal: 'bearish', desc: 'SMA50 crosses below SMA200 — strong long-term bearish signal' },
      bbSqueeze:   { signal: 'neutral', desc: 'Low volatility coiling — expect a large move soon' },
    },
    riskManagement: [
      'Never risk more than 1-2% of portfolio on a single trade',
      'Always use stop-losses — set them before entering',
      'Take partial profits at key resistance levels',
      'Avoid trading against the dominant trend',
      'Reduce position sizes in high-volatility conditions',
      'Diversify across uncorrelated assets',
    ]
  },

  async init() {
    this.container = document.getElementById('ai-trading');
    if (!this.container) return;
    if (this.container.querySelector('.ai-trading-page')) return;

    this.render();
    this.attachEvents();
    this.addMessage('assistant', this.getWelcomeMessage());
    await this.fetchContext();
  },

  getWelcomeMessage() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${greeting}! I'm your **AI Trading Assistant** 🤖

I have real-time access to:
- 📊 Live market signals & technical indicators
- 💼 Your paper trading portfolio
- 🔍 Pattern detection across 20+ coins
- 📈 Multi-timeframe trend analysis

I'm currently set to **${this.PERSONALITIES[this.currentPersonality].label}** mode. You can change this anytime.

**Try one of the quick prompts below**, or ask me anything about the markets!`;
  },

  render() {
    this.container.innerHTML = `
      <div class="ai-trading-page">
        <div class="ai-header">
          <div class="ai-header-left">
            <div class="ai-avatar">🤖</div>
            <div>
              <h2 class="ai-title">AI Trading Assistant</h2>
              <div class="ai-status-row">
                <span class="ai-status-dot"></span>
                <span class="ai-status-text">Online — Real-time market data</span>
              </div>
            </div>
          </div>
          <div class="ai-controls">
            <label class="ai-label">Mode:</label>
            <div class="ai-personality-btns">
              ${Object.entries(this.PERSONALITIES).map(([k, v]) =>
                `<button class="ai-personality-btn ${k === this.currentPersonality ? 'active' : ''}" data-personality="${k}">${v.label}</button>`
              ).join('')}
            </div>
            <button class="ai-clear-btn" id="ai-clear-btn" title="Clear chat">🗑️ Clear</button>
          </div>
        </div>

        <div class="ai-body">
          <div class="ai-chat-col">
            <div class="ai-messages" id="ai-messages"></div>
            <div class="ai-quick-prompts" id="ai-quick-prompts">
              ${this.QUICK_PROMPTS.map(p =>
                `<button class="ai-quick-btn" data-text="${p.text}">${p.label}</button>`
              ).join('')}
            </div>
            <div class="ai-input-row">
              <textarea class="ai-input" id="ai-input" placeholder="Ask about market conditions, strategies, risk management..." rows="2"></textarea>
              <button class="ai-send-btn" id="ai-send-btn">
                <span>Send</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>

          <div class="ai-sidebar-col">
            <div class="ai-context-panel" id="ai-context-panel">
              <div class="ai-panel-title">📡 Live Context</div>
              <div class="ai-context-loading">
                <div class="ai-spinner"></div>
                <span>Fetching market data…</span>
              </div>
            </div>

            <div class="ai-knowledge-panel">
              <div class="ai-panel-title">📚 Quick Reference</div>
              <div class="ai-ref-tabs">
                <button class="ai-ref-tab active" data-ref="indicators">Indicators</button>
                <button class="ai-ref-tab" data-ref="patterns">Patterns</button>
                <button class="ai-ref-tab" data-ref="risk">Risk Rules</button>
              </div>
              <div class="ai-ref-content" id="ai-ref-content">
                ${this.renderRefContent('indicators')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .ai-trading-page { display:flex; flex-direction:column; gap:0; height:100%; }
        .ai-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:var(--color-surface,#1e2442); border-bottom:1px solid var(--color-border,rgba(102,126,234,0.18)); flex-wrap:wrap; gap:12px; }
        .ai-header-left { display:flex; align-items:center; gap:14px; }
        .ai-avatar { font-size:2rem; width:48px; height:48px; background:linear-gradient(135deg,#6c63ff,#00c896); border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .ai-title { font-size:1.2rem; font-weight:700; color:var(--text-primary,#e4e7f1); margin:0; }
        .ai-status-row { display:flex; align-items:center; gap:6px; margin-top:3px; }
        .ai-status-dot { width:8px; height:8px; border-radius:50%; background:#00c896; box-shadow:0 0 6px #00c896; animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .ai-status-text { font-size:0.78rem; color:var(--text-secondary,#a0a8c1); }
        .ai-controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .ai-label { font-size:0.78rem; color:var(--text-secondary,#a0a8c1); }
        .ai-personality-btns { display:flex; gap:6px; }
        .ai-personality-btn { padding:5px 10px; border-radius:20px; border:1px solid var(--color-border,rgba(102,126,234,0.18)); background:transparent; color:var(--text-secondary,#a0a8c1); font-size:0.75rem; cursor:pointer; transition:all 0.2s; }
        .ai-personality-btn.active { background:linear-gradient(135deg,#6c63ff,#00c896); color:#fff; border-color:transparent; }
        .ai-personality-btn:hover:not(.active) { background:var(--color-card,#252b4a); color:var(--text-primary,#e4e7f1); }
        .ai-clear-btn { padding:5px 12px; border-radius:8px; border:1px solid var(--color-border,rgba(102,126,234,0.18)); background:transparent; color:var(--text-secondary,#a0a8c1); font-size:0.75rem; cursor:pointer; transition:all 0.2s; }
        .ai-clear-btn:hover { background:rgba(255,100,100,0.1); color:#ff6a6a; border-color:#ff6a6a40; }

        .ai-body { display:grid; grid-template-columns:1fr 300px; gap:0; flex:1; min-height:0; overflow:hidden; }
        @media(max-width:900px){ .ai-body{grid-template-columns:1fr;} .ai-sidebar-col{display:none;} }

        .ai-chat-col { display:flex; flex-direction:column; border-right:1px solid var(--color-border,rgba(102,126,234,0.18)); }
        .ai-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:14px; min-height:0; max-height:calc(100vh - 320px); }
        .ai-messages::-webkit-scrollbar { width:4px; }
        .ai-messages::-webkit-scrollbar-thumb { background:var(--color-border,rgba(102,126,234,0.18)); border-radius:4px; }

        .ai-msg { display:flex; gap:10px; max-width:90%; }
        .ai-msg.user { align-self:flex-end; flex-direction:row-reverse; }
        .ai-msg.assistant { align-self:flex-start; }
        .ai-msg-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0; margin-top:2px; }
        .ai-msg.assistant .ai-msg-avatar { background:linear-gradient(135deg,#6c63ff,#00c896); }
        .ai-msg.user .ai-msg-avatar { background:linear-gradient(135deg,#f7971e,#ffd200); }
        .ai-msg-bubble { padding:10px 14px; border-radius:12px; font-size:0.875rem; line-height:1.6; color:var(--text-primary,#e4e7f1); }
        .ai-msg.assistant .ai-msg-bubble { background:var(--color-surface,#1e2442); border:1px solid var(--color-border,rgba(102,126,234,0.18)); border-top-left-radius:2px; }
        .ai-msg.user .ai-msg-bubble { background:linear-gradient(135deg,#6c63ff22,#00c89622); border:1px solid #6c63ff44; border-top-right-radius:2px; }
        .ai-msg-bubble strong { color:#a78bfa; }
        .ai-msg-bubble .signal-buy { color:#00c896; font-weight:600; }
        .ai-msg-bubble .signal-sell { color:#ff6a6a; font-weight:600; }
        .ai-msg-bubble .signal-hold { color:#f7971e; font-weight:600; }
        .ai-msg-bubble ul { padding-left:16px; margin:6px 0; }
        .ai-msg-bubble li { margin:3px 0; }
        .ai-msg-bubble code { background:rgba(108,99,255,0.15); padding:1px 5px; border-radius:4px; font-size:0.82rem; color:#a78bfa; }
        .ai-msg-time { font-size:0.7rem; color:var(--text-muted,#6b7394); margin-top:4px; text-align:right; }

        .ai-thinking { display:flex; gap:5px; align-items:center; padding:12px 16px; }
        .ai-thinking span { width:8px; height:8px; border-radius:50%; background:#6c63ff; animation:thinking 1.4s infinite; }
        .ai-thinking span:nth-child(2) { animation-delay:0.2s; }
        .ai-thinking span:nth-child(3) { animation-delay:0.4s; }
        @keyframes thinking { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }

        .ai-quick-prompts { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px; border-top:1px solid var(--color-border,rgba(102,126,234,0.18)); }
        .ai-quick-btn { padding:5px 10px; border-radius:16px; border:1px solid var(--color-border,rgba(102,126,234,0.18)); background:var(--color-card,#252b4a); color:var(--text-secondary,#a0a8c1); font-size:0.75rem; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .ai-quick-btn:hover { background:rgba(108,99,255,0.15); color:var(--text-primary,#e4e7f1); border-color:#6c63ff44; }

        .ai-input-row { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--color-border,rgba(102,126,234,0.18)); }
        .ai-input { flex:1; padding:10px 14px; background:var(--color-card,#252b4a); border:1px solid var(--color-border,rgba(102,126,234,0.18)); border-radius:10px; color:var(--text-primary,#e4e7f1); font-size:0.875rem; resize:none; font-family:inherit; transition:border-color 0.2s; }
        .ai-input:focus { outline:none; border-color:#6c63ff88; }
        .ai-input::placeholder { color:var(--text-muted,#6b7394); }
        .ai-send-btn { padding:10px 18px; background:linear-gradient(135deg,#6c63ff,#00c896); border:none; border-radius:10px; color:#fff; font-size:0.875rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; transition:opacity 0.2s; white-space:nowrap; }
        .ai-send-btn:hover { opacity:0.9; }
        .ai-send-btn:disabled { opacity:0.5; cursor:not-allowed; }

        .ai-sidebar-col { display:flex; flex-direction:column; gap:0; overflow-y:auto; }
        .ai-context-panel, .ai-knowledge-panel { padding:14px; border-bottom:1px solid var(--color-border,rgba(102,126,234,0.18)); }
        .ai-panel-title { font-size:0.8rem; font-weight:700; color:var(--text-secondary,#a0a8c1); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; }
        .ai-context-loading { display:flex; align-items:center; gap:8px; color:var(--text-secondary,#a0a8c1); font-size:0.8rem; }
        .ai-spinner { width:16px; height:16px; border:2px solid var(--color-border,rgba(102,126,234,0.18)); border-top-color:#6c63ff; border-radius:50%; animation:spin 0.8s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }

        .ai-ctx-item { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid var(--color-border,rgba(102,126,234,0.1)); font-size:0.8rem; }
        .ai-ctx-item:last-child { border-bottom:none; }
        .ai-ctx-label { color:var(--text-secondary,#a0a8c1); }
        .ai-ctx-value { color:var(--text-primary,#e4e7f1); font-weight:600; }
        .ai-ctx-value.positive { color:#00c896; }
        .ai-ctx-value.negative { color:#ff6a6a; }
        .ai-ctx-value.neutral { color:#f7971e; }
        .ai-ctx-refresh { font-size:0.7rem; color:var(--text-muted,#6b7394); margin-top:8px; text-align:right; cursor:pointer; }
        .ai-ctx-refresh:hover { color:var(--text-secondary,#a0a8c1); }

        .ai-ref-tabs { display:flex; gap:4px; margin-bottom:10px; }
        .ai-ref-tab { padding:4px 10px; border-radius:6px; border:1px solid var(--color-border,rgba(102,126,234,0.18)); background:transparent; color:var(--text-secondary,#a0a8c1); font-size:0.72rem; cursor:pointer; transition:all 0.2s; }
        .ai-ref-tab.active { background:#6c63ff22; color:#a78bfa; border-color:#6c63ff44; }
        .ai-ref-content { font-size:0.78rem; color:var(--text-secondary,#a0a8c1); line-height:1.5; }
        .ai-ref-item { margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--color-border,rgba(102,126,234,0.1)); }
        .ai-ref-item:last-child { border-bottom:none; margin-bottom:0; }
        .ai-ref-name { font-weight:600; color:var(--text-primary,#e4e7f1); margin-bottom:2px; }
        .ai-ref-desc { font-size:0.73rem; color:var(--text-muted,#6b7394); }
        .ai-ref-signal { display:inline-block; padding:1px 6px; border-radius:4px; font-size:0.7rem; font-weight:600; margin-top:2px; }
        .ai-ref-signal.bullish { background:#00c89622; color:#00c896; }
        .ai-ref-signal.bearish { background:#ff6a6a22; color:#ff6a6a; }
        .ai-ref-signal.neutral { background:#f7971e22; color:#f7971e; }
        .ai-risk-rule { padding:4px 0; border-bottom:1px solid var(--color-border,rgba(102,126,234,0.08)); display:flex; gap:6px; }
        .ai-risk-rule::before { content:'⚠️'; font-size:0.7rem; flex-shrink:0; margin-top:1px; }
      </style>
    `;

    // Render initial messages
    this.renderMessages();
  },

  renderRefContent(tab) {
    if (tab === 'indicators') {
      return Object.values(this.KNOWLEDGE_BASE.indicators).map(i => `
        <div class="ai-ref-item">
          <div class="ai-ref-name">${i.name}</div>
          <div class="ai-ref-desc">${i.desc}</div>
          ${i.overbought ? `<div style="margin-top:3px;font-size:0.7rem;color:#6b7394;">OB: >${i.overbought} | OS: <${i.oversold}</div>` : ''}
        </div>`).join('');
    }
    if (tab === 'patterns') {
      return Object.values(this.KNOWLEDGE_BASE.patterns).map(p => `
        <div class="ai-ref-item">
          <div class="ai-ref-name">${p.name || Object.keys(this.KNOWLEDGE_BASE.patterns).find(k => this.KNOWLEDGE_BASE.patterns[k] === p)}</div>
          <span class="ai-ref-signal ${p.signal}">${p.signal.toUpperCase()}</span>
          <div class="ai-ref-desc" style="margin-top:4px;">${p.desc}</div>
        </div>`).join('');
    }
    if (tab === 'risk') {
      return this.KNOWLEDGE_BASE.riskManagement.map(r => `
        <div class="ai-risk-rule">${r}</div>`).join('');
    }
    return '';
  },

  attachEvents() {
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');
    const clearBtn = document.getElementById('ai-clear-btn');

    sendBtn?.addEventListener('click', () => this.handleSend());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
    });
    clearBtn?.addEventListener('click', () => this.clearChat());

    this.container.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById('ai-input');
        if (inp) { inp.value = btn.dataset.text; inp.focus(); }
      });
    });

    this.container.querySelectorAll('.ai-personality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPersonality = btn.dataset.personality;
        this.container.querySelectorAll('.ai-personality-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.addMessage('assistant', `Switched to **${this.PERSONALITIES[this.currentPersonality].label}** mode. I'll tailor my advice accordingly.`);
      });
    });

    this.container.querySelectorAll('.ai-ref-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.container.querySelectorAll('.ai-ref-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const refContent = document.getElementById('ai-ref-content');
        if (refContent) refContent.innerHTML = this.renderRefContent(tab.dataset.ref);
      });
    });

    const ctxRefresh = document.getElementById('ai-ctx-refresh');
    ctxRefresh?.addEventListener('click', () => {
      this.lastContextFetch = 0;
      this.fetchContext();
    });
  },

  async handleSend() {
    const input = document.getElementById('ai-input');
    const text = input?.value?.trim();
    if (!text || this.isThinking) return;

    input.value = '';
    this.addMessage('user', text);
    await this.generateResponse(text);
  },

  clearChat() {
    this.messages = [];
    this.renderMessages();
    this.addMessage('assistant', this.getWelcomeMessage());
  },

  addMessage(role, content) {
    const msg = { role, content, time: new Date() };
    this.messages.push(msg);
    this.renderMessages();
    this.scrollToBottom();
  },

  renderMessages() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    container.innerHTML = this.messages.map(m => this.renderMessage(m)).join('');
  },

  renderMessage(msg) {
    const isUser = msg.role === 'user';
    const avatar = isUser ? '👤' : '🤖';
    const timeStr = msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const htmlContent = this.markdownToHtml(msg.content);
    return `
      <div class="ai-msg ${msg.role}">
        <div class="ai-msg-avatar">${avatar}</div>
        <div>
          <div class="ai-msg-bubble">${htmlContent}</div>
          <div class="ai-msg-time">${timeStr}</div>
        </div>
      </div>`;
  },

  markdownToHtml(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*?)$/gm, '<div style="font-weight:700;color:#a78bfa;margin:8px 0 4px;">$1</div>')
      .replace(/^## (.*?)$/gm, '<div style="font-weight:700;color:#e4e7f1;margin:10px 0 5px;font-size:1rem;">$1</div>')
      .replace(/^\- (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/🟢(.*?)$/gm, '<span class="signal-buy">🟢$1</span>')
      .replace(/🔴(.*?)$/gm, '<span class="signal-sell">🔴$1</span>')
      .replace(/🟡(.*?)$/gm, '<span class="signal-hold">🟡$1</span>')
      .replace(/\n/g, '<br>');
  },

  showThinking() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ai-msg assistant';
    div.id = 'ai-thinking-msg';
    div.innerHTML = `
      <div class="ai-msg-avatar">🤖</div>
      <div class="ai-msg-bubble">
        <div class="ai-thinking"><span></span><span></span><span></span></div>
      </div>`;
    container.appendChild(div);
    this.scrollToBottom();
  },

  hideThinking() {
    document.getElementById('ai-thinking-msg')?.remove();
  },

  scrollToBottom() {
    const container = document.getElementById('ai-messages');
    if (container) setTimeout(() => container.scrollTop = container.scrollHeight, 50);
  },

  async fetchContext() {
    if (Date.now() - this.lastContextFetch < this.CONTEXT_TTL) return;
    this.lastContextFetch = Date.now();

    const panel = document.getElementById('ai-context-panel');

    try {
      // Fetch BTC data as market proxy
      const btcData = await fetch('/api/crypto/bitcoin/analysis').then(r => r.ok ? r.json() : null).catch(() => null);
      const ethData = await fetch('/api/crypto/ethereum/analysis').then(r => r.ok ? r.json() : null).catch(() => null);
      const fgData = await fetch('/api/market/fear-greed').then(r => r.ok ? r.json() : null).catch(() => null);

      // Portfolio context from localStorage
      let portfolio = null;
      try {
        const stored = localStorage.getItem('traderpro_paper_trading');
        if (stored) portfolio = JSON.parse(stored);
      } catch(e) {}

      this.marketContext = { btc: btcData, eth: ethData, fearGreed: fgData };
      this.portfolioContext = portfolio;

      if (panel) {
        panel.innerHTML = `
          <div class="ai-panel-title">📡 Live Context</div>
          ${btcData ? `
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">BTC Price</span>
              <span class="ai-ctx-value">$${btcData.currentPrice ? Number(btcData.currentPrice).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">BTC RSI</span>
              <span class="ai-ctx-value ${this.rsiClass(btcData.rsi)}">${btcData.rsi ? btcData.rsi.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">BTC Signal</span>
              <span class="ai-ctx-value ${btcData.signal === 'BUY' ? 'positive' : btcData.signal === 'SELL' ? 'negative' : 'neutral'}">${btcData.signal || 'N/A'}</span>
            </div>` : ''}
          ${ethData ? `
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">ETH RSI</span>
              <span class="ai-ctx-value ${this.rsiClass(ethData.rsi)}">${ethData.rsi ? ethData.rsi.toFixed(1) : 'N/A'}</span>
            </div>` : ''}
          ${fgData ? `
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">Fear & Greed</span>
              <span class="ai-ctx-value ${this.fgClass(fgData.value)}">${fgData.value} — ${fgData.classification || ''}</span>
            </div>` : ''}
          ${portfolio ? `
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">Portfolio P&L</span>
              <span class="ai-ctx-value ${(portfolio.totalPnl || 0) >= 0 ? 'positive' : 'negative'}">${portfolio.totalPnl >= 0 ? '+' : ''}${(portfolio.totalPnl || 0).toFixed(2)}%</span>
            </div>
            <div class="ai-ctx-item">
              <span class="ai-ctx-label">Open Positions</span>
              <span class="ai-ctx-value">${(portfolio.positions || []).length}</span>
            </div>` : ''}
          <div class="ai-ctx-refresh" id="ai-ctx-refresh">↻ Refresh context</div>
        `;
        panel.querySelector('#ai-ctx-refresh')?.addEventListener('click', () => {
          this.lastContextFetch = 0;
          this.fetchContext();
        });
      }
    } catch(e) {
      if (panel) panel.innerHTML = `<div class="ai-panel-title">📡 Live Context</div><div style="font-size:0.78rem;color:#6b7394;">Context unavailable</div>`;
    }
  },

  rsiClass(rsi) {
    if (!rsi) return '';
    if (rsi >= 70) return 'negative';
    if (rsi <= 30) return 'positive';
    return 'neutral';
  },
  fgClass(val) {
    if (!val) return '';
    const v = parseInt(val);
    if (v >= 75) return 'negative'; // extreme greed
    if (v <= 25) return 'positive'; // extreme fear = buy opp
    return 'neutral';
  },

  async generateResponse(userMessage) {
    this.isThinking = true;
    document.getElementById('ai-send-btn')?.setAttribute('disabled', 'true');
    this.showThinking();

    // Simulate processing delay for realism
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

    try {
      const response = await this.buildResponse(userMessage);
      this.hideThinking();
      this.addMessage('assistant', response);
    } catch(e) {
      this.hideThinking();
      this.addMessage('assistant', 'I encountered an issue fetching live data. Please try again in a moment.');
    }

    this.isThinking = false;
    document.getElementById('ai-send-btn')?.removeAttribute('disabled');
  },

  async buildResponse(query) {
    const q = query.toLowerCase();
    const ctx = this.marketContext;
    const btc = ctx?.btc;
    const eth = ctx?.eth;
    const fg = ctx?.fearGreed;
    const mode = this.currentPersonality;
    const personality = this.PERSONALITIES[mode];

    // Refresh context if stale
    if (Date.now() - this.lastContextFetch > this.CONTEXT_TTL) {
      await this.fetchContext();
    }

    // ── Market Overview ─────────────────────────────────────────────────
    if (q.includes('overview') || q.includes('market') && (q.includes('what') || q.includes('how'))) {
      return this.buildMarketOverview(btc, eth, fg, mode);
    }

    // ── Opportunities / Best Trades ──────────────────────────────────────
    if (q.includes('opportunit') || q.includes('best trade') || q.includes('top') && q.includes('trade')) {
      return await this.buildOpportunities(mode);
    }

    // ── Portfolio / Risk Check ───────────────────────────────────────────
    if (q.includes('portfolio') || q.includes('position') || q.includes('risk') && q.includes('portfolio')) {
      return this.buildPortfolioAnalysis(mode);
    }

    // ── Trend / Bull / Bear ──────────────────────────────────────────────
    if (q.includes('trend') || q.includes('bull') || q.includes('bear')) {
      return this.buildTrendAnalysis(btc, eth, fg, mode);
    }

    // ── Bitcoin / BTC ────────────────────────────────────────────────────
    if (q.includes('bitcoin') || q.includes('btc')) {
      return this.buildCoinAnalysis('bitcoin', btc, mode);
    }

    // ── Ethereum / ETH ───────────────────────────────────────────────────
    if (q.includes('ethereum') || q.includes('eth')) {
      return this.buildCoinAnalysis('ethereum', eth, mode);
    }

    // ── Other specific coins ─────────────────────────────────────────────
    const coinMap = { sol:'solana', bnb:'binancecoin', xrp:'ripple', ada:'cardano', doge:'dogecoin', avax:'avalanche-2', link:'chainlink', dot:'polkadot', matic:'matic-network' };
    for (const [abbr, id] of Object.entries(coinMap)) {
      if (q.includes(abbr) || q.includes(id.split('-')[0])) {
        return await this.buildLiveCoinAnalysis(id, abbr.toUpperCase(), mode);
      }
    }

    // ── Strategy Advice ──────────────────────────────────────────────────
    if (q.includes('strateg') || q.includes('approach') || q.includes('how to trade')) {
      return this.buildStrategyAdvice(btc, fg, mode);
    }

    // ── Risk Management ──────────────────────────────────────────────────
    if (q.includes('risk') || q.includes('stop loss') || q.includes('stop-loss') || q.includes('position size')) {
      return this.buildRiskAdvice(mode);
    }

    // ── Fear & Greed ─────────────────────────────────────────────────────
    if (q.includes('fear') || q.includes('greed') || q.includes('sentiment')) {
      return this.buildSentimentAnalysis(fg, mode);
    }

    // ── DCA / dollar cost ────────────────────────────────────────────────
    if (q.includes('dca') || q.includes('dollar cost') || q.includes('accumulate')) {
      return this.buildDCAAdvice(btc, fg, mode);
    }

    // ── Entry / buy ──────────────────────────────────────────────────────
    if (q.includes('entry') || (q.includes('buy') && !q.includes("don't buy"))) {
      return this.buildEntryAdvice(btc, fg, mode);
    }

    // ── Exit / sell ──────────────────────────────────────────────────────
    if (q.includes('exit') || q.includes('sell') || q.includes('take profit')) {
      return this.buildExitAdvice(btc, mode);
    }

    // ── Generic / fallback ───────────────────────────────────────────────
    return this.buildGenericResponse(query, btc, fg, mode);
  },

  buildMarketOverview(btc, eth, fg, mode) {
    const btcRsi = btc?.rsi?.toFixed(1) || 'N/A';
    const btcSignal = btc?.signal || 'NEUTRAL';
    const btcPrice = btc?.currentPrice ? `$${Number(btc.currentPrice).toLocaleString()}` : 'N/A';
    const fgVal = fg ? parseInt(fg.value) : null;
    const fgLabel = fg?.classification || 'Unknown';
    const fgEmoji = fgVal ? (fgVal >= 75 ? '🤑' : fgVal >= 55 ? '😊' : fgVal >= 45 ? '😐' : fgVal >= 25 ? '😨' : '😱') : '❓';
    const marketBias = btcSignal === 'BUY' ? 'bullish' : btcSignal === 'SELL' ? 'bearish' : 'mixed/sideways';

    let modeAdvice = '';
    if (mode === 'conservative') modeAdvice = '\n\n🛡️ **Conservative Stance:** In the current environment, I\'d suggest focusing on BTC/ETH only, keeping 40%+ in cash, and waiting for clearer entries.';
    if (mode === 'aggressive') modeAdvice = '\n\n🚀 **Aggressive Stance:** Look for momentum setups in altcoins, consider leveraged positions on confirmed breakouts, but always protect with stops.';

    return `## 📊 Market Overview

**Bitcoin:** ${btcPrice} | RSI: ${btcRsi} | Signal: ${btcSignal === 'BUY' ? '🟢' : btcSignal === 'SELL' ? '🔴' : '🟡'} ${btcSignal}

**Overall Bias:** The market is currently **${marketBias}** based on BTC\'s technical structure.

**Sentiment:** ${fgEmoji} Fear & Greed Index at **${fgVal || 'N/A'}** (${fgLabel})

### Key Observations:
- ${fgVal && fgVal < 30 ? '📉 Extreme Fear — historically a buying opportunity for patient traders' : fgVal && fgVal > 75 ? '📈 Extreme Greed — market may be overextended, consider taking partial profits' : '⚖️ Neutral/Moderate sentiment — wait for clear directional confirmation'}
- BTC RSI at ${btcRsi} suggests ${parseFloat(btcRsi) > 70 ? 'overbought conditions — pullback risk' : parseFloat(btcRsi) < 30 ? 'oversold conditions — potential bounce zone' : 'healthy momentum territory'}
- **Recommendation:** ${btcSignal === 'BUY' ? 'Conditions favor long positions with proper risk management' : btcSignal === 'SELL' ? 'Reduce exposure and watch for reversal signals' : 'Wait for clearer direction before committing large positions'}
${modeAdvice}`;
  },

  async buildOpportunities(mode) {
    // Try to fetch a few coins' analysis
    const coins = [
      { id: 'bitcoin', label: 'BTC' },
      { id: 'ethereum', label: 'ETH' },
      { id: 'solana', label: 'SOL' },
      { id: 'avalanche-2', label: 'AVAX' },
      { id: 'chainlink', label: 'LINK' },
    ];

    const results = [];
    for (const coin of coins) {
      try {
        const data = await fetch(`/api/crypto/${coin.id}/analysis`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (data) results.push({ ...coin, data });
      } catch(e) {}
    }

    const buySignals = results.filter(r => r.data?.signal === 'BUY').slice(0, 3);
    const sellSignals = results.filter(r => r.data?.signal === 'SELL').slice(0, 2);

    let response = `## 🎯 Top Trading Opportunities\n\n`;

    if (buySignals.length > 0) {
      response += `### 🟢 Long Opportunities\n`;
      buySignals.forEach((coin, i) => {
        const d = coin.data;
        const rsi = d.rsi?.toFixed(1) || 'N/A';
        const price = d.currentPrice ? `$${Number(d.currentPrice).toLocaleString()}` : 'N/A';
        response += `\n**${i+1}. ${coin.label}** — ${price}\n- RSI: ${rsi} | Score: ${d.signalScore || 'N/A'}\n- ${d.trend || 'Bullish structure'}\n`;
        if (mode === 'conservative') response += `- Entry: Wait for pullback to support\n`;
        if (mode === 'aggressive') response += `- Entry: Current levels, tight stop below recent low\n`;
      });
    } else {
      response += `**No strong BUY signals detected right now.** Market may be in a consolidation phase.\n`;
    }

    if (sellSignals.length > 0 && mode !== 'conservative') {
      response += `\n### 🔴 Short/Avoid\n`;
      sellSignals.forEach(coin => {
        response += `- **${coin.label}**: ${coin.data.trend || 'Bearish structure'} — avoid longs\n`;
      });
    }

    response += `\n⚠️ **Always use stop-losses.** These are signals, not guarantees.`;
    return response;
  },

  buildPortfolioAnalysis(mode) {
    let portfolio = null;
    try {
      const stored = localStorage.getItem('traderpro_paper_trading');
      if (stored) portfolio = JSON.parse(stored);
    } catch(e) {}

    if (!portfolio || !(portfolio.positions?.length)) {
      return `## 💼 Portfolio Analysis\n\nI don't see any open positions in your paper trading portfolio. \n\nTo start trading:\n- Navigate to **Paper Trading** in the sidebar\n- Open some test positions\n- Come back and I'll analyze your exposure\n\n**Tip:** Even with paper trading, practice proper position sizing — treat it like real money to build good habits!`;
    }

    const positions = portfolio.positions || [];
    const totalPnl = portfolio.totalPnl || 0;
    const balance = portfolio.balance || 10000;

    let response = `## 💼 Portfolio Risk Analysis\n\n`;
    response += `**Balance:** $${balance.toLocaleString()} | **Total P&L:** ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%\n\n`;
    response += `**Open Positions:** ${positions.length}\n\n`;

    if (positions.length > 3) {
      response += `⚠️ **Concentration Warning:** You have ${positions.length} open positions. `;
      response += mode === 'conservative' ? 'Consider reducing to 3-4 max for better risk control.\n\n' : 'Make sure your total exposure is within your risk tolerance.\n\n';
    }

    response += `### Position Summary\n`;
    positions.slice(0, 5).forEach(pos => {
      const pnl = pos.unrealizedPnl || 0;
      response += `- **${pos.symbol || 'Unknown'}**: ${pnl >= 0 ? '🟢 +' : '🔴 '}${pnl.toFixed(2)}%`;
      if (!pos.stopLoss) response += ` ⚠️ No stop-loss!`;
      response += '\n';
    });

    const noStop = positions.filter(p => !p.stopLoss);
    if (noStop.length > 0) {
      response += `\n🚨 **${noStop.length} position(s) without stop-losses!** This is high risk — set stops immediately.`;
    }

    return response;
  },

  buildTrendAnalysis(btc, eth, fg, mode) {
    const btcRsi = btc?.rsi || 50;
    const fgVal = fg ? parseInt(fg.value) : 50;
    const btcSignal = btc?.signal || 'HOLD';

    const isBull = btcSignal === 'BUY' && fgVal > 50 && btcRsi > 50;
    const isBear = btcSignal === 'SELL' && fgVal < 50 && btcRsi < 50;
    const phase = isBull ? '🐂 Bullish' : isBear ? '🐻 Bearish' : '↔️ Sideways/Uncertain';

    return `## 📈 Trend Analysis

**Current Phase:** ${phase}

### Technical Evidence:
- **BTC RSI:** ${btcRsi.toFixed ? btcRsi.toFixed(1) : btcRsi} — ${btcRsi > 60 ? 'Bullish momentum' : btcRsi < 40 ? 'Bearish pressure' : 'Neutral zone'}
- **Market Sentiment:** Fear & Greed at ${fgVal} — ${fgVal > 60 ? 'Greed dominating' : fgVal < 40 ? 'Fear dominating' : 'Balanced'}
- **BTC Primary Signal:** ${btcSignal}

### What This Means:
${isBull ? `
- The overall trend favors **long positions**
- Look for dips to buy, not extended rallies
- ${mode === 'aggressive' ? 'Consider leveraged longs on pullbacks to key support' : 'Accumulate quality assets (BTC/ETH) on retracements'}
- Key risk: Watch for momentum divergence (RSI falling while price rises)
` : isBear ? `
- The trend favors **caution and reduced exposure**
- Any rallies should be seen as selling opportunities
- ${mode === 'conservative' ? 'Move majority to stablecoins until trend reverses' : 'Look for short setups or wait on the sidelines'}
- Key risk: Sudden reversals — always have stops in place
` : `
- The market is **consolidating** — no clear trend direction
- Best approach: Wait for breakout confirmation
- ${mode === 'aggressive' ? 'Watch for BB squeeze patterns (big move coming)' : 'Stay patient — forced trades in choppy markets lose money'}
- Key levels: BTC needs to break and hold above/below key moving averages
`}`;
  },

  buildCoinAnalysis(coin, data, mode) {
    if (!data) return `I couldn't fetch live ${coin.toUpperCase()} data right now. Try refreshing or check back in a moment.`;

    const price = data.currentPrice ? `$${Number(data.currentPrice).toLocaleString()}` : 'N/A';
    const rsi = data.rsi?.toFixed(1) || 'N/A';
    const signal = data.signal || 'HOLD';
    const trend = data.trend || 'Neutral';

    const riskNote = mode === 'conservative' ? '\n\n🛡️ **Conservative:** Only enter if signal confirms AND RSI is not extended.' :
                     mode === 'aggressive' ? '\n\n🚀 **Aggressive:** Look for momentum continuation — add on breakouts.' : '';

    return `## 🔍 ${coin.toUpperCase()} Analysis

**Price:** ${price}
**RSI:** ${rsi} — ${parseFloat(rsi) > 70 ? '⚠️ Overbought' : parseFloat(rsi) < 30 ? '🟢 Oversold' : '✅ Healthy'}
**Signal:** ${signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : '🟡'} **${signal}**
**Trend:** ${trend}

### Analysis:
- RSI at ${rsi} ${parseFloat(rsi) > 70 ? 'suggests the asset is overextended. Consider waiting for a pullback before entering.' : parseFloat(rsi) < 30 ? 'signals potential oversold conditions — watch for reversal candles.' : 'is in a healthy range with room to move either direction.'}
- Current signal is **${signal}** — ${signal === 'BUY' ? 'technical conditions favor bulls' : signal === 'SELL' ? 'technical conditions favor bears' : 'no strong directional bias'}

### Actionable:
${signal === 'BUY' ? `- 🟢 **Entry Zone:** Current levels or on minor pullback\n- 🎯 **Target:** Look for +5-15% move to next resistance\n- 🛑 **Stop:** -3% to -5% below entry` : signal === 'SELL' ? `- 🔴 **Avoid longs** at current levels\n- ⏳ Wait for RSI to reach oversold or signal to flip\n- 🛑 If holding, consider tightening stop-losses` : `- ⏳ **Hold Pattern** — no action needed\n- Watch for breakout above resistance or break below support\n- Set alerts at key levels`}
${riskNote}`;
  },

  async buildLiveCoinAnalysis(coinId, symbol, mode) {
    const data = await fetch(`/api/crypto/${coinId}/analysis`).then(r => r.ok ? r.json() : null).catch(() => null);
    return this.buildCoinAnalysis(symbol.toLowerCase(), data, mode);
  },

  buildStrategyAdvice(btc, fg, mode) {
    const fgVal = fg ? parseInt(fg.value) : 50;
    const btcSignal = btc?.signal || 'HOLD';

    const strategies = {
      conservative: {
        primary: 'Dollar-Cost Averaging (DCA)',
        desc: 'Invest fixed amounts at regular intervals regardless of price',
        rules: ['Invest 10-20% of allocation per week', 'Focus only on BTC and ETH', 'Hold 50-60% in stablecoins', 'Exit if RSI > 80 for 3+ days'],
      },
      balanced: {
        primary: 'Trend Following with Risk Controls',
        desc: 'Follow the primary trend, cut losses quickly',
        rules: ['Enter on confirmed EMA crossovers', 'Use 2% max risk per trade', 'Take 50% profit at +10%, let rest run', 'Review weekly, not daily'],
      },
      aggressive: {
        primary: 'Momentum + Breakout Trading',
        desc: 'Catch strong moves early with tight risk management',
        rules: ['Enter on Bollinger squeeze breakouts with volume', 'Use 3-5% risk per trade', 'Trail stop after +10% gain', 'Add to winners, never losers'],
      },
    };

    const strat = strategies[mode];
    const marketSuitability = btcSignal === 'BUY' ? '✅ Current market conditions are favorable for this strategy.' :
                              btcSignal === 'SELL' ? '⚠️ Market conditions are challenging — reduce position sizes.' :
                              '⚠️ Sideways markets require patience — wait for clear signals.';

    return `## 💡 Strategy Recommendation

Based on your **${this.PERSONALITIES[mode].label}** profile, I recommend:

### ${strat.primary}
*${strat.desc}*

**Rules to Follow:**
${strat.rules.map(r => `- ${r}`).join('\n')}

**Market Fit:** ${marketSuitability}

### Additional Context:
- Fear & Greed Index at **${fgVal}** — ${fgVal < 30 ? 'fear = potential buying opportunity' : fgVal > 70 ? 'greed = be careful chasing rallies' : 'neutral — follow your strategy rules'}
- BTC signal is **${btcSignal}** which ${btcSignal === 'BUY' ? 'aligns with a long bias' : btcSignal === 'SELL' ? 'suggests caution on new longs' : 'is neutral'}

💡 **Pro tip:** The best strategy is one you can stick to consistently. Switching strategies based on short-term noise destroys returns.`;
  },

  buildRiskAdvice(mode) {
    const riskPct = mode === 'conservative' ? '1%' : mode === 'aggressive' ? '2-3%' : '1-2%';
    return `## ⚠️ Risk Management Rules

**For your ${this.PERSONALITIES[mode].label} profile:**

### Position Sizing
- **Max risk per trade:** ${riskPct} of total portfolio
- **Formula:** Position Size = (Portfolio × Risk%) ÷ (Entry - Stop Loss)
- **Example:** $10,000 × 1% = $100 max loss → if stop is 5% below entry → $2,000 position size

### Stop-Loss Rules
- **Always set before entering** — never move stops against your position
- For volatile crypto: 3-5% initial stop is typical
- Move stop to breakeven once trade is +5% in profit (free trade!)
- Consider ATR-based stops for precise sizing

### Portfolio-Level Rules
${mode === 'conservative' ? `- Max 30% in crypto at any time\n- Keep 50%+ in stablecoins/cash\n- Max 3 open positions\n- No leverage` : mode === 'aggressive' ? `- Max 80% deployed at peak\n- Keep 20% cash reserve\n- Max 5-7 open positions\n- Leverage only on high-conviction setups` : `- Max 60% deployed\n- Keep 30% cash reserve\n- Max 4-5 open positions\n- No leverage`}

### The "Sleep Test"
🛌 If your positions are keeping you awake, you're sized too large. Reduce until you can sleep comfortably.`;
  },

  buildSentimentAnalysis(fg, mode) {
    const val = fg ? parseInt(fg.value) : null;
    const label = fg?.classification || 'Unknown';

    if (!val) return `I couldn't fetch the Fear & Greed Index right now. This indicator typically shows market sentiment from 0 (Extreme Fear) to 100 (Extreme Greed).`;

    const interpretation = val <= 25 ? 'Extreme Fear — historically these levels precede market recoveries. "Be greedy when others are fearful." — Warren Buffett' :
                           val <= 40 ? 'Fear — market is cautious. Good time to start accumulating quality assets.' :
                           val <= 60 ? 'Neutral — no strong sentiment edge. Follow technical signals.' :
                           val <= 75 ? 'Greed — market is feeling good. Watch for overextension.' :
                           'Extreme Greed — markets are euphoric. High risk of correction. Consider taking profits.';

    const action = mode === 'conservative' ?
      (val <= 40 ? 'DCA into BTC/ETH slowly' : val >= 75 ? 'Take 30-50% profits, move to stablecoins' : 'Hold current positions') :
      (val <= 25 ? 'Aggressive buying opportunity — deploy 50%+ of reserves' : val >= 75 ? 'Scale out of altcoins, hold only BTC/ETH core' : 'Follow technical signals');

    return `## 😨😊 Fear & Greed Analysis

**Current Index:** ${val}/100 — **${label}**

${'█'.repeat(Math.floor(val/5))}${'░'.repeat(20-Math.floor(val/5))} ${val}%

**What This Means:**
${interpretation}

### Historical Context:
- Values **< 25** (Extreme Fear) have historically been near market bottoms
- Values **> 75** (Extreme Greed) have historically been near market tops
- This indicator works best as a **contrarian signal** — not for timing exact entries

### Your Action (${this.PERSONALITIES[mode].label} mode):
📌 ${action}

⚠️ **Important:** Fear & Greed is a sentiment tool, not a standalone signal. Always confirm with price action and technical indicators.`;
  },

  buildDCAAdvice(btc, fg, mode) {
    const fgVal = fg ? parseInt(fg.value) : 50;
    const dip = fgVal < 40;
    return `## 📅 DCA Strategy Advice

**Dollar-Cost Averaging** is ideal for ${mode === 'conservative' ? 'your conservative profile' : 'building a core position'}.

### Recommended Approach:
${dip ? '✅ **Current environment (Fear conditions) is favorable for DCA.** Markets in fear often recover.' : '⚠️ **Neutral/Greed conditions** — DCA still works, but don\'t rush to deploy all capital.'}

### DCA Schedule (Example for $10,000 total allocation):
- **Weekly:** $${mode === 'aggressive' ? '1000/week × 10 weeks' : '500/week × 20 weeks'}
- **Trigger-based:** Add extra if RSI drops below 30 or Fear & Greed drops below 20
- **Hold period:** Minimum 3-6 months to average out volatility

### Best Assets for DCA:
1. **Bitcoin (BTC)** — 50-60% of DCA budget
2. **Ethereum (ETH)** — 25-30%
3. ${mode === 'aggressive' ? '**Blue-chip altcoins** (SOL, AVAX, LINK) — 10-25%' : '**Stablecoins** — park remainder until better entry'}

### What NOT to do:
- Don't try to time the bottom exactly — that's what DCA avoids
- Don't pause DCA when prices rise (you'll only buy dips!)
- Don't include meme coins in your DCA strategy`;
  },

  buildEntryAdvice(btc, fg, mode) {
    const btcRsi = btc?.rsi || 50;
    const btcSignal = btc?.signal || 'HOLD';
    const goodEntry = btcSignal === 'BUY' && btcRsi < 65;

    return `## 🎯 Entry Strategy

${goodEntry ? '✅ **Current conditions look favorable for entries.**' : '⚠️ **Wait for better entry conditions before committing.**'}

### Entry Checklist:
- [ ] Price is near support (not chasing a rally)
- [ ] RSI is between 40-65 (not overbought)
- [ ] Volume confirms the move (above average)
- [ ] Higher timeframe trend is bullish (4H/Daily)
- [ ] Stop-loss level is defined BEFORE entering
- [ ] Risk is ≤${mode === 'conservative' ? '1%' : mode === 'aggressive' ? '3%' : '2%'} of portfolio

### Entry Techniques:
${mode === 'conservative' ? `**Limit Orders Only:**\n- Place buy limit orders 1-2% below current price\n- Wait for price to come to you\n- Never chase green candles` : mode === 'aggressive' ? `**Breakout Entries:**\n- Enter on confirmed breakout with volume\n- Use market order for speed\n- Immediately set stop 3-5% below breakout level` : `**Scaled Entries:**\n- Enter 50% at current level\n- Reserve 50% for potential dip\n- Average in rather than going all-in at once`}

### Current BTC Setup:
- RSI: ${btcRsi.toFixed ? btcRsi.toFixed(1) : btcRsi} — ${btcRsi > 70 ? '⚠️ Overbought — wait for cooling off' : btcRsi < 35 ? '🟢 Oversold — potential entry zone' : '✅ Healthy range for entries'}
- Signal: ${btcSignal}`;
  },

  buildExitAdvice(btc, mode) {
    const btcRsi = btc?.rsi || 50;
    return `## 🚪 Exit Strategy

### When to Exit — ${this.PERSONALITIES[mode].label} Mode:

**Take Profit Levels:**
${mode === 'conservative' ? '- Take 100% profit at +8-10%\n- Don\'t get greedy — lock in gains consistently' : mode === 'aggressive' ? '- Take 25% profit at +10%\n- Take another 25% at +20%\n- Let 50% run with trailing stop\n- Final exit if RSI > 80 or signal flips SELL' : '- Take 50% profit at +10%\n- Move stop to breakeven on remaining\n- Final exit at +20% or on signal reversal'}

**Stop-Loss Rules:**
- Hard stop: -${mode === 'conservative' ? '3' : mode === 'aggressive' ? '5' : '4'}% from entry (non-negotiable!)
- Breakeven stop: Move to entry price once +5% in profit
- Trailing stop: ${mode === 'aggressive' ? '7% trailing from highest point' : '5% trailing from highest point'}

**Exit Signals to Watch:**
- RSI approaches 75-80 → start scaling out
- MACD bearish crossover → reduce position
- Price closes below 20 EMA on daily → tighten stops
- Volume drops on up moves (distribution) → watch carefully

### Current BTC Exit Context:
- RSI at ${btcRsi.toFixed ? btcRsi.toFixed(1) : btcRsi} — ${btcRsi > 75 ? '🚨 Near overbought: start taking profits!' : btcRsi > 65 ? '⚠️ Getting extended: tighten stops' : '✅ No urgency to exit yet'}`;
  },

  buildGenericResponse(query, btc, fg, mode) {
    const fgVal = fg ? parseInt(fg.value) : 50;
    const btcSignal = btc?.signal || 'HOLD';
    const btcRsi = btc?.rsi ? btc.rsi.toFixed(1) : 'N/A';

    return `I understand you're asking about: **"${query}"**

Here's what I can tell you based on current market data:

**Market Snapshot:**
- BTC Signal: ${btcSignal === 'BUY' ? '🟢' : btcSignal === 'SELL' ? '🔴' : '🟡'} ${btcSignal} | RSI: ${btcRsi}
- Sentiment: ${fgVal}/100 ${fgVal < 30 ? '(Extreme Fear)' : fgVal > 70 ? '(Extreme Greed)' : '(Neutral)'}
- Your Mode: ${this.PERSONALITIES[mode].label}

For more specific analysis, try asking me:
- "Give me a market overview"
- "What are the top opportunities right now?"
- "Analyze my portfolio risk"
- "How should I approach Bitcoin right now?"
- Or use the quick prompt buttons above!

Is there a specific coin or trading topic you'd like me to dive deeper into?`;
  },
};

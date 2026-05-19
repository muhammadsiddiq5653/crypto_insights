'use strict';

/**
 * LLM Trade Decision Engine
 * Uses OpenRouter (free tier) to reason about technical indicators
 * and produce natural-language trade decisions with full explanation.
 * Falls back to a rule-based local engine if no API key is set.
 */
const LLMTradeEngine = (() => {
  function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  // Safe markdown converter: escapes text first, THEN applies only bold/newline transforms
  function safeMd(s) {
    return esc(s)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
  }

  let initialised = false;
  let apiKey = '';
  let analysisHistory = [];
  let currentAnalysis = null;

  // ── Local rule-based engine (no API key needed) ────────────────────

  function ruleBasedAnalysis(indicators, symbol, price) {
    const {
      rsi = 50, macd = 0, macdSignal = 0, sma20 = price, sma50 = price,
      bb_upper = price * 1.02, bb_lower = price * 0.98,
      volume_ratio = 1.0, adx = 25
    } = indicators;

    let bullishPoints = 0, bearishPoints = 0;
    const reasons = [];

    // RSI analysis
    if (rsi < 30) { bullishPoints += 3; reasons.push({ factor: 'RSI Oversold', detail: `RSI at ${rsi.toFixed(1)} — historically strong reversal zone`, bias: 'BULLISH', weight: 3 }); }
    else if (rsi < 45) { bullishPoints += 1; reasons.push({ factor: 'RSI Low', detail: `RSI at ${rsi.toFixed(1)} — mild bullish bias`, bias: 'BULLISH', weight: 1 }); }
    else if (rsi > 70) { bearishPoints += 3; reasons.push({ factor: 'RSI Overbought', detail: `RSI at ${rsi.toFixed(1)} — overextended, pullback likely`, bias: 'BEARISH', weight: 3 }); }
    else if (rsi > 60) { bearishPoints += 1; reasons.push({ factor: 'RSI Elevated', detail: `RSI at ${rsi.toFixed(1)} — approaching overbought territory`, bias: 'BEARISH', weight: 1 }); }
    else { reasons.push({ factor: 'RSI Neutral', detail: `RSI at ${rsi.toFixed(1)} — no directional signal`, bias: 'NEUTRAL', weight: 0 }); }

    // MACD
    if (macd > macdSignal && macd > 0) { bullishPoints += 2; reasons.push({ factor: 'MACD Bullish Cross', detail: `MACD (${macd.toFixed(4)}) above signal (${macdSignal.toFixed(4)}) in positive territory`, bias: 'BULLISH', weight: 2 }); }
    else if (macd < macdSignal && macd < 0) { bearishPoints += 2; reasons.push({ factor: 'MACD Bearish Cross', detail: `MACD below signal in negative territory — downtrend confirmed`, bias: 'BEARISH', weight: 2 }); }
    else if (macd > macdSignal) { bullishPoints += 1; reasons.push({ factor: 'MACD Positive', detail: `MACD above signal — early bullish momentum`, bias: 'BULLISH', weight: 1 }); }

    // Moving averages
    if (price > sma20 && sma20 > sma50) { bullishPoints += 2; reasons.push({ factor: 'MA Alignment', detail: `Price > SMA20 > SMA50 — classic bullish alignment`, bias: 'BULLISH', weight: 2 }); }
    else if (price < sma20 && sma20 < sma50) { bearishPoints += 2; reasons.push({ factor: 'MA Alignment', detail: `Price < SMA20 < SMA50 — bearish trend structure`, bias: 'BEARISH', weight: 2 }); }
    else if (price > sma50) { bullishPoints += 1; reasons.push({ factor: 'Above SMA50', detail: `Price above long-term average — uptrend intact`, bias: 'BULLISH', weight: 1 }); }

    // Bollinger Bands
    if (price <= bb_lower) { bullishPoints += 2; reasons.push({ factor: 'BB Lower Touch', detail: `Price at lower Bollinger Band — mean reversion buy signal`, bias: 'BULLISH', weight: 2 }); }
    else if (price >= bb_upper) { bearishPoints += 2; reasons.push({ factor: 'BB Upper Touch', detail: `Price at upper Bollinger Band — overbought, potential reversal`, bias: 'BEARISH', weight: 2 }); }

    // Volume confirmation
    if (volume_ratio > 1.5) { reasons.push({ factor: 'High Volume', detail: `Volume ${volume_ratio.toFixed(1)}x above average — move is confirmed`, bias: 'CONFIRMING', weight: 1 }); bullishPoints += 0.5; }
    else if (volume_ratio < 0.7) { reasons.push({ factor: 'Low Volume', detail: `Volume below average — move lacks conviction`, bias: 'WARNING', weight: -1 }); }

    // ADX (trend strength)
    if (adx > 30) { reasons.push({ factor: 'Strong Trend', detail: `ADX at ${adx.toFixed(0)} — strong directional trend, hold positions`, bias: 'CONFIRMING', weight: 0 }); }
    else if (adx < 20) { reasons.push({ factor: 'Weak Trend', detail: `ADX at ${adx.toFixed(0)} — choppy market, reduce position size`, bias: 'WARNING', weight: 0 }); }

    // Final decision
    const total = bullishPoints + bearishPoints;
    const bullishPct = total > 0 ? bullishPoints / total : 0.5;
    const confidence = Math.min(0.95, Math.abs(bullishPoints - bearishPoints) / 10 + 0.4);

    let signal, signalColor;
    if (bullishPoints >= bearishPoints + 4) { signal = 'STRONG BUY'; signalColor = '#2dd882'; }
    else if (bullishPoints >= bearishPoints + 2) { signal = 'BUY'; signalColor = '#84cc16'; }
    else if (bearishPoints >= bullishPoints + 4) { signal = 'STRONG SELL'; signalColor = '#ff5f57'; }
    else if (bearishPoints >= bullishPoints + 2) { signal = 'SELL'; signalColor = '#f87171'; }
    else { signal = 'HOLD'; signalColor = '#f59e0b'; }

    // Natural language summary
    const sentiment = bullishPoints > bearishPoints ? 'bullish' : bearishPoints > bullishPoints ? 'bearish' : 'mixed';
    const summary = generateLocalSummary(symbol, price, signal, sentiment, reasons, confidence);

    return {
      symbol, price, signal, signalColor, confidence: +(confidence * 100).toFixed(0),
      bullishScore: +bullishPoints.toFixed(1), bearishScore: +bearishPoints.toFixed(1),
      reasons, summary, source: 'Local Rule Engine', timestamp: new Date().toISOString()
    };
  }

  function generateLocalSummary(symbol, price, signal, sentiment, reasons, confidence) {
    const topReasons = reasons.filter(r => r.weight >= 2).map(r => r.factor).slice(0, 3);
    const confLabel = confidence > 0.75 ? 'high' : confidence > 0.55 ? 'moderate' : 'low';

    const lines = [
      `**${symbol}** is currently trading at $${price.toLocaleString('en', {maximumFractionDigits: 2})} and showing ${sentiment} technical signals.`,
      '',
      topReasons.length > 0
        ? `The primary drivers are: ${topReasons.join(', ')}.`
        : 'No dominant signals identified — market is in a consolidation phase.',
      '',
      `Signal: **${signal}** with ${confLabel} confidence (${(confidence * 100).toFixed(0)}%).`,
      '',
      signal.includes('BUY')
        ? 'Consider entering with a defined stop-loss. Use the Kelly Position Sizer to determine appropriate position size.'
        : signal.includes('SELL')
        ? 'Consider reducing exposure or hedging. Wait for confirmation before shorting.'
        : 'Wait for a clearer directional signal before committing to a new position.'
    ];

    return lines.join('\n');
  }

  // ── OpenRouter API call ───────────────────────────────────────────────

  async function callOpenRouter(prompt) {
    if (!apiKey) return null;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://traderpro.local',
          'X-Title': 'TraderPro LLM Engine'
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct:free', // free tier
          messages: [
            {
              role: 'system',
              content: `You are a professional crypto trading analyst. Analyze the given technical indicators and provide a clear, concise trade decision. Structure your response as:
1. SIGNAL: [BUY/SELL/HOLD/STRONG BUY/STRONG SELL]
2. CONFIDENCE: [0-100%]
3. KEY REASONS: bullet points (max 4)
4. TRADE PLAN: entry, stop-loss, take-profit levels
5. RISK WARNING: one sentence

Be direct and data-driven. No financial advice disclaimers needed.`
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 400,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.warn('[LLMEngine] OpenRouter failed:', e.message);
      return null;
    }
  }

  function buildPrompt(symbol, price, indicators) {
    return `Analyze ${symbol} trading at $${price.toLocaleString()}.

Technical Indicators:
- RSI (14): ${indicators.rsi?.toFixed(1) || 'N/A'}
- MACD: ${indicators.macd?.toFixed(4) || 'N/A'} (Signal: ${indicators.macdSignal?.toFixed(4) || 'N/A'})
- SMA 20: $${indicators.sma20?.toFixed(2) || 'N/A'} | SMA 50: $${indicators.sma50?.toFixed(2) || 'N/A'}
- Bollinger Bands: Upper $${indicators.bb_upper?.toFixed(2) || 'N/A'} | Lower $${indicators.bb_lower?.toFixed(2) || 'N/A'}
- Volume ratio vs avg: ${indicators.volume_ratio?.toFixed(2) || 'N/A'}x
- ADX: ${indicators.adx?.toFixed(1) || 'N/A'}
- 24h Change: ${indicators.change_24h?.toFixed(2) || 'N/A'}%

Provide a complete trade analysis with signal, confidence, key reasons, and trade plan.`;
  }

  // ── Fetch live indicators ─────────────────────────────────────────────

  async function fetchLiveIndicators(symbol) {
    try {
      const [ticker, klines] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json()),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=60`).then(r => r.json())
      ]);

      if (!Array.isArray(klines) || klines.length < 30) return null;

      const closes = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));
      const price = parseFloat(ticker.lastPrice);

      // RSI
      const gains = [], losses = [];
      for (let i = 1; i < closes.length; i++) {
        const d = closes[i] - closes[i-1];
        gains.push(d > 0 ? d : 0);
        losses.push(d < 0 ? -d : 0);
      }
      const period = 14;
      const avgGain = gains.slice(-period).reduce((a,b) => a+b, 0) / period;
      const avgLoss = losses.slice(-period).reduce((a,b) => a+b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);

      // SMA
      const sma20 = closes.slice(-20).reduce((a,b) => a+b, 0) / 20;
      const sma50 = closes.slice(-50).reduce((a,b) => a+b, 0) / 50;

      // MACD (12, 26, 9)
      const ema = (arr, n) => {
        const k = 2/(n+1);
        return arr.reduce((prev, curr, i) => i === 0 ? curr : prev * (1-k) + curr * k, arr[0]);
      };
      const ema12 = ema(closes.slice(-30), 12);
      const ema26 = ema(closes.slice(-30), 26);
      const macd = ema12 - ema26;
      const macdArr = closes.slice(-35).map((_, i, arr) => {
        const slice = arr.slice(0, i+1);
        return ema(slice, 12) - ema(slice, 26);
      });
      const macdSignal = ema(macdArr.slice(-9), 9);

      // Bollinger Bands
      const bb_avg = closes.slice(-20).reduce((a,b) => a+b, 0) / 20;
      const variance = closes.slice(-20).reduce((sum, c) => sum + Math.pow(c - bb_avg, 2), 0) / 20;
      const stddev = Math.sqrt(variance);
      const bb_upper = bb_avg + 2 * stddev;
      const bb_lower = bb_avg - 2 * stddev;

      // Volume ratio
      const avgVol = volumes.slice(-20).reduce((a,b) => a+b, 0) / 20;
      const volume_ratio = volumes[volumes.length-1] / avgVol;

      // ADX (simplified)
      const adx = 20 + Math.abs(rsi - 50) * 0.4;

      return {
        rsi, macd, macdSignal, sma20, sma50, bb_upper, bb_lower,
        volume_ratio, adx, change_24h: parseFloat(ticker.priceChangePercent),
        price
      };
    } catch (e) {
      console.warn('[LLMEngine] Indicator fetch failed:', e.message);
      return null;
    }
  }

  // ── HTML rendering ────────────────────────────────────────────────────

  function renderSection() {
    const el = document.getElementById('llm-trade-engine');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">🤖 AI Trade Decision Engine</h2>
          <p class="section-subtitle">LLM-powered reasoning over technical indicators — get an AI analyst's take on any trade</p>
        </div>
      </div>

      <!-- API Key Setup -->
      <div class="llm-apikey-card" id="llm-apikey-card">
        <div class="llm-apikey-header">
          <span class="llm-key-icon">🔑</span>
          <div>
            <strong>OpenRouter API Key (Optional)</strong>
            <div class="llm-key-desc">Add a free OpenRouter key to use Mistral-7B for deeper reasoning. Without it, the local rule engine runs automatically.</div>
          </div>
        </div>
        <div class="llm-key-input-row">
          <input type="password" id="llm-api-key-input" placeholder="sk-or-v1-... (optional)" />
          <button onclick="LLMTradeEngine.saveKey()">Save Key</button>
          <a href="https://openrouter.ai/keys" target="_blank" class="llm-get-key-link">Get free key →</a>
        </div>
        <div class="llm-key-saved" id="llm-key-saved" style="display:none">✓ Key saved — LLM mode active</div>
      </div>

      <!-- Controls -->
      <div class="llm-controls">
        <div class="llm-control-group">
          <label>Asset</label>
          <select id="llm-symbol">
            <option value="BTCUSDT">Bitcoin (BTC)</option>
            <option value="ETHUSDT">Ethereum (ETH)</option>
            <option value="SOLUSDT">Solana (SOL)</option>
            <option value="BNBUSDT">BNB</option>
            <option value="XRPUSDT">XRP</option>
            <option value="ADAUSDT">Cardano (ADA)</option>
            <option value="AVAXUSDT">Avalanche (AVAX)</option>
            <option value="DOGEUSDT">Dogecoin (DOGE)</option>
          </select>
        </div>
        <button class="btn-llm-analyze" id="btn-llm-analyze" onclick="LLMTradeEngine.analyze()">
          🧠 Analyze Now
        </button>
      </div>

      <!-- Result Panel -->
      <div id="llm-result-panel" style="display:none">
        <!-- Chief Analyst verdict -->
        <div class="llm-signal-banner" id="llm-signal-banner"></div>

        <!-- Agent Council -->
        <div class="agent-council" id="agent-council">
          <div class="agent-council-title">🤖 Agent Council — 3 Specialists + Chief Analyst</div>
          <div class="agent-council-grid" id="agent-council-grid"></div>
        </div>

        <!-- Signal Bus context used by agents -->
        <div class="agent-bus-context" id="agent-bus-context" style="display:none">
          <div class="abc-title">📡 Signal Bus Context (fed to agents)</div>
          <div class="abc-body" id="agent-bus-body"></div>
        </div>

        <div class="llm-result-grid">
          <div class="card">
            <div class="card-header">Technical Scores</div>
            <div class="card-body" id="llm-scores-body"></div>
          </div>
          <div class="card">
            <div class="card-header" id="llm-reasoning-header">Chief Analyst Reasoning</div>
            <div class="card-body" id="llm-reasoning-body"></div>
          </div>
        </div>

        <div class="card llm-analysis-card">
          <div class="card-header">Full Analysis</div>
          <div class="card-body llm-analysis-text" id="llm-analysis-text"></div>
        </div>
      </div>

      <!-- History -->
      <div class="card" id="llm-history-card" style="margin-top:1.25rem;display:none">
        <div class="card-header">Analysis History</div>
        <div class="card-body" id="llm-history-body"></div>
      </div>
    `;

    injectStyles();

    // Restore saved key
    const savedKey = localStorage.getItem('llm_openrouter_key');
    if (savedKey) {
      apiKey = savedKey;
      const saved = document.getElementById('llm-key-saved');
      if (saved) saved.style.display = 'block';
    }
  }

  function renderSignalBanner(result) {
    const banner = document.getElementById('llm-signal-banner');
    if (!banner) return;

    banner.innerHTML = `
      <div class="llm-banner-inner" style="border-color:${result.signalColor}20;background:${result.signalColor}08">
        <div class="llm-banner-signal" style="color:${result.signalColor}">${esc(result.signal)}</div>
        <div class="llm-banner-details">
          <div class="llm-banner-symbol">${esc(result.symbol.replace('USDT',''))} at $${result.price.toLocaleString('en',{maximumFractionDigits:2})}</div>
          <div class="llm-banner-conf">Confidence: <strong style="color:${result.signalColor}">${esc(result.confidence)}%</strong></div>
          <div class="llm-banner-source" style="color:var(--color-text-muted);font-size:0.75rem">Source: ${esc(result.source)} · ${new Date(result.timestamp).toLocaleTimeString()}</div>
        </div>
        <div class="llm-bull-bear-bar">
          <div class="llm-bull-seg" style="width:${(result.bullishScore/(result.bullishScore+result.bearishScore))*100}%"></div>
          <div class="llm-bear-seg" style="width:${(result.bearishScore/(result.bullishScore+result.bearishScore))*100}%"></div>
        </div>
      </div>
    `;
  }

  function renderScores(result) {
    const body = document.getElementById('llm-scores-body');
    if (!body) return;

    const total = result.bullishScore + result.bearishScore;
    const bullPct = total > 0 ? (result.bullishScore/total*100).toFixed(0) : 50;
    const bearPct = total > 0 ? (result.bearishScore/total*100).toFixed(0) : 50;

    body.innerHTML = `
      <div class="llm-score-row">
        <span>🟢 Bullish Points</span>
        <strong style="color:#2dd882">${result.bullishScore}</strong>
      </div>
      <div class="llm-score-bar-bg">
        <div style="width:${bullPct}%;background:#2dd882;height:100%;border-radius:2px 0 0 2px;transition:width 0.6s"></div>
        <div style="width:${bearPct}%;background:#ff5f57;height:100%;border-radius:0 2px 2px 0;transition:width 0.6s"></div>
      </div>
      <div class="llm-score-row" style="margin-bottom:1rem">
        <span>🔴 Bearish Points</span>
        <strong style="color:#ff5f57">${result.bearishScore}</strong>
      </div>

      <div class="llm-indicator-list">
        ${result.reasons.map(r => `
          <div class="llm-indicator-item">
            <span class="llm-ind-dot" style="background:${r.bias==='BULLISH'?'#2dd882':r.bias==='BEARISH'?'#ff5f57':r.bias==='WARNING'?'#f59e0b':'#6378dc'}"></span>
            <div class="llm-ind-text">
              <div class="llm-ind-name">${esc(r.factor)}</div>
              <div class="llm-ind-detail">${esc(r.detail)}</div>
            </div>
            ${r.weight > 0 ? `<span class="llm-ind-weight" style="color:${r.bias==='BULLISH'?'#2dd882':'#ff5f57'}">+${r.weight}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderReasoning(result) {
    const body = document.getElementById('llm-reasoning-body');
    const header = document.getElementById('llm-reasoning-header');
    if (!body) return;

    if (header) header.textContent = result.source?.includes('Agent Council') ? '🤖 Chief Analyst Synthesis' : result.source === 'Local Rule Engine' ? 'Rule-Based Reasoning' : '🤖 AI Reasoning (Mistral-7B)';

    body.innerHTML = `<div class="llm-reasoning-text"><p>${safeMd(result.summary)}</p></div>`;
  }

  function renderAnalysisText(result, llmText) {
    const el = document.getElementById('llm-analysis-text');
    if (!el) return;

    el.innerHTML = `<p>${safeMd(llmText || result.summary)}</p>`;
  }

  function renderHistory() {
    if (analysisHistory.length === 0) return;

    const card = document.getElementById('llm-history-card');
    const body = document.getElementById('llm-history-body');
    if (!card || !body) return;

    card.style.display = 'block';
    body.innerHTML = `
      <table class="llm-history-table">
        <thead>
          <tr><th>Time</th><th>Asset</th><th>Price</th><th>Signal</th><th>Confidence</th><th>Source</th></tr>
        </thead>
        <tbody>
          ${analysisHistory.slice(-10).reverse().map(r => `
            <tr>
              <td style="font-size:0.75rem;color:var(--color-text-muted)">${new Date(r.timestamp).toLocaleTimeString()}</td>
              <td style="font-weight:600">${esc(r.symbol.replace('USDT',''))}</td>
              <td>$${r.price.toLocaleString('en',{maximumFractionDigits:2})}</td>
              <td style="color:${r.signalColor};font-weight:700">${esc(r.signal)}</td>
              <td>${esc(r.confidence)}%</td>
              <td style="font-size:0.75rem;color:var(--color-text-muted)">${esc(r.source)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Public API ────────────────────────────────────────────────────────

  function saveKey() {
    const input = document.getElementById('llm-api-key-input');
    if (!input) return;
    apiKey = input.value.trim();
    if (apiKey) {
      localStorage.setItem('llm_openrouter_key', apiKey);
      const saved = document.getElementById('llm-key-saved');
      if (saved) saved.style.display = 'block';
      input.value = '';
    }
  }

  // ── Multi-Agent Council ───────────────────────────────────────────────

  function agentTechnical(indicators, symbol, price) {
    const result = ruleBasedAnalysis(indicators, symbol, price);
    const verdict = result.signal === '🟢 LONG' ? 'LONG' : result.signal === '🔴 SHORT' ? 'SHORT' : 'NEUTRAL';
    return {
      id: 'technical', name: 'Technical Analyst', icon: '📊',
      verdict, confidence: result.confidence,
      summary: `RSI ${indicators.rsi?.toFixed(1) || '?'} · MACD ${result.reasons.find(r=>r.factor==='MACD')?result.reasons.find(r=>r.factor==='MACD').detail:'n/a'} · ADX ${indicators.adx?.toFixed(0)||'?'}`,
      reasons: result.reasons.slice(0, 4),
      bullishScore: result.bullishScore, bearishScore: result.bearishScore,
    };
  }

  function agentSentiment(symbol) {
    const busSignals = (typeof SignalBus !== 'undefined') ? SignalBus.getSignals() : [];
    const sym = symbol.replace('USDT','');
    const relevant = busSignals.filter(s =>
      (s.symbol === sym || s.symbol === symbol) &&
      (s.source === 'news_sentiment' || s.source === 'polymarket' || s.source === 'onchain')
    );
    const fgRaw = localStorage.getItem('fg_index');
    const fg = fgRaw ? parseInt(fgRaw) : null;
    const fgLabel = fg === null ? 'unknown' : fg >= 75 ? 'Extreme Greed' : fg >= 55 ? 'Greed' : fg >= 45 ? 'Neutral' : fg >= 25 ? 'Fear' : 'Extreme Fear';
    const fgBias = fg !== null ? (fg > 55 ? 'LONG' : fg < 45 ? 'SHORT' : 'NEUTRAL') : 'NEUTRAL';

    let bullCount = 0, bearCount = 0;
    relevant.forEach(s => { if (s.direction === 'LONG') bullCount++; else if (s.direction === 'SHORT') bearCount++; });
    const verdict = (bullCount > bearCount) ? 'LONG' : (bearCount > bullCount) ? 'SHORT' : fgBias;
    const conf = Math.min(90, 45 + (Math.abs(bullCount - bearCount) * 10) + (fg ? Math.abs(fg - 50) * 0.4 : 0));

    return {
      id: 'sentiment', name: 'Sentiment Analyst', icon: '🌐',
      verdict, confidence: Math.round(conf),
      summary: `Fear & Greed: ${fg !== null ? fg : 'N/A'} (${fgLabel}) · Bus signals: ${relevant.length}`,
      reasons: [
        { factor: 'Fear & Greed', detail: `${fgLabel} (${fg ?? 'N/A'})`, bias: fgBias === 'LONG' ? 'BULLISH' : fgBias === 'SHORT' ? 'BEARISH' : 'NEUTRAL', weight: 0 },
        { factor: 'News/Poly Signals', detail: `${bullCount} bullish · ${bearCount} bearish from bus`, bias: verdict === 'LONG' ? 'BULLISH' : verdict === 'SHORT' ? 'BEARISH' : 'NEUTRAL', weight: 0 },
        ...relevant.slice(0,2).map(s => ({ factor: s.source, detail: s.reasons?.[0] || s.direction, bias: s.direction === 'LONG' ? 'BULLISH' : 'BEARISH', weight: 0 })),
      ],
      bullishScore: bullCount + (fgBias === 'LONG' ? 2 : 0),
      bearishScore: bearCount + (fgBias === 'SHORT' ? 2 : 0),
    };
  }

  function agentRisk(indicators, symbol, price, technicalResult, sentimentResult) {
    const volatility = indicators.bb_upper && indicators.bb_lower
      ? ((indicators.bb_upper - indicators.bb_lower) / price * 100).toFixed(1)
      : '3.0';
    const adx = indicators.adx || 20;
    const trendStrength = adx > 35 ? 'Strong' : adx > 25 ? 'Moderate' : 'Weak';
    const agree = technicalResult.verdict === sentimentResult.verdict && technicalResult.verdict !== 'NEUTRAL';
    const kellyFraction = agree ? 0.25 : 0.10;
    const avgConf = (technicalResult.confidence + sentimentResult.confidence) / 2;
    const riskVerdict = agree ? technicalResult.verdict : 'NEUTRAL';
    const riskConf = Math.round(avgConf * (agree ? 1.1 : 0.7));

    return {
      id: 'risk', name: 'Risk Manager', icon: '🛡️',
      verdict: riskVerdict, confidence: Math.min(95, riskConf),
      summary: `Volatility ${volatility}% · Trend ${trendStrength} · Kelly ${(kellyFraction*100).toFixed(0)}% · Agents ${agree?'agree':'disagree'}`,
      reasons: [
        { factor: 'Volatility (BB)', detail: `${volatility}% band width — ${parseFloat(volatility) > 5 ? 'high vol, reduce size' : 'normal range'}`, bias: parseFloat(volatility) > 5 ? 'WARNING' : 'NEUTRAL', weight: 0 },
        { factor: 'Trend Strength', detail: `ADX ${adx.toFixed(0)} — ${trendStrength} trend`, bias: adx > 25 ? 'BULLISH' : 'NEUTRAL', weight: 0 },
        { factor: 'Agent Consensus', detail: agree ? 'Technical & Sentiment agree — higher conviction' : 'Agents disagree — reduce position', bias: agree ? 'BULLISH' : 'WARNING', weight: 0 },
        { factor: 'Position Sizing', detail: `Quarter-Kelly: ${(kellyFraction*100).toFixed(0)}% of risk capital`, bias: 'NEUTRAL', weight: 0 },
      ],
      bullishScore: agree ? 3 : 0, bearishScore: agree ? 0 : 2,
      kellyFraction, volatility,
    };
  }

  function synthesizeChief(tech, sent, risk, symbol, price) {
    const votes = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
    [tech, sent, risk].forEach(a => { votes[a.verdict] = (votes[a.verdict] || 0) + a.confidence; });
    const verdict = Object.entries(votes).sort((a,b) => b[1]-a[1])[0][0];
    const conf = Math.round(Math.min(95, (tech.confidence*0.4 + sent.confidence*0.3 + risk.confidence*0.3)));
    const bull = tech.bullishScore + sent.bullishScore + risk.bullishScore;
    const bear = tech.bearishScore + sent.bearishScore + risk.bearishScore;
    const signalColor = verdict === 'LONG' ? '#2dd882' : verdict === 'SHORT' ? '#ff5f57' : '#f59e0b';
    const summary = `Council verdict: **${verdict}** with ${conf}% conviction.\n\n` +
      `Technical (${tech.verdict} ${tech.confidence}%) · Sentiment (${sent.verdict} ${sent.confidence}%) · Risk (${risk.verdict} ${risk.confidence}%).\n\n` +
      `Volatility at ${risk.volatility}% · Kelly sizing ${(risk.kellyFraction*100).toFixed(0)}%. ` +
      (verdict !== 'NEUTRAL' ? `Entry near $${price.toLocaleString('en',{maximumFractionDigits:2})} with stop ${verdict==='LONG'?'below':'above'} recent swing.` : 'No clear edge — stand aside.');
    return {
      signal: verdict === 'LONG' ? '🟢 LONG' : verdict === 'SHORT' ? '🔴 SHORT' : '⚪ NEUTRAL',
      direction: verdict, confidence: conf, symbol, price,
      bullishScore: bull, bearishScore: bear, signalColor,
      source: 'Agent Council (3 Specialists)', timestamp: Date.now(), summary,
      reasons: [...tech.reasons.slice(0,2), ...sent.reasons.slice(0,2), ...risk.reasons.slice(0,2)],
    };
  }

  function renderAgentCouncil(agents) {
    const grid = document.getElementById('agent-council-grid');
    const council = document.getElementById('agent-council');
    if (!grid) return;
    if (council) council.style.display = 'block';

    grid.innerHTML = agents.map(a => {
      const col = a.verdict === 'LONG' ? '#2dd882' : a.verdict === 'SHORT' ? '#ff5f57' : '#f59e0b';
      return `
        <div class="agent-card" style="border-color:${col}30;background:${col}06">
          <div class="agent-card-header">
            <span class="agent-icon">${esc(a.icon)}</span>
            <div>
              <div class="agent-name">${esc(a.name)}</div>
              <div class="agent-verdict" style="color:${col}">${esc(a.verdict)} · ${esc(a.confidence)}%</div>
            </div>
            <div class="agent-conf-bar-wrap">
              <div class="agent-conf-bar" style="width:${esc(a.confidence)}%;background:${col}"></div>
            </div>
          </div>
          <div class="agent-summary">${esc(a.summary)}</div>
          <div class="agent-reasons">
            ${(a.reasons||[]).slice(0,3).map(r => `
              <div class="agent-reason-item">
                <span class="agent-reason-dot" style="background:${r.bias==='BULLISH'?'#2dd882':r.bias==='BEARISH'?'#ff5f57':r.bias==='WARNING'?'#f59e0b':'#888'}"></span>
                <span class="agent-reason-text">${esc(r.factor)}: ${esc(r.detail)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Show bus context
    const busCtx = document.getElementById('agent-bus-context');
    const busBody = document.getElementById('agent-bus-body');
    if (busCtx && busBody && typeof SignalBus !== 'undefined') {
      const ranked = SignalBus.getRanked().slice(0, 5);
      if (ranked.length) {
        busCtx.style.display = 'block';
        busBody.innerHTML = ranked.map(s =>
          `<span class="abc-chip" style="border-color:${s.direction==='LONG'?'#2dd882':'#ff5f57'}40">${esc(s.symbol)} ${esc(s.direction)} ${esc(s.confidence)}% <em>${esc(s.source)}</em></span>`
        ).join('');
      }
    }
  }

  async function analyze() {
    const symbolEl = document.getElementById('llm-symbol');
    const btn = document.getElementById('btn-llm-analyze');
    const symbol = symbolEl?.value || 'BTCUSDT';

    if (btn) { btn.disabled = true; btn.textContent = '🤖 Council Analyzing...'; }

    try {
      const indicators = await fetchLiveIndicators(symbol) || {
        rsi: 50, macd: 0, macdSignal: 0,
        sma20: 50000, sma50: 48000,
        bb_upper: 52000, bb_lower: 48000,
        volume_ratio: 1.0, adx: 22,
        change_24h: 0.5, price: 50000,
      };

      const price = indicators.price;
      delete indicators.price;

      // Run 3 specialist agents
      const tech = agentTechnical(indicators, symbol, price);
      const sent = agentSentiment(symbol);
      const risk = agentRisk(indicators, symbol, price, tech, sent);
      const agents = [tech, sent, risk];

      // Chief Analyst synthesis
      const result = synthesizeChief(tech, sent, risk, symbol, price);

      // Show panel
      const panel = document.getElementById('llm-result-panel');
      if (panel) panel.style.display = 'block';

      renderAgentCouncil(agents);
      renderSignalBanner(result);
      renderScores(result);
      renderReasoning(result);
      renderAnalysisText(result, null);

      // Optional LLM enhancement
      if (apiKey) {
        const prompt = buildPrompt(symbol, price, indicators);
        const llmText = await callOpenRouter(prompt);
        if (llmText) {
          result.source = 'Agent Council + Mistral-7B';
          renderSignalBanner(result);
          renderAnalysisText(result, llmText);
        }
      }

      // Emit to SignalBus
      if (typeof SignalBus !== 'undefined' && result.direction !== 'NEUTRAL') {
        SignalBus.emit({
          symbol: symbol.replace('USDT',''), direction: result.direction,
          confidence: result.confidence, source: 'ml_prediction', price,
          reasons: result.reasons.slice(0,3).map(r => r.detail || r.factor),
        });
      }

      analysisHistory.push(result);
      currentAnalysis = result;
      renderHistory();

    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🧠 Analyze Now'; }
    }
  }

  function injectStyles() {
    if (document.getElementById('llm-styles')) return;
    const s = document.createElement('style');
    s.id = 'llm-styles';
    s.textContent = `
      .llm-apikey-card {
        background:rgba(99,120,220,0.06);
        border:1px solid rgba(99,120,220,0.2);
        border-radius:12px;padding:1rem 1.25rem;
        margin-bottom:1.25rem;
      }
      .llm-apikey-header { display:flex;gap:0.75rem;align-items:flex-start;margin-bottom:0.75rem; }
      .llm-key-icon { font-size:1.5rem;flex-shrink:0; }
      .llm-key-desc { font-size:0.8rem;color:var(--color-text-muted);margin-top:0.2rem; }
      .llm-key-input-row { display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap; }
      .llm-key-input-row input {
        flex:1;min-width:200px;
        background:var(--color-bg-secondary);
        border:1px solid var(--color-border);
        border-radius:8px;color:var(--color-text-primary);
        padding:0.5rem 0.75rem;font-size:0.85rem;outline:none;
        transition:border-color 0.2s;
      }
      .llm-key-input-row input:focus { border-color:var(--color-accent-primary); }
      .llm-key-input-row button {
        background:var(--color-accent-primary);color:white;
        border:none;border-radius:8px;padding:0.5rem 1rem;
        font-size:0.85rem;font-weight:600;cursor:pointer;
        transition:opacity 0.2s;
      }
      .llm-key-input-row button:hover { opacity:0.85; }
      .llm-get-key-link { font-size:0.8rem;color:var(--color-accent-primary); }
      .llm-key-saved { font-size:0.8rem;color:#2dd882;margin-top:0.5rem; }

      .llm-controls {
        display:flex;gap:1rem;align-items:flex-end;
        margin-bottom:1.25rem;flex-wrap:wrap;
      }
      .llm-control-group label {
        display:block;font-size:0.75rem;font-weight:500;
        color:var(--color-text-muted);text-transform:uppercase;
        letter-spacing:0.04em;margin-bottom:0.3rem;
      }
      .llm-control-group select {
        background:var(--color-bg-card);
        border:1px solid var(--color-border);
        border-radius:8px;color:var(--color-text-primary);
        padding:0.55rem 0.85rem;font-size:0.875rem;outline:none;
        transition:border-color 0.2s;
      }

      .btn-llm-analyze {
        background:linear-gradient(135deg,#6378dc,#4f62c8);
        color:white;border:none;border-radius:8px;
        font-size:0.95rem;font-weight:600;
        padding:0.6rem 1.5rem;cursor:pointer;
        box-shadow:0 4px 16px rgba(99,120,220,0.3);
        transition:all 0.2s;
      }
      .btn-llm-analyze:hover:not(:disabled) { transform:translateY(-1px); }
      .btn-llm-analyze:disabled { opacity:0.6;cursor:not-allowed; }

      /* Signal Banner */
      .llm-banner-inner {
        border:1px solid;border-radius:12px;
        padding:1.25rem 1.5rem;
        display:flex;align-items:center;gap:1.5rem;
        margin-bottom:1.25rem;
        flex-wrap:wrap;
      }
      .llm-banner-signal { font-size:1.8rem;font-weight:800;letter-spacing:-0.02em;white-space:nowrap; }
      .llm-banner-symbol { font-size:1rem;font-weight:600;color:var(--color-text-primary); }
      .llm-banner-conf { font-size:0.875rem;color:var(--color-text-muted); }
      .llm-bull-bear-bar {
        height:6px;border-radius:3px;overflow:hidden;
        display:flex;width:100%;margin-top:0.5rem;flex-basis:100%;
      }
      .llm-bull-seg { background:#2dd882;transition:width 0.6s; }
      .llm-bear-seg { background:#ff5f57;transition:width 0.6s; }

      .llm-result-grid {
        display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;
        margin-bottom:1.25rem;
      }
      @media(max-width:800px) { .llm-result-grid { grid-template-columns:1fr; } }

      .llm-score-row { display:flex;justify-content:space-between;align-items:center;font-size:0.875rem;margin-bottom:0.4rem; }
      .llm-score-bar-bg { height:10px;border-radius:5px;overflow:hidden;display:flex;margin-bottom:0.75rem;background:var(--color-bg-secondary); }

      .llm-indicator-list { display:flex;flex-direction:column;gap:0.5rem; }
      .llm-indicator-item { display:flex;align-items:flex-start;gap:0.6rem; }
      .llm-ind-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:4px; }
      .llm-ind-name { font-size:0.8rem;font-weight:600;color:var(--color-text-primary); }
      .llm-ind-detail { font-size:0.75rem;color:var(--color-text-muted);line-height:1.3; }
      .llm-ind-weight { font-size:0.75rem;font-weight:700;margin-left:auto;flex-shrink:0; }

      .llm-reasoning-text { font-size:0.875rem;color:var(--color-text-muted);line-height:1.6; }
      .llm-reasoning-text p { margin-bottom:0.5rem; }

      .llm-analysis-card .llm-analysis-text {
        font-size:0.875rem;color:var(--color-text-primary);
        line-height:1.7;
      }
      .llm-analysis-text p { margin-bottom:0.5rem; }

      .llm-history-table { width:100%;border-collapse:collapse;font-size:0.875rem; }
      .llm-history-table th {
        text-align:left;padding:0.5rem 0.75rem;
        border-bottom:1px solid var(--color-border);
        color:var(--color-text-muted);font-size:0.75rem;
        text-transform:uppercase;letter-spacing:0.05em;
      }
      .llm-history-table td { padding:0.6rem 0.75rem;border-bottom:1px solid var(--color-border); }
      .llm-history-table tr:last-child td { border-bottom:none; }
    `;
    document.head.appendChild(s);
  }

  function init() {
    if (initialised) return;
    initialised = true;
    renderSection();
  }

  // ── Signal bridge: analyze a SignalBus signal object ─────────────────
  // Returns a promise resolving to { result, agents, llmText, symbol, price }

  async function analyzeSignal(signal) {
    const sym = (signal.symbol || 'BTC').replace('USDT', '').toUpperCase();
    const symbolFull = sym + 'USDT';
    const fallbackPrice = signal.price || 50000;

    const raw = await fetchLiveIndicators(symbolFull);
    const indicators = raw || {
      rsi: 50, macd: 0, macdSignal: 0,
      sma20: fallbackPrice * 0.97, sma50: fallbackPrice * 0.95,
      bb_upper: fallbackPrice * 1.03, bb_lower: fallbackPrice * 0.97,
      volume_ratio: 1.0, adx: 22, change_24h: 0.5, price: fallbackPrice,
    };

    const price = indicators.price || fallbackPrice;
    const indNoPrice = Object.assign({}, indicators);
    delete indNoPrice.price;

    const tech   = agentTechnical(indNoPrice, symbolFull, price);
    const sent   = agentSentiment(symbolFull);
    const risk   = agentRisk(indNoPrice, symbolFull, price, tech, sent);
    const result = synthesizeChief(tech, sent, risk, symbolFull, price);

    let llmText = null;
    if (apiKey) {
      const prompt = buildPrompt(symbolFull, price, indNoPrice);
      llmText = await callOpenRouter(prompt);
      if (llmText) result.source = 'Agent Council + Mistral-7B';
    }

    return { result, agents: [tech, sent, risk], llmText, symbol: sym, price };
  }

  return { init, analyze, analyzeSignal, saveKey };
})();

/**
 * AI Trade Coach - Rule-based intelligent trading assistant
 * Pattern-matches user input and provides contextual responses
 * No external AI API required, no frameworks
 */

let coachState = {
  messages: [],
  context: {}
};

const COACH_CONFIG = {
  MAX_MESSAGES: 50,
  STORAGE_KEY: 'tp_coach_messages',
  RESPONSE_DELAY: 800,
  MAX_HISTORY_TRADES: 7
};

/**
 * Initialize the AI Coach UI and load persisted messages
 */
function initAICoach() {
  const container = document.getElementById('ai-coach');
  if (!container) return;

  // Load persisted messages
  loadCoachMessages();

  // Render UI
  container.innerHTML = `
    <div class="coach-container">
      <div class="coach-header">
        <h3>AI Trade Coach</h3>
        <button class="coach-clear-btn">Clear Chat</button>
      </div>

      <div class="coach-chips">
        <button class="coach-chip" data-question="Explain my signal">Explain my signal</button>
        <button class="coach-chip" data-question="Am I overtrading?">Am I overtrading?</button>
        <button class="coach-chip" data-question="What's RSI?">What's RSI?</button>
        <button class="coach-chip" data-question="Review my journal">Review my journal</button>
        <button class="coach-chip" data-question="Best setup today?">Best setup today?</button>
      </div>

      <div id="coachMessages" class="coach-messages"></div>

      <div class="coach-input-row">
        <input
          id="coachInput"
          class="coach-input"
          type="text"
          placeholder="Ask me about trading, signals, risk management..."
          autocomplete="off"
        />
        <button id="coachSendBtn" class="coach-send-btn">Send</button>
      </div>
    </div>
  `;

  // Event listeners
  const input = document.getElementById('coachInput');
  const sendBtn = document.getElementById('coachSendBtn');
  const clearBtn = container.querySelector('.coach-clear-btn');

  sendBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (text) sendCoachMessage(text);
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const text = input.value.trim();
      if (text) sendCoachMessage(text);
    }
  });

  clearBtn.addEventListener('click', clearCoachHistory);

  // Quick chip questions
  container.querySelectorAll('.coach-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const question = e.target.dataset.question;
      input.value = question;
      input.focus();
      sendCoachMessage(question);
    });
  });

  // Render initial messages
  renderCoachMessages();
}

/**
 * Load messages from localStorage
 */
function loadCoachMessages() {
  try {
    const stored = localStorage.getItem(COACH_CONFIG.STORAGE_KEY);
    if (stored) {
      coachState.messages = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load coach messages:', e);
  }
}

/**
 * Save messages to localStorage
 */
function saveCoachMessages() {
  try {
    // Keep only last 50 messages
    const toSave = coachState.messages.slice(-COACH_CONFIG.MAX_MESSAGES);
    localStorage.setItem(COACH_CONFIG.STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save coach messages:', e);
  }
}

/**
 * Send user message and get AI response
 */
function sendCoachMessage(text) {
  // Add user message
  const userMsg = {
    type: 'user',
    text: text,
    timestamp: new Date().toISOString()
  };
  coachState.messages.push(userMsg);

  // Clear input
  const input = document.getElementById('coachInput');
  if (input) input.value = '';

  renderCoachMessages();

  // Get AI response after delay (for realism)
  setTimeout(() => {
    const response = getCoachResponse(text);
    const aiMsg = {
      type: 'ai',
      text: response,
      timestamp: new Date().toISOString()
    };
    coachState.messages.push(aiMsg);
    saveCoachMessages();
    renderCoachMessages();
  }, COACH_CONFIG.RESPONSE_DELAY);
}

/**
 * Determine AI response based on user input
 */
function getCoachResponse(input) {
  const lower = input.toLowerCase();

  // RSI questions
  if (lower.includes('rsi') || (lower.includes('relative') && lower.includes('strength'))) {
    return getResponseRSI();
  }

  // MACD questions
  if (lower.includes('macd')) {
    return getResponseMACD();
  }

  // Signal explanation
  if (lower.includes('signal') || lower.includes('explain')) {
    return getResponseSignal();
  }

  // Overtrading
  if (lower.includes('overtrad') || lower.includes('too many') || lower.includes('trading too much')) {
    return getResponseOvertrading();
  }

  // Journal review
  if (lower.includes('journal') || lower.includes('review')) {
    return getResponseJournal();
  }

  // Win rate / performance
  if (lower.includes('win rate') || lower.includes('performance') || lower.includes('how am i doing')) {
    return getResponseWinRate();
  }

  // Best setup
  if (lower.includes('best setup') || lower.includes('what should i trade') || lower.includes('what to trade')) {
    return getResponseBestSetup();
  }

  // Risk management
  if (lower.includes('stop loss') || lower.includes('position size') || lower.includes('risk')) {
    return getResponseRiskMgmt();
  }

  // Market sentiment
  if (lower.includes('fear') || lower.includes('greed') || lower.includes('sentiment')) {
    return getResponseSentiment();
  }

  // Support/Resistance
  if (lower.includes('support') || lower.includes('resistance') || lower.includes('level')) {
    return getResponseSupportResistance();
  }

  // Default
  return getResponseDefault();
}

/**
 * Response: RSI explanation
 */
function getResponseRSI() {
  return `**RSI (Relative Strength Index)** is a momentum indicator that measures the speed of price changes.

- Ranges from 0 to 100
- **Overbought**: RSI > 70 (price may pull back)
- **Oversold**: RSI < 30 (price may bounce)
- Uses 14 periods by default
- Signals exhaustion, not direction

RSI is great for spotting extremes, but pair it with price action for confirmation. Don't trade RSI alone!`;
}

/**
 * Response: MACD explanation
 */
function getResponseMACD() {
  return `**MACD (Moving Average Convergence Divergence)** tracks momentum and trend direction.

- Shows difference between two moving averages
- MACD line: fast moving average minus slow
- Signal line: moving average of MACD line
- **Bullish**: MACD crosses above signal line
- **Bearish**: MACD crosses below signal line
- Histogram: visual representation of difference

Use MACD for trend confirmation and momentum shifts. Avoid trading on MACD alone in choppy markets.`;
}

/**
 * Response: Signal explanation
 */
function getResponseSignal() {
  let response = `I don't see an active signal right now.`;

  if (window._lastSignal) {
    const signal = window._lastSignal;
    response = `**Your last signal:** ${signal.direction || 'N/A'}

- **Confidence**: ${signal.confidence || 'Unknown'}%
- **Key reasons**: ${signal.reasons ? signal.reasons.join(', ') : 'No data'}
- **Time**: ${signal.timestamp ? new Date(signal.timestamp).toLocaleTimeString() : 'Unknown'}

${signal.direction === 'BUY' ? '📈 Bullish setup detected' : '📉 Bearish setup detected'}

Remember: signals are suggestions. Always manage your risk with stop losses.`;
  }

  return response;
}

/**
 * Response: Overtrading check
 */
function getResponseOvertrading() {
  let response = `Let me check your trade history...`;

  try {
    const historyStr = localStorage.getItem('tp_signal_history');
    if (historyStr) {
      const history = JSON.parse(historyStr);
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const recentTrades = history.filter(t => (now - new Date(t.timestamp).getTime()) < sevenDaysMs);

      const tradeCount = recentTrades.length;
      let advice = '';

      if (tradeCount > 14) {
        advice = '⚠️ **You might be overtrading.** More than 2 trades per day increases risk. Focus on high-quality setups only.';
      } else if (tradeCount > 7) {
        advice = '✓ Moderate activity. Keep an eye on win rate to ensure quality over quantity.';
      } else {
        advice = '✓ Good discipline! You\'re trading selectively.';
      }

      response = `**Last 7 days: ${tradeCount} trades**

${advice}

Quality > Quantity. Wait for setups that align with your rules.`;
    }
  } catch (e) {
    console.error('Error reading trade history:', e);
  }

  return response;
}

/**
 * Response: Journal review
 */
function getResponseJournal() {
  let response = `No journal entries yet. Start documenting your trades!`;

  try {
    const journalStr = localStorage.getItem('tp_trade_journal');
    if (journalStr) {
      const journal = JSON.parse(journalStr);
      if (journal.length > 0) {
        const recent = journal.slice(-5);
        const shortTrades = recent.filter(t => t.direction === 'SHORT');
        const longTrades = recent.filter(t => t.direction === 'LONG');

        let patterns = [];
        if (shortTrades.length > longTrades.length) {
          patterns.push('You favor short trades');
        }
        if (recent.some(t => t.outcome === 'loss')) {
          patterns.push('Recent losses detected — review your entries');
        }

        response = `**Last 5 journal entries analyzed:**

- Total entries: ${recent.length}
- Shorts: ${shortTrades.length} | Longs: ${longTrades.length}

${patterns.length > 0 ? patterns.map(p => `- ${p}`).join('\n') : '- Consistent journaling — great!'}

Keep refining your process. Each trade teaches you something.`;
      }
    }
  } catch (e) {
    console.error('Error reading journal:', e);
  }

  return response;
}

/**
 * Response: Win rate calculation
 */
function getResponseWinRate() {
  let response = `I need more trade data to calculate your win rate.`;

  try {
    const historyStr = localStorage.getItem('tp_signal_history');
    if (historyStr) {
      const history = JSON.parse(historyStr);
      if (history.length > 0) {
        const wins = history.filter(t => t.outcome === 'win').length;
        const losses = history.filter(t => t.outcome === 'loss').length;
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        let message = '';
        if (winRate > 60) {
          message = '🎉 Excellent! Above 60% is professional level.';
        } else if (winRate > 50) {
          message = '✓ Solid! Above 50% + risk management = profitability.';
        } else {
          message = '⚠️ Below 50%. Tighten entries or cut losses faster.';
        }

        response = `**Win Rate: ${winRate}%**

- Wins: ${wins} | Losses: ${losses}
- ${message}

Remember: win rate × avg win - (1 - win rate) × avg loss = edge.`;
      }
    }
  } catch (e) {
    console.error('Error calculating win rate:', e);
  }

  return response;
}

/**
 * Response: Best setup recommendation
 */
function getResponseBestSetup() {
  let response = `I need live price data to suggest a setup. Make sure prices are loaded.`;

  if (window._lastSignal) {
    const signal = window._lastSignal;
    response = `**Best opportunity right now:**

${signal.direction === 'BUY' ? '📈 **GO LONG**' : '📉 **GO SHORT**'}

- Confidence: ${signal.confidence || '?'}%
- Setup: ${signal.setup || 'Check your signal'}
- Entry: Market or limit near current price
- Stop: Below/above last swing
- Target: 2:1 risk/reward minimum

Wait for your conditions to align. Don't force trades.`;
  }

  return response;
}

/**
 * Response: Risk management advice
 */
function getResponseRiskMgmt() {
  return `**Position Sizing & Risk Management** — The foundation of trading:

- **1-2% Rule**: Risk only 1-2% of account per trade
- **Stop Loss**: Always set, non-negotiable
- **Risk/Reward**: Aim for 2:1 minimum (risk $1 to make $2)
- **Max Drawdown**: Risk max 5-10% per day to stay disciplined

**Example**: $10,000 account
- Risk per trade: $100-200
- Stop 50 pips away = position size calculated backwards
- Target 100 pips away = 2:1 reward

Proper sizing prevents big losses. Bigger account = more consistent growth.`;
}

/**
 * Response: Market sentiment
 */
function getResponseSentiment() {
  let response = `**Fear & Greed Index** measures market psychology:

- **Extreme Fear** (0-25): Panic selling, potential bottom
- **Fear** (25-45): Caution, selective entries
- **Neutral** (45-55): Balanced conditions
- **Greed** (55-75): Euphoria, extended rallies
- **Extreme Greed** (75-100): Overheating, watch for reversals

Use sentiment as context, not direction. Extreme readings offer opportunities but confirmation needed.`;

  try {
    const fearGreed = localStorage.getItem('tp_fear_greed_index');
    if (fearGreed) {
      const index = JSON.parse(fearGreed);
      response = `**Current Fear & Greed: ${index.value || '?'}**

${index.label || 'Monitor sentiment shifts for entries.'}

${response}`;
    }
  } catch (e) {
    // Continue with default response
  }

  return response;
}

/**
 * Response: Support and resistance
 */
function getResponseSupportResistance() {
  return `**Support & Resistance** — Key price levels where buying/selling clusters:

- **Support**: Price floor where buyers step in (BUY signal)
- **Resistance**: Price ceiling where sellers appear (SELL signal)
- **Bounce**: Price bounces off level, continuing trend
- **Breakout**: Price breaks through level with volume

**Example**: BTC tested $40k five times and bounced = strong support. Break below = sell signal.

Use S/R to place stops and targets. The more times a level holds, the stronger it is.`;
}

/**
 * Response: Default helpful response
 */
function getResponseDefault() {
  return `**Trading Tips:**

- **Discipline** > Prediction. Stick to your rules.
- **Journal** every trade (entry, exit, reason, outcome).
- **Risk Management** first, profits second.
- **Patience** beats frustration. Wait for setups.
- **Review** weekly. What works? What doesn't?

Ask me about RSI, MACD, signals, risk management, or your performance. I'm here to help you trade smarter!`;
}

/**
 * Render all messages in the chat window
 */
function renderCoachMessages() {
  const container = document.getElementById('coachMessages');
  if (!container) return;

  container.innerHTML = coachState.messages
    .map((msg, idx) => {
      const isUser = msg.type === 'user';
      const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      const htmlContent = isUser ? escapeHtml(msg.text) : parseMarkdown(msg.text);

      return `
        <div class="coach-msg ${isUser ? 'user' : 'ai'}">
          ${!isUser ? '<div class="coach-avatar">🤖</div>' : ''}
          <div class="coach-bubble">
            <div>${htmlContent}</div>
            <div class="coach-time">${time}</div>
          </div>
        </div>
      `;
    })
    .join('');

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Parse basic markdown: **bold**, - bullets
 */
function parseMarkdown(text) {
  return text
    .split('\n')
    .map(line => {
      // Bold
      let parsed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Bullet lists
      if (parsed.trim().startsWith('-')) {
        parsed = parsed.replace(/^-\s/, '');
        return `<li>${parsed}</li>`;
      }

      return parsed;
    })
    .join('\n')
    .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear chat history
 */
function clearCoachHistory() {
  if (confirm('Clear all chat history? This cannot be undone.')) {
    coachState.messages = [];
    saveCoachMessages();
    renderCoachMessages();
  }
}

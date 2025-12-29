// Futures Trading Indicators Display

// Display futures trading data
async function displayFuturesData(symbol) {
    const container = document.getElementById('futuresContent');
    showLoading(container);

    try {
        const futuresData = await apiRequest(`/api/crypto/${symbol}/futures`);

        if (!futuresData.available) {
            container.innerHTML = `
        <div class="info-message">
          <span class="info-icon">ℹ️</span>
          <p>Futures trading data is not available for ${symbol}. This feature works best with major cryptocurrencies like BTC, ETH, BNB, etc.</p>
        </div>
      `;
            return;
        }

        let html = '<div class="futures-grid">';

        // Funding Rate Card
        if (futuresData.fundingRate) {
            const rate = futuresData.fundingRate.rate;
            const isPositive = rate > 0;
            const sentiment = isPositive ? 'Bullish' : 'Bearish';
            const color = isPositive ? 'success' : 'danger';

            html += `
        <div class="futures-card">
          <div class="futures-card-header">
            <h3>💰 Funding Rate</h3>
            <span class="futures-badge ${color}">${sentiment}</span>
          </div>
          <div class="futures-value ${color}">${rate > 0 ? '+' : ''}${rate.toFixed(4)}%</div>
          <p class="futures-description">
            ${isPositive ?
                    'Longs are paying shorts. Market is bullish, but watch for potential reversal if rate gets too high.' :
                    'Shorts are paying longs. Market is bearish, but watch for potential reversal if rate gets too negative.'}
          </p>
          <div class="futures-info">
            <strong>What is Funding Rate?</strong><br/>
            The periodic payment between long and short traders. Positive = longs pay shorts (bullish sentiment). Negative = shorts pay longs (bearish sentiment).
          </div>
        </div>
      `;
        }

        // Open Interest Card
        if (futuresData.openInterest) {
            const oi = futuresData.openInterest.value;

            html += `
        <div class="futures-card">
          <div class="futures-card-header">
            <h3>📊 Open Interest</h3>
          </div>
          <div class="futures-value">${formatLargeNumber(oi * 1000000)}</div>
          <p class="futures-description">
            ${oi > 100000 ?
                    'High open interest indicates strong market participation and trend strength.' :
                    'Moderate open interest. Watch for increases which signal growing conviction.'}
          </p>
          <div class="futures-info">
            <strong>What is Open Interest?</strong><br/>
            Total number of outstanding futures contracts. Rising OI + rising price = strong uptrend. Rising OI + falling price = strong downtrend.
          </div>
        </div>
      `;
        }

        // Long/Short Ratio Card
        if (futuresData.longShortRatio) {
            const ratio = futuresData.longShortRatio.ratio;
            const longPct = (ratio / (ratio + 1)) * 100;
            const shortPct = 100 - longPct;
            const sentiment = ratio > 1 ? 'Bullish' : ratio < 1 ? 'Bearish' : 'Neutral';
            const color = ratio > 1 ? 'success' : ratio < 1 ? 'danger' : 'warning';

            html += `
        <div class="futures-card">
          <div class="futures-card-header">
            <h3>⚖️ Long/Short Ratio</h3>
            <span class="futures-badge ${color}">${sentiment}</span>
          </div>
          <div class="futures-value">${ratio.toFixed(2)}</div>
          <div class="long-short-bar">
            <div class="long-bar" style="width: ${longPct}%">
              <span>Long ${longPct.toFixed(1)}%</span>
            </div>
            <div class="short-bar" style="width: ${shortPct}%">
              <span>Short ${shortPct.toFixed(1)}%</span>
            </div>
          </div>
          <p class="futures-description">
            ${ratio > 1.5 ?
                    '⚠️ Extremely bullish positioning. High risk of long squeeze if price drops.' :
                    ratio > 1 ?
                        'More traders are long than short. Bullish sentiment dominates.' :
                        ratio < 0.67 ?
                            '⚠️ Extremely bearish positioning. High risk of short squeeze if price rises.' :
                            'More traders are short than long. Bearish sentiment dominates.'}
          </p>
          <div class="futures-info">
            <strong>What is Long/Short Ratio?</strong><br/>
            Ratio of long positions to short positions. Above 1 = more longs (bullish). Below 1 = more shorts (bearish). Extreme values can signal potential squeezes.
          </div>
        </div>
      `;
        }

        html += '</div>';

        // Add educational section
        html += `
      <div class="futures-education">
        <h3>🎓 How to Use Futures Indicators</h3>
        <div class="futures-tips">
          <div class="futures-tip">
            <strong>Funding Rate Strategy:</strong>
            <p>When funding is very positive (>0.1%), longs are overheated - consider taking profits or waiting for a dip. When very negative (<-0.1%), shorts are overheated - potential buying opportunity.</p>
          </div>
          <div class="futures-tip">
            <strong>Open Interest Strategy:</strong>
            <p>Rising OI + rising price = strong uptrend (add to longs). Rising OI + falling price = strong downtrend (add to shorts). Falling OI = trend weakening.</p>
          </div>
          <div class="futures-tip">
            <strong>Long/Short Ratio Strategy:</strong>
            <p>Extreme ratios (>2 or <0.5) often precede reversals due to liquidations. Use as a contrarian indicator when combined with other signals.</p>
          </div>
        </div>
      </div>
    `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error displaying futures data:', error);
        showError(container, 'Failed to load futures trading data. Please try again.');
    }
}

// Setup futures selector
function setupFuturesSelector() {
    const selector = document.getElementById('futuresSelector');
    if (!selector) return;

    selector.addEventListener('change', (e) => {
        const symbol = e.target.value;
        if (symbol) {
            displayFuturesData(symbol);
        }
    });
}

const config = require('../config');

// Calculate Simple Moving Average (SMA)
function calculateSMA(data, period) {
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

// Calculate Exponential Moving Average (EMA)
function calculateEMA(data, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    let previousEMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(previousEMA);

    // Calculate EMA for remaining values
    for (let i = period; i < data.length; i++) {
        const currentEMA = (data[i] - previousEMA) * multiplier + previousEMA;
        ema.push(currentEMA);
        previousEMA = currentEMA;
    }

    return ema;
}

// Calculate Relative Strength Index (RSI)
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
        return { value: 50, signal: 'NEUTRAL', description: 'Insufficient data for RSI calculation' };
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

    // Calculate average gain and loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calculate RSI for remaining periods
    for (let i = period; i < changes.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Determine signal
    let signal, description;
    if (rsi >= config.technicalAnalysis.rsi.overbought) {
        signal = 'SELL';
        description = `RSI is ${rsi.toFixed(2)} (overbought). Price may be due for a correction.`;
    } else if (rsi <= config.technicalAnalysis.rsi.oversold) {
        signal = 'BUY';
        description = `RSI is ${rsi.toFixed(2)} (oversold). Price may be due for a rebound.`;
    } else {
        signal = 'HOLD';
        description = `RSI is ${rsi.toFixed(2)} (neutral). No strong signal.`;
    }

    return { value: rsi, signal, description };
}

// Calculate MACD (Moving Average Convergence Divergence)
function calculateMACD(prices) {
    const { fastPeriod, slowPeriod, signalPeriod } = config.technicalAnalysis.macd;

    if (prices.length < slowPeriod + signalPeriod) {
        return {
            macdLine: 0,
            signalLine: 0,
            histogram: 0,
            signal: 'NEUTRAL',
            description: 'Insufficient data for MACD calculation'
        };
    }

    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    // MACD line = Fast EMA - Slow EMA
    const macdLine = [];
    const offset = slowPeriod - fastPeriod;
    for (let i = 0; i < slowEMA.length; i++) {
        macdLine.push(fastEMA[i + offset] - slowEMA[i]);
    }

    // Signal line = EMA of MACD line
    const signalLine = calculateEMA(macdLine, signalPeriod);

    // Histogram = MACD line - Signal line
    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const histogram = currentMACD - currentSignal;

    // Determine signal
    let signal, description;
    if (currentMACD > currentSignal && histogram > 0) {
        signal = 'BUY';
        description = 'MACD line is above signal line (bullish momentum).';
    } else if (currentMACD < currentSignal && histogram < 0) {
        signal = 'SELL';
        description = 'MACD line is below signal line (bearish momentum).';
    } else {
        signal = 'HOLD';
        description = 'MACD shows neutral momentum.';
    }

    return {
        macdLine: currentMACD,
        signalLine: currentSignal,
        histogram,
        signal,
        description
    };
}

// Calculate Bollinger Bands
function calculateBollingerBands(prices) {
    const { period, standardDeviations } = config.technicalAnalysis.bollingerBands;

    if (prices.length < period) {
        return {
            upper: 0,
            middle: 0,
            lower: 0,
            signal: 'NEUTRAL',
            description: 'Insufficient data for Bollinger Bands calculation'
        };
    }

    const sma = calculateSMA(prices, period);
    const currentSMA = sma[sma.length - 1];

    // Calculate standard deviation
    const recentPrices = prices.slice(-period);
    const squaredDiffs = recentPrices.map(p => Math.pow(p - currentSMA, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = currentSMA + (standardDeviations * stdDev);
    const lower = currentSMA - (standardDeviations * stdDev);
    const currentPrice = prices[prices.length - 1];

    // Calculate bandwidth (volatility indicator)
    const bandwidth = ((upper - lower) / currentSMA) * 100;

    // Determine signal
    let signal, description;
    if (currentPrice >= upper) {
        signal = 'SELL';
        description = `Price (${currentPrice.toFixed(2)}) is at or above upper band (overbought).`;
    } else if (currentPrice <= lower) {
        signal = 'BUY';
        description = `Price (${currentPrice.toFixed(2)}) is at or below lower band (oversold).`;
    } else {
        signal = 'HOLD';
        description = `Price is within bands. Bandwidth: ${bandwidth.toFixed(2)}% (${bandwidth > 10 ? 'high volatility' : 'low volatility'}).`;
    }

    return {
        upper,
        middle: currentSMA,
        lower,
        bandwidth,
        signal,
        description
    };
}

// Calculate Moving Averages and trend
function calculateMovingAverages(prices) {
    const { short, medium, long } = config.technicalAnalysis.movingAverages;

    if (prices.length < long) {
        return {
            sma20: 0,
            sma50: 0,
            sma200: 0,
            signal: 'NEUTRAL',
            description: 'Insufficient data for moving averages'
        };
    }

    const sma20 = calculateSMA(prices, short);
    const sma50 = calculateSMA(prices, medium);
    const sma200 = calculateSMA(prices, long);

    const currentPrice = prices[prices.length - 1];
    const currentSMA20 = sma20[sma20.length - 1];
    const currentSMA50 = sma50[sma50.length - 1];
    const currentSMA200 = sma200[sma200.length - 1];

    // Determine trend
    let signal, description;
    if (currentSMA20 > currentSMA50 && currentSMA50 > currentSMA200) {
        signal = 'BUY';
        description = 'Strong uptrend: All moving averages aligned bullishly (Golden Cross pattern).';
    } else if (currentSMA20 < currentSMA50 && currentSMA50 < currentSMA200) {
        signal = 'SELL';
        description = 'Strong downtrend: All moving averages aligned bearishly (Death Cross pattern).';
    } else if (currentPrice > currentSMA200) {
        signal = 'HOLD';
        description = 'Price above 200-day MA (long-term uptrend), but mixed signals on shorter timeframes.';
    } else {
        signal = 'HOLD';
        description = 'Mixed signals from moving averages. No clear trend.';
    }

    return {
        sma20: currentSMA20,
        sma50: currentSMA50,
        sma200: currentSMA200,
        currentPrice,
        signal,
        description
    };
}

// Analyze volume
function analyzeVolume(volumes) {
    if (volumes.length < 7) {
        return {
            current: 0,
            average: 0,
            signal: 'NEUTRAL',
            description: 'Insufficient volume data'
        };
    }

    const recentVolumes = volumes.slice(-7).map(v => v.volume);
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const volumeRatio = currentVolume / avgVolume;

    let signal, description;
    if (volumeRatio > 1.5) {
        signal = 'STRONG';
        description = `High volume (${(volumeRatio * 100).toFixed(0)}% of average). Strong market interest.`;
    } else if (volumeRatio < 0.5) {
        signal = 'WEAK';
        description = `Low volume (${(volumeRatio * 100).toFixed(0)}% of average). Weak market interest.`;
    } else {
        signal = 'NORMAL';
        description = `Normal volume levels (${(volumeRatio * 100).toFixed(0)}% of average).`;
    }

    return {
        current: currentVolume,
        average: avgVolume,
        ratio: volumeRatio,
        signal,
        description
    };
}

// Generate overall trading signal
function generateOverallSignal(indicators) {
    const signals = [
        indicators.rsi.signal,
        indicators.macd.signal,
        indicators.bollingerBands.signal,
        indicators.movingAverages.signal
    ];

    const buyCount = signals.filter(s => s === 'BUY').length;
    const sellCount = signals.filter(s => s === 'SELL').length;

    let overallSignal, confidence, recommendation;

    if (buyCount >= 3) {
        overallSignal = 'STRONG BUY';
        confidence = (buyCount / 4) * 100;
        recommendation = 'Multiple indicators suggest this is a good buying opportunity. Consider entering a position.';
    } else if (buyCount >= 2) {
        overallSignal = 'BUY';
        confidence = 60;
        recommendation = 'Some indicators suggest buying. Consider a smaller position or wait for more confirmation.';
    } else if (sellCount >= 3) {
        overallSignal = 'STRONG SELL';
        confidence = (sellCount / 4) * 100;
        recommendation = 'Multiple indicators suggest selling or avoiding this asset. Consider exiting positions.';
    } else if (sellCount >= 2) {
        overallSignal = 'SELL';
        confidence = 60;
        recommendation = 'Some indicators suggest selling. Consider reducing position size or setting stop losses.';
    } else {
        overallSignal = 'HOLD';
        confidence = 50;
        recommendation = 'Mixed signals from indicators. Best to hold current positions and wait for clearer signals.';
    }

    return {
        signal: overallSignal,
        confidence,
        recommendation,
        breakdown: {
            buy: buyCount,
            sell: sellCount,
            hold: 4 - buyCount - sellCount
        }
    };
}

// ── CANDLESTICK PATTERN DETECTION ──────────────────────────────────────
// Uses OHLC data if available, falls back to close-only approximation
function detectCandlestickPatterns(priceData) {
    const patterns = [];

    // priceData: array of { price, open, high, low, close } or just { price }
    // Build OHLC from close prices if open/high/low not available
    const candles = priceData.map((d, i) => ({
        open:  d.open  || (i > 0 ? priceData[i-1].price : d.price),
        high:  d.high  || d.price * 1.005,
        low:   d.low   || d.price * 0.995,
        close: d.close || d.price
    }));

    if (candles.length < 3) return { patterns: [], signal: 'NEUTRAL', description: 'Insufficient data' };

    const len = candles.length;
    const c0 = candles[len - 1]; // most recent
    const c1 = candles[len - 2]; // one before
    const c2 = candles[len - 3]; // two before

    const body0 = Math.abs(c0.close - c0.open);
    const body1 = Math.abs(c1.close - c1.open);
    const range0 = c0.high - c0.low;
    const range1 = c1.high - c1.low;
    const isBull0 = c0.close > c0.open;
    const isBull1 = c1.close > c1.open;

    // Doji: body very small relative to range
    if (body0 < range0 * 0.1 && range0 > 0) {
        patterns.push({ name: 'Doji', type: 'NEUTRAL', icon: '🕯️', desc: 'Indecision candle — potential reversal' });
    }

    // Hammer (bullish): small body at top, long lower wick, after downtrend
    const lowerWick0 = Math.min(c0.open, c0.close) - c0.low;
    const upperWick0 = c0.high - Math.max(c0.open, c0.close);
    if (lowerWick0 > body0 * 2 && upperWick0 < body0 * 0.5 && !isBull1) {
        patterns.push({ name: 'Hammer', type: 'BUY', icon: '🔨', desc: 'Bullish reversal — buyers rejected lower prices' });
    }

    // Shooting Star (bearish): small body at bottom, long upper wick, after uptrend
    if (upperWick0 > body0 * 2 && lowerWick0 < body0 * 0.5 && isBull1) {
        patterns.push({ name: 'Shooting Star', type: 'SELL', icon: '⭐', desc: 'Bearish reversal — sellers rejected higher prices' });
    }

    // Bullish Engulfing: bearish candle followed by larger bullish candle
    if (!isBull1 && isBull0 && c0.close > c1.open && c0.open < c1.close) {
        patterns.push({ name: 'Bullish Engulfing', type: 'BUY', icon: '🟢', desc: 'Strong bullish reversal — buyers overwhelm sellers' });
    }

    // Bearish Engulfing: bullish candle followed by larger bearish candle
    if (isBull1 && !isBull0 && c0.close < c1.open && c0.open > c1.close) {
        patterns.push({ name: 'Bearish Engulfing', type: 'SELL', icon: '🔴', desc: 'Strong bearish reversal — sellers overwhelm buyers' });
    }

    // Morning Star: bearish, doji/small, bullish (3-candle)
    const isBear2 = c2.close < c2.open;
    const isSmall1 = Math.abs(c1.close - c1.open) < (c1.high - c1.low) * 0.3;
    if (isBear2 && isSmall1 && isBull0 && c0.close > (c2.open + c2.close) / 2) {
        patterns.push({ name: 'Morning Star', type: 'BUY', icon: '🌅', desc: 'Powerful 3-candle bullish reversal pattern' });
    }

    // Evening Star: bullish, doji/small, bearish (3-candle)
    const isBull2 = c2.close > c2.open;
    if (isBull2 && isSmall1 && !isBull0 && c0.close < (c2.open + c2.close) / 2) {
        patterns.push({ name: 'Evening Star', type: 'SELL', icon: '🌆', desc: 'Powerful 3-candle bearish reversal pattern' });
    }

    // Three White Soldiers: three consecutive bullish candles
    if (len >= 3) {
        const c3 = candles[len - 3];
        if (c0.close > c1.close && c1.close > c3.close &&
            c0.open > c3.open && c0.open > c1.open &&
            c0.close > c0.open && c1.close > c1.open && c3.close > c3.open) {
            patterns.push({ name: 'Three White Soldiers', type: 'BUY', icon: '🪖', desc: 'Strong bullish continuation — sustained buying pressure' });
        }
    }

    const buyPatterns  = patterns.filter(p => p.type === 'BUY').length;
    const sellPatterns = patterns.filter(p => p.type === 'SELL').length;

    let signal = 'NEUTRAL', description = 'No significant candlestick pattern detected.';
    if (buyPatterns > sellPatterns) {
        signal = 'BUY';
        description = patterns.filter(p => p.type === 'BUY').map(p => p.name).join(', ') + ' detected.';
    } else if (sellPatterns > buyPatterns) {
        signal = 'SELL';
        description = patterns.filter(p => p.type === 'SELL').map(p => p.name).join(', ') + ' detected.';
    } else if (patterns.length > 0) {
        description = patterns.map(p => p.name).join(', ') + ' detected.';
    }

    return { patterns, signal, description, buyCount: buyPatterns, sellCount: sellPatterns };
}

// ── RSI DIVERGENCE DETECTION ────────────────────────────────────────────
function detectRSIDivergence(prices, period = 14) {
    if (prices.length < period + 10) {
        return { type: 'NONE', description: 'Insufficient data for divergence detection', signal: 'NEUTRAL' };
    }

    // Calculate RSI series
    const rsiSeries = [];
    for (let i = period; i < prices.length; i++) {
        const slice = prices.slice(i - period, i + 1);
        const changes = slice.map((p, j) => j > 0 ? p - slice[j-1] : 0).slice(1);
        const gains  = changes.map(c => c > 0 ? c : 0);
        const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);
        const avgG = gains.reduce((a,b) => a+b,0)  / period;
        const avgL = losses.reduce((a,b) => a+b,0) / period;
        const rs   = avgL === 0 ? 100 : avgG / avgL;
        rsiSeries.push(100 - 100 / (1 + rs));
    }

    if (rsiSeries.length < 6) return { type: 'NONE', description: 'Insufficient RSI data', signal: 'NEUTRAL' };

    // Look at recent vs previous swing highs/lows (last 6 vs prior 6)
    const recentPrices = prices.slice(-6);
    const priorPrices  = prices.slice(-12, -6);
    const recentRSI    = rsiSeries.slice(-6);
    const priorRSI     = rsiSeries.slice(-12, -6);

    const recentHigh  = Math.max(...recentPrices);
    const priorHigh   = Math.max(...priorPrices);
    const recentLow   = Math.min(...recentPrices);
    const priorLow    = Math.min(...priorPrices);
    const recentRSIH  = Math.max(...recentRSI);
    const priorRSIH   = Math.max(...priorRSI);
    const recentRSIL  = Math.min(...recentRSI);
    const priorRSIL   = Math.min(...priorRSI);

    // Bearish divergence: price makes higher high, RSI makes lower high
    if (recentHigh > priorHigh * 1.005 && recentRSIH < priorRSIH - 2) {
        return {
            type: 'BEARISH',
            description: `Bearish RSI divergence: price made a higher high (${recentHigh.toFixed(2)} vs ${priorHigh.toFixed(2)}) but RSI peaked lower (${recentRSIH.toFixed(1)} vs ${priorRSIH.toFixed(1)}). Potential reversal downward.`,
            signal: 'SELL',
            priceDiff: recentHigh - priorHigh,
            rsiDiff: recentRSIH - priorRSIH
        };
    }

    // Bullish divergence: price makes lower low, RSI makes higher low
    if (recentLow < priorLow * 0.995 && recentRSIL > priorRSIL + 2) {
        return {
            type: 'BULLISH',
            description: `Bullish RSI divergence: price made a lower low (${recentLow.toFixed(2)} vs ${priorLow.toFixed(2)}) but RSI held higher (${recentRSIL.toFixed(1)} vs ${priorRSIL.toFixed(1)}). Potential reversal upward.`,
            signal: 'BUY',
            priceDiff: recentLow - priorLow,
            rsiDiff: recentRSIL - priorRSIL
        };
    }

    return { type: 'NONE', description: 'No divergence detected.', signal: 'NEUTRAL' };
}

// ── MACD DIVERGENCE DETECTION ───────────────────────────────────────────
function detectMACDDivergence(prices) {
    const { fastPeriod, slowPeriod, signalPeriod } = config.technicalAnalysis.macd;
    if (prices.length < slowPeriod + signalPeriod + 10) {
        return { type: 'NONE', description: 'Insufficient data', signal: 'NEUTRAL' };
    }

    // Calculate MACD histogram series for last 20 bars
    const histSeries = [];
    const window = Math.min(20, prices.length - slowPeriod - signalPeriod);
    for (let offset = window; offset >= 0; offset--) {
        const slice = prices.slice(0, prices.length - offset);
        if (slice.length < slowPeriod + signalPeriod) continue;
        const fastE = calculateEMA(slice, fastPeriod);
        const slowE = calculateEMA(slice, slowPeriod);
        const macdL = [];
        const off2 = slowPeriod - fastPeriod;
        for (let i = 0; i < slowE.length; i++) macdL.push(fastE[i + off2] - slowE[i]);
        const sigL = calculateEMA(macdL, signalPeriod);
        histSeries.push(macdL[macdL.length - 1] - sigL[sigL.length - 1]);
    }

    if (histSeries.length < 8) return { type: 'NONE', description: 'Insufficient MACD data', signal: 'NEUTRAL' };

    const recentPrices = prices.slice(-Math.floor(histSeries.length / 2));
    const priorPrices  = prices.slice(-histSeries.length, -Math.floor(histSeries.length / 2));
    const recentHist   = histSeries.slice(Math.floor(histSeries.length / 2));
    const priorHist    = histSeries.slice(0, Math.floor(histSeries.length / 2));

    const recentHigh = Math.max(...recentPrices);
    const priorHigh  = Math.max(...priorPrices);
    const recentLow  = Math.min(...recentPrices);
    const priorLow   = Math.min(...priorPrices);
    const recentHistMax = Math.max(...recentHist);
    const priorHistMax  = Math.max(...priorHist);
    const recentHistMin = Math.min(...recentHist);
    const priorHistMin  = Math.min(...priorHist);

    if (recentHigh > priorHigh * 1.005 && recentHistMax < priorHistMax * 0.9) {
        return { type: 'BEARISH', signal: 'SELL', description: 'Bearish MACD divergence: price higher, MACD momentum weakening.' };
    }
    if (recentLow < priorLow * 0.995 && recentHistMin > priorHistMin * 0.9) {
        return { type: 'BULLISH', signal: 'BUY', description: 'Bullish MACD divergence: price lower, MACD momentum strengthening.' };
    }

    return { type: 'NONE', description: 'No MACD divergence detected.', signal: 'NEUTRAL' };
}

// Main analysis function
function analyzeData(historicalData) {
    const prices = historicalData.prices.map(p => p.price);
    const volumes = historicalData.volumes;

    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const bollingerBands = calculateBollingerBands(prices);
    const movingAverages = calculateMovingAverages(prices);
    const volume = analyzeVolume(volumes);

    // NEW: Candlestick patterns + divergence
    const candlestickPatterns = detectCandlestickPatterns(historicalData.prices);
    const rsiDivergence       = detectRSIDivergence(prices);
    const macdDivergence      = detectMACDDivergence(prices);

    const indicators = {
        rsi,
        macd,
        bollingerBands,
        movingAverages,
        volume,
        candlestickPatterns,
        rsiDivergence,
        macdDivergence
    };

    const overall = generateOverallSignal(indicators);

    return {
        indicators,
        overall,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    analyzeData,
    detectCandlestickPatterns,
    detectRSIDivergence,
    detectMACDDivergence,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateMovingAverages,
    analyzeVolume
};

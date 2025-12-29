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

// Main analysis function
function analyzeData(historicalData) {
    const prices = historicalData.prices.map(p => p.price);
    const volumes = historicalData.volumes;

    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const bollingerBands = calculateBollingerBands(prices);
    const movingAverages = calculateMovingAverages(prices);
    const volume = analyzeVolume(volumes);

    const indicators = {
        rsi,
        macd,
        bollingerBands,
        movingAverages,
        volume
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
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateMovingAverages,
    analyzeVolume
};

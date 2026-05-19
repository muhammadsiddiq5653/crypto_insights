/**
 * SignalBus — Global trading signal aggregator
 *
 * All modules emit signals here. The bus normalises, deduplicates, scores,
 * and ranks them so the Command Center can display a unified, live feed.
 *
 * Emit:   SignalBus.emit({ symbol, direction, confidence, source, reasons, price })
 * Listen: SignalBus.subscribe(fn)  →  fn receives the updated ranked feed
 */

const SignalBus = (() => {

  // ── Constants ──────────────────────────────────────────────────────────

  const MAX_SIGNALS = 60;        // rolling buffer
  const DEDUP_WINDOW_MS = 120000; // ignore same symbol+source within 2 min
  const SOURCE_WEIGHT = {
    mtf_consensus:    1.4,  // multi-timeframe consensus is highest conviction
    technical:        1.2,
    news_sentiment:   1.0,
    onchain:          1.1,
    polymarket:       0.9,
    screener:         0.8,
    ml_prediction:    1.0,
    autotrade:        1.0,
    default:          0.8,
  };

  // ── State ──────────────────────────────────────────────────────────────

  let signals   = [];   // raw signal buffer
  let ranked    = [];   // current ranked feed (recomputed on each emit)
  let listeners = [];

  // ── Helpers ────────────────────────────────────────────────────────────

  function dirScore(direction) {
    if (direction === 'LONG'  || direction === 'BUY')  return  1;
    if (direction === 'SHORT' || direction === 'SELL') return -1;
    return 0;
  }

  function normaliseDirection(dir) {
    if (!dir) return 'NEUTRAL';
    const d = dir.toUpperCase();
    if (d === 'BUY'  || d === 'LONG')  return 'LONG';
    if (d === 'SELL' || d === 'SHORT') return 'SHORT';
    return 'NEUTRAL';
  }

  function rank(signalList) {
    // Group by symbol, compute composite score per symbol
    const bySymbol = {};

    signalList.forEach(s => {
      if (!bySymbol[s.symbol]) bySymbol[s.symbol] = { symbol: s.symbol, price: s.price, signals: [] };
      bySymbol[s.symbol].signals.push(s);
    });

    const composites = Object.values(bySymbol).map(group => {
      let weightedScore = 0, totalWeight = 0, maxConf = 0;
      const sources = [], reasons = [];

      group.signals.forEach(s => {
        const w   = SOURCE_WEIGHT[s.source] || SOURCE_WEIGHT.default;
        const dir = dirScore(s.direction);
        const conf = Math.min(100, Math.max(0, s.confidence || 50));
        weightedScore += dir * (conf / 100) * w;
        totalWeight   += w;
        maxConf = Math.max(maxConf, conf);
        if (!sources.includes(s.source)) sources.push(s.source);
        (s.reasons || []).forEach(r => { if (!reasons.includes(r)) reasons.push(r); });
      });

      const normalized = totalWeight > 0 ? weightedScore / totalWeight : 0;
      const direction = normalized > 0.15 ? 'LONG' : normalized < -0.15 ? 'SHORT' : 'NEUTRAL';
      const compositeConf = Math.round(Math.abs(normalized) * 100 * 0.6 + maxConf * 0.4);
      const latestSignal = group.signals[group.signals.length - 1];

      return {
        symbol:     group.symbol,
        price:      group.price || latestSignal?.price,
        direction,
        confidence: Math.min(99, compositeConf),
        score:      +normalized.toFixed(3),
        sources,
        reasons:    reasons.slice(0, 5),
        signalCount: group.signals.length,
        updatedAt:  latestSignal?.timestamp || Date.now(),
      };
    });

    // Sort: LONG/SHORT by confidence desc, NEUTRAL last
    return composites.sort((a, b) => {
      const aN = a.direction === 'NEUTRAL' ? 0 : 1;
      const bN = b.direction === 'NEUTRAL' ? 0 : 1;
      if (aN !== bN) return bN - aN;
      return b.confidence - a.confidence;
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Emit a signal from any module.
   * @param {object} sig
   *   symbol      {string}   e.g. 'BTC'
   *   direction   {string}   'LONG'|'SHORT'|'NEUTRAL'|'BUY'|'SELL'|'HOLD'
   *   confidence  {number}   0-100
   *   source      {string}   key from SOURCE_WEIGHT
   *   reasons     {string[]} up to 5 human-readable reasons
   *   price       {number}   current price (optional)
   */
  function emit(sig) {
    if (!sig || !sig.symbol) return;

    const signal = {
      id:         Date.now() + Math.random(),
      symbol:     sig.symbol.toUpperCase(),
      direction:  normaliseDirection(sig.direction),
      confidence: Math.round(sig.confidence || 50),
      source:     sig.source || 'default',
      reasons:    Array.isArray(sig.reasons) ? sig.reasons.slice(0, 5) : [],
      price:      sig.price || null,
      timestamp:  Date.now(),
    };

    // Dedup: drop if same symbol+source emitted within DEDUP_WINDOW_MS
    const isDup = signals.some(s =>
      s.symbol === signal.symbol &&
      s.source === signal.source &&
      (signal.timestamp - s.timestamp) < DEDUP_WINDOW_MS
    );
    if (isDup) return;

    // Prepend and trim
    signals.unshift(signal);
    if (signals.length > MAX_SIGNALS) signals = signals.slice(0, MAX_SIGNALS);

    // Rerank and notify
    ranked = rank(signals);
    listeners.forEach(fn => { try { fn(ranked, signal); } catch(e) {} });
  }

  function subscribe(fn) {
    listeners.push(fn);
    // Immediately call with current state if any signals exist
    if (ranked.length) fn(ranked, null);
    return () => { listeners = listeners.filter(l => l !== fn); };
  }

  function getRanked() { return ranked; }
  function getSignals() { return signals; }

  /**
   * Seed from MTF cockpit data for a coin.
   * Called by TradingCockpit after it loads coin data.
   */
  function seedFromCockpit(coin, coinData) {
    if (!coinData) return;
    const { ticker, mtfSignals, prediction, polyOdds } = coinData;
    const price = ticker?.price;

    if (mtfSignals?.consensus && mtfSignals.consensus !== 'HOLD') {
      const dir = mtfSignals.consensus === 'BUY' ? 'LONG' : mtfSignals.consensus === 'SELL' ? 'SHORT' : 'NEUTRAL';
      const conf = mtfSignals.h1 && mtfSignals.h4 && mtfSignals.d1
        ? Math.round((mtfSignals.h1.confidence + mtfSignals.h4.confidence + mtfSignals.d1.confidence) / 3)
        : 60;
      const reasons = [];
      ['h1','h4','d1'].forEach(tf => {
        if (mtfSignals[tf]) reasons.push(`${tf.toUpperCase()}: ${mtfSignals[tf].signal} (RSI ${mtfSignals[tf].rsi})`);
      });
      emit({ symbol: coin.symbol, direction: dir, confidence: conf, source: 'mtf_consensus', reasons, price });
    }

    if (prediction?.signal && prediction.signal !== 'HOLD') {
      const dir = prediction.signal === 'BUY' ? 'LONG' : prediction.signal === 'SELL' ? 'SHORT' : 'NEUTRAL';
      const conf = Math.round((prediction.confidence || 0.55) * 100);
      emit({ symbol: coin.symbol, direction: dir, confidence: conf, source: 'ml_prediction',
             reasons: [`RSI ${prediction.rsi}`, `Trend: ${prediction.trend}`, `Target: $${prediction.price_target}`], price });
    }

    if (polyOdds) {
      const dir = polyOdds.signal === 'BULLISH' ? 'LONG' : polyOdds.signal === 'BEARISH' ? 'SHORT' : 'NEUTRAL';
      if (dir !== 'NEUTRAL') {
        emit({ symbol: coin.symbol, direction: dir, confidence: polyOdds.yes || 50,
               source: 'polymarket', reasons: [polyOdds.title, `YES ${polyOdds.yes}% · Vol ${polyOdds.volume}`], price });
      }
    }
  }

  return { emit, subscribe, getRanked, getSignals, seedFromCockpit };

})();

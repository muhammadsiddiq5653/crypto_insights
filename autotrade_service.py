"""
AutoTrade Microservice — Flask API wrapper around the autotrade backtesting engine.
Exposes backtesting, strategy listing, and live signal endpoints for the trader portal.

Endpoints:
  GET  /health                          — service health check
  GET  /strategies                      — list all strategies
  POST /backtest                        — run a backtest { symbol, timeframe, strategy, start, end, cash }
  GET  /results                         — get experiment log (results.jsonl)
  POST /results                         — save a result to the log
  POST /strategy/create                 — create a new strategy file from template
  GET  /strategy/<name>                 — get strategy source code
  DELETE /strategy/<name>              — trash a strategy

Runs on port 5002.
"""

import os
import sys
import json
import math
import importlib.util
import traceback
from datetime import datetime
from pathlib import Path

# ── Add project root to path ──────────────────────────────────────────────────
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)

STRATEGIES_DIR = ROOT / 'autotrade' / 'strategies' / 'generated'
TRASH_DIR      = ROOT / 'autotrade' / 'strategies' / 'trash'
RESULTS_FILE   = ROOT / 'autotrade' / 'results.jsonl'

STRATEGIES_DIR.mkdir(parents=True, exist_ok=True)
TRASH_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_FILE.touch(exist_ok=True)

# ── Metric evaluation (from autotrade risk.py / profit.py) ──────────────────

def evaluate_risk(stats: dict, max_drawdown_limit: float = -20.0) -> dict:
    num_trades   = int(stats.get('Trades', 0) or 0)
    max_dd       = float(stats.get('Max Drawdown [%]', 0) or 0)
    profit_f     = stats.get('Profit Factor', None)

    if num_trades == 0 or profit_f is None or (isinstance(profit_f, float) and math.isnan(profit_f)):
        return {'passed': False, 'invalid': True, 'violations': [f'Strategy produced {num_trades} trades — no signals fired']}

    violations = []
    if max_dd < max_drawdown_limit:
        violations.append(f'Max drawdown {max_dd:.1f}% breached floor {max_drawdown_limit}%')

    return {'passed': len(violations) == 0, 'invalid': False, 'violations': violations,
            'details': {'num_trades': num_trades, 'max_drawdown_pct': max_dd}}

def evaluate_profit(stats: dict, min_sharpe: float = 0.8, min_trades: int = 5) -> dict:
    num_trades = int(stats.get('Trades', 0) or 0)
    sharpe     = float(stats.get('Sharpe Ratio', 0) or 0)
    calmar     = float(stats.get('Calmar Ratio', 0) or 0)
    violations = []
    if num_trades < min_trades:
        violations.append(f'{num_trades} trades below minimum {min_trades}')
    if sharpe < min_sharpe:
        violations.append(f'Sharpe {sharpe:.2f} below target {min_sharpe}')
    return {'passed': len(violations) == 0, 'violations': violations,
            'details': {'sharpe': sharpe, 'calmar': calmar, 'num_trades': num_trades}}

def get_verdict(risk, profit):
    if risk.get('invalid'):   return 'CRASH'
    if not risk['passed']:    return 'DISCARD_RISK'
    if not profit['passed']:  return 'DISCARD_PROFIT'
    return 'ELIGIBLE'

# ── Data loader using CCXT ────────────────────────────────────────────────────

def fetch_ohlcv(symbol: str, timeframe: str, start: str, end: str | None) -> pd.DataFrame:
    import ccxt
    exchange = ccxt.binance({'enableRateLimit': True})

    since = int(pd.Timestamp(start).timestamp() * 1000)
    until = int(pd.Timestamp(end).timestamp() * 1000) if end else None

    all_ohlcv = []
    while True:
        batch = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=500)
        if not batch:
            break
        all_ohlcv.extend(batch)
        last_ts = batch[-1][0]
        if until and last_ts >= until:
            break
        if len(batch) < 500:
            break
        since = last_ts + 1

    df = pd.DataFrame(all_ohlcv, columns=['Date', 'Open', 'High', 'Low', 'Close', 'Volume'])
    df['Date'] = pd.to_datetime(df['Date'], unit='ms', utc=True)
    df.set_index('Date', inplace=True)
    df = df[~df.index.duplicated(keep='first')]

    if until:
        df = df[df.index <= pd.Timestamp(end, tz='UTC')]

    return df

# ── Strategy loader ───────────────────────────────────────────────────────────

def load_strategy_class(strategy_file: str):
    path = STRATEGIES_DIR / strategy_file
    if not path.exists():
        raise FileNotFoundError(f'Strategy not found: {strategy_file}')

    spec = importlib.util.spec_from_file_location('strategy_module', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    from autotrade.base import BaseStrategy
    for name in dir(module):
        obj = getattr(module, name)
        try:
            if isinstance(obj, type) and issubclass(obj, BaseStrategy) and obj is not BaseStrategy:
                return obj
        except TypeError:
            pass
    raise ValueError(f'No BaseStrategy subclass found in {strategy_file}')

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'autotrade', 'port': 5002})

@app.route('/strategies')
def list_strategies():
    files = sorted(STRATEGIES_DIR.glob('*.py'))
    strategies = []
    for f in files:
        if f.name.startswith('_'):
            continue
        info = {'file': f.name, 'name': f.stem, 'keep': False, 'description': ''}
        try:
            cls = load_strategy_class(f.name)
            info['description'] = getattr(cls, 'description', '')
            info['keep']        = getattr(cls, 'keep', False)
        except Exception:
            pass
        strategies.append(info)
    return jsonify({'success': True, 'strategies': strategies})

@app.route('/backtest', methods=['POST'])
def run_backtest():
    data = request.json or {}
    strategy_file  = data.get('strategy', 'ema_crossover_rsi.py')
    symbol         = data.get('symbol', 'BTC/USDT')
    timeframe      = data.get('timeframe', '1d')
    start          = data.get('start', '2024-01-01')
    end            = data.get('end', None)
    cash           = float(data.get('cash', 10000))
    max_leverage   = float(data.get('maxLeverage', 1.0))
    max_drawdown_l = float(data.get('maxDrawdownLimit', -20.0))
    min_sharpe     = float(data.get('minSharpe', 0.8))

    try:
        from backtesting import Backtest

        df = fetch_ohlcv(symbol, timeframe, start, end)
        if len(df) < 50:
            return jsonify({'success': False, 'error': f'Only {len(df)} candles fetched — too few for meaningful backtest. Try a longer period.'}), 400

        strategy_cls = load_strategy_class(strategy_file)
        margin = 1.0 / max_leverage

        bt = Backtest(df, strategy_cls, cash=cash, commission=0.001,
                      exclusive_orders=True, margin=margin)
        stats = bt.run()

        # Convert stats to dict
        public = {k: v for k, v in stats.items() if not k.startswith('_')}
        stats_dict = {}
        for k, v in public.items():
            try:
                if hasattr(v, 'item'):     v = v.item()
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)): v = None
                if isinstance(v, pd.Timedelta): v = str(v)
                if isinstance(v, pd.Timestamp): v = str(v)
                stats_dict[k] = v
            except Exception:
                stats_dict[k] = str(v)

        # Normalise key names (backtesting.py uses [%] suffixes)
        normalised = {
            'Return [%]':           stats_dict.get('Return [%]'),
            'Buy & Hold Return [%]':stats_dict.get('Buy & Hold Return [%]'),
            'Return (Ann.) [%]':    stats_dict.get('Return (Ann.) [%]'),
            'Sharpe Ratio':         stats_dict.get('Sharpe Ratio'),
            'Calmar Ratio':         stats_dict.get('Calmar Ratio'),
            'Sortino Ratio':        stats_dict.get('Sortino Ratio'),
            'Max Drawdown [%]':     stats_dict.get('Max. Drawdown [%]'),
            'Avg Drawdown [%]':     stats_dict.get('Avg. Drawdown [%]'),
            'Profit Factor':        stats_dict.get('Profit Factor'),
            'Win Rate [%]':         stats_dict.get('Win Rate [%]'),
            'Trades':               stats_dict.get('# Trades'),
            'Exposure Time [%]':    stats_dict.get('Exposure Time [%]'),
            'Equity Final [$]':     stats_dict.get('Equity Final [$]'),
            'Equity Peak [$]':      stats_dict.get('Equity Peak [$]'),
            'Best Trade [%]':       stats_dict.get('Best Trade [%]'),
            'Worst Trade [%]':      stats_dict.get('Worst Trade [%]'),
            'Avg Trade [%]':        stats_dict.get('Avg. Trade [%]'),
            'Kelly Criterion':      stats_dict.get('Kelly Criterion'),
            'SQN':                  stats_dict.get('SQN'),
            'Expectancy [%]':       stats_dict.get('Expectancy [%]'),
            'Alpha [%]':            stats_dict.get('Alpha [%]'),
            'Duration':             str(stats_dict.get('Duration', '')),
            'Start':                str(stats_dict.get('Start', '')),
            'End':                  str(stats_dict.get('End', '')),
        }

        risk   = evaluate_risk(normalised, max_drawdown_l)
        profit = evaluate_profit(normalised, min_sharpe)
        verdict = get_verdict(risk, profit)

        # Extract trades list
        trades_raw = stats.get('_trades', pd.DataFrame())
        trades = []
        if not trades_raw.empty:
            for _, row in trades_raw.head(50).iterrows():
                trades.append({
                    'entry': str(row.get('EntryTime', '')),
                    'exit':  str(row.get('ExitTime', '')),
                    'size':  float(row.get('Size', 0)),
                    'entryPrice': float(row.get('EntryPrice', 0)),
                    'exitPrice':  float(row.get('ExitPrice', 0)),
                    'pnl':   float(row.get('PnL', 0)),
                    'returnPct': float(row.get('ReturnPct', 0)) * 100,
                    'tag':   str(row.get('Tag', '')),
                })

        # Equity curve (sampled)
        equity_raw = stats.get('_equity_curve', pd.DataFrame())
        equity = []
        if not equity_raw.empty:
            stride = max(1, len(equity_raw) // 150)
            sampled = equity_raw.iloc[::stride]
            equity = [{'date': str(ts), 'equity': float(eq)}
                      for ts, eq in zip(sampled.index, sampled['Equity'])]

        return jsonify({
            'success': True,
            'strategy': strategy_file,
            'symbol': symbol,
            'timeframe': timeframe,
            'stats': normalised,
            'risk': risk,
            'profit': profit,
            'verdict': verdict,
            'trades': trades,
            'equity': equity,
            'candles': len(df),
        })

    except FileNotFoundError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'trace': traceback.format_exc()}), 500

@app.route('/results', methods=['GET'])
def get_results():
    results = []
    try:
        for line in RESULTS_FILE.read_text().strip().splitlines():
            if line.strip():
                results.append(json.loads(line))
    except Exception:
        pass
    return jsonify({'success': True, 'results': list(reversed(results))})

@app.route('/results', methods=['POST'])
def save_result():
    data = request.json or {}
    data['timestamp'] = datetime.utcnow().isoformat()
    with open(RESULTS_FILE, 'a') as f:
        f.write(json.dumps(data) + '\n')
    return jsonify({'success': True})

@app.route('/strategy/<name>', methods=['GET'])
def get_strategy(name):
    if not name.endswith('.py'):
        name += '.py'
    path = STRATEGIES_DIR / name
    if not path.exists():
        return jsonify({'success': False, 'error': 'Not found'}), 404
    return jsonify({'success': True, 'file': name, 'code': path.read_text()})

@app.route('/strategy/<name>', methods=['DELETE'])
def trash_strategy(name):
    if not name.endswith('.py'):
        name += '.py'
    src = STRATEGIES_DIR / name
    if not src.exists():
        return jsonify({'success': False, 'error': 'Not found'}), 404
    dst = TRASH_DIR / name
    src.rename(dst)
    return jsonify({'success': True, 'trashed': name})

@app.route('/strategy/create', methods=['POST'])
def create_strategy():
    data = request.json or {}
    name        = data.get('name', 'custom_strategy').replace(' ', '_').lower()
    description = data.get('description', 'Custom strategy')
    code        = data.get('code', '')

    if not name.endswith('.py'):
        name += '.py'

    path = STRATEGIES_DIR / name
    if path.exists():
        return jsonify({'success': False, 'error': f'{name} already exists'}), 409

    if not code:
        code = f'''import pandas as pd
import ta.trend
import ta.momentum

from autotrade.base import BaseStrategy


class CustomStrategy(BaseStrategy):
    description = "{description}"
    keep = False

    def init(self):
        close = pd.Series(self.data.Close)
        self.rsi = self.I(
            lambda: ta.momentum.RSIIndicator(close, window=14).rsi().values
        )

    def next(self):
        if self.position:
            if self.rsi[-1] > 70:
                self.position.close()
            return
        if self.rsi[-1] < 30:
            self.buy()
'''

    path.write_text(code)
    return jsonify({'success': True, 'file': name})

if __name__ == '__main__':
    print('🤖 AutoTrade service starting on port 5002...')
    app.run(host='127.0.0.1', port=5002, debug=False)

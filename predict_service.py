"""
TraderPro ML Prediction Microservice
- Ensemble model: Linear Regression + Random Forest + Gradient Boosting
- Predicts price direction and magnitude for next 1h, 24h, 7d
- Returns ML-based BUY/SELL/HOLD signal with confidence score
- Runs on port 5001, called by Node.js server
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.pipeline import Pipeline
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# ── Feature Engineering ────────────────────────────────────────────────────

def compute_features(prices: list, volumes: list = None) -> pd.DataFrame:
    """Convert raw price/volume arrays into ML feature matrix."""
    df = pd.DataFrame({'price': prices})

    if volumes and len(volumes) == len(prices):
        df['volume'] = volumes
    else:
        df['volume'] = 1.0  # neutral if no volume

    n = len(df)

    # Returns
    df['ret_1']  = df['price'].pct_change(1)
    df['ret_3']  = df['price'].pct_change(3)
    df['ret_7']  = df['price'].pct_change(7)
    df['ret_14'] = df['price'].pct_change(14)

    # Moving Averages
    df['sma5']   = df['price'].rolling(5).mean()
    df['sma10']  = df['price'].rolling(10).mean()
    df['sma20']  = df['price'].rolling(20).mean()
    df['sma50']  = df['price'].rolling(min(50, n//2)).mean()

    # EMA
    df['ema12'] = df['price'].ewm(span=12, adjust=False).mean()
    df['ema26'] = df['price'].ewm(span=26, adjust=False).mean()
    df['macd']  = df['ema12'] - df['ema26']
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist']   = df['macd'] - df['macd_signal']

    # RSI
    delta = df['price'].diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    df['rsi'] = 100 - (100 / (1 + rs))

    # Bollinger Bands
    bb_period = min(20, n // 3)
    df['bb_mid']   = df['price'].rolling(bb_period).mean()
    df['bb_std']   = df['price'].rolling(bb_period).std()
    df['bb_upper'] = df['bb_mid'] + 2 * df['bb_std']
    df['bb_lower'] = df['bb_mid'] - 2 * df['bb_std']
    df['bb_pos']   = (df['price'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'] + 1e-10)
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / (df['bb_mid'] + 1e-10)

    # Momentum & Volatility
    df['momentum']  = df['price'] - df['price'].shift(10)
    df['volatility']= df['ret_1'].rolling(10).std()

    # Price relative to MAs
    df['price_vs_sma20'] = (df['price'] - df['sma20']) / (df['sma20'] + 1e-10)
    df['price_vs_sma50'] = (df['price'] - df['sma50']) / (df['sma50'] + 1e-10)

    # Volume momentum
    df['vol_ma5']    = df['volume'].rolling(5).mean()
    df['vol_ratio']  = df['volume'] / (df['vol_ma5'] + 1e-10)

    # Lag features (autoregressive)
    for lag in [1, 2, 3, 5, 7]:
        df[f'lag_{lag}'] = df['ret_1'].shift(lag)

    df.dropna(inplace=True)
    return df


def build_xy(df: pd.DataFrame, horizon: int):
    """Build feature matrix X and target y for a given prediction horizon."""
    feature_cols = [
        'ret_1', 'ret_3', 'ret_7', 'ret_14',
        'macd', 'macd_hist', 'rsi',
        'bb_pos', 'bb_width',
        'momentum', 'volatility',
        'price_vs_sma20', 'price_vs_sma50',
        'vol_ratio',
        'lag_1', 'lag_2', 'lag_3', 'lag_5', 'lag_7'
    ]

    # Only use columns that exist
    feature_cols = [c for c in feature_cols if c in df.columns]

    X = df[feature_cols].values
    # Target: future return over horizon steps
    y = df['price'].pct_change(horizon).shift(-horizon).fillna(0).values

    # Trim to same length
    min_len = min(len(X), len(y))
    return X[:min_len], y[:min_len], feature_cols


def train_ensemble(X_train, y_train):
    """Train three models and return them."""
    models = {
        'ridge': Ridge(alpha=1.0),
        'rf':    RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1),
        'gbr':   GradientBoostingRegressor(n_estimators=100, learning_rate=0.05, max_depth=4, random_state=42)
    }
    for name, m in models.items():
        m.fit(X_train, y_train)
    return models


def ensemble_predict(models, X_last):
    """Average predictions from all models (equal weight)."""
    preds = [m.predict(X_last.reshape(1, -1))[0] for m in models.values()]
    return float(np.mean(preds)), preds


# ── Main Prediction Logic ──────────────────────────────────────────────────

def run_prediction(prices: list, volumes: list = None):
    """
    Full prediction pipeline.
    Returns forecasts for 24h and 7d, plus ML signal.
    """
    if len(prices) < 30:
        return {"error": "Need at least 30 data points for prediction"}

    df = compute_features(prices, volumes)

    if len(df) < 20:
        return {"error": "Insufficient data after feature engineering"}

    results = {}

    for label, horizon in [('24h', 1), ('7d', 7)]:
        X, y, feat_cols = build_xy(df, horizon)

        if len(X) < 15:
            results[label] = {"error": "Insufficient training data"}
            continue

        # Use 80% for training, last point for prediction
        split = max(int(len(X) * 0.8), len(X) - 5)
        X_train, y_train = X[:split], y[:split]
        X_last = X[-1]

        try:
            models = train_ensemble(X_train, y_train)
            pred_return, individual_preds = ensemble_predict(models, X_last)

            current_price = prices[-1]
            predicted_price = current_price * (1 + pred_return)

            # Signal logic
            if pred_return > 0.02:
                signal = 'BUY'
                signal_strength = min(int(abs(pred_return) * 500), 100)
            elif pred_return < -0.02:
                signal = 'SELL'
                signal_strength = min(int(abs(pred_return) * 500), 100)
            else:
                signal = 'HOLD'
                signal_strength = max(0, 50 - int(abs(pred_return) * 1000))

            # Model agreement (higher = more confident)
            signs = [1 if p > 0 else -1 for p in individual_preds]
            agreement = abs(sum(signs)) / len(signs)  # 0..1
            confidence = int((0.4 + 0.6 * agreement) * 100)

            results[label] = {
                'predicted_return_pct': round(pred_return * 100, 2),
                'predicted_price': round(predicted_price, 6),
                'current_price': round(current_price, 6),
                'signal': signal,
                'confidence': confidence,
                'signal_strength': signal_strength,
                'model_votes': {
                    'ridge': round(individual_preds[0] * 100, 2),
                    'random_forest': round(individual_preds[1] * 100, 2),
                    'gradient_boost': round(individual_preds[2] * 100, 2)
                }
            }
        except Exception as e:
            results[label] = {"error": str(e)}

    # Combined overall ML signal (weight 7d more for long-term, 24h for short)
    try:
        r24 = results.get('24h', {})
        r7d = results.get('7d', {})

        if 'signal' in r24 and 'signal' in r7d:
            signals_map = {'BUY': 1, 'HOLD': 0, 'SELL': -1}
            score = (signals_map[r24['signal']] * 0.4 + signals_map[r7d['signal']] * 0.6)

            if score > 0.3:
                ml_signal = 'BUY'
            elif score < -0.3:
                ml_signal = 'SELL'
            else:
                ml_signal = 'HOLD'

            avg_conf = int((r24.get('confidence', 50) + r7d.get('confidence', 50)) / 2)

            results['overall'] = {
                'signal': ml_signal,
                'confidence': avg_conf,
                'score': round(score, 2),
                'summary': generate_summary(ml_signal, avg_conf, r24, r7d)
            }
    except Exception:
        pass

    # Generate price trajectory (simple interpolation for chart)
    try:
        current_price = prices[-1]
        r24_ret = results.get('24h', {}).get('predicted_return_pct', 0) / 100
        r7d_ret = results.get('7d', {}).get('predicted_return_pct', 0) / 100

        trajectory = []
        for i in range(8):  # 0, 1, 2, 3, 4, 5, 6, 7 days
            frac = i / 7
            interpolated_ret = r24_ret * (1 - frac) + r7d_ret * frac
            price = round(current_price * (1 + interpolated_ret * (i / 1)), 6) if i == 0 else \
                    round(current_price * (1 + r7d_ret * (i / 7)), 6)
            trajectory.append({'day': i, 'price': price})

        results['trajectory'] = trajectory
    except Exception:
        pass

    return results


def generate_summary(signal, confidence, r24, r7d):
    direction = "rise" if signal == 'BUY' else ("fall" if signal == 'SELL' else "remain stable")
    ret24 = r24.get('predicted_return_pct', 0)
    ret7d = r7d.get('predicted_return_pct', 0)
    return (f"ML model predicts price will {direction}. "
            f"24h forecast: {ret24:+.1f}%, 7-day forecast: {ret7d:+.1f}%. "
            f"Model confidence: {confidence}%.")


# ── Flask API Routes ───────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "TraderPro ML Prediction Engine"})


@app.route('/predict', methods=['POST'])
def predict():
    """
    POST /predict
    Body: { "prices": [float...], "volumes": [float...] (optional), "symbol": "BTC" }
    Returns: prediction results
    """
    try:
        data = request.get_json()
        if not data or 'prices' not in data:
            return jsonify({"error": "Missing 'prices' array in request body"}), 400

        prices  = [float(p) for p in data['prices']]
        volumes = [float(v) for v in data.get('volumes', [])] if data.get('volumes') else None
        symbol  = data.get('symbol', 'UNKNOWN')

        result = run_prediction(prices, volumes)
        result['symbol'] = symbol
        result['data_points'] = len(prices)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/predict/quick', methods=['POST'])
def predict_quick():
    """Lighter endpoint — just returns the signal + confidence, no trajectory."""
    try:
        data    = request.get_json()
        prices  = [float(p) for p in data['prices']]
        volumes = [float(v) for v in data.get('volumes', [])] if data.get('volumes') else None

        result = run_prediction(prices, volumes)
        overall = result.get('overall', {})

        return jsonify({
            "success": True,
            "data": {
                "signal":     overall.get('signal', 'HOLD'),
                "confidence": overall.get('confidence', 50),
                "summary":    overall.get('summary', ''),
                "24h":        result.get('24h', {}),
                "7d":         result.get('7d', {})
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    print("🤖 TraderPro ML Prediction Engine starting on port 5001...")
    print("📊 Models: Ridge Regression + Random Forest + Gradient Boosting")
    print("🔗 Endpoints: POST /predict, POST /predict/quick, GET /health")
    app.run(host='0.0.0.0', port=5001, debug=False)

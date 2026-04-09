#!/bin/bash
# TraderPro — Start Node.js server + ML Prediction Engine + AutoTrade Engine
# Usage: bash start_with_ml.sh

echo "🚀 Starting TraderPro with ML + AutoTrade Engines..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
  echo "❌ Python3 not found. Install it from https://www.python.org"
  exit 1
fi

# Install Python deps if needed
echo "📦 Checking Python dependencies..."
python3 -c "import flask, sklearn, pandas, numpy, backtesting, ta, ccxt" 2>/dev/null || {
  echo "Installing dependencies (one-time setup, ~60 seconds)..."
  pip3 install flask flask-cors scikit-learn pandas numpy backtesting ta ccxt python-dotenv --quiet --break-system-packages
}
echo "✅ Dependencies ready"
echo ""

# ── Kill existing processes on all three ports ────────────────────────────────

for PORT in 5001 5002 3000; do
  EXISTING=$(lsof -ti tcp:$PORT 2>/dev/null)
  if [ -n "$EXISTING" ]; then
    echo "   Stopping existing process on port $PORT (PID $EXISTING)..."
    kill $EXISTING 2>/dev/null
    sleep 0.5
  fi
done

# ── Start ML Prediction Engine (port 5001) ────────────────────────────────────
echo "🤖 Starting ML Prediction Engine on port 5001..."
python3 predict_service.py &
ML_PID=$!
echo "   ML Engine PID: $ML_PID"

# ── Start AutoTrade Engine (port 5002) ────────────────────────────────────────
echo "⚙️  Starting AutoTrade Engine on port 5002..."
python3 autotrade_service.py &
AT_PID=$!
echo "   AutoTrade Engine PID: $AT_PID"

# Wait for Python services to start
sleep 2

# Verify services
lsof -ti tcp:5001 &>/dev/null && echo "   ✅ ML Engine listening on port 5001" || echo "   ⚠️  ML Engine may not have started"
lsof -ti tcp:5002 &>/dev/null && echo "   ✅ AutoTrade Engine listening on port 5002" || echo "   ⚠️  AutoTrade Engine may not have started"

# ── Start Node.js server (foreground) ─────────────────────────────────────────
echo ""
echo "🌐 Starting TraderPro on http://localhost:3000"
echo "   Press Ctrl+C to stop all servers."
echo ""

trap "echo ''; echo '🛑 Stopping all servers...'; kill $ML_PID $AT_PID 2>/dev/null; exit 0" INT TERM EXIT

npm start

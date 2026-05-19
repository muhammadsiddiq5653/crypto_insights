#!/bin/bash
# TraderPro — Start all three services for local development
#
# For production use PM2 instead:
#   pm2 start ecosystem.config.js --env production
#   pm2 save && pm2 startup
#
# Usage (dev only): bash start_with_ml.sh

set -e
echo "🚀 Starting TraderPro (dev mode — all 3 services)..."
echo ""

mkdir -p logs

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "❌ Python3 not found. Install from https://www.python.org"
  exit 1
fi

# ── Install Python deps if missing ───────────────────────────────────────────
echo "📦 Checking Python dependencies..."
python3 -c "import flask, sklearn, pandas, numpy, gunicorn" 2>/dev/null || {
  echo "   Installing dependencies from requirements.txt (one-time, ~90s)..."
  pip3 install -r requirements.txt --quiet
}
echo "✅ Python dependencies ready"
echo ""

# ── Stop anything already running on these ports ─────────────────────────────
for PORT in 3000 5001 5002; do
  PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "   Stopping existing process on port $PORT..."
    kill $PIDS 2>/dev/null || true
    sleep 0.3
  fi
done

# ── Start ML Prediction Engine via gunicorn (port 5001) ──────────────────────
echo "🤖 Starting ML Prediction Engine on :5001..."
gunicorn --workers 2 --bind 0.0.0.0:5001 --timeout 120 predict_service:app \
  &> ./logs/ml-out.log &
ML_PID=$!

# ── Start AutoTrade Engine via gunicorn (port 5002) ──────────────────────────
echo "⚡ Starting AutoTrade Engine on :5002..."
gunicorn --workers 2 --bind 127.0.0.1:5002 --timeout 180 autotrade_service:app \
  &> ./logs/at-out.log &
AT_PID=$!

# Give gunicorn workers a moment to bind and load models
sleep 3

# ── Verify services started ───────────────────────────────────────────────────
lsof -ti tcp:5001 &>/dev/null \
  && echo "   ✅ ML Engine ready on :5001" \
  || echo "   ⚠️  ML Engine may not have started — check logs/ml-out.log"
lsof -ti tcp:5002 &>/dev/null \
  && echo "   ✅ AutoTrade Engine ready on :5002" \
  || echo "   ⚠️  AutoTrade Engine may not have started — check logs/at-out.log"

echo ""
echo "🌐 Starting TraderPro on http://localhost:3000"
echo "   Logs: logs/ml-out.log · logs/at-out.log"
echo "   Press Ctrl+C to stop all servers."
echo ""

# ── Shutdown hook ─────────────────────────────────────────────────────────────
trap 'echo ""; echo "🛑 Stopping all servers..."; kill $ML_PID $AT_PID 2>/dev/null; exit 0' INT TERM EXIT

npm start

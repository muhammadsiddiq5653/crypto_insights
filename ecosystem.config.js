/**
 * PM2 Ecosystem Configuration — TraderPro
 *
 * Manages three processes:
 *   traderpro       — Node.js main server (port 3000)
 *   traderpro-ml    — Python ML prediction service (port 5001)
 *   traderpro-at    — Python AutoTrade backtest service (port 5002)
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save        ← persist process list across reboots
 *   pm2 startup     ← enable auto-start on system boot
 *   pm2 logs        ← stream all logs
 *   pm2 monit       ← CPU/RAM dashboard
 *
 * Prerequisites for Python services:
 *   pip install flask flask-cors numpy pandas scikit-learn
 *   (see predict_service.py and autotrade_service.py for full requirements)
 */
module.exports = {
  apps: [
    // ── 1. Node.js main server ────────────────────────────────────────
    {
      name: 'traderpro',
      script: 'server.js',
      cwd: __dirname,

      instances: 'max',     // use all CPU cores
      exec_mode: 'cluster', // zero-downtime reloads via `pm2 reload traderpro`

      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 10000,
    },

    // ── 2. ML prediction microservice (Python, port 5001) ─────────────
    // Uses gunicorn for production-grade concurrency.
    // Override binary with GUNICORN_BIN if using a venv:
    //   GUNICORN_BIN=/path/to/venv/bin/gunicorn pm2 start ecosystem.config.js
    {
      name: 'traderpro-ml',
      script: process.env.GUNICORN_BIN || 'gunicorn',
      args: '--workers 2 --bind 0.0.0.0:5001 --timeout 120 predict_service:app',
      cwd: __dirname,
      interpreter: 'none',

      instances: 1,
      exec_mode: 'fork',

      env: { FLASK_ENV: 'production' },
      env_production: { FLASK_ENV: 'production' },

      out_file: './logs/ml-out.log',
      error_file: './logs/ml-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      min_uptime: '30s',
      max_restarts: 5,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 10000,
    },

    // ── 3. AutoTrade backtest microservice (Python, port 5002) ────────
    {
      name: 'traderpro-at',
      script: process.env.GUNICORN_BIN || 'gunicorn',
      args: '--workers 2 --bind 127.0.0.1:5002 --timeout 180 autotrade_service:app',
      cwd: __dirname,
      interpreter: 'none',

      instances: 1,
      exec_mode: 'fork',

      env: { FLASK_ENV: 'production' },
      env_production: { FLASK_ENV: 'production' },

      out_file: './logs/at-out.log',
      error_file: './logs/at-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      min_uptime: '15s',
      max_restarts: 5,
      restart_delay: 3000,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 10000,
    },
  ],
};

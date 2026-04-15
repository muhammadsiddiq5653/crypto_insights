/**
 * PM2 Ecosystem Configuration — TraderPro
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save        ← persist across reboots
 *   pm2 startup     ← auto-start on system boot
 *   pm2 logs        ← view live logs
 *   pm2 monit       ← CPU/RAM dashboard
 */
module.exports = {
  apps: [
    {
      name: 'traderpro',
      script: 'server.js',
      cwd: __dirname,

      // ── Instances & Mode ──────────────────────────────────────────
      instances: 'max',       // use all CPU cores
      exec_mode: 'cluster',   // Node cluster mode for zero-downtime reloads

      // ── Environment ───────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // ── Logging ───────────────────────────────────────────────────
      out_file:    './logs/out.log',
      error_file:  './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // ── Stability ─────────────────────────────────────────────────
      max_restarts: 10,
      min_uptime: '10s',       // don't count restarts faster than 10s as stable
      restart_delay: 2000,     // wait 2s between restarts
      watch: false,            // don't watch files in production

      // ── Memory guard ──────────────────────────────────────────────
      max_memory_restart: '512M',

      // ── Graceful shutdown ─────────────────────────────────────────
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};

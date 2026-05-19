'use strict';

// ─── Auth module ─────────────────────────────────────────────────────────────

const Auth = (() => {
  // ── Helpers ──────────────────────────────────────────────────────────

  function showAlert(message, type = 'error') {
    const box = document.getElementById('alert-box');
    if (!box) return;
    const icon = type === 'error' ? '⚠️' : '✅';
    // Safe: message is always a string from our own server responses
    box.textContent = '';
    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.textContent = `${icon} ${message}`;
    box.appendChild(div);
    box.style.display = 'block';
  }

  function clearAlert() {
    const box = document.getElementById('alert-box');
    if (box) { box.textContent = ''; box.style.display = 'none'; }
  }

  function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
    if (!loading && btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    else if (loading) { btn.dataset.originalText = btn.textContent; if (label) btn.textContent = label; }
  }

  async function apiPost(endpoint, body) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // ── Panel switching (tabs + extra panels) ────────────────────────────

  function showPanel(id) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const p = document.getElementById(id);
    if (p) p.classList.add('active');
    clearAlert();
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showPanel(`panel-${btn.dataset.tab}`);
      });
    });
    document.getElementById('link-forgot')?.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      showPanel('panel-forgot');
    });
    document.getElementById('link-back-login')?.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="login"]')?.classList.add('active');
      showPanel('panel-login');
    });
  }

  // ── Password toggle ───────────────────────────────────────────────────

  function initPasswordToggles() {
    document.querySelectorAll('.toggle-pw').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.textContent = isText ? '👁' : '🙈';
      });
    });
  }

  // ── Password strength hints ───────────────────────────────────────────

  function initPasswordHints() {
    const pwInput = document.getElementById('reg-password');
    if (!pwInput) return;
    pwInput.addEventListener('input', () => {
      const val = pwInput.value;
      document.getElementById('hint-len')  ?.classList.toggle('met', val.length >= 8);
      document.getElementById('hint-upper')?.classList.toggle('met', /[A-Z]/.test(val));
      document.getElementById('hint-num')  ?.classList.toggle('met', /[0-9]/.test(val));
    });
  }

  // ── Login form ────────────────────────────────────────────────────────

  function initLoginForm() {
    const form = document.getElementById('form-login');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-login', true, 'Signing in…');
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        const data = await apiPost('/api/auth/login', { email, password });
        if (data.requires2FA) {
          setLoading('btn-login', false);
          showPanel('panel-totp');
          document.getElementById('totp-code')?.focus();
          return;
        }
        if (data.success) {
          showAlert('Login successful! Redirecting…', 'success');
          setTimeout(() => { window.location.href = '/'; }, 700);
        } else {
          showAlert(data.error || 'Login failed');
          setLoading('btn-login', false);
        }
      } catch {
        showAlert('Connection error. Make sure the server is running.');
        setLoading('btn-login', false);
      }
    });
  }

  // ── Register form ─────────────────────────────────────────────────────

  function initRegisterForm() {
    const form = document.getElementById('form-register');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-register', true, 'Creating account…');
      const username = document.getElementById('reg-username').value.trim();
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      try {
        const data = await apiPost('/api/auth/register', { username, email, password });
        if (data.success) {
          showAlert('Account created! Redirecting…', 'success');
          setTimeout(() => { window.location.href = '/'; }, 700);
        } else {
          showAlert(data.error || 'Registration failed');
          setLoading('btn-register', false);
        }
      } catch {
        showAlert('Connection error. Make sure the server is running.');
        setLoading('btn-register', false);
      }
    });
  }

  // ── Forgot-password form ──────────────────────────────────────────────

  function initForgotForm() {
    const form = document.getElementById('form-forgot');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-forgot', true, 'Sending…');
      const email = document.getElementById('forgot-email').value.trim();
      try {
        const data = await apiPost('/api/auth/forgot-password', { email });
        if (data._devLink) {
          // Dev mode: show the link so developers can test without SMTP
          showAlert(`DEV MODE — Reset link: ${data._devLink}`, 'success');
        } else {
          showAlert('If that email exists, a reset link has been sent.', 'success');
        }
        setLoading('btn-forgot', false);
      } catch {
        showAlert('Connection error.');
        setLoading('btn-forgot', false);
      }
    });
  }

  // ── Reset-password form ───────────────────────────────────────────────

  function initResetForm() {
    const form = document.getElementById('form-reset');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-reset', true, 'Updating password…');
      const params   = new URLSearchParams(window.location.search);
      const token    = params.get('token');
      const password = document.getElementById('reset-password').value;
      try {
        const data = await apiPost('/api/auth/reset-password', { token, password });
        if (data.success) {
          showAlert('Password updated! Redirecting to login…', 'success');
          setTimeout(() => {
            window.history.replaceState({}, '', '/auth.html');
            document.querySelector('[data-tab="login"]')?.classList.add('active');
            showPanel('panel-login');
          }, 1800);
        } else {
          showAlert(data.error || 'Reset failed');
          setLoading('btn-reset', false);
        }
      } catch {
        showAlert('Connection error.');
        setLoading('btn-reset', false);
      }
    });
  }

  // ── 2FA TOTP form ─────────────────────────────────────────────────────

  function initTotpForm() {
    const form = document.getElementById('form-totp');
    if (!form) return;
    // Auto-submit when 6 digits entered
    document.getElementById('totp-code')?.addEventListener('input', e => {
      if (e.target.value.replace(/\D/g, '').length === 6) form.requestSubmit();
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-totp', true, 'Verifying…');
      const token = document.getElementById('totp-code').value.replace(/\D/g, '');
      try {
        const data = await apiPost('/api/auth/2fa/validate', { token });
        if (data.success) {
          showAlert('Verified! Redirecting…', 'success');
          setTimeout(() => { window.location.href = '/'; }, 700);
        } else {
          showAlert(data.error || 'Invalid code');
          document.getElementById('totp-code').value = '';
          setLoading('btn-totp', false);
        }
      } catch {
        showAlert('Connection error.');
        setLoading('btn-totp', false);
      }
    });
  }

  // ── Check URL params on load ──────────────────────────────────────────

  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'reset' && params.get('token')) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      showPanel('panel-reset');
    }
  }

  // ── Session check on auth page ────────────────────────────────────────

  async function checkAlreadyLoggedIn() {
    try {
      const res  = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) window.location.href = '/';
    } catch { /* not logged in */ }
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    checkAlreadyLoggedIn();
    handleUrlParams();
    initTabs();
    initPasswordToggles();
    initPasswordHints();
    initLoginForm();
    initRegisterForm();
    initForgotForm();
    initResetForm();
    initTotpForm();
    setTimeout(() => document.getElementById('login-email')?.focus(), 100);
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Auth.init);
} else {
  Auth.init();
}

// ─── App-level auth utilities (used in index.html / app.js) ─────────────────

window.AuthUtils = {
  // In-memory CSRF token — fetched once per session
  _csrf: null,

  async getCsrf() {
    if (this._csrf) return this._csrf;
    try {
      const res  = await fetch('/api/auth/csrf', { credentials: 'include' });
      const data = await res.json();
      this._csrf = data.token || null;
    } catch { this._csrf = null; }
    return this._csrf;
  },

  // Authenticated fetch that injects the CSRF token header automatically
  async apiFetch(url, options = {}) {
    const csrf = await this.getCsrf();
    const method = (options.method || 'GET').toUpperCase();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (csrf && !['GET','HEAD','OPTIONS'].includes(method)) {
      headers['X-CSRF-Token'] = csrf;
    }
    return fetch(url, { ...options, headers, credentials: 'include' });
  },

  async requireLogin() {
    try {
      const res  = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) return data.user;
    } catch {}
    window.location.href = '/auth.html';
    return null;
  },

  async getUser() {
    try {
      const res  = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      return data.success ? data.user : null;
    } catch { return null; }
  },

  async logout() {
    try {
      await this.apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    this._csrf = null;
    window.location.href = '/auth.html';
  },

  renderUserInfo(user, containerId = 'user-info-header') {
    const el = document.getElementById(containerId);
    if (!el || !user) return;
    // Build DOM safely — no innerHTML with user data
    el.textContent = '';
    const wrap   = document.createElement('div'); wrap.className = 'header-user';
    const avatar = document.createElement('div'); avatar.className = 'user-avatar';
    avatar.textContent = user.username.charAt(0).toUpperCase();
    const details = document.createElement('div'); details.className = 'user-details';
    const name    = document.createElement('div'); name.className = 'user-name'; name.textContent = user.username;
    const role    = document.createElement('div'); role.className = 'user-role';  role.textContent = user.role;
    const logoutBtn = document.createElement('button'); logoutBtn.className = 'btn-logout';
    logoutBtn.title = 'Sign out'; logoutBtn.textContent = '⏻';
    logoutBtn.addEventListener('click', () => AuthUtils.logout());
    details.appendChild(name); details.appendChild(role);
    wrap.appendChild(avatar); wrap.appendChild(details); wrap.appendChild(logoutBtn);
    el.appendChild(wrap);
  },
};

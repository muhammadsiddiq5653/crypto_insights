'use strict';

// ─── Auth module ─────────────────────────────────────────────────────────────

const Auth = (() => {
  // ── Helpers ──────────────────────────────────────────────────────────

  function showAlert(message, type = 'error') {
    const box = document.getElementById('alert-box');
    if (!box) return;
    const icon = type === 'error' ? '⚠️' : '✅';
    box.innerHTML = `<div class="alert alert-${type}">${icon} ${message}</div>`;
    box.style.display = 'block';
  }

  function clearAlert() {
    const box = document.getElementById('alert-box');
    if (box) box.style.display = 'none';
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = btn.textContent;
    } else {
      if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    }
  }

  async function apiPost(endpoint, body) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // ── Tab switching ─────────────────────────────────────────────────────

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById(`panel-${tab}`);
        if (panel) panel.classList.add('active');
        clearAlert();
      });
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
      document.getElementById('hint-len').classList.toggle('met', val.length >= 8);
      document.getElementById('hint-upper').classList.toggle('met', /[A-Z]/.test(val));
      document.getElementById('hint-num').classList.toggle('met', /[0-9]/.test(val));
    });
  }

  // ── Login form ────────────────────────────────────────────────────────

  function initLoginForm() {
    const form = document.getElementById('form-login');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-login', true);

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const data = await apiPost('/api/auth/login', { email, password });
        if (data.success) {
          showAlert('Login successful! Redirecting...', 'success');
          setTimeout(() => { window.location.href = '/'; }, 700);
        } else {
          showAlert(data.error || 'Login failed');
          setLoading('btn-login', false);
        }
      } catch (err) {
        showAlert('Connection error. Make sure the server is running.');
        setLoading('btn-login', false);
      }
    });
  }

  // ── Register form ─────────────────────────────────────────────────────

  function initRegisterForm() {
    const form = document.getElementById('form-register');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();
      setLoading('btn-register', true);

      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

      try {
        const data = await apiPost('/api/auth/register', { username, email, password });
        if (data.success) {
          showAlert('Account created! Redirecting...', 'success');
          setTimeout(() => { window.location.href = '/'; }, 700);
        } else {
          showAlert(data.error || 'Registration failed');
          setLoading('btn-register', false);
        }
      } catch (err) {
        showAlert('Connection error. Make sure the server is running.');
        setLoading('btn-register', false);
      }
    });
  }

  // ── Session check on auth page ────────────────────────────────────────

  async function checkAlreadyLoggedIn() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        // Already logged in — go to app
        window.location.href = '/';
      }
    } catch (e) {
      // Not logged in, stay on auth page
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    checkAlreadyLoggedIn();
    initTabs();
    initPasswordToggles();
    initPasswordHints();
    initLoginForm();
    initRegisterForm();

    // Focus first input
    setTimeout(() => {
      const first = document.getElementById('login-email');
      if (first) first.focus();
    }, 100);
  }

  return { init };
})();

// Init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Auth.init);
} else {
  Auth.init();
}

// ─── App-level auth utilities (used in index.html / app.js) ─────────────────

window.AuthUtils = {
  /**
   * Check session; redirect to auth page if not logged in
   * Returns user object if authenticated, null otherwise
   */
  async requireLogin() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) return data.user;
    } catch (e) {}
    window.location.href = '/auth.html';
    return null;
  },

  /**
   * Get current user without redirect
   */
  async getUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      return data.success ? data.user : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Log out and redirect to auth page
   */
  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    window.location.href = '/auth.html';
  },

  /**
   * Render user info in header
   */
  renderUserInfo(user, containerId = 'user-info-header') {
    const el = document.getElementById(containerId);
    if (!el || !user) return;
    el.innerHTML = `
      <div class="header-user">
        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
        <div class="user-details">
          <div class="user-name">${user.username}</div>
          <div class="user-role">${user.role}</div>
        </div>
        <button class="btn-logout" onclick="AuthUtils.logout()" title="Sign out">⏻</button>
      </div>
    `;
  }
};

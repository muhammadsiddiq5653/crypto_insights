'use strict';

const bcrypt = require('bcryptjs');
const db = require('./db');

const SALT_ROUNDS = 12;

// Password validation rules
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

// Username validation
function validateUsername(username) {
  if (!username || username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (username.length > 30) {
    return 'Username must be 30 characters or fewer';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  return null;
}

// Email validation
function validateEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}

/**
 * Register a new user
 * Returns { success, userId, error }
 */
async function register(username, email, password) {
  // Validate inputs
  const usernameErr = validateUsername(username);
  if (usernameErr) return { success: false, error: usernameErr };

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: emailErr };

  const passwordErr = validatePassword(password);
  if (passwordErr) return { success: false, error: passwordErr };

  // Check if registration is open
  const regOpen = db.getSetting('registration_open');
  if (regOpen === 'false') {
    return { success: false, error: 'Registration is currently disabled' };
  }

  // Check uniqueness
  const existingEmail = db.getUserByEmail(email.toLowerCase());
  if (existingEmail) return { success: false, error: 'Email already registered' };

  const existingUsername = db.getUserByUsername(username.toLowerCase());
  if (existingUsername) return { success: false, error: 'Username already taken' };

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Determine role — first user gets admin
  const allUsers = db.getAllUsers();
  const role = allUsers.length === 0 ? 'admin' : 'user';

  try {
    const userId = db.createUser(
      username.toLowerCase(),
      email.toLowerCase(),
      passwordHash,
      role
    );
    return { success: true, userId, role };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return { success: false, error: 'Username or email already exists' };
    }
    throw err;
  }
}

/**
 * Login a user
 * Returns { success, user, error }
 */
async function login(emailOrUsername, password) {
  if (!emailOrUsername || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // Try email first, then username
  let user = db.getUserByEmail(emailOrUsername.toLowerCase());
  if (!user) {
    user = db.getUserByUsername(emailOrUsername.toLowerCase());
  }

  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Update last login
  db.updateLastLogin(user.id);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    }
  };
}

/**
 * Get user profile by ID (safe — no password_hash)
 */
function getProfile(userId) {
  const user = db.getUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    lastLogin: user.last_login
  };
}

/**
 * Change password
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = db.getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { success: false, error: 'User not found' };

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return { success: false, error: 'Current password is incorrect' };

  const passwordErr = validatePassword(newPassword);
  if (passwordErr) return { success: false, error: passwordErr };

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  db.getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

  return { success: true };
}

module.exports = { register, login, getProfile, changePassword, validatePassword, validateEmail, validateUsername };

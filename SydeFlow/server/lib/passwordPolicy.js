/**
 * Shared password / identity policy for SydeFlow + portfolio admin.
 */

const MIN_LENGTH = 12;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_LENGTH} characters`,
    };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: 'Password must include a lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: 'Password must include an uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: 'Password must include a number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: 'Password must include a special character' };
  }
  return { ok: true };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Generic message — avoid account enumeration */
const INVALID_CREDENTIALS = 'Invalid email or password';
const ACCOUNT_LOCKED = 'Too many failed attempts. Try again later.';
const ACCOUNT_INACTIVE = 'Account is inactive. Contact an administrator.';

module.exports = {
  MIN_LENGTH,
  validatePassword,
  normalizeEmail,
  isValidEmail,
  INVALID_CREDENTIALS,
  ACCOUNT_LOCKED,
  ACCOUNT_INACTIVE,
};

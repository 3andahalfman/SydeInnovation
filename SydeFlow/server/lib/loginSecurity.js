const { supabase } = require('../supabase');

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

async function recordAttempt({ email, ip, success }) {
  try {
    await supabase.from('login_attempts').insert({
      email,
      ip: ip || null,
      success: !!success,
    });
  } catch (_) {
    /* non-fatal */
  }
}

async function clearFailures(userId) {
  await supabase
    .from('users')
    .update({
      failed_login_count: 0,
      locked_until: null,
      last_login: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function registerFailure(user) {
  if (!user?.id) return { locked: false, lockedUntil: null };

  const count = (user.failed_login_count || 0) + 1;
  const locked = count >= MAX_FAILURES;
  const lockedUntil = locked
    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
    : null;

  await supabase
    .from('users')
    .update({
      failed_login_count: locked ? 0 : count,
      locked_until: lockedUntil,
    })
    .eq('id', user.id);

  return { locked, lockedUntil };
}

function isLocked(user) {
  if (!user?.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

module.exports = {
  MAX_FAILURES,
  LOCK_MINUTES,
  recordAttempt,
  clearFailures,
  registerFailure,
  isLocked,
  clientIp,
};

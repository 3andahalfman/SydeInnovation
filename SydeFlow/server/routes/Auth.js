const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { Users } = require('./Users');
const { authenticate, resolveProfile } = require('../middleware/auth');
const {
  validatePassword,
  normalizeEmail,
  isValidEmail,
  INVALID_CREDENTIALS,
  ACCOUNT_LOCKED,
  ACCOUNT_INACTIVE,
} = require('../lib/passwordPolicy');
const {
  recordAttempt,
  clearFailures,
  registerFailure,
  isLocked,
  clientIp,
} = require('../lib/loginSecurity');

const SIGNUP_ENABLED = process.env.ALLOW_PUBLIC_SIGNUP === 'true';

function publicUser(profile) {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName || profile.full_name,
    role: profile.role,
  };
}

/**
 * POST /api/auth/signup
 * Disabled by default — set ALLOW_PUBLIC_SIGNUP=true to enable.
 */
router.post('/signup', async (req, res) => {
  if (!SIGNUP_ENABLED) {
    return res.status(403).json({
      success: false,
      error: 'Public signup is disabled. Contact an administrator.',
    });
  }

  try {
    const email = normalizeEmail(req.body.email);
    const { password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required',
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const policy = validatePassword(password);
    if (!policy.ok) {
      return res.status(400).json({ success: false, error: policy.error });
    }

    const { data: existing } = await Users.getByEmail(email);
    if (existing) {
      // Avoid confirming whether email exists
      return res.status(400).json({ success: false, error: 'Unable to create account' });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: 'user' },
    });
    if (authError || !authData?.user) {
      return res.status(400).json({ success: false, error: 'Unable to create account' });
    }

    await Users.upsertProfile({
      id: authData.user.id,
      email,
      fullName,
      role: 'user',
    });

    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !sessionData?.session) {
      return res.status(201).json({
        success: true,
        message: 'Account created. Please sign in.',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: { id: authData.user.id, email, fullName, role: 'user' },
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      expiresAt: sessionData.session.expires_at,
    });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

/**
 * POST /api/auth/login
 * Unified Supabase Auth login used by SydeFlow and portfolio /admin.
 */
router.post('/login', async (req, res) => {
  const ip = clientIp(req);
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { data: profile } = await Users.getByEmail(email);
    if (profile && isLocked(profile)) {
      await recordAttempt({ email, ip, success: false });
      return res.status(429).json({ success: false, error: ACCOUNT_LOCKED });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData?.session || !authData?.user) {
      if (profile) {
        const fail = await registerFailure(profile);
        await recordAttempt({ email, ip, success: false });
        if (fail.locked) {
          return res.status(429).json({ success: false, error: ACCOUNT_LOCKED });
        }
      } else {
        await recordAttempt({ email, ip, success: false });
      }
      // Constant-ish delay to slow brute force / enumeration
      await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 200)));
      return res.status(401).json({ success: false, error: INVALID_CREDENTIALS });
    }

    let resolved = await resolveProfile(authData.user);
    if (!resolved) {
      // First login: create profile as non-admin by default
      await Users.upsertProfile({
        id: authData.user.id,
        email,
        fullName: authData.user.user_metadata?.full_name || email.split('@')[0],
        role: authData.user.app_metadata?.role || 'user',
      });
      resolved = await resolveProfile(authData.user);
    }

    if (!resolved || resolved.is_active === false) {
      await recordAttempt({ email, ip, success: false });
      return res.status(403).json({ success: false, error: ACCOUNT_INACTIVE });
    }

    if (profile?.id) {
      await clearFailures(profile.id);
    } else if (resolved.id) {
      await clearFailures(resolved.id);
    }
    await recordAttempt({ email, ip, success: true });

    res.json({
      success: true,
      message: 'Login successful',
      user: publicUser(resolved),
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresAt: authData.session.expires_at,
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load user' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    if (req.authToken) {
      await supabase.auth.admin.signOut(req.authToken).catch(() => {});
    }
  } catch (_) {
    /* ignore */
  }
  res.json({ success: true, message: 'Logout successful' });
});

/**
 * POST /api/auth/verify-token
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const { data: authData, error } = await supabase.auth.getUser(token);
    if (error || !authData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const profile = await resolveProfile(authData.user);
    if (!profile || profile.is_active === false) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    res.json({
      success: true,
      user: publicUser(profile),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Authenticated password change with policy enforcement.
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }
    const policy = validatePassword(newPassword);
    if (!policy.ok) {
      return res.status(400).json({ success: false, error: policy.error });
    }

    const email = req.user.email;
    const { error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (checkError) {
      return res.status(401).json({ success: false, error: INVALID_CREDENTIALS });
    }

    const authUserId = req.user.authUserId || req.user.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    });
    if (updateError) {
      return res.status(400).json({ success: false, error: 'Unable to update password' });
    }

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ success: false, error: 'Unable to update password' });
  }
});

module.exports = router;

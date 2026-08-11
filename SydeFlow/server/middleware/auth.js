const jwt = require('jsonwebtoken');
const { supabase } = require('../supabase');
const { Users } = require('../routes/Users');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set in .env. Legacy JWT auth will not work until it is set.');
}

async function resolveProfile(authUser) {
  if (!authUser?.email) return null;

  let { data: profile } = await Users.getByAuthUserId(authUser.id);
  if (!profile) {
    ({ data: profile } = await Users.getByEmail(authUser.email.toLowerCase()));
  }

  const metaRole = authUser.app_metadata?.role || authUser.user_metadata?.role;
  const role = profile?.role || metaRole || 'user';

  return {
    id: profile?.id || authUser.id,
    email: authUser.email.toLowerCase(),
    role,
    fullName:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.email.split('@')[0],
    is_active: profile ? profile.is_active !== false : true,
    authUserId: authUser.id,
  };
}

/**
 * Middleware to verify Bearer token (Supabase Auth JWT or legacy app JWT)
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    // Prefer Supabase Auth verification (unified login)
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (!authError && authData?.user) {
      const profile = await resolveProfile(authData.user);
      if (!profile || profile.is_active === false) {
        return res.status(403).json({ success: false, error: 'Account is inactive' });
      }
      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.fullName,
        authUserId: profile.authUserId,
      };
      req.authToken = token;
      return next();
    }

    // Legacy HS256 JWT fallback (transition)
    if (!JWT_SECRET) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.authToken = token;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  return next();
};

/** Short-lived app token (legacy clients). Prefer Supabase access tokens. */
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

const verifyToken = (token) => {
  try {
    if (!token) return null;
    // Sync verify for legacy only — async Supabase path is in authenticate/verify endpoint
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/** Resolve Bearer token to app user (Supabase Auth or legacy JWT). */
async function resolveBearerUser(token) {
  if (!token) return null;
  try {
    const { data: authData, error } = await supabase.auth.getUser(token);
    if (!error && authData?.user) {
      const profile = await resolveProfile(authData.user);
      if (!profile || profile.is_active === false) return null;
      return {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.fullName,
        authUserId: profile.authUserId,
      };
    }
  } catch (_) {
    /* fall through */
  }
  const decoded = verifyToken(token);
  return decoded || null;
}

module.exports = {
  authenticate,
  requireAdmin,
  generateToken,
  verifyToken,
  resolveProfile,
  resolveBearerUser,
  JWT_SECRET,
};

const _path = require('path');
const _fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const config = require('./config');

// Check for credentials - warn but don't exit so admin console can be used to configure
if (!config.hasCredentials()) {
    console.warn('⚠️  APS credentials not configured.');
    console.warn('   Use the Admin Console at /admin to configure your APS credentials.');
    console.warn('   Or create a .env file with APS_CLIENT_ID and APS_CLIENT_SECRET.');
}

let app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Managed per-route for embed support
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS - restrict to known origins only
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'];

app.use(cors({
    origin: function(origin, callback) {
        // Allow same-origin requests (no origin header)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('CORS policy: origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files from public folder (for legacy frontend)
app.use(express.static(_path.join(__dirname, './public')));

// Also serve dist folder (production React build - landing page)
// Updated path: sydeflow/server -> ../../dist
app.use(express.static(_path.join(__dirname, '../../dist')));

// Serve admin console static files (built from Next.js)
// Admin console build is in server/admin-console (copied via npm run export)
const adminConsolePath = _path.join(__dirname, 'admin-console');
if (_fs.existsSync(adminConsolePath)) {
    // Disable caching for development to ensure fresh JS is served
    app.use('/admin', express.static(adminConsolePath, {
        etag: false,
        maxAge: 0,
        setHeaders: (res, filePath, stat) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }));

    // Allow iframe embedding for /admin/configure paths with embed=true
    // Restrict to configured embed domains (default: same-origin only)
    const embedDomains = process.env.EMBED_DOMAINS
        ? process.env.EMBED_DOMAINS.split(',')
        : [];
    app.use('/admin/configure', (req, res, next) => {
        if (req.query.embed === 'true' || (req.headers.referer && req.headers.referer.includes('embed=true'))) {
            if (embedDomains.length > 0) {
                res.removeHeader('X-Frame-Options');
                res.set('Content-Security-Policy', `frame-ancestors 'self' ${embedDomains.join(' ')}`);
            }
        }
        next();
    });
}

// Cookie session
const cookieSecret = process.env.COOKIE_SESSION_SECRET;
if (!cookieSecret) {
    console.warn('⚠️  COOKIE_SESSION_SECRET not set in .env. Set it for production security.');
}
app.use(cookieSession({
    name: 'sydeflow_session',
    keys: [cookieSecret || require('crypto').randomBytes(32).toString('hex')],
    maxAge: 60 * 60 * 1000, // 1 hour
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
}));

// JSON parsing
app.use(express.json({ limit: '50mb' }));

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Too many requests. Please wait a minute.' } });
const quoteLimiter  = rateLimit({ windowMs: 60_000, max: 5,   message: { success: false, error: 'Too many quote requests. Please wait a minute.' } });
const workflowLimiter = rateLimit({ windowMs: 60_000, max: 6,  message: { success: false, error: 'Too many automation requests. Please wait a minute.' } });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, message: { success: false, error: 'Too many login attempts. Please wait 15 minutes.' } });
const settingsLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { success: false, error: 'Too many settings requests. Please wait a minute.' } });
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/settings', settingsLimiter);
app.use('/api/quotes', quoteLimiter);
// Apply workflow rate limit only to mutation endpoints, not polling
app.use('/api/workflow/regenerate', workflowLimiter);
app.use('/api/workflow/run', workflowLimiter);
app.use('/api/workflow/extract', workflowLimiter);

// API status endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'SydeFlow API',
        version: '1.0.0',
        status: 'active',
        endpoints: {
            designAutomation: '/api/aps/*',
            fileSync: '/api/filesync/*',
            activity: '/api/activity/*',
            oss: '/api/oss/*'
        }
    });
});

// API routes
app.use('/api/auth', require('./routes/Auth'));  // Authentication routes - must be first, no auth needed
app.use('/api/settings', require('./routes/Settings'));  // Settings first - no auth needed
app.use('/api/categories', require('./routes/Categories'));  // Category management
app.use('/api/products', require('./routes/Products'));  // Products management
app.use('/api/configurations', require('./routes/Configurations'));  // Configuration management
app.use('/api/quotes', require('./routes/Quotes'));  // Quote requests from customer configurator
app.use('/api/setup', require('./routes/SetupAutomation'));  // Design Automation setup
app.use('/api/workflow', require('./routes/ParameterWorkflow'));  // Parameter workflow
app.use('/api', require('./routes/DesignAutomation'));
app.use('/api/filesync', require('./routes/FileSync'));
app.use('/api/activity', require('./routes/ActivityLog'));
app.use('/api/schemas', require('./routes/ProductsConfig'));
app.use('/api/webhooks', require('./routes/Webhooks'));  // Webhook subscriptions

// 404 handler for API routes (handled after other routes)
// Note: This only catches routes that weren't matched by specific handlers

// Global error handler - prevents crashes from unhandled errors
app.use((err, req, res, next) => {
    console.error('Express error handler caught:', err.message);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error'
    });
});

// Serve login page (standalone HTML, not Next.js)
app.get('/login', (req, res) => {
    res.sendFile(_path.join(__dirname, './public/login.html'));
});

// Redirect root to login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Redirect /configure to /admin/configure (customer-facing configurator)
app.get('/configure', (req, res) => {
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(`/admin/configure${query}`);
});

app.set('port', process.env.APS_PORT || process.env.PORT || 8080);

module.exports = app;

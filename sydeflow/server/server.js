const _path = require('path');
const _fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const config = require('./config');

// Check for credentials - warn but don't exit so admin console can be used to configure
if (!config.hasCredentials()) {
    console.warn('⚠️  APS credentials not configured.');
    console.warn('   Use the Admin Console at /admin to configure your APS credentials.');
    console.warn('   Or create a .env file with APS_CLIENT_ID and APS_CLIENT_SECRET.');
}

let app = express();

// Enable CORS for Vite dev server and Next.js admin console (dev mode)
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
    credentials: true
}));

// Serve static files from public folder (for legacy frontend)
app.use(express.static(_path.join(__dirname, './public')));

// Also serve dist folder (production React build - landing page)
// Updated path: sydeflow/server -> ../../dist
app.use(express.static(_path.join(__dirname, '../../dist')));

// Serve admin console static files (built from Next.js)
// Admin console is now at sydeflow/admin-console but server copies it to ./admin-console
const adminConsolePath = _path.join(__dirname, '../admin-console/out');
if (_fs.existsSync(adminConsolePath)) {
    // Disable caching for development to ensure fresh JS is served
    app.use('/admin', express.static(adminConsolePath, {
        etag: false,
        maxAge: 0,
        setHeaders: (res, path) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }));
}

// Cookie session
app.use(cookieSession({
    name: 'sydeflow_session',
    keys: ['sydeflow_secure_key'],
    maxAge: 60 * 60 * 1000 // 1 hour
}));

// JSON parsing
app.use(express.json({ limit: '50mb' }));

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
app.use('/api/settings', require('./routes/Settings'));  // Settings first - no auth needed
app.use('/api', require('./routes/DesignAutomation'));
app.use('/api/filesync', require('./routes/FileSync'));
app.use('/api/activity', require('./routes/ActivityLog'));
app.use('/api/schemas', require('./routes/ProductsConfig'));

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// Global error handler - prevents crashes from unhandled errors
app.use((err, req, res, next) => {
    console.error('Express error handler caught:', err.message);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message,
        path: req.path 
    });
});

// Serve React app for all other routes (SPA fallback) - exclude API routes
app.get('*', (req, res, next) => {
    // Skip if this is an API request
    if (req.path.startsWith('/api')) {
        return next();
    }
    // Updated path: sydeflow/server -> ../../dist
    const indexPath = _path.join(__dirname, '../../dist/index.html');
    if (_fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.sendFile(_path.join(__dirname, './public/index.html'));
    }
});

app.set('port', process.env.APS_PORT || process.env.PORT || 8080);

module.exports = app;

const _path = require('path');
const _fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const config = require('./config');

if (!config.credentials.client_id || !config.credentials.client_secret) {
    console.error('Missing APS_CLIENT_ID or APS_CLIENT_SECRET env variables.');
    console.error('Please create a .env file with your APS credentials.');
    process.exit(1);
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
app.use(express.static(_path.join(__dirname, '../dist')));

// Serve admin console static files (built from Next.js)
const adminConsolePath = _path.join(__dirname, './admin-console');
if (_fs.existsSync(adminConsolePath)) {
    app.use('/admin', express.static(adminConsolePath));
}

// Cookie session
app.use(cookieSession({
    name: 'sydeflow_session',
    keys: ['sydeflow_secure_key'],
    maxAge: 60 * 60 * 1000 // 1 hour
}));

// JSON parsing
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api', require('./routes/DesignAutomation'));
app.use('/api/filesync', require('./routes/FileSync'));
app.use('/api/activity', require('./routes/ActivityLog'));

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// Serve React app for all other routes (SPA fallback) - exclude API routes
app.get('*', (req, res, next) => {
    // Skip if this is an API request
    if (req.path.startsWith('/api')) {
        return next();
    }
    const indexPath = _path.join(__dirname, '../dist/index.html');
    if (_fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.sendFile(_path.join(__dirname, './public/index.html'));
    }
});

app.set('port', process.env.APS_PORT || process.env.PORT || 8080);

module.exports = app;

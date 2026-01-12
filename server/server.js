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

// Enable CORS for Vite dev server
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));

// Serve static files from public folder (for legacy frontend)
app.use(express.static(_path.join(__dirname, './public')));

// Also serve dist folder (production React build)
app.use(express.static(_path.join(__dirname, '../dist')));

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

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
    const indexPath = _path.join(__dirname, '../dist/index.html');
    if (_fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.sendFile(_path.join(__dirname, './public/index.html'));
    }
});

app.set('port', process.env.APS_PORT || process.env.PORT || 8080);

module.exports = app;

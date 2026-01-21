const express = require('express');
const router = express.Router();
const _fs = require('fs');
const _path = require('path');
const { AuthClientTwoLegged } = require('forge-apis');
const oauth = require('./common/oauth');
const config = require('../config');

// Settings file path
const SETTINGS_FILE = _path.join(__dirname, '..', 'data', 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
    apsClientId: process.env.APS_CLIENT_ID || '',
    apsClientSecret: process.env.APS_CLIENT_SECRET || '',
    callbackUrl: process.env.APS_CALLBACK_URL || 'http://localhost:8080/api/aps/callback/oauth',
    webhookUrl: '',
    bucketKey: '',
    activityId: '',
    appBundleId: ''
};

// Ensure data directory exists
const dataDir = _path.join(__dirname, '..', 'data');
if (!_fs.existsSync(dataDir)) {
    _fs.mkdirSync(dataDir, { recursive: true });
}

// Load settings from file
const loadSettings = () => {
    try {
        if (_fs.existsSync(SETTINGS_FILE)) {
            const data = _fs.readFileSync(SETTINGS_FILE, 'utf8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
    return DEFAULT_SETTINGS;
};

// Save settings to file
const saveSettings = (settings) => {
    try {
        _fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving settings:', err);
        return false;
    }
};

// GET /api/settings - Get current settings (masked secrets)
router.get('/', (req, res) => {
    const settings = loadSettings();
    
    // Mask the client secret
    const maskedSettings = {
        ...settings,
        apsClientSecret: settings.apsClientSecret ? '••••••••••••••••' : '',
        hasClientId: !!settings.apsClientId,
        hasClientSecret: !!settings.apsClientSecret,
        // Include environment variable status
        envStatus: {
            hasEnvClientId: !!process.env.APS_CLIENT_ID,
            hasEnvClientSecret: !!process.env.APS_CLIENT_SECRET,
            hasEnvCallbackUrl: !!process.env.APS_CALLBACK_URL
        }
    };
    
    res.json(maskedSettings);
});

// GET /api/settings/reveal-secret - Get the actual secret (for reveal button)
router.get('/reveal-secret', (req, res) => {
    const settings = loadSettings();
    
    if (!settings.apsClientSecret) {
        return res.status(404).json({ success: false, message: 'No secret stored' });
    }
    
    res.json({ 
        success: true, 
        secret: settings.apsClientSecret 
    });
});

// POST /api/settings - Save settings
router.post('/', (req, res) => {
    const currentSettings = loadSettings();
    const updates = req.body;
    
    // Don't overwrite secret if masked value is sent
    if (updates.apsClientSecret === '••••••••••••••••') {
        delete updates.apsClientSecret;
    }
    
    // Check if credentials are changing
    const credentialsChanging = 
        (updates.apsClientId && updates.apsClientId !== currentSettings.apsClientId) ||
        (updates.apsClientSecret && updates.apsClientSecret !== currentSettings.apsClientSecret);
    
    const newSettings = { ...currentSettings, ...updates };
    
    if (saveSettings(newSettings)) {
        // Clear OAuth cache if credentials changed
        if (credentialsChanging) {
            oauth.clearCache();
            console.log('Credentials changed - OAuth cache cleared');
        }
        
        res.json({ 
            success: true, 
            message: 'Settings saved successfully',
            credentialsChanged: credentialsChanging,
            settings: {
                ...newSettings,
                apsClientSecret: newSettings.apsClientSecret ? '••••••••••••••••' : ''
            }
        });
    } else {
        res.status(500).json({ success: false, message: 'Failed to save settings' });
    }
});

// POST /api/settings/test-connection - Test APS connection with provided or saved credentials
router.post('/test-connection', async (req, res) => {
    try {
        const { clientId, clientSecret } = req.body;
        const settings = loadSettings();
        
        // Use provided credentials or fall back to saved/env
        // Don't use masked secret - fall back to saved one
        const testClientId = clientId || settings.apsClientId || process.env.APS_CLIENT_ID;
        const testClientSecret = (clientSecret && clientSecret !== '••••••••••••••••') 
            ? clientSecret 
            : (settings.apsClientSecret || process.env.APS_CLIENT_SECRET);
        
        if (!testClientId || !testClientSecret) {
            return res.status(400).json({
                success: false,
                error: 'Missing credentials',
                message: 'Client ID and Client Secret are required'
            });
        }
        
        // Test authentication
        const oauth = new AuthClientTwoLegged(
            testClientId,
            testClientSecret,
            ['data:read'],
            false
        );
        
        const credentials = await oauth.authenticate();
        
        res.json({
            success: true,
            message: 'Connection successful',
            tokenInfo: {
                expiresIn: credentials.expires_in,
                tokenType: credentials.token_type,
                scope: 'data:read'
            }
        });
    } catch (err) {
        console.error('Connection test failed:', err);
        
        let errorMessage = 'Authentication failed';
        if (err.message?.includes('401')) {
            errorMessage = 'Invalid credentials - check your Client ID and Secret';
        } else if (err.message?.includes('network')) {
            errorMessage = 'Network error - check your internet connection';
        }
        
        res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: errorMessage,
            details: err.message
        });
    }
});

// GET /api/settings/env-status - Check environment variable status
router.get('/env-status', (req, res) => {
    res.json({
        hasClientId: !!process.env.APS_CLIENT_ID,
        hasClientSecret: !!process.env.APS_CLIENT_SECRET,
        hasCallbackUrl: !!process.env.APS_CALLBACK_URL,
        clientIdPreview: process.env.APS_CLIENT_ID ? 
            process.env.APS_CLIENT_ID.substring(0, 8) + '...' : null
    });
});

// GET /api/settings/aps-status - Get real-time APS connection status
router.get('/aps-status', async (req, res) => {
    try {
        // Check if credentials are configured
        if (!config.hasCredentials()) {
            return res.json({
                connected: false,
                status: 'not_configured',
                message: 'APS credentials not configured',
                hasCredentials: false
            });
        }

        // Try to get/create OAuth client
        const client = await oauth.getClient();
        const connectionStatus = oauth.getConnectionStatus();
        
        if (client) {
            res.json({
                connected: true,
                status: 'connected',
                message: 'Connected to Autodesk Platform Services',
                hasCredentials: true,
                lastCheck: connectionStatus.lastCheck
            });
        } else {
            res.json({
                connected: false,
                status: 'authentication_failed',
                message: connectionStatus.error || 'Failed to authenticate with APS',
                hasCredentials: true,
                lastCheck: connectionStatus.lastCheck
            });
        }
    } catch (err) {
        res.json({
            connected: false,
            status: 'error',
            message: err.message,
            hasCredentials: config.hasCredentials()
        });
    }
});

// POST /api/settings/clear-cache - Clear OAuth cache (force reconnection)
router.post('/clear-cache', (req, res) => {
    oauth.clearCache();
    res.json({
        success: true,
        message: 'OAuth cache cleared - next API call will re-authenticate'
    });
});

module.exports = router;

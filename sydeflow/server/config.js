// Autodesk Platform Services (APS) configuration
const _fs = require('fs');
const _path = require('path');

// Settings file path
const SETTINGS_FILE = _path.join(__dirname, 'data', 'settings.json');

// Load settings from file (called on each access to get fresh values)
function loadSettings() {
    try {
        if (_fs.existsSync(SETTINGS_FILE)) {
            const data = _fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        // Silently fail, use env vars
    }
    return {};
}

// Dynamic config that checks settings file then falls back to env vars
const config = {
    // Credentials getter - checks settings first, then env vars
    get credentials() {
        const settings = loadSettings();
        return {
            client_id: settings.apsClientId || process.env.APS_CLIENT_ID,
            client_secret: settings.apsClientSecret || process.env.APS_CLIENT_SECRET,
            callback_url: settings.callbackUrl || process.env.APS_CALLBACK_URL || 'http://localhost:8080/api/aps/callback/oauth',
            webhook_url: settings.webhookUrl || process.env.APS_WEBHOOK_URL
        };
    },
    scopes: {
        // Required scopes for the server-side application
        internal: ['bucket:create', 'bucket:read', 'bucket:delete', 'data:read', 'data:create', 'data:write', 'code:all'],
        // Required scope for the client-side viewer
        public: ['viewables:read']
    },
    client: {
        circuitBreaker: {
            threshold: 11,
            interval: 1200
        },
        retry: {
            maxNumberOfRetries: 7,
            backoffDelay: 4000,
            backoffPolicy: 'exponentialBackoffWithJitter'
        },
        requestTimeout: 13000
    },
    // Helper to check if credentials are configured
    hasCredentials() {
        const creds = this.credentials;
        return !!(creds.client_id && creds.client_secret);
    }
};

module.exports = config;

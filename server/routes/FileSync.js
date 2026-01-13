/**
 * FileSync.js - Autodesk Cloud to OSS Sync Service
 * 
 * Handles webhooks from Autodesk Cloud (ACC/Fusion Team) and syncs files to OSS
 * 
 * Flow:
 * 1. Desktop Connector syncs local files to Autodesk Cloud
 * 2. Autodesk sends webhook when files change
 * 3. This service downloads changed files and uploads to OSS
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { 
    getClient, 
    getAuthorizationUrl, 
    exchangeCodeForToken, 
    setUserToken, 
    getUserToken,
    isUserAuthenticated 
} = require('./common/oauth');
const config = require('../config');
const ForgeAPI = require('forge-apis');
const _fs = require('fs');
const _path = require('path');

// In-memory storage for sync configurations (can be moved to database later)
let syncConfigurations = [];
let syncHistory = [];
let registeredWebhooks = [];
let syncedFiles = {}; // Track synced files: { "bucketKey/objectKey": { syncedAt, sourceFolder, sourceFile, configId } }

// Load sync config from file if exists
const SYNC_CONFIG_PATH = _path.join(__dirname, '../data/sync-config.json');
try {
    if (_fs.existsSync(SYNC_CONFIG_PATH)) {
        const data = JSON.parse(_fs.readFileSync(SYNC_CONFIG_PATH, 'utf8'));
        syncConfigurations = data.configurations || [];
        registeredWebhooks = data.webhooks || [];
        syncedFiles = data.syncedFiles || {};
    }
} catch (err) {
    console.log('No existing sync config found, starting fresh');
}

// Save sync config to file
const saveSyncConfig = () => {
    try {
        _fs.writeFileSync(SYNC_CONFIG_PATH, JSON.stringify({
            configurations: syncConfigurations,
            webhooks: registeredWebhooks,
            syncedFiles: syncedFiles
        }, null, 2));
    } catch (err) {
        console.error('Failed to save sync config:', err);
    }
};

// Socket.io reference - use global.socketIO set by socket.io.js
const getIO = () => global.socketIO;

// Emit sync event to connected clients
const emitSyncEvent = (event, data) => {
    const io = getIO();
    if (io) {
        console.log(`📡 Emitting ${event}:`, data.message || data.status);
        io.emit(event, data);
    } else {
        console.log(`⚠️ Socket.io not initialized, cannot emit ${event}`);
    }
};

// ============================================
// 3-LEGGED OAUTH ENDPOINTS
// ============================================

/**
 * Check if user is authenticated for Data Management API
 */
router.get('/auth/status', (req, res) => {
    const sessionId = req.session?.id || 'default';
    const authenticated = isUserAuthenticated(sessionId);
    res.json({ 
        authenticated,
        message: authenticated ? 'User is authenticated' : 'Please log in to access Autodesk Cloud'
    });
});

/**
 * Get the login URL for Autodesk
 */
router.get('/auth/login', (req, res) => {
    const callbackUrl = 'http://localhost:8080/api/filesync/auth/callback';
    const url = getAuthorizationUrl(callbackUrl);
    res.json({ url });
});

/**
 * OAuth callback - receives the authorization code
 */
router.get('/auth/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send('No authorization code received');
        }

        const callbackUrl = 'http://localhost:8080/api/filesync/auth/callback';
        const { client, credentials } = await exchangeCodeForToken(code, callbackUrl);
        const sessionId = req.session?.id || 'default';
        setUserToken(sessionId, credentials);

        console.log('✅ User authenticated successfully');
        
        // Redirect back to admin console
        res.redirect('http://localhost:3001?auth=success');
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('http://localhost:3001?auth=error');
    }
});

/**
 * Logout - clear user tokens
 */
router.post('/auth/logout', (req, res) => {
    const sessionId = req.session?.id || 'default';
    // Clear token would go here
    res.json({ success: true });
});

// ============================================
// WEBHOOK ENDPOINTS
// ============================================

/**
 * Webhook callback endpoint - receives notifications from Autodesk Cloud
 * POST /api/filesync/webhook/callback
 */
router.post('/webhook/callback', async (req, res) => {
    console.log('📥 Webhook received:', JSON.stringify(req.body, null, 2));
    
    try {
        const hookPayload = req.body;
        
        // Autodesk sends a verification request first
        if (hookPayload.hook) {
            // This is a webhook registration verification
            console.log('✅ Webhook verification received');
            return res.status(200).json({ status: 'ok' });
        }

        // Process the webhook payload
        const { resourceUrn, payload, hook } = hookPayload;
        
        // Log to sync history
        const historyEntry = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            event: hookPayload.event || 'unknown',
            resourceUrn: resourceUrn,
            status: 'received',
            details: hookPayload
        };
        syncHistory.unshift(historyEntry);
        if (syncHistory.length > 100) syncHistory.pop(); // Keep last 100 entries
        
        emitSyncEvent('sync:webhook-received', historyEntry);

        // Find matching sync configuration
        const matchingConfig = syncConfigurations.find(cfg => 
            cfg.enabled && cfg.sourceProjectId && 
            (resourceUrn?.includes(cfg.sourceProjectId) || resourceUrn?.includes(cfg.sourceFolderId))
        );

        if (matchingConfig) {
            console.log('🔄 Processing file change for config:', matchingConfig.name);
            historyEntry.status = 'processing';
            emitSyncEvent('sync:processing', historyEntry);
            
            // Process the file sync
            await processFileSync(hookPayload, matchingConfig, historyEntry);
        } else {
            console.log('⚠️ No matching sync configuration found');
            historyEntry.status = 'skipped';
            historyEntry.message = 'No matching sync configuration';
        }

        res.status(200).json({ status: 'received' });
    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Process file sync from Autodesk Cloud to OSS
 */
async function processFileSync(hookPayload, syncConfig, historyEntry) {
    try {
        const client = await getClient(config.scopes.internal);
        const token = client.getCredentials();
        
        // Extract file info from webhook
        const resourceUrn = hookPayload.resourceUrn || hookPayload.payload?.urn;
        
        if (!resourceUrn) {
            throw new Error('No resource URN in webhook payload');
        }

        // Get file details from Data Management API
        const itemApi = new ForgeAPI.ItemsApi();
        const versionApi = new ForgeAPI.VersionsApi();
        
        // The URN might be an item or version URN
        let fileInfo;
        let downloadUrl;
        
        // Try to get version info (for file content)
        try {
            const versionData = await versionApi.getVersion(
                hookPayload.payload?.project || syncConfig.sourceProjectId,
                resourceUrn,
                client, token
            );
            fileInfo = versionData.body.data;
            
            // Get storage location for download
            if (fileInfo.relationships?.storage?.data?.id) {
                const storageUrn = fileInfo.relationships.storage.data.id;
                // Download URL needs to be obtained from storage
                downloadUrl = await getDownloadUrl(storageUrn, client, token);
            }
        } catch (err) {
            console.log('Could not get version directly, trying item API');
        }

        if (!downloadUrl) {
            historyEntry.status = 'error';
            historyEntry.message = 'Could not obtain download URL';
            emitSyncEvent('sync:error', historyEntry);
            return;
        }

        // Download the file
        console.log('⬇️ Downloading file from Autodesk Cloud...');
        const fileBuffer = await downloadFile(downloadUrl, token.access_token);
        
        // Get filename
        const fileName = fileInfo?.attributes?.displayName || 
                        fileInfo?.attributes?.name || 
                        `synced-file-${Date.now()}`;

        // Upload to OSS
        console.log('⬆️ Uploading to OSS bucket:', syncConfig.targetBucket);
        const objectKey = `${syncConfig.targetPrefix || ''}${fileName}`;
        
        const objectsApi = new ForgeAPI.ObjectsApi();
        const uploadResult = await objectsApi.uploadObject(
            syncConfig.targetBucket,
            objectKey,
            fileBuffer.length,
            fileBuffer,
            {},
            client, token
        );

        console.log('✅ File synced successfully:', objectKey);
        
        historyEntry.status = 'completed';
        historyEntry.message = `Synced ${fileName} to ${syncConfig.targetBucket}/${objectKey}`;
        historyEntry.ossObject = {
            bucket: syncConfig.targetBucket,
            objectKey: objectKey,
            urn: uploadResult.body.objectId
        };
        
        emitSyncEvent('sync:completed', historyEntry);

        // Optionally trigger translation for viewing
        if (syncConfig.autoTranslate) {
            await triggerTranslation(uploadResult.body.objectId, client, token);
        }

    } catch (error) {
        console.error('❌ File sync error:', error);
        historyEntry.status = 'error';
        historyEntry.message = error.message;
        emitSyncEvent('sync:error', historyEntry);
    }
}

/**
 * Get download URL for a storage object
 */
async function getDownloadUrl(storageUrn, client, token) {
    try {
        // Parse the storage URN to get bucket and object
        // Format: urn:adsk.objects:os.object:bucket/objectkey
        const objectsApi = new ForgeAPI.ObjectsApi();
        
        // For signed URL download
        const signedUrl = await objectsApi.createSignedResource(
            storageUrn.split('/')[0].replace('urn:adsk.objects:os.object:', ''),
            storageUrn.split('/')[1],
            { access: 'read' },
            { minutesExpiration: 10 },
            client, token
        );
        
        return signedUrl.body.signedUrl;
    } catch (error) {
        console.error('Error getting download URL:', error);
        return null;
    }
}

/**
 * Download file from URL
 */
async function downloadFile(url, accessToken) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return Buffer.from(response.data);
}

/**
 * Trigger Model Derivative translation
 */
async function triggerTranslation(objectId, client, token) {
    try {
        const derivativesApi = new ForgeAPI.DerivativesApi();
        const base64Urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
        
        await derivativesApi.translate({
            input: { urn: base64Urn },
            output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] }
        }, {}, client, token);
        
        console.log('📐 Translation job started for:', objectId);
    } catch (error) {
        console.error('Translation error:', error);
    }
}

// ============================================
// WEBHOOK MANAGEMENT API
// ============================================

/**
 * Get available webhook events
 */
router.get('/webhook/events', async (req, res) => {
    res.json([
        { event: 'dm.version.added', description: 'New version of file added' },
        { event: 'dm.version.modified', description: 'File version modified' },
        { event: 'dm.version.deleted', description: 'File version deleted' },
        { event: 'dm.folder.added', description: 'New folder created' },
        { event: 'dm.folder.modified', description: 'Folder modified' }
    ]);
});

/**
 * Register a new webhook with Autodesk
 * POST /api/filesync/webhook/register
 */
router.post('/webhook/register', async (req, res) => {
    try {
        const { scope, hookEvent, callbackUrl, projectId, folderId } = req.body;
        
        const client = await getClient(config.scopes.internal);
        const token = client.getCredentials();

        // Build the webhook registration payload
        const webhookPayload = {
            callbackUrl: callbackUrl || `${config.credentials.webhook_url}/api/filesync/webhook/callback`,
            scope: {
                folder: folderId || scope?.folder
            },
            hookAttribute: {
                projectId: projectId
            }
        };

        // Register webhook via Autodesk Webhooks API
        const response = await axios.post(
            `https://developer.api.autodesk.com/webhooks/v1/systems/data/events/${hookEvent}/hooks`,
            webhookPayload,
            {
                headers: {
                    'Authorization': `Bearer ${token.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const webhook = {
            id: response.data.hookId,
            event: hookEvent,
            projectId: projectId,
            folderId: folderId,
            callbackUrl: webhookPayload.callbackUrl,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        registeredWebhooks.push(webhook);
        saveSyncConfig();

        console.log('✅ Webhook registered:', webhook.id);
        res.json(webhook);
    } catch (error) {
        console.error('❌ Webhook registration error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to register webhook',
            details: error.response?.data || error.message
        });
    }
});

/**
 * List registered webhooks
 */
router.get('/webhook/list', async (req, res) => {
    try {
        const client = await getClient(config.scopes.internal);
        const token = client.getCredentials();

        // Get webhooks from Autodesk
        const response = await axios.get(
            'https://developer.api.autodesk.com/webhooks/v1/systems/data/hooks',
            {
                headers: {
                    'Authorization': `Bearer ${token.access_token}`
                }
            }
        );

        res.json(response.data.data || []);
    } catch (error) {
        console.error('Error fetching webhooks:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a webhook
 */
router.delete('/webhook/:hookId', async (req, res) => {
    try {
        const { hookId } = req.params;
        
        const client = await getClient(config.scopes.internal);
        const token = client.getCredentials();

        await axios.delete(
            `https://developer.api.autodesk.com/webhooks/v1/systems/data/hooks/${hookId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token.access_token}`
                }
            }
        );

        // Remove from local storage
        registeredWebhooks = registeredWebhooks.filter(w => w.id !== hookId);
        saveSyncConfig();

        console.log('🗑️ Webhook deleted:', hookId);
        res.json({ status: 'deleted', hookId });
    } catch (error) {
        console.error('Error deleting webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SYNC CONFIGURATION API
// ============================================

/**
 * Get all sync configurations
 */
router.get('/config', (req, res) => {
    res.json(syncConfigurations);
});

/**
 * Create a new sync configuration
 */
router.post('/config', (req, res) => {
    const newConfig = {
        id: Date.now().toString(),
        name: req.body.name || 'New Sync',
        sourceProjectId: req.body.sourceProjectId,
        sourceFolderId: req.body.sourceFolderId,
        sourcePath: req.body.sourcePath,
        targetBucket: req.body.targetBucket,
        targetPrefix: req.body.targetPrefix || '',
        autoTranslate: req.body.autoTranslate || false,
        enabled: req.body.enabled !== false,
        createdAt: new Date().toISOString()
    };
    
    syncConfigurations.push(newConfig);
    saveSyncConfig();
    
    res.json(newConfig);
});

/**
 * Update sync configuration
 */
router.put('/config/:id', (req, res) => {
    const { id } = req.params;
    const index = syncConfigurations.findIndex(c => c.id === id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Configuration not found' });
    }
    
    syncConfigurations[index] = {
        ...syncConfigurations[index],
        ...req.body,
        updatedAt: new Date().toISOString()
    };
    
    saveSyncConfig();
    res.json(syncConfigurations[index]);
});

/**
 * Delete sync configuration
 */
router.delete('/config/:id', (req, res) => {
    const { id } = req.params;
    syncConfigurations = syncConfigurations.filter(c => c.id !== id);
    saveSyncConfig();
    res.json({ status: 'deleted', id });
});

/**
 * Toggle sync configuration enabled/disabled
 */
router.post('/config/:id/toggle', (req, res) => {
    const { id } = req.params;
    const config = syncConfigurations.find(c => c.id === id);
    
    if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
    }
    
    config.enabled = !config.enabled;
    saveSyncConfig();
    res.json(config);
});

// ============================================
// SYNC HISTORY API
// ============================================

/**
 * Get sync history
 */
router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(syncHistory.slice(0, limit));
});

/**
 * Clear sync history
 */
router.delete('/history', (req, res) => {
    syncHistory = [];
    res.json({ status: 'cleared' });
});

// ============================================
// SYNCED FILES TRACKING API
// ============================================

/**
 * Get all synced files info
 * Can filter by bucketKey
 */
router.get('/synced-files', (req, res) => {
    const { bucketKey } = req.query;
    
    if (bucketKey) {
        // Filter by bucket
        const filtered = {};
        Object.entries(syncedFiles).forEach(([key, value]) => {
            if (key.startsWith(bucketKey + '/')) {
                filtered[key] = value;
            }
        });
        return res.json(filtered);
    }
    
    res.json(syncedFiles);
});

/**
 * Check if specific objects are synced
 * POST body: { bucketKey: string, objectKeys: string[] }
 */
router.post('/synced-files/check', (req, res) => {
    const { bucketKey, objectKeys } = req.body;
    
    if (!bucketKey || !objectKeys) {
        return res.status(400).json({ error: 'bucketKey and objectKeys required' });
    }
    
    const results = {};
    objectKeys.forEach(objectKey => {
        const fullKey = `${bucketKey}/${objectKey}`;
        results[objectKey] = syncedFiles[fullKey] || null;
    });
    
    res.json(results);
});

/**
 * Record a synced file (called internally when sync completes)
 */
const recordSyncedFile = (bucketKey, objectKey, metadata) => {
    const fullKey = `${bucketKey}/${objectKey}`;
    syncedFiles[fullKey] = {
        syncedAt: new Date().toISOString(),
        ...metadata
    };
    saveSyncConfig();
};

// ============================================
// DATA MANAGEMENT API - Project/Folder Browser
// ============================================

/**
 * Helper to get user's 3-legged token or return error
 */
const getUserCredentials = (req, res) => {
    const sessionId = req.session?.id || 'default';
    const credentials = getUserToken(sessionId);
    if (!credentials) {
        return null;
    }
    return credentials;
};

/**
 * Get hubs (accounts) accessible by the user
 * Requires 3-legged OAuth
 */
router.get('/hubs', async (req, res) => {
    try {
        const sessionId = req.session?.id || 'default';
        const credentials = getUserToken(sessionId);
        
        if (!credentials) {
            return res.status(401).json({ 
                error: 'Not authenticated', 
                needsLogin: true,
                loginUrl: getAuthorizationUrl()
            });
        }

        const response = await axios.get('https://developer.api.autodesk.com/project/v1/hubs', {
            headers: {
                'Authorization': `Bearer ${credentials.access_token}`
            }
        });
        
        res.json(response.data.data || []);
    } catch (error) {
        console.error('Error fetching hubs:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ 
                error: 'Session expired', 
                needsLogin: true,
                loginUrl: getAuthorizationUrl()
            });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get projects in a hub
 */
router.get('/hubs/:hubId/projects', async (req, res) => {
    try {
        const { hubId } = req.params;
        const sessionId = req.session?.id || 'default';
        const credentials = getUserToken(sessionId);
        
        if (!credentials) {
            return res.status(401).json({ error: 'Not authenticated', needsLogin: true });
        }

        const response = await axios.get(`https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects`, {
            headers: {
                'Authorization': `Bearer ${credentials.access_token}`
            }
        });
        
        res.json(response.data.data || []);
    } catch (error) {
        console.error('Error fetching projects:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get top folders in a project
 */
router.get('/projects/:projectId/topFolders', async (req, res) => {
    try {
        const { projectId } = req.params;
        const hubId = req.query.hubId;
        const sessionId = req.session?.id || 'default';
        const credentials = getUserToken(sessionId);
        
        if (!credentials) {
            return res.status(401).json({ error: 'Not authenticated', needsLogin: true });
        }

        const response = await axios.get(
            `https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`,
            {
                headers: {
                    'Authorization': `Bearer ${credentials.access_token}`
                }
            }
        );
        
        res.json(response.data.data || []);
    } catch (error) {
        console.error('Error fetching top folders:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get folder contents
 */
router.get('/projects/:projectId/folders/:folderId/contents', async (req, res) => {
    try {
        const { projectId, folderId } = req.params;
        const sessionId = req.session?.id || 'default';
        const credentials = getUserToken(sessionId);
        
        if (!credentials) {
            return res.status(401).json({ error: 'Not authenticated', needsLogin: true });
        }

        const response = await axios.get(
            `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`,
            {
                headers: {
                    'Authorization': `Bearer ${credentials.access_token}`
                }
            }
        );
        
        res.json(response.data.data || []);
    } catch (error) {
        console.error('Error fetching folder contents:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get OSS buckets for target selection (uses 2-legged - app-owned data)
 */
router.get('/oss/buckets', async (req, res) => {
    try {
        const client = await getClient(config.scopes.internal);
        const token = client.getCredentials();

        const bucketsApi = new ForgeAPI.BucketsApi();
        const buckets = await bucketsApi.getBuckets({ limit: 100 }, client, token);
        
        res.json(buckets.body.items || []);
    } catch (error) {
        console.error('Error fetching buckets:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Manual sync trigger - sync a specific file/folder now
 * Uses 3-legged OAuth for Data Management API (user's data)
 * Uses 2-legged OAuth for OSS upload (app data)
 */
router.post('/sync/trigger', async (req, res) => {
    try {
        const { projectId, folderId, itemId, targetBucket, targetPrefix } = req.body;
        
        // Get user's 3-legged token for accessing their ACC/Fusion data
        const sessionId = req.session?.id || 'default';
        const userCredentials = getUserToken(sessionId);
        
        if (!userCredentials) {
            return res.status(401).json({ 
                error: 'Not authenticated', 
                needsLogin: true,
                message: 'Please sign in to Autodesk to sync files'
            });
        }

        // Get folder contents using user's token (axios call)
        if (folderId) {
            // Sync entire folder
            console.log('🔄 Starting manual sync for folder:', folderId);
            
            const contentsResponse = await axios.get(
                `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${encodeURIComponent(folderId)}/contents`,
                {
                    headers: {
                        'Authorization': `Bearer ${userCredentials.access_token}`
                    }
                }
            );
            
            const items = contentsResponse.data.data.filter(item => item.type === 'items');
            console.log(`📁 Found ${items.length} files in folder`);
            
            if (items.length === 0) {
                return res.json({ 
                    status: 'completed', 
                    message: 'No files found in folder',
                    itemCount: 0 
                });
            }
            
            res.json({ 
                status: 'syncing', 
                message: `Syncing ${items.length} files`,
                itemCount: items.length 
            });
            
            // Get 2-legged token for OSS uploads
            const ossClient = await getClient(config.scopes.internal);
            const ossCredentials = ossClient.getCredentials();
            const ossAccessToken = ossCredentials.access_token;
            console.log(`🔑 Got OSS token: ${ossAccessToken.substring(0, 20)}...`);
            
            // Process items in background
            for (const item of items) {
                try {
                    // Get item tip (latest version) using user's token
                    const tipResponse = await axios.get(
                        `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodeURIComponent(item.id)}/tip`,
                        {
                            headers: {
                                'Authorization': `Bearer ${userCredentials.access_token}`
                            }
                        }
                    );
                    
                    const tipData = tipResponse.data.data;
                    const fileName = item.attributes.displayName || item.attributes.name;
                    
                    console.log(`⬇️ Downloading: ${fileName}`);
                    
                    // Get storage ID from the tip
                    const storageId = tipData.relationships?.storage?.data?.id;
                    console.log(`   Storage ID: ${storageId}`);
                    
                    if (!storageId) {
                        console.log(`⚠️ No storage found for ${fileName}`);
                        continue;
                    }
                    
                    let fileBuffer;
                    
                    // Parse the storage URN to get bucket and object key
                    // Format: urn:adsk.objects:os.object:wip.dm.prod/GUID
                    const ossMatch = storageId.match(/urn:adsk\.objects:os\.object:([^/]+)\/(.+)/);
                    
                    if (ossMatch) {
                        const [, bucket, objectKey] = ossMatch;
                        console.log(`   Bucket: ${bucket}, Key: ${objectKey}`);
                        
                        // For WIP buckets, we need to use a signed URL
                        // First, try to get a signed S3 download URL
                        try {
                            const signedResponse = await axios.get(
                                `https://developer.api.autodesk.com/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3download`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${userCredentials.access_token}`
                                    }
                                }
                            );
                            
                            console.log(`   Got signed URL, downloading...`);
                            const downloadResponse = await axios.get(signedResponse.data.url, {
                                responseType: 'arraybuffer'
                            });
                            fileBuffer = Buffer.from(downloadResponse.data);
                        } catch (signedError) {
                            console.log(`   Signed URL failed: ${signedError.message}`);
                            
                            // Fall back to direct download
                            try {
                                const downloadResponse = await axios.get(
                                    `https://developer.api.autodesk.com/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${userCredentials.access_token}`
                                        },
                                        responseType: 'arraybuffer'
                                    }
                                );
                                fileBuffer = Buffer.from(downloadResponse.data);
                            } catch (directError) {
                                console.log(`   Direct download failed: ${directError.message}`);
                            }
                        }
                    } else {
                        console.log(`   Could not parse storage URN format: ${storageId}`);
                    }
                    
                    if (!fileBuffer) {
                        console.log(`⚠️ Could not download ${fileName}`);
                        
                        const historyEntry = {
                            id: Date.now().toString(),
                            timestamp: new Date().toISOString(),
                            event: 'manual-sync',
                            status: 'error',
                            message: `Could not download ${fileName}`
                        };
                        syncHistory.unshift(historyEntry);
                        emitSyncEvent('sync:error', historyEntry);
                        continue;
                    }
                    
                    console.log(`📦 Downloaded ${fileName} (${fileBuffer.length} bytes)`);
                    
                    // Upload to target OSS bucket using 2-legged token
                    const objectKey = `${targetPrefix || ''}${fileName}`;
                    
                    console.log(`⬆️ Uploading to OSS: ${targetBucket}/${objectKey}`);
                    
                    // Use new signed S3 upload API (legacy endpoint is deprecated)
                    try {
                        // Step 1: Get signed upload URL
                        const signedUploadRes = await axios.get(
                            `https://developer.api.autodesk.com/oss/v2/buckets/${targetBucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${ossAccessToken}`
                                }
                            }
                        );
                        
                        const { uploadKey, urls } = signedUploadRes.data;
                        console.log(`   Got signed upload URL`);
                        
                        // Step 2: Upload to S3
                        await axios.put(urls[0], fileBuffer, {
                            headers: {
                                'Content-Type': 'application/octet-stream'
                            },
                            maxBodyLength: Infinity,
                            maxContentLength: Infinity
                        });
                        
                        // Step 3: Complete the upload
                        await axios.post(
                            `https://developer.api.autodesk.com/oss/v2/buckets/${targetBucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
                            { uploadKey },
                            {
                                headers: {
                                    'Authorization': `Bearer ${ossAccessToken}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        
                        console.log(`✅ Uploaded to OSS: ${targetBucket}/${objectKey}`);
                    } catch (uploadError) {
                        console.error(`❌ Upload failed:`, uploadError.response?.data || uploadError.message);
                        throw uploadError;
                    }
                    
                    // Record synced file
                    const fullKey = `${targetBucket}/${objectKey}`;
                    syncedFiles[fullKey] = {
                        syncedAt: new Date().toISOString(),
                        sourceFolder: folderId,
                        sourceFile: item.id,
                        fileName: fileName
                    };
                    
                    // Add to history
                    const historyEntry = {
                        id: Date.now().toString(),
                        timestamp: new Date().toISOString(),
                        event: 'manual-sync',
                        status: 'completed',
                        message: `Synced ${fileName}`,
                        ossObject: {
                            bucket: targetBucket,
                            objectKey: objectKey
                        }
                    };
                    syncHistory.unshift(historyEntry);
                    emitSyncEvent('sync:completed', historyEntry);
                    
                } catch (itemError) {
                    console.error(`❌ Error syncing item:`, itemError.message);
                    const historyEntry = {
                        id: Date.now().toString(),
                        timestamp: new Date().toISOString(),
                        event: 'manual-sync',
                        status: 'error',
                        message: `Failed: ${itemError.message}`
                    };
                    syncHistory.unshift(historyEntry);
                    emitSyncEvent('sync:error', historyEntry);
                }
            }
            
            // Save sync config after all files processed
            saveSyncConfig();
            
        } else if (itemId) {
            // Sync single item - similar logic
            res.status(400).json({ error: 'Single item sync not yet implemented' });
        } else {
            res.status(400).json({ error: 'Either itemId or folderId is required' });
        }
    } catch (error) {
        console.error('Manual sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

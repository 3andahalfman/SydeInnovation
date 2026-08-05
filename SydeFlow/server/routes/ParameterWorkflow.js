const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getInternalToken } = require('./common/oauth');
const config = require('../config');
const dav3 = require('autodesk.forge.designautomation');
const ForgeAPI = require('forge-apis');
const { ParamCache } = require('../db');

// Import activity logger
let logActivity;
try {
    const ActivityLog = require('./ActivityLog');
    logActivity = ActivityLog.logActivity;
} catch (e) {
    logActivity = (type, data) => console.log(`Activity: ${type}`, data);
}

/**
 * Utility functions
 */
class WorkflowUtils {
    static get NickName() {
        return config.credentials.client_id;
    }

    static get Alias() {
        return 'dev';
    }

    static async getDAv3Api() {
        const client = new dav3.AutodeskForgeDesignAutomationClient(config.client);
        const FetchRefresh = async () => {
            const { getClient } = require('./common/oauth');
            const oauthClient = await getClient();
            return oauthClient.getCredentials();
        };
        client.authManager.authentications['2-legged'].fetchToken = FetchRefresh;
        client.authManager.authentications['2-legged'].refreshToken = FetchRefresh;
        return new dav3.AutodeskForgeDesignAutomationApi(client);
    }

    static async getSignedUrl(bucketKey, objectKey, access = 'read') {
        const oauth = await getInternalToken();
        const objectsApi = new ForgeAPI.ObjectsApi();
        
        if (access === 'write') {
            // Use createSignedResource for write - auto-commits on PUT (no finalize needed)
            const response = await objectsApi.createSignedResource(
                bucketKey,
                objectKey,
                {
                    minutesExpiration: 60,
                    singleUse: false
                },
                { access: 'write' },
                oauth.client, oauth.credentials
            );
            return response.body.signedUrl;
        } else {
            // For read access, use createSignedResource too for consistency
            const response = await objectsApi.createSignedResource(
                bucketKey,
                objectKey,
                {
                    minutesExpiration: 60,
                    singleUse: false
                },
                { access: 'read' },
                oauth.client, oauth.credentials
            );
            return response.body.signedUrl;
        }
    }

    /**
     * Deterministic hash of source file identity + parameter values.
     * Sorts keys alphabetically so {a:1, b:2} and {b:2, a:1} produce the same hash.
     */
    static hashParameters(sourceBucket, sourceObjectKey, parameters) {
        const sorted = Object.keys(parameters).sort().reduce((acc, key) => {
            acc[key] = parameters[key];
            return acc;
        }, {});
        const payload = `${sourceBucket}:${sourceObjectKey}:${JSON.stringify(sorted)}`;
        return crypto.createHash('sha256').update(payload).digest('hex');
    }
}

/**
 * POST /api/workflow/extract-parameters
 * Run parameter extraction workitem on an Inventor file
 * 
 * Request body:
 * {
 *   bucketKey: string,
 *   objectKey: string,
 *   // OR
 *   objectId: string,  // Full OSS object ID (urn:adsk.objects:os.object:bucket/key)
 *   // OR (for testing)
 *   sampleFile: true
 * }
 */
router.post('/extract-parameters', async (req, res) => {
    try {
        const api = await WorkflowUtils.getDAv3Api();
        const oauth = await getInternalToken();
        const objectsApi = new ForgeAPI.ObjectsApi();

        let inputUrl;
        let sourceInfo;

        // Determine input source
        if (req.body.sampleFile) {
            // Use the uploaded sample file - need to get its URL
            const settingsPath = path.join(__dirname, '../data/settings.json');
            let bucketKey = 'sydeflow-models';
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                bucketKey = settings.bucketKey || bucketKey;
            }

            // List objects in bucket to find the sample
            try {
                const objects = await objectsApi.getObjects(bucketKey, { limit: 100 }, oauth.client, oauth.credentials);
                const sampleObj = objects.body.items.find(obj => 
                    obj.objectKey.includes('custom-box') || obj.objectKey.includes('inventor_sample')
                );
                
                if (sampleObj) {
                    inputUrl = await WorkflowUtils.getSignedUrl(bucketKey, sampleObj.objectKey, 'read');
                    sourceInfo = { bucketKey, objectKey: sampleObj.objectKey };
                } else {
                    return res.status(404).json({
                        success: false,
                        error: 'Sample file not found in OSS. Run setup first.'
                    });
                }
            } catch (e) {
                return res.status(404).json({
                    success: false,
                    error: 'Could not access bucket. Run setup first.'
                });
            }
        } else if (req.body.objectId) {
            // Parse objectId to get bucket and key
            const match = req.body.objectId.match(/urn:adsk\.objects:os\.object:([^/]+)\/(.+)/);
            if (!match) {
                return res.status(400).json({ success: false, error: 'Invalid objectId format' });
            }
            inputUrl = await WorkflowUtils.getSignedUrl(match[1], match[2], 'read');
            sourceInfo = { bucketKey: match[1], objectKey: match[2] };
        } else if (req.body.bucketKey && req.body.objectKey) {
            inputUrl = await WorkflowUtils.getSignedUrl(req.body.bucketKey, req.body.objectKey, 'read');
            sourceInfo = { bucketKey: req.body.bucketKey, objectKey: req.body.objectKey };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Must provide sampleFile: true, objectId, or bucketKey + objectKey'
            });
        }

        // Create output URL for the parameters JSON
        const outputObjectKey = `params-${Date.now()}.json`;
        const outputUrl = await WorkflowUtils.getSignedUrl(sourceInfo.bucketKey, outputObjectKey, 'write');

        console.log('Input URL:', inputUrl?.substring(0, 100) + '...');
        console.log('Output URL:', outputUrl?.substring(0, 100) + '...');

        // Create the workitem
        const activityId = `${WorkflowUtils.NickName}.ExtractParamsActivity+${WorkflowUtils.Alias}`;
        
        const workItemSpec = {
            activityId: activityId,
            arguments: {
                inputFile: {
                    url: inputUrl,
                    verb: dav3.Verb.get
                },
                outputJson: {
                    url: outputUrl,
                    verb: dav3.Verb.put
                }
            }
        };

        console.log('Starting parameter extraction workitem...');
        console.log('Activity ID:', activityId);
        console.log('WorkItem spec:', JSON.stringify(workItemSpec, null, 2));
        
        const workItemResult = await api.createWorkItem(workItemSpec);
        console.log('WorkItem created:', workItemResult.id, 'Status:', workItemResult.status);

        logActivity('workflow:extract:started', {
            title: 'Parameter Extraction Started',
            message: `Started extraction for ${sourceInfo.objectKey}`,
            details: { workItemId: workItemResult.id, activityId }
        });

        res.json({
            success: true,
            workItemId: workItemResult.id,
            status: workItemResult.status,
            outputLocation: {
                bucketKey: sourceInfo.bucketKey,
                objectKey: outputObjectKey
            },
            message: 'Parameter extraction workitem started'
        });
    } catch (error) {
        console.error('Error starting extraction workitem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/workflow/workitem/:id
 * Check workitem status
 */
router.get('/workitem/:id', async (req, res) => {
    try {
        const api = await WorkflowUtils.getDAv3Api();
        const workItemStatus = await api.getWorkitemStatus(req.params.id);

        res.json({
            success: true,
            id: req.params.id,
            status: workItemStatus.status,
            progress: workItemStatus.progress,
            reportUrl: workItemStatus.reportUrl,
            stats: workItemStatus.stats
        });
    } catch (error) {
        console.error('Error checking workitem status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/workflow/workitem/:id
 * Cancel an in-flight work item
 */
router.delete('/workitem/:id', async (req, res) => {
    try {
        const api = await WorkflowUtils.getDAv3Api();
        await api.deleteWorkItem(req.params.id);

        logActivity('workflow:cancelled', {
            title: 'Work Item Cancelled',
            message: `Cancelled work item ${req.params.id}`,
            details: { workItemId: req.params.id }
        });

        res.json({ success: true, id: req.params.id, message: 'Work item cancelled' });
    } catch (error) {
        console.error('Error cancelling workitem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/workflow/parameters/:bucketKey/:objectKey
 * Retrieve extracted parameters from OSS
 */
router.get('/parameters/:bucketKey/:objectKey', async (req, res) => {
    try {
        const oauth = await getInternalToken();
        const objectsApi = new ForgeAPI.ObjectsApi();
        
        const object = await objectsApi.getObject(
            req.params.bucketKey, 
            req.params.objectKey, 
            {}, 
            oauth.client, oauth.credentials
        );

        // Parse the JSON content
        const content = object.body.toString('utf8');
        const parameters = JSON.parse(content);

        res.json({
            success: true,
            parameters,
            source: {
                bucketKey: req.params.bucketKey,
                objectKey: req.params.objectKey
            }
        });
    } catch (error) {
        console.error('Error retrieving parameters:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/workflow/regenerate
 * Run model regeneration with new parameter values
 * Supports dual parallel work items: IPT (Inventor) + DWG (AutoCAD)
 * 
 * Request body:
 * {
 *   bucketKey: string,
 *   objectKey: string,         // Source IPT/IAM file
 *   parameters: {               // Parameters to update
 *     Length: 150,
 *     Width: 100,
 *     // ...etc
 *   },
 *   outputFileName?: string,    // Optional custom output name
 *   drawingFile?: {             // Optional: DWG file for AutoCAD activity
 *     bucketKey: string,
 *     objectKey: string
 *   }
 * }
 */
/**
 * POST /api/workflow/run
 * Configurator builder test-run alias. Accepts { productId, parameters },
 * resolves OSS source from the Products store, then regenerates.
 */
router.post('/run', async (req, res) => {
    try {
        const { productId, parameters = {} } = req.body || {};
        if (!productId) {
            return res.status(400).json({ success: false, error: 'productId is required' });
        }

        const { ProductsStore } = require('../db');
        const product = await ProductsStore.getById(productId);
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const source = product.sourceFile
            || (product.ossBucket
                ? { bucketKey: product.ossBucket, objectKey: product.ossObjectKey }
                : null);

        if (!source?.bucketKey || !source?.objectKey) {
            return res.status(400).json({
                success: false,
                error: 'Product has no source file configured'
            });
        }

        req.body = {
            bucketKey: source.bucketKey,
            objectKey: source.objectKey,
            parameters,
            drawingFile: product.drawingFile || undefined
        };
        req.url = '/regenerate';
        return router.handle(req, res);
    } catch (error) {
        console.error('Error in workflow/run:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/regenerate', async (req, res) => {
    try {
        const { bucketKey, objectKey, parameters, outputFileName, drawingFile } = req.body;
        
        if (!bucketKey || !objectKey || !parameters) {
            return res.status(400).json({
                success: false,
                error: 'Must provide bucketKey, objectKey, and parameters'
            });
        }

        // ─── Cache lookup ─────────────────────────────────────────────
        const paramHash = WorkflowUtils.hashParameters(bucketKey, objectKey, parameters);
        const { data: cached, error: cacheErr } = await ParamCache.findByHash(bucketKey, objectKey, paramHash);

        if (!cacheErr && cached) {
            if (cached.status === 'completed' && cached.output_urn) {
                console.log(`Cache HIT (completed) for ${objectKey} hash=${paramHash.slice(0,12)}`);
                return res.json({
                    success: true,
                    cached: true,
                    urn: cached.output_urn,
                    outputLocation: {
                        bucketKey: cached.output_bucket || bucketKey,
                        objectKey: cached.output_object_key
                    },
                    message: 'Loaded from cache — identical parameters were generated before'
                });
            }
            if (cached.status === 'pending' && cached.work_item_id) {
                console.log(`Cache HIT (pending) for ${objectKey} hash=${paramHash.slice(0,12)}`);
                return res.json({
                    success: true,
                    cached: true,
                    pending: true,
                    iptWorkItemId: cached.work_item_id,
                    workItemId: cached.work_item_id,
                    cacheId: cached.id,
                    outputLocation: {
                        bucketKey: cached.output_bucket || bucketKey,
                        objectKey: cached.output_object_key
                    },
                    message: 'Work item already in progress for these parameters'
                });
            }
            // If status is 'failed', treat as cache miss — re-run
        }
        console.log(`Cache MISS for ${objectKey} hash=${paramHash.slice(0,12)}`);
        // ─── End cache lookup ─────────────────────────────────────────

        const api = await WorkflowUtils.getDAv3Api();
        const oauth = await getInternalToken();
        const objectsApi = new ForgeAPI.ObjectsApi();

        // Get signed URL for input IPT file
        const inputUrl = await WorkflowUtils.getSignedUrl(bucketKey, objectKey, 'read');

        // Upload parameters JSON to OSS
        const paramsObjectKey = `params-input-${Date.now()}.json`;
        const paramsContent = JSON.stringify(parameters);
        await objectsApi.uploadResources(
            bucketKey,
            [{
                objectKey: paramsObjectKey,
                data: Buffer.from(paramsContent),
                length: paramsContent.length
            }],
            { useAcceleration: false, minutesExpiration: 60 },
            oauth.client, oauth.credentials
        );
        const paramsUrl = await WorkflowUtils.getSignedUrl(bucketKey, paramsObjectKey, 'read');

        // Create output file name for IPT
        const ext = path.extname(objectKey);
        const baseName = path.basename(objectKey, ext);
        const outputKey = outputFileName || `${baseName}_Config${Date.now()}${ext}`;
        const outputUrl = await WorkflowUtils.getSignedUrl(bucketKey, outputKey, 'write');

        // ─── Work Item 1: IPT regeneration (Inventor engine) ───
        const iptActivityId = `${WorkflowUtils.NickName}.UpdateModelActivity+${WorkflowUtils.Alias}`;
        
        const iptWorkItemSpec = {
            activityId: iptActivityId,
            arguments: {
                inputFile: {
                    url: inputUrl,
                    verb: dav3.Verb.get
                },
                inputJson: {
                    url: paramsUrl,
                    verb: dav3.Verb.get
                },
                outputFile: {
                    url: outputUrl,
                    verb: dav3.Verb.put
                }
            }
        };

        console.log('Starting IPT regeneration workitem...');

        // Check if we also need a DWG work item
        const hasDwg = drawingFile && drawingFile.bucketKey && drawingFile.objectKey;
        let dwgWorkItemPromise = null;
        let outputDwgKey = null;

        if (hasDwg) {
            // ─── Work Item 2: DWG parameter update (AutoCAD engine) ───
            const inputDwgUrl = await WorkflowUtils.getSignedUrl(
                drawingFile.bucketKey, drawingFile.objectKey, 'read'
            );
            
            // Upload same params for the DWG activity (separate copy for isolation)
            const dwgParamsObjectKey = `params-dwg-input-${Date.now()}.json`;
            await objectsApi.uploadResources(
                bucketKey,
                [{
                    objectKey: dwgParamsObjectKey,
                    data: Buffer.from(paramsContent),
                    length: paramsContent.length
                }],
                { useAcceleration: false, minutesExpiration: 60 },
                oauth.client, oauth.credentials
            );
            const dwgParamsUrl = await WorkflowUtils.getSignedUrl(bucketKey, dwgParamsObjectKey, 'read');

            outputDwgKey = `${baseName}_Config${Date.now()}.dwg`;
            const outputDwgUrl = await WorkflowUtils.getSignedUrl(bucketKey, outputDwgKey, 'write');
            
            const dwgActivityId = `${WorkflowUtils.NickName}.UpdateDWGParamActivity+${WorkflowUtils.Alias}`;

            const dwgWorkItemSpec = {
                activityId: dwgActivityId,
                arguments: {
                    inputFile: {
                        url: inputDwgUrl,
                        verb: dav3.Verb.get
                    },
                    inputJson: {
                        url: dwgParamsUrl,
                        verb: dav3.Verb.get
                    },
                    outputFile: {
                        url: outputDwgUrl,
                        verb: dav3.Verb.put
                    }
                }
            };

            console.log('Starting DWG parameter update workitem (AutoCAD)...');
            dwgWorkItemPromise = api.createWorkItem(dwgWorkItemSpec);
        }

        // Fire both work items in parallel
        const [iptWorkItemResult, dwgWorkItemResult] = await Promise.all([
            api.createWorkItem(iptWorkItemSpec),
            dwgWorkItemPromise || Promise.resolve(null)
        ]);

        logActivity('workflow:regenerate:started', {
            title: hasDwg ? 'Dual Regeneration Started (IPT + DWG)' : 'Model Regeneration Started',
            message: `Started regeneration for ${objectKey}${hasDwg ? ' + DWG (parallel)' : ''}`,
            details: { 
                iptWorkItemId: iptWorkItemResult.id,
                dwgWorkItemId: dwgWorkItemResult?.id || null,
                outputKey,
                outputDwgKey,
                hasDwg
            }
        });

        // ─── Create cache entry (status='pending') ───────────────────
        let cacheId = null;
        try {
            const { data: cacheEntry } = await ParamCache.create({
                sourceBucket: bucketKey,
                sourceObjectKey: objectKey,
                paramHash,
                parameters,
                workItemId: iptWorkItemResult.id,
                outputBucket: bucketKey,
                outputObjectKey: outputKey
            });
            if (cacheEntry) cacheId = cacheEntry.id;
        } catch (cacheWriteErr) {
            console.warn('Failed to create param cache entry:', cacheWriteErr.message);
        }
        // ─── End cache entry creation ─────────────────────────────────

        const response = {
            success: true,
            cached: false,
            cacheId,
            // IPT work item (3D view)
            iptWorkItemId: iptWorkItemResult.id,
            iptStatus: iptWorkItemResult.status,
            outputLocation: {
                bucketKey,
                objectKey: outputKey
            },
            // Legacy field for backward compatibility
            workItemId: iptWorkItemResult.id,
            status: iptWorkItemResult.status,
            message: hasDwg 
                ? 'Dual regeneration started (IPT + DWG in parallel)' 
                : 'Model regeneration workitem started'
        };

        // Include DWG work item info if applicable
        if (hasDwg && dwgWorkItemResult) {
            response.dwgWorkItemId = dwgWorkItemResult.id;
            response.dwgStatus = dwgWorkItemResult.status;
            response.dwgOutputLocation = {
                bucketKey,
                objectKey: outputDwgKey
            };
        }

        res.json(response);
    } catch (error) {
        console.error('Error starting regeneration workitem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/workflow/cache-complete
 * Called by the frontend after translation succeeds to persist the cached URN.
 * On failure, marks the cache entry as failed so it will be retried next time.
 *
 * Request body: { cacheId, outputUrn, outputBucket?, outputObjectKey?, failed?, errorMessage? }
 */
router.post('/cache-complete', async (req, res) => {
    try {
        const { cacheId, outputUrn, outputBucket, outputObjectKey, failed, errorMessage } = req.body;

        if (!cacheId) {
            return res.status(400).json({ success: false, error: 'cacheId is required' });
        }

        if (failed) {
            await ParamCache.markFailed(cacheId, errorMessage || 'Translation or regeneration failed');
            return res.json({ success: true, status: 'failed' });
        }

        if (!outputUrn) {
            return res.status(400).json({ success: false, error: 'outputUrn is required when not failed' });
        }

        const { data, error } = await ParamCache.markCompleted(cacheId, {
            outputBucket: outputBucket || '',
            outputObjectKey: outputObjectKey || '',
            outputUrn
        });

        if (error) throw error;

        console.log(`Cache entry ${cacheId} marked completed with URN ${outputUrn.slice(0, 30)}...`);
        res.json({ success: true, status: 'completed', data });
    } catch (error) {
        console.error('Error completing cache entry:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/workflow/extract-and-wait
 * Extract parameters and wait for completion (polling)
 * Returns the extracted parameters directly
 */
router.post('/extract-and-wait', async (req, res) => {
    try {
        const api = await WorkflowUtils.getDAv3Api();
        
        // Start extraction (use internal port so this works regardless of external URL)
        const port = process.env.APS_PORT || process.env.PORT || 8080;
        const extractRes = await fetch(`http://localhost:${port}/api/workflow/extract-parameters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const extractData = await extractRes.json();

        if (!extractData.success) {
            return res.status(400).json(extractData);
        }

        // Poll for completion
        const workItemId = extractData.workItemId;
        let status = 'pending';
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max

        console.log(`Polling workitem ${workItemId} for completion...`);

        while (status === 'pending' || status === 'inprogress') {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;

            console.log(`Poll attempt ${attempts}/${maxAttempts} for workitem ${workItemId}`);

            if (attempts > maxAttempts) {
                // Try to cancel the hung work item so it doesn't consume APS quota
                try { await api.deleteWorkItem(workItemId); } catch (_) {}
                return res.status(408).json({
                    success: false,
                    error: 'Parameter extraction timed out after 5 minutes. The work item has been cancelled. Please retry.',
                    workItemId
                });
            }

            try {
                const statusRes = await api.getWorkitemStatus(workItemId);
                status = statusRes.status;
                console.log(`Workitem ${workItemId} status: ${status}`);

                if (status === 'success') {
                    // Retrieve the parameters
                    const oauth = await getInternalToken();
                    const objectsApi = new ForgeAPI.ObjectsApi();
                    
                    const object = await objectsApi.getObject(
                        extractData.outputLocation.bucketKey,
                        extractData.outputLocation.objectKey,
                        {},
                        oauth.client, oauth.credentials
                    );

                    const parameters = JSON.parse(object.body.toString('utf8'));

                    logActivity('workflow:extract:completed', {
                        title: 'Parameter Extraction Completed',
                        message: `Extracted ${Object.keys(parameters).length} parameters`,
                        details: { workItemId, parametersCount: Object.keys(parameters).length }
                    });

                    return res.json({
                        success: true,
                        parameters,
                        workItemId,
                        outputLocation: extractData.outputLocation
                    });
                } else if (status === 'failed' || status === 'cancelled') {
                    console.error(`Workitem ${workItemId} ${status}:`, statusRes);
                    return res.status(500).json({
                        success: false,
                        error: `Workitem ${status}`,
                        workItemId,
                        details: statusRes
                    });
                }
            } catch (pollError) {
                console.error(`Error polling workitem ${workItemId}:`, pollError.message);
                return res.status(500).json({
                    success: false,
                    error: `Failed to poll workitem: ${pollError.message}`,
                    workItemId
                });
            }
        }
    } catch (error) {
        console.error('Error in extract-and-wait:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/workflow/translate
 * Trigger SVF translation for a model derivative (for viewer)
 * 
 * Request body:
 * { urn: string } or { bucketKey: string, objectKey: string }
 */
router.post('/translate', async (req, res) => {
    try {
        let urn = req.body.urn;
        const force = req.body.force !== false; // default true for new outputs, can be set to false

        // If bucketKey/objectKey provided, build the URN
        if (!urn && req.body.bucketKey && req.body.objectKey) {
            const objectId = `urn:adsk.objects:os.object:${req.body.bucketKey}/${req.body.objectKey}`;
            urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        }

        if (!urn) {
            return res.status(400).json({ success: false, error: 'Must provide urn, or bucketKey + objectKey' });
        }

        const oauth = await getInternalToken();
        const derivativesApi = new ForgeAPI.DerivativesApi();
        const job = {
            input: { urn: urn },
            output: {
                formats: [{ type: 'svf', views: ['2d', '3d'] }]
            }
        };

        try {
            await derivativesApi.translate(job, { xAdsForce: force }, oauth.client, oauth.credentials);
            console.log('Translation started for URN (force=' + force + '):', urn.substring(0, 50));
        } catch (ex) {
            const code = ex.statusCode || 0;
            console.log('Translation error:', code, ex.statusMessage || ex.message, 'URN:', urn.substring(0, 40) + '...');
            if (code === 404) {
                return res.status(404).json({ success: false, error: 'Source file not found in OSS — it may have been deleted or expired', urn });
            }
            if (code === 401 || code === 403) {
                return res.status(code).json({ success: false, error: 'Not authorized to translate this file — credentials may have changed', urn });
            }
        }

        res.json({ success: true, urn, status: 'started' });
    } catch (error) {
        console.error('Error starting translation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/workflow/download/:bucketKey/:objectKey
 * Get a signed download URL for an OSS object
 */
router.get('/download/:bucketKey/:objectKey', async (req, res) => {
    try {
        const oauth = await getInternalToken();
        const objectsApi = new ForgeAPI.ObjectsApi();

        const response = await objectsApi.getS3DownloadURL(
            req.params.bucketKey,
            req.params.objectKey,
            { useAcceleration: false, minutesExpiration: 15 },
            oauth.client, oauth.credentials
        );

        res.json({ success: true, url: response.body.url });
    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

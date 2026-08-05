const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getClient, getInternalToken } = require('./common/oauth');
const config = require('../config');
const dav3 = require('autodesk.forge.designautomation');
const ForgeAPI = require('forge-apis');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Protect all setup endpoints - admin only
router.use(authenticate, requireAdmin);

// Import activity logger
let logActivity;
try {
    const ActivityLog = require('./ActivityLog');
    logActivity = ActivityLog.logActivity;
} catch (e) {
    logActivity = (type, data) => console.log(`Activity: ${type}`, data);
}

/**
 * Utility class for Design Automation setup
 */
class SetupUtils {
    static get NickName() {
        return config.credentials.client_id;
    }

    static get Alias() {
        return 'dev';
    }

    static get BundlesFolder() {
        return path.resolve(path.join(__dirname, '../bundles'));
    }

    static async getDAv3Api() {
        const client = new dav3.AutodeskForgeDesignAutomationClient(config.client);
        const FetchRefresh = async () => {
            const oauthClient = await getClient();
            return oauthClient.getCredentials();
        };
        client.authManager.authentications['2-legged'].fetchToken = FetchRefresh;
        client.authManager.authentications['2-legged'].refreshToken = FetchRefresh;
        return new dav3.AutodeskForgeDesignAutomationApi(client);
    }
}

/**
 * POST /api/setup/extract-params-bundle
 * Register the ExtractParams AppBundle with APS
 */
router.post('/extract-params-bundle', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const bundleName = 'ExtractParamsBundle';
        const engineName = 'Autodesk.Inventor+2024';
        const zipPath = path.join(SetupUtils.BundlesFolder, 'ExtractParams', 'ExtractParamsBundle.zip');

        if (!fs.existsSync(zipPath)) {
            return res.status(400).json({
                success: false,
                error: 'ExtractParamsBundle.zip not found. Run the bundle creation script first.'
            });
        }

        // Check if bundle already exists
        const appBundles = await api.getAppBundles();
        const qualifiedBundleId = `${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`;

        let newAppVersion;
        if (!appBundles.data.includes(qualifiedBundleId)) {
            // Create new bundle (version 1)
            const appBundleSpec = dav3.AppBundle.constructFromObject({
                package: bundleName,
                engine: engineName,
                id: bundleName,
                description: 'Extracts user parameters from Inventor IPT/IAM files as JSON'
            });
            newAppVersion = await api.createAppBundle(appBundleSpec);

            // Create alias pointing to v1
            const aliasSpec = { id: SetupUtils.Alias, version: 1 };
            await api.createAppBundleAlias(bundleName, aliasSpec);
            
            console.log(`Created new AppBundle: ${qualifiedBundleId}`);
        } else {
            // Update existing bundle
            const appBundleSpec = { engine: engineName, description: bundleName };
            newAppVersion = await api.createAppBundleVersion(bundleName, appBundleSpec);

            // Update alias to new version
            const aliasSpec = { version: newAppVersion.version };
            await api.modifyAppBundleAlias(bundleName, SetupUtils.Alias, aliasSpec);
            
            console.log(`Updated AppBundle to version ${newAppVersion.version}`);
        }

        // Upload the ZIP file
        const formData = require('form-data');
        const form = new formData();
        const uploadParams = newAppVersion.uploadParameters;
        
        Object.keys(uploadParams.formData).forEach(key => {
            form.append(key, uploadParams.formData[key]);
        });
        form.append('file', fs.createReadStream(zipPath));

        const https = require('https');
        const url = require('url');
        const urlInfo = url.parse(uploadParams.endpointURL);

        await new Promise((resolve, reject) => {
            const uploadReq = https.request({
                host: urlInfo.host,
                path: urlInfo.pathname,
                method: 'POST',
                headers: form.getHeaders()
            }, response => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${response.statusCode}`));
                }
            });
            form.pipe(uploadReq);
        });

        logActivity('setup:bundle:created', {
            title: 'ExtractParams Bundle Registered',
            message: `Registered ${bundleName} version ${newAppVersion.version}`,
            details: { bundleId: qualifiedBundleId, version: newAppVersion.version }
        });

        res.json({
            success: true,
            bundleId: qualifiedBundleId,
            version: newAppVersion.version,
            message: 'ExtractParams AppBundle registered successfully'
        });
    } catch (error) {
        console.error('Error registering ExtractParams bundle:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/extract-params-activity
 * Create the ExtractParams Activity
 */
router.post('/extract-params-activity', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const activityName = 'ExtractParamsActivity';
        const bundleName = 'ExtractParamsBundle';
        const engineName = 'Autodesk.Inventor+2024';

        // Check if activity already exists
        const activities = await api.getActivities();
        const qualifiedActivityId = `${SetupUtils.NickName}.${activityName}+${SetupUtils.Alias}`;

        if (activities.data.includes(qualifiedActivityId)) {
            return res.json({
                success: true,
                activityId: qualifiedActivityId,
                message: 'ExtractParams Activity already exists'
            });
        }

        // Create the activity
        const activitySpec = {
            id: activityName,
            appbundles: [`${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`],
            commandLine: [
                '$(engine.path)\\InventorCoreConsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[ExtractParamsBundle].path)"'
            ],
            engine: engineName,
            parameters: {
                inputFile: {
                    description: 'Input Inventor file (IPT or IAM)',
                    localName: 'input.ipt',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                outputJson: {
                    description: 'Output JSON file with extracted parameters',
                    localName: 'parameters.json',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.put,
                    zip: false
                }
            }
        };

        await api.createActivity(activitySpec);

        // Create alias
        const aliasSpec = { id: SetupUtils.Alias, version: 1 };
        await api.createActivityAlias(activityName, aliasSpec);

        logActivity('setup:activity:created', {
            title: 'ExtractParams Activity Created',
            message: `Created ${activityName} for parameter extraction`,
            details: { activityId: qualifiedActivityId, engine: engineName }
        });

        res.json({
            success: true,
            activityId: qualifiedActivityId,
            message: 'ExtractParams Activity created successfully'
        });
    } catch (error) {
        console.error('Error creating ExtractParams activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/update-ipt-activity
 * Create the UpdateIPTParam Activity for model regeneration
 */
router.post('/update-ipt-activity', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const activityName = 'UpdateIPTParamActivity';
        const bundleName = 'UpdateIPTParamAppBundle';
        const engineName = 'Autodesk.Inventor+2024';

        // Check if activity already exists
        const activities = await api.getActivities();
        const qualifiedActivityId = `${SetupUtils.NickName}.${activityName}+${SetupUtils.Alias}`;

        if (activities.data.includes(qualifiedActivityId)) {
            return res.json({
                success: true,
                activityId: qualifiedActivityId,
                message: 'UpdateIPTParam Activity already exists'
            });
        }

        // Create the activity
        const activitySpec = {
            id: activityName,
            appbundles: [`${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`],
            commandLine: [
                '$(engine.path)\\InventorCoreConsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[UpdateIPTParamAppBundle].path)"'
            ],
            engine: engineName,
            parameters: {
                inputFile: {
                    description: 'Input Inventor file (IPT or IAM)',
                    localName: 'input.ipt',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                inputJson: {
                    description: 'JSON file with parameter values to apply',
                    localName: 'params.json',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                outputFile: {
                    description: 'Output regenerated Inventor file',
                    localName: 'output.ipt',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.put,
                    zip: false
                }
            }
        };

        await api.createActivity(activitySpec);

        // Create alias
        const aliasSpec = { id: SetupUtils.Alias, version: 1 };
        await api.createActivityAlias(activityName, aliasSpec);

        logActivity('setup:activity:created', {
            title: 'UpdateIPTParam Activity Created',
            message: `Created ${activityName} for model regeneration`,
            details: { activityId: qualifiedActivityId, engine: engineName }
        });

        res.json({
            success: true,
            activityId: qualifiedActivityId,
            message: 'UpdateIPTParam Activity created successfully'
        });
    } catch (error) {
        console.error('Error creating UpdateIPTParam activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/update-model-bundle
 * Register the UpdateModel AppBundle with APS (combined IPT regen + DWG export)
 */
router.post('/update-model-bundle', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const bundleName = 'UpdateModelBundle';
        const engineName = 'Autodesk.Inventor+2024';
        const zipPath = path.join(SetupUtils.BundlesFolder, 'UpdateModel', 'UpdateModelBundle.zip');

        if (!fs.existsSync(zipPath)) {
            // Auto-create the zip from the bundle folder
            const bundleDir = path.join(SetupUtils.BundlesFolder, 'UpdateModel');
            const archiver = require('archiver');
            await new Promise((resolve, reject) => {
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });
                output.on('close', resolve);
                archive.on('error', reject);
                archive.pipe(output);
                // Add PackageContents.xml at root
                archive.file(path.join(bundleDir, 'PackageContents.xml'), { name: 'PackageContents.xml' });
                // Add iLogic script in Contents/
                archive.file(path.join(bundleDir, 'UpdateModel.iLogicVb'), { name: 'Contents/UpdateModel.iLogicVb' });
                archive.finalize();
            });
            console.log(`Created ${zipPath}`);
        }

        // Check if bundle already exists
        const appBundles = await api.getAppBundles();
        const qualifiedBundleId = `${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`;

        let newAppVersion;
        if (!appBundles.data.includes(qualifiedBundleId)) {
            const appBundleSpec = dav3.AppBundle.constructFromObject({
                package: bundleName,
                engine: engineName,
                id: bundleName,
                description: 'Updates IPT parameters, regenerates model, exports linked IDW as DWG'
            });
            newAppVersion = await api.createAppBundle(appBundleSpec);
            const aliasSpec = { id: SetupUtils.Alias, version: 1 };
            await api.createAppBundleAlias(bundleName, aliasSpec);
            console.log(`Created new AppBundle: ${qualifiedBundleId}`);
        } else {
            const appBundleSpec = { engine: engineName, description: bundleName };
            newAppVersion = await api.createAppBundleVersion(bundleName, appBundleSpec);
            const aliasSpec = { version: newAppVersion.version };
            await api.modifyAppBundleAlias(bundleName, SetupUtils.Alias, aliasSpec);
            console.log(`Updated AppBundle to version ${newAppVersion.version}`);
        }

        // Upload the ZIP file
        const formData = require('form-data');
        const form = new formData();
        const uploadParams = newAppVersion.uploadParameters;
        Object.keys(uploadParams.formData).forEach(key => {
            form.append(key, uploadParams.formData[key]);
        });
        form.append('file', fs.createReadStream(zipPath));

        const https = require('https');
        const url = require('url');
        const urlInfo = url.parse(uploadParams.endpointURL);
        const contentLength = await new Promise((resolve, reject) => {
            form.getLength((err, length) => err ? reject(err) : resolve(length));
        });
        const headers = form.getHeaders();
        headers['Content-Length'] = contentLength;
        headers['Cache-Control'] = 'no-cache';
        await new Promise((resolve, reject) => {
            const uploadReq = https.request({
                host: urlInfo.host,
                path: urlInfo.pathname,
                method: 'POST',
                headers: headers
            }, response => {
                if (response.statusCode >= 200 && response.statusCode < 300) resolve();
                else reject(new Error(`Upload failed with status ${response.statusCode}`));
            });
            form.pipe(uploadReq);
        });

        logActivity('setup:bundle:created', {
            title: 'UpdateModel Bundle Registered',
            message: `Registered ${bundleName} version ${newAppVersion.version}`,
            details: { bundleId: qualifiedBundleId, version: newAppVersion.version }
        });

        res.json({
            success: true,
            bundleId: qualifiedBundleId,
            version: newAppVersion.version,
            message: 'UpdateModel AppBundle registered successfully'
        });
    } catch (error) {
        console.error('Error registering UpdateModel bundle:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/update-model-activity
 * Create the UpdateModel Activity (combined IPT regen + DWG export)
 * 5 parameters: inputFile, inputDwg, inputJson, outputFile, outputDwg
 */
router.post('/update-model-activity', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const activityName = 'UpdateModelActivity';
        const bundleName = 'UpdateModelBundle';
        const engineName = 'Autodesk.Inventor+2024';

        const activities = await api.getActivities();
        const qualifiedActivityId = `${SetupUtils.NickName}.${activityName}+${SetupUtils.Alias}`;

        if (activities.data.includes(qualifiedActivityId)) {
            return res.json({
                success: true,
                activityId: qualifiedActivityId,
                message: 'UpdateModel Activity already exists'
            });
        }

        const activitySpec = {
            id: activityName,
            appbundles: [`${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`],
            commandLine: [
                '$(engine.path)\\InventorCoreConsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[UpdateModelBundle].path)"'
            ],
            engine: engineName,
            parameters: {
                inputFile: {
                    description: 'Input Inventor file (IPT or IAM)',
                    localName: 'input.ipt',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                inputDwg: {
                    description: 'Input Inventor Drawing (.idw) that references the model',
                    localName: 'input.idw',
                    ondemand: false,
                    required: false,
                    verb: dav3.Verb.get,
                    zip: false
                },
                inputJson: {
                    description: 'JSON file with parameter values to apply',
                    localName: 'params.json',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                outputFile: {
                    description: 'Output regenerated Inventor file',
                    localName: 'output.ipt',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.put,
                    zip: false
                },
                outputDwg: {
                    description: 'Output DWG drawing exported from Inventor Drawing',
                    localName: 'output.dwg',
                    ondemand: false,
                    required: false,
                    verb: dav3.Verb.put,
                    zip: false
                }
            }
        };

        await api.createActivity(activitySpec);
        const aliasSpec = { id: SetupUtils.Alias, version: 1 };
        await api.createActivityAlias(activityName, aliasSpec);

        logActivity('setup:activity:created', {
            title: 'UpdateModel Activity Created',
            message: `Created ${activityName} for combined IPT regen + DWG export`,
            details: { activityId: qualifiedActivityId, engine: engineName }
        });

        res.json({
            success: true,
            activityId: qualifiedActivityId,
            message: 'UpdateModel Activity created successfully'
        });
    } catch (error) {
        console.error('Error creating UpdateModel activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/update-dwg-bundle
 * Register the UpdateDWGParam AppBundle with APS (AutoCAD engine)
 * Updates dynamic block parameters in .dwg files
 */
router.post('/update-dwg-bundle', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const bundleName = 'UpdateDWGParamAppBundle';
        const engineName = 'Autodesk.AutoCAD+25_1';
        const bundleDir = path.join(__dirname, '../../bundles/UpdateDWGParam/UpdateDWGParam.bundle');
        const zipPath = path.join(__dirname, '../../bundles/UpdateDWGParam/UpdateDWGParamAppBundle.zip');

        if (!fs.existsSync(zipPath)) {
            // Auto-create the zip from the bundle folder
            if (!fs.existsSync(bundleDir)) {
                return res.status(400).json({
                    success: false,
                    error: 'UpdateDWGParam bundle folder not found at: ' + bundleDir
                });
            }
            const archiver = require('archiver');
            await new Promise((resolve, reject) => {
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });
                output.on('close', resolve);
                archive.on('error', reject);
                archive.pipe(output);
                // Add PackageContents.xml at root
                archive.file(path.join(bundleDir, 'PackageContents.xml'), { name: 'PackageContents.xml' });
                // Add DLL files in Contents/
                const contentsDir = path.join(bundleDir, 'Contents');
                if (fs.existsSync(contentsDir)) {
                    archive.directory(contentsDir, 'Contents');
                }
                archive.finalize();
            });
            console.log(`Created ${zipPath}`);
        }

        // Check if bundle already exists
        const appBundles = await api.getAppBundles();
        const qualifiedBundleId = `${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`;

        let newAppVersion;
        if (!appBundles.data.includes(qualifiedBundleId)) {
            const appBundleSpec = dav3.AppBundle.constructFromObject({
                package: bundleName,
                engine: engineName,
                id: bundleName,
                description: 'Updates dynamic block parameters in AutoCAD DWG files'
            });
            newAppVersion = await api.createAppBundle(appBundleSpec);
            const aliasSpec = { id: SetupUtils.Alias, version: 1 };
            await api.createAppBundleAlias(bundleName, aliasSpec);
            console.log(`Created new AppBundle: ${qualifiedBundleId}`);
        } else {
            const appBundleSpec = { engine: engineName, description: bundleName };
            newAppVersion = await api.createAppBundleVersion(bundleName, appBundleSpec);
            const aliasSpec = { version: newAppVersion.version };
            await api.modifyAppBundleAlias(bundleName, SetupUtils.Alias, aliasSpec);
            console.log(`Updated AppBundle to version ${newAppVersion.version}`);
        }

        // Upload the ZIP file
        const formData = require('form-data');
        const form = new formData();
        const uploadParams = newAppVersion.uploadParameters;
        Object.keys(uploadParams.formData).forEach(key => {
            form.append(key, uploadParams.formData[key]);
        });
        form.append('file', fs.createReadStream(zipPath));

        const https = require('https');
        const url = require('url');
        const urlInfo = url.parse(uploadParams.endpointURL);
        await new Promise((resolve, reject) => {
            const uploadReq = https.request({
                host: urlInfo.host,
                path: urlInfo.pathname,
                method: 'POST',
                headers: form.getHeaders()
            }, response => {
                if (response.statusCode >= 200 && response.statusCode < 300) resolve();
                else reject(new Error(`Upload failed with status ${response.statusCode}`));
            });
            form.pipe(uploadReq);
        });

        logActivity('setup:bundle:created', {
            title: 'UpdateDWGParam Bundle Registered',
            message: `Registered ${bundleName} version ${newAppVersion.version}`,
            details: { bundleId: qualifiedBundleId, version: newAppVersion.version }
        });

        res.json({
            success: true,
            bundleId: qualifiedBundleId,
            version: newAppVersion.version,
            message: 'UpdateDWGParam AppBundle registered successfully'
        });
    } catch (error) {
        console.error('Error registering UpdateDWGParam bundle:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/update-dwg-activity
 * Create the UpdateDWGParam Activity (AutoCAD engine)
 * 3 parameters: inputFile (.dwg), inputJson (params), outputFile (.dwg)
 */
router.post('/update-dwg-activity', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        const activityName = 'UpdateDWGParamActivity';
        const bundleName = 'UpdateDWGParamAppBundle';
        const engineName = 'Autodesk.AutoCAD+25_1';

        const activities = await api.getActivities();
        const qualifiedActivityId = `${SetupUtils.NickName}.${activityName}+${SetupUtils.Alias}`;

        if (activities.data.includes(qualifiedActivityId)) {
            return res.json({
                success: true,
                activityId: qualifiedActivityId,
                message: 'UpdateDWGParam Activity already exists'
            });
        }

        const activitySpec = {
            id: activityName,
            appbundles: [`${SetupUtils.NickName}.${bundleName}+${SetupUtils.Alias}`],
            commandLine: [
                '$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[UpdateDWGParamAppBundle].path)" /s "$(settings[script].path)"'
            ],
            engine: engineName,
            settings: {
                script: {
                    value: 'UpdateParam\n'
                }
            },
            parameters: {
                inputFile: {
                    description: 'Input AutoCAD DWG file',
                    localName: 'input.dwg',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                inputJson: {
                    description: 'JSON file with parameter values to apply',
                    localName: 'params.json',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                outputFile: {
                    description: 'Output updated DWG file',
                    localName: 'output.dwg',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.put,
                    zip: false
                }
            }
        };

        await api.createActivity(activitySpec);
        const aliasSpec = { id: SetupUtils.Alias, version: 1 };
        await api.createActivityAlias(activityName, aliasSpec);

        logActivity('setup:activity:created', {
            title: 'UpdateDWGParam Activity Created',
            message: `Created ${activityName} for AutoCAD DWG parameter updates`,
            details: { activityId: qualifiedActivityId, engine: engineName }
        });

        res.json({
            success: true,
            activityId: qualifiedActivityId,
            message: 'UpdateDWGParam Activity created successfully'
        });
    } catch (error) {
        console.error('Error creating UpdateDWGParam activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/upload-sample-file
 * Upload the sample IPT file to OSS
 */
router.post('/upload-sample-file', async (req, res) => {
    try {
        const oauth = await getInternalToken();
        const objectsApi = new ForgeAPI.ObjectsApi();
        const bucketsApi = new ForgeAPI.BucketsApi();

        // Get bucket key from settings or use default
        const settingsPath = path.join(__dirname, '../data/settings.json');
        let bucketKey = 'sydeflow-models';
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            bucketKey = settings.bucketKey || bucketKey;
        }

        // Ensure bucket exists
        try {
            await bucketsApi.createBucket({
                bucketKey: bucketKey,
                policyKey: 'transient'
            }, {}, oauth.client, oauth.credentials);
            console.log(`Created bucket: ${bucketKey}`);
        } catch (e) {
            // Bucket may already exist
            console.log(`Bucket ${bucketKey} already exists or error:`, e.message);
        }

        // Read the sample file
        const sampleFilePath = path.join(__dirname, '../../3D Model Files/Test Sample/inventor_sample_file.ipt');
        if (!fs.existsSync(sampleFilePath)) {
            return res.status(400).json({
                success: false,
                error: 'Sample file not found at: ' + sampleFilePath
            });
        }

        const fileBuffer = fs.readFileSync(sampleFilePath);
        const fileName = 'inventor_sample_file.ipt';
        const objectKey = `custom-box-${Date.now()}.ipt`;

        // Upload to OSS
        const uploadResult = await objectsApi.uploadResources(
            bucketKey,
            [{
                objectKey: objectKey,
                data: fileBuffer,
                length: fileBuffer.length
            }],
            { useAcceleration: false, minutesExpiration: 60 },
            oauth.client, oauth.credentials
        );

        if (uploadResult[0].error) {
            throw new Error(uploadResult[0].completed.reason);
        }

        const objectId = uploadResult[0].completed.objectId;
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

        logActivity('setup:file:uploaded', {
            title: 'Sample File Uploaded',
            message: `Uploaded ${fileName} to OSS`,
            details: { bucketKey, objectKey, urn }
        });

        res.json({
            success: true,
            bucketKey,
            objectKey,
            objectId,
            urn,
            message: 'Sample file uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading sample file:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/run-all
 * Run all setup steps in sequence
 */
router.post('/run-all', async (req, res) => {
    const results = {
        steps: [],
        success: true
    };

    try {
        // Step 1: Register ExtractParams Bundle
        console.log('Step 1: Registering ExtractParams Bundle...');
        const bundleRes = await fetch('http://localhost:8080/api/setup/extract-params-bundle', { method: 'POST' });
        const bundleData = await bundleRes.json();
        results.steps.push({ step: 'ExtractParams Bundle', ...bundleData });
        if (!bundleData.success && !bundleData.message?.includes('already')) {
            results.success = false;
        }

        // Step 2: Create ExtractParams Activity
        console.log('Step 2: Creating ExtractParams Activity...');
        const activityRes = await fetch('http://localhost:8080/api/setup/extract-params-activity', { method: 'POST' });
        const activityData = await activityRes.json();
        results.steps.push({ step: 'ExtractParams Activity', ...activityData });
        if (!activityData.success) {
            results.success = false;
        }

        // Step 3: Upload Sample File
        console.log('Step 3: Uploading sample file to OSS...');
        const uploadRes = await fetch('http://localhost:8080/api/setup/upload-sample-file', { method: 'POST' });
        const uploadData = await uploadRes.json();
        results.steps.push({ step: 'Upload Sample File', ...uploadData });
        if (!uploadData.success) {
            results.success = false;
        }

        // Step 4: Register UpdateIPTParam Bundle (if exists)
        console.log('Step 4: Checking UpdateIPTParam Bundle...');
        const updateBundlePath = path.join(SetupUtils.BundlesFolder, '..', '..', 'bundles', 'UpdateIPTParam.zip');
        if (fs.existsSync(updateBundlePath)) {
            // This would need the bundle to be in the server/bundles folder
            results.steps.push({ step: 'UpdateIPTParam Bundle', message: 'Bundle exists, manual registration may be needed' });
        }

        // Step 5: Create UpdateIPTParam Activity
        console.log('Step 5: Creating UpdateIPTParam Activity...');
        const updateActivityRes = await fetch('http://localhost:8080/api/setup/update-ipt-activity', { method: 'POST' });
        const updateActivityData = await updateActivityRes.json();
        results.steps.push({ step: 'UpdateIPTParam Activity', ...updateActivityData });

        // Step 6: Register UpdateModel Bundle (combined IPT + DWG)
        console.log('Step 6: Registering UpdateModel Bundle...');
        try {
            const modelBundleRes = await fetch('http://localhost:8080/api/setup/update-model-bundle', { method: 'POST' });
            const modelBundleData = await modelBundleRes.json();
            results.steps.push({ step: 'UpdateModel Bundle', ...modelBundleData });
        } catch (e) {
            results.steps.push({ step: 'UpdateModel Bundle', success: false, error: e.message });
        }

        // Step 7: Create UpdateModel Activity (combined IPT + DWG)
        console.log('Step 7: Creating UpdateModel Activity...');
        try {
            const modelActivityRes = await fetch('http://localhost:8080/api/setup/update-model-activity', { method: 'POST' });
            const modelActivityData = await modelActivityRes.json();
            results.steps.push({ step: 'UpdateModel Activity', ...modelActivityData });
        } catch (e) {
            results.steps.push({ step: 'UpdateModel Activity', success: false, error: e.message });
        }

        // Step 8: Register UpdateDWGParam Bundle (AutoCAD engine)
        console.log('Step 8: Registering UpdateDWGParam Bundle...');
        try {
            const dwgBundleRes = await fetch('http://localhost:8080/api/setup/update-dwg-bundle', { method: 'POST' });
            const dwgBundleData = await dwgBundleRes.json();
            results.steps.push({ step: 'UpdateDWGParam Bundle', ...dwgBundleData });
        } catch (e) {
            results.steps.push({ step: 'UpdateDWGParam Bundle', success: false, error: e.message });
        }

        // Step 9: Create UpdateDWGParam Activity (AutoCAD engine)
        console.log('Step 9: Creating UpdateDWGParam Activity...');
        try {
            const dwgActivityRes = await fetch('http://localhost:8080/api/setup/update-dwg-activity', { method: 'POST' });
            const dwgActivityData = await dwgActivityRes.json();
            results.steps.push({ step: 'UpdateDWGParam Activity', ...dwgActivityData });
        } catch (e) {
            results.steps.push({ step: 'UpdateDWGParam Activity', success: false, error: e.message });
        }

        res.json(results);
    } catch (error) {
        console.error('Error in setup:', error);
        results.success = false;
        results.error = error.message;
        res.status(500).json(results);
    }
});

/**
 * GET /api/setup/status
 * Check current setup status
 */
router.get('/status', async (req, res) => {
    try {
        const api = await SetupUtils.getDAv3Api();
        
        // Get bundles and activities
        const [bundlesRes, activitiesRes] = await Promise.all([
            api.getAppBundles(),
            api.getActivities()
        ]);

        const myBundles = bundlesRes.data.filter(b => 
            b.startsWith(SetupUtils.NickName) && !b.includes('$LATEST')
        );
        const myActivities = activitiesRes.data.filter(a => 
            a.startsWith(SetupUtils.NickName) && !a.includes('$LATEST')
        );

        const extractBundleExists = myBundles.some(b => b.includes('ExtractParamsBundle'));
        const extractActivityExists = myActivities.some(a => a.includes('ExtractParamsActivity'));
        const updateActivityExists = myActivities.some(a => a.includes('UpdateIPTParamActivity'));
        const updateModelBundleExists = myBundles.some(b => b.includes('UpdateModelBundle'));
        const updateModelActivityExists = myActivities.some(a => a.includes('UpdateModelActivity'));
        const updateDwgBundleExists = myBundles.some(b => b.includes('UpdateDWGParamAppBundle'));
        const updateDwgActivityExists = myActivities.some(a => a.includes('UpdateDWGParamActivity'));

        res.json({
            success: true,
            bundles: myBundles,
            activities: myActivities,
            status: {
                extractParamsBundle: extractBundleExists,
                extractParamsActivity: extractActivityExists,
                updateIPTParamActivity: updateActivityExists,
                updateModelBundle: updateModelBundleExists,
                updateModelActivity: updateModelActivityExists,
                updateDwgBundle: updateDwgBundleExists,
                updateDwgActivity: updateDwgActivityExists
            },
            ready: extractBundleExists && extractActivityExists,
            modelReady: updateModelBundleExists && updateModelActivityExists,
            dwgReady: updateDwgBundleExists && updateDwgActivityExists
        });
    } catch (error) {
        console.error('Error checking setup status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

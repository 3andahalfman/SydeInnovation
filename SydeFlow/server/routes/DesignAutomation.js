const _path = require('path');
const _fs = require('fs');
const _url = require('url');
const express = require('express');
//const http = require('http');
const http = require('https');
const formdata = require('form-data');
const bodyParser = require('body-parser');
const multer = require('multer');
const router = express.Router();
const { getClient } = require('./common/oauth');
const config = require('../config');
const dav3 = require('autodesk.forge.designautomation');
const ForgeAPI = require('forge-apis');

// Import activity logger
let logActivity;
try {
    const ActivityLog = require('./ActivityLog');
    logActivity = ActivityLog.logActivity;
} catch (e) {
    logActivity = (type, data) => console.log(`Activity: ${type}`, data);
}

router.use(bodyParser.json());

/// <summary>
/// Get access token for the Autodesk Viewer
/// </summary>
router.get('/auth/token', async (req, res) => {
    try {
        console.log('Token endpoint called, requesting scopes:', config.scopes.public);
        let client = await getClient(config.scopes.public);
        if (!client) {
            return res.status(503).json({ 
                diagnostic: 'APS not connected - check credentials in Settings',
                apsConnected: false
            });
        }
        let credentials = client.getCredentials();
        console.log('Token obtained with scopes for viewer');
        res.json({
            access_token: credentials.access_token,
            expires_in: credentials.expires_in
        });
    } catch (ex) {
        console.error('Token endpoint error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get viewer token: ' + ex.message });
    }
});

// Middleware for obtaining a token for each request.
router.use(async (req, res, next) => {
    console.log('OAuth middleware called for:', req.path);
    try {
        req.oauth_client = await getClient(/*config.scopes.internal*/);
        if (!req.oauth_client) {
            console.log('OAuth client is null');
            return res.status(503).json({ 
                diagnostic: 'APS not connected - check credentials in Settings',
                apsConnected: false
            });
        }
        req.oauth_token = req.oauth_client.getCredentials();
        console.log('OAuth token obtained');
        next();
    } catch (err) {
        console.error('OAuth middleware error:', err);
        res.status(500).json({ diagnostic: 'OAuth error: ' + err.message });
    }
});

/// <summary>
/// Get translation status for a URN
/// </summary>
router.get('/translation/:urn', async (req, res) => {
    try {
        const urn = req.params.urn;
        const derivativesApi = new ForgeAPI.DerivativesApi();
        const manifest = await derivativesApi.getManifest(urn, {}, req.oauth_client, req.oauth_token);
        
        res.json({
            status: manifest.body.status,
            progress: manifest.body.progress,
            urn: urn
        });
    } catch (ex) {
        // Return 404 when no manifest exists (model not yet translated)
        if (ex.statusCode === 404 || (ex.message && ex.message.includes('404'))) {
            return res.status(404).json({ status: 'not_found', diagnostic: 'No translation manifest found for this URN' });
        }
        // Return 403 when model belongs to a different APS account / credentials mismatch
        if (ex.statusCode === 403 || (ex.message && ex.message.includes('403'))) {
            return res.status(403).json({ status: 'forbidden', diagnostic: 'Model not accessible — it may belong to a different APS account. Re-run automation to regenerate.' });
        }
        console.error('Translation status error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get translation status: ' + ex.message });
    }
});

/// <summary>
/// Upload file for direct viewing (without Design Automation)
/// </summary>
const ALLOWED_EXTENSIONS = ['.ipt', '.iam', '.idw', '.dwg', '.dwf', '.pdf', '.zip'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const uploadMiddleware = multer({
    dest: 'uploads/',
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = _path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new Error(`File type ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
        }
        cb(null, true);
    }
}).single('file');

async function handleOssUpload(req, res) {
    try {
        console.log('Upload endpoint called for file:', req.file ? req.file.originalname : 'no file');
        
        if (!req.file) {
            return res.status(400).json({ diagnostic: 'No file uploaded' });
        }

        // Sanitize filename - only allow alphanumeric, dots, hyphens, underscores
        const safeName = _path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');

        // Use provided bucket or fall back to default
        const bucketKey = req.body.bucketKey || (config.credentials.client_id.toLowerCase() + '-designautomation');
        console.log('Uploading to bucket:', bucketKey);
        
        // Check if bucket exists, create only if using default bucket
        if (!req.body.bucketKey) {
            try {
                let payload = new ForgeAPI.PostBucketsPayload();
                payload.bucketKey = bucketKey;
                payload.policyKey = 'transient';
                await new ForgeAPI.BucketsApi().createBucket(payload, {}, req.oauth_client, req.oauth_token);
            } catch (ex) {
                // Bucket might already exist, continue
            }
        }

        // Upload file - use sanitized filename
        const objectKey = safeName;
        
        // Upload to OSS
        let contentStream = _fs.createReadStream(req.file.path);
        let uploadResponse = await new ForgeAPI.ObjectsApi().uploadResources(
            bucketKey,
            [{
                objectKey: objectKey,
                data: contentStream,
                length: req.file.size
            }],
            {
                useAcceleration: false,
                minutesExpiration: 60
            },
            req.oauth_client, req.oauth_token
        );

        if (uploadResponse[0].hasOwnProperty('error') && uploadResponse[0].error) {
            throw new Error(uploadResponse[0].completed.reason);
        }

        const objectId = uploadResponse[0].completed.objectId;
        console.log('File uploaded, objectId:', objectId);

        // Convert objectId to base64 URN for Model Derivative
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
        console.log('Starting translation for URN:', urn);

        // Trigger Model Derivative translation
        const derivativesApi = new ForgeAPI.DerivativesApi();
        const job = {
            input: {
                urn: urn
            },
            output: {
                formats: [
                    {
                        type: 'svf',
                        views: ['2d', '3d']
                    }
                ]
            }
        };

        try {
            await derivativesApi.translate(job, {}, req.oauth_client, req.oauth_token);
            console.log('Translation job started');
        } catch (ex) {
            // Translation might already be in progress or complete
            console.log('Translation status:', ex.statusCode);
        }

        // Clean up temp file
        _fs.unlinkSync(req.file.path);

        console.log('Returning URN for viewer');
        res.json({
            urn: urn,
            objectId: objectId,
            bucketKey: bucketKey,
            objectKey: objectKey
        });
    } catch (ex) {
        console.error('Upload error:', ex);
        res.status(500).json({ diagnostic: 'Failed to upload file: ' + ex.message });
    }
}

function withUploadMiddleware(handler) {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err) return res.status(400).json({ diagnostic: err.message });
            handler(req, res, next);
        });
    };
}

router.post('/upload', withUploadMiddleware(handleOssUpload));
// Frontend (DesignAutomationView) calls /api/aps/upload
router.post('/aps/upload', withUploadMiddleware(handleOssUpload));

// Static instance of the DA API
let dav3Instance = null;

class Utils {

    static async Instance() {
        if (dav3Instance === null) {
            // Here it is ok to not await since we awaited in the call router.use()
            dav3Instance = new dav3.AutodeskForgeDesignAutomationClient(config.client);
            let FetchRefresh = async (data) => { // data is undefined in a fetch, but contains the old credentials in a refresh
                let client = await getClient();
                let credentials = client.getCredentials();
                // The line below is for testing
                //credentials.expires_in = 30; credentials.expires_at = new Date(Date.now() + credentials.expires_in * 1000);
                return (credentials);
            };
            dav3Instance.authManager.authentications['2-legged'].fetchToken = FetchRefresh;
            dav3Instance.authManager.authentications['2-legged'].refreshToken = FetchRefresh;
        }
        return (dav3Instance);
    }

    /// <summary>
    /// Returns the directory where bindles are stored on the local machine.
    /// </summary>
    static get LocalBundlesFolder() {
        // Prefer server/bundles (deploy root on Railway). Fall back to repo-level
        // SydeFlow/bundles for local monorepo layouts.
        const serverBundles = _path.resolve(_path.join(__dirname, '../bundles'));
        const repoBundles = _path.resolve(_path.join(__dirname, '../../bundles'));
        if (_fs.existsSync(serverBundles)) return serverBundles;
        return repoBundles;
    }

    /// <summary>
    /// Prefix for AppBundles and Activities
    /// </summary>
    static get NickName() {
        return (config.credentials.client_id);
    }

    /// <summary>
    /// Alias for the app (e.g. DEV, STG, PROD). This value may come from an environment variable
    /// </summary>
    static get Alias() {
        return ('dev');
    }

    /// <summary>
    /// Search files in a folder and filter them.
    /// </summary>
    static async findFiles(dir, filter) {
        return (new Promise((fulfill, reject) => {
            _fs.readdir(dir, (err, files) => {
                if (err)
                    return (reject(err));
                if (filter !== undefined && typeof filter === 'string')
                    files = files.filter((file) => {
                        return (_path.extname(file) === filter);
                    });
                else if (filter !== undefined && typeof filter === 'object')
                    files = files.filter((file) => {
                        return (filter.test(file));
                    });
                fulfill(files);
            });
        }));
    }

    /// <summary>
    /// Create a new DAv3 client/API with default settings
    /// </summary>
    static async dav3API(oauth2) {
        // There is 2 alternatives to setup an API instance, providing the access_token directly
        // let apiClient2 = new dav3.AutodeskForgeDesignAutomationClient(/*config.client*/);
        // apiClient2.authManager.authentications['2-legged'].accessToken = oauth2.access_token;
        //return (new dav3.AutodeskForgeDesignAutomationApi(apiClient));

        // Or use the Auto-Refresh feature
        let apiClient = await Utils.Instance();
        return (new dav3.AutodeskForgeDesignAutomationApi(apiClient));
    }

    /// <summary>
    /// Helps identify the engine
    /// </summary>
    static EngineAttributes(engine) {
        if (engine.includes('3dsMax'))
            return ({
                commandLine: '$(engine.path)\\3dsmaxbatch.exe -sceneFile "$(args[inputFile].path)" "$(settings[script].path)"',
                extension: 'max',
                script: "da = dotNetClass(\'Autodesk.Forge.Sample.DesignAutomation.Max.RuntimeExecute\')\nda.ModifyWindowWidthHeight()\n"
            });
        if (engine.includes('AutoCAD'))
            return ({
                commandLine: '$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[{0}].path)" /s "$(settings[script].path)"',
                extension: 'dwg',
                script: "UpdateParam\n"
            });
        if (engine.includes('Inventor'))
            return ({
                commandLine: '$(engine.path)\\InventorCoreConsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[{0}].path)"',
                extension: 'ipt',
                script: ''
            });
        if (engine.includes('Revit'))
            return ({
                commandLine: '$(engine.path)\\revitcoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[{0}].path)"',
                extension: 'rvt',
                script: ''
            });

        throw new Error('Invalid engine');
    }

    static FormDataLength(form) {
        return (new Promise((fulfill, reject) => {
            form.getLength((err, length) => {
                if (err)
                    return (reject(err));
                fulfill(length);
            });
        }));
    }

    /// <summary>
    /// Upload a file
    /// </summary>
    static uploadFormDataWithFile(filepath, endpoint, params = null) {
        return (new Promise(async (fulfill, reject) => {
            const fileStream = _fs.createReadStream(filepath);

            const form = new formdata();
            if (params) {
                const keys = Object.keys(params);
                for (let i = 0; i < keys.length; i++)
                    form.append(keys[i], params[keys[i]]);
            }
            form.append('file', fileStream);

            let headers = form.getHeaders();
            headers['Cache-Control'] = 'no-cache';
            headers['Content-Length'] = await Utils.FormDataLength(form);

            const urlinfo = _url.parse(endpoint);
            const postReq = http.request({
                host: urlinfo.host,
                port: (urlinfo.port || (urlinfo.protocol === 'https:' ? 443 : 80)),
                path: urlinfo.pathname,
                method: 'POST',
                headers: headers
            },
                response => {
                    fulfill(response.statusCode);
                },
                err => {
                    reject(err);
                }
            );

            form.pipe(postReq);
        }));
    }
}

/// <summary>
/// Names of app bundles on this project (local zip packages and bundle folders)
/// </summary>
router.get('/appbundles', async /*GetLocalBundles*/(req, res) => {
    // Local packages live under SydeFlow/bundles. On some hosts the folder may be
    // missing or only contain unpacked .bundle dirs — never 500 the admin UI.
    try {
        const folder = Utils.LocalBundlesFolder;
        if (!_fs.existsSync(folder)) {
            return res.json([]);
        }

        const entries = await Utils.findFiles(folder);
        const names = new Set();

        for (const entry of entries) {
            if (_path.extname(entry) === '.zip') {
                names.add(_path.basename(entry, '.zip'));
                continue;
            }
            // Unpacked bundle folders (e.g. UpdateIPTParam/) are selectable too
            const full = _path.join(folder, entry);
            try {
                if (_fs.statSync(full).isDirectory()) {
                    const kids = _fs.readdirSync(full);
                    if (kids.some((k) => k.endsWith('.bundle') || k.endsWith('.zip'))) {
                        names.add(entry);
                    }
                }
            } catch (_) { /* ignore */ }
        }

        res.json([...names].sort());
    } catch (ex) {
        console.error('Error listing local appbundles:', ex);
        res.json([]);
    }
});

/// <summary>
/// Get registered AppBundles from APS Design Automation
/// </summary>
router.get('/aps/appbundles', async (req, res) => {
    try {
        const api = await Utils.dav3API(req.oauth_token);
        let allBundles = [];
        let paginationToken = null;
        
        while (true) {
            let bundles = await api.getAppBundles({ 'page': paginationToken });
            allBundles = allBundles.concat(bundles.data);
            if (bundles.paginationToken == null) break;
            paginationToken = bundles.paginationToken;
        }
        
        // Filter to only show bundles belonging to this account
        const myBundles = allBundles.filter(b => 
            b.startsWith(Utils.NickName) && !b.includes('$LATEST')
        ).map(b => b.replace(Utils.NickName + '.', ''));
        
        res.json(myBundles);
    } catch (ex) {
        console.error('Error fetching appbundles:', ex);
        res.status(500).json({ error: 'Failed to fetch app bundles' });
    }
});

/// <summary>
/// Alias used by BundlesView: POST /api/aps/appbundles (JSON or multipart zip upload)
/// </summary>
router.post('/aps/appbundles', multer({ dest: 'uploads/' }).single('zipFile'), async (req, res) => {
    try {
        let zipFileName = req.body.zipFileName || req.body.id;
        const engine = req.body.engine || 'Autodesk.Inventor+2024';

        if (req.file) {
            zipFileName = (zipFileName || _path.basename(req.file.originalname, '.zip'))
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            if (!_fs.existsSync(Utils.LocalBundlesFolder)) {
                _fs.mkdirSync(Utils.LocalBundlesFolder, { recursive: true });
            }
            const dest = _path.join(Utils.LocalBundlesFolder, `${zipFileName}.zip`);
            _fs.renameSync(req.file.path, dest);
        }

        if (!zipFileName) {
            return res.status(400).json({ diagnostic: 'Missing zipFileName/id (and optional zipFile)' });
        }

        // Ensure a zip exists (zip unpacked bundle folders on demand)
        const packageZipPath = _path.join(Utils.LocalBundlesFolder, zipFileName + '.zip');
        if (!_fs.existsSync(packageZipPath)) {
            const folderPath = _path.join(Utils.LocalBundlesFolder, zipFileName);
            if (_fs.existsSync(folderPath) && _fs.statSync(folderPath).isDirectory()) {
                const archiver = require('archiver');
                await new Promise((resolve, reject) => {
                    const output = _fs.createWriteStream(packageZipPath);
                    const archive = archiver('zip', { zlib: { level: 9 } });
                    output.on('close', resolve);
                    archive.on('error', reject);
                    archive.pipe(output);
                    archive.directory(folderPath, false);
                    archive.finalize();
                });
            } else {
                return res.status(404).json({
                    diagnostic: `Local bundle package not found: ${zipFileName}.zip`
                });
            }
        }

        req.body = { zipFileName, engine };
        req.url = '/aps/designautomation/appbundles';
        return router.handle(req, res);
    } catch (ex) {
        console.error('Alias create appbundle error:', ex);
        if (req.file?.path && _fs.existsSync(req.file.path)) {
            try { _fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
        }
        res.status(500).json({ diagnostic: 'Failed to create app bundle: ' + ex.message });
    }
});

/// <summary>
/// Alias used by BundlesView: DELETE /api/aps/appbundles/:id
/// </summary>
router.delete('/aps/appbundles/:id', async (req, res) => {
    try {
        let bundleId = decodeURIComponent(req.params.id || '');
        // Accept qualified or short names: Nickname.Foo+dev → Foo
        if (bundleId.includes('.')) {
            bundleId = bundleId.split('.').pop();
        }
        bundleId = bundleId.replace(/\+.*$/, '');

        if (!bundleId) {
            return res.status(400).json({ diagnostic: 'Missing app bundle id' });
        }

        const api = await Utils.dav3API(req.oauth_token);
        await api.deleteAppBundle(bundleId);

        logActivity('da:bundle:deleted', {
            title: 'AppBundle Deleted',
            message: `Deleted AppBundle "${bundleId}"`,
            details: { appBundleId: bundleId }
        });

        res.json({ success: true, deleted: bundleId });
    } catch (ex) {
        console.error('Delete appbundle error:', ex);
        res.status(500).json({ diagnostic: 'Failed to delete app bundle: ' + (ex.message || ex) });
    }
});

/// <summary>
/// Get registered Activities from APS Design Automation (alias for frontend compatibility)
/// </summary>
router.get('/aps/activities', async (req, res) => {
    try {
        const api = await Utils.dav3API(req.oauth_token);
        let activities = await api.getActivities();
        
        // Filter to only show activities belonging to this account
        const myActivities = activities.data.filter(a => 
            a.startsWith(Utils.NickName) && !a.includes('$LATEST')
        ).map(a => a.replace(Utils.NickName + '.', ''));
        
        res.json(myActivities);
    } catch (ex) {
        console.error('Error fetching activities:', ex);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

/// <summary>
/// Return a list of available engines
/// </summary>
router.get('/aps/designautomation/engines', async /*GetAvailableEngines*/(req, res) => {
    let that = this;
    let Allengines = [];
    let paginationToken = null;
    try {
        const api = await Utils.dav3API(req.oauth_token);
        while (true) {
            let engines = await api.getEngines({ 'page': paginationToken });
            Allengines = Allengines.concat(engines.data)
            if (engines.paginationToken == null) break;
            paginationToken = engines.paginationToken;
        }
        res.json(Allengines.sort()); // return list of engines
    } catch (ex) {
        console.error(ex);
        res.json([]);
    }

});

/// <summary>
/// Define a new appbundle
/// </summary>
router.post('/aps/designautomation/appbundles', async /*CreateAppBundle*/(req, res) => {
    const appBundleSpecs = req.body;

    // basic input validation
    const zipFileName = appBundleSpecs.zipFileName;
    const engineName = appBundleSpecs.engine;

    // standard name for this sample
    const appBundleName = zipFileName + 'AppBundle';

    // check if ZIP with bundle is here (zip unpacked folders on demand)
    const packageZipPath = _path.join(Utils.LocalBundlesFolder, zipFileName + '.zip');
    if (!_fs.existsSync(packageZipPath)) {
        const folderPath = _path.join(Utils.LocalBundlesFolder, zipFileName);
        if (_fs.existsSync(folderPath) && _fs.statSync(folderPath).isDirectory()) {
            try {
                const archiver = require('archiver');
                await new Promise((resolve, reject) => {
                    const output = _fs.createWriteStream(packageZipPath);
                    const archive = archiver('zip', { zlib: { level: 9 } });
                    output.on('close', resolve);
                    archive.on('error', reject);
                    archive.pipe(output);
                    archive.directory(folderPath, false);
                    archive.finalize();
                });
            } catch (zipEx) {
                console.error('Failed to zip local bundle folder:', zipEx);
                return res.status(500).json({
                    diagnostic: `Bundle zip missing and failed to pack folder: ${zipFileName}`
                });
            }
        }
    }

    // get defined app bundles
    const api = await Utils.dav3API(req.oauth_token);
    let appBundles = null;
    try {
        appBundles = await api.getAppBundles();
    } catch (ex) {
        console.error(ex);
        return (res.status(500).json({
            diagnostic: 'Failed to get the Bundle list'
        }));
    }
    // check if app bundle is already define
    let newAppVersion = null;
    const qualifiedAppBundleId = `${Utils.NickName}.${appBundleName}+${Utils.Alias}`;
    if (!appBundles.data.includes(qualifiedAppBundleId)) {
        // create an appbundle (version 1)
        // const appBundleSpec = {
        //         package: appBundleName,
        //         engine: engineName,
        //         id: appBundleName,
        //         description: `Description for ${appBundleName}`
        //     };
        const appBundleSpec = dav3.AppBundle.constructFromObject({
            package: appBundleName,
            engine: engineName,
            id: appBundleName,
            description: `Description for ${appBundleName}`
        });
        try {
            newAppVersion = await api.createAppBundle(appBundleSpec);
        } catch (ex) {
            console.error(ex);
            return (res.status(500).json({
                diagnostic: 'Cannot create new app'
            }));
        }

        // create alias pointing to v1
        const aliasSpec = //dav3.Alias.constructFromObject({
        {
            id: Utils.Alias,
            version: 1
        };
        try {
            const newAlias = await api.createAppBundleAlias(appBundleName, aliasSpec);
        } catch (ex) {
            console.error(ex);
            return (res.status(500).json({
                diagnostic: 'Failed to create an alias'
            }));
        }
    } else {
        // create new version
        const appBundleSpec = //dav3.AppBundle.constructFromObject({
        {
            engine: engineName,
            description: appBundleName
        };
        try {
            newAppVersion = await api.createAppBundleVersion(appBundleName, appBundleSpec);
        } catch (ex) {
            console.error(ex);
            return (res.status(500).json({
                diagnostic: 'Cannot create new version'
            }));
        }

        // update alias pointing to v+1
        const aliasSpec = //dav3.AliasPatch.constructFromObject({
        {
            version: newAppVersion.version
        };
        try {
            const newAlias = await api.modifyAppBundleAlias(appBundleName, Utils.Alias, aliasSpec);
        } catch (ex) {
            console.error(ex);
            return (res.status(500).json({
                diagnostic: 'Failed to create an alias'
            }));
        }
    }

    // upload the zip with .bundle
    try {
        // curl https://bucketname.s3.amazonaws.com/
        // -F key = apps/myApp/myfile.zip
        // -F content-type = application/octet-stream
        // -F policy = eyJleHBpcmF0aW9uIjoiMjAxOC0wNi0yMVQxMzo...(trimmed)
        // -F x-amz-signature = 800e52d73579387757e1c1cd88762...(trimmed)
        // -F x-amz-credential = AKIAIOSFODNN7EXAMPLE/20180621/us-west-2/s3/aws4_request/
        // -F x-amz-algorithm = AWS4-HMAC-SHA256
        // -F x-amz-date = 20180621T091656Z
        // -F file=@E:myfile.zip
        //
        // The ‘file’ field must be at the end, all fields after ‘file’ will be ignored.
        await Utils.uploadFormDataWithFile(
            packageZipPath,
            newAppVersion.uploadParameters.endpointURL,
            newAppVersion.uploadParameters.formData
        );
    } catch (ex) {
        console.error(ex);
        return (res.status(500).json({
            diagnostic: 'Failed to upload bundle on s3'
        }));
    }

    res.status(200).json({
        appBundle: qualifiedAppBundleId,
        version: newAppVersion.version
    });
    
    // Log activity
    logActivity('da:bundle:created', {
        title: 'AppBundle Created',
        message: `Created AppBundle "${appBundleName}" version ${newAppVersion.version}`,
        details: { appBundleId: qualifiedAppBundleId, version: newAppVersion.version, engine: engineName }
    });
});

/// <summary>
/// CreateActivity a new Activity
/// </summary>
router.post('/aps/designautomation/activities', async /*CreateActivity*/(req, res) => {
    const activitySpecs = req.body;

    // basic input validation
    const zipFileName = activitySpecs.zipFileName;
    const engineName = activitySpecs.engine;

    // standard name for this sample
    const appBundleName = zipFileName + 'AppBundle';
    const activityName = zipFileName + 'Activity';

    // get defined activities
    const api = await Utils.dav3API(req.oauth_token);
    let activities = null;
    try {
        activities = await api.getActivities();
    } catch (ex) {
        console.error(ex);
        return (res.status(500).json({
            diagnostic: 'Failed to get activity list'
        }));
    }
    const qualifiedActivityId = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
    if (!activities.data.includes(qualifiedActivityId)) {
        // define the activity
        // ToDo: parametrize for different engines...
        const engineAttributes = Utils.EngineAttributes(engineName);
        const commandLine = engineAttributes.commandLine.replace('{0}', appBundleName);
        const activitySpec = {
            id: activityName,
            appbundles: [`${Utils.NickName}.${appBundleName}+${Utils.Alias}`],
            commandLine: [commandLine],
            engine: engineName,
            parameters: {
                inputFile: {
                    description: 'input file',
                    localName: '$(inputFile)',
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.get,
                    zip: false
                },
                inputJson: {
                    description: 'input json',
                    localName: 'params.json',
                    ondemand: false,
                    required: false,
                    verb: dav3.Verb.get,
                    zip: false
                },
                outputFile: {
                    description: 'output file',
                    localName: 'outputFile.' + engineAttributes.extension,
                    ondemand: false,
                    required: true,
                    verb: dav3.Verb.put,
                    zip: false
                }
            },
            settings: {
                script: {
                    value: engineAttributes.script
                }
            }
        };
        try {
            const newActivity = await api.createActivity(activitySpec);
        } catch (ex) {
            console.error(ex);
            return (res.status(500).json({
                diagnostic: 'Failed to create new activity'
            }));
        }
        // specify the alias for this Activity
        const aliasSpec = {
            id: Utils.Alias,
            version: 1
        };
        try {
            const newAlias = await api.createActivityAlias(activityName, aliasSpec);
        } catch (ex) {
            console.error(ex);
            return (res.status(500).json({
                diagnostic: 'Failed to create new alias for activity'
            }));
        }
        
        // Log activity
        logActivity('da:activity:created', {
            title: 'Activity Created',
            message: `Created Design Automation Activity "${activityName}"`,
            details: { activityId: qualifiedActivityId, engine: engineName }
        });
        
        res.status(200).json({
            activity: qualifiedActivityId
        });
        return;
    }

    // as this activity points to a AppBundle "dev" alias (which points to the last version of the bundle),
    // there is no need to update it (for this sample), but this may be extended for different contexts
    res.status(200).json({
        activity: 'Activity already defined'
    });
});

/// <summary>
/// Get all Activities defined for this account
/// </summary>
router.get('/aps/designautomation/activities', async /*GetDefinedActivities*/(req, res) => {
    const api = await Utils.dav3API(req.oauth_token);
    // filter list of 
    let activities = null;
    try {
        activities = await api.getActivities();
    } catch (ex) {
        console.error(ex);
        return (res.status(500).json({
            diagnostic: 'Failed to get activity list'
        }));
    }
    let definedActivities = [];
    for (let i = 0; i < activities.data.length; i++) {
        let activity = activities.data[i];
        if (activity.startsWith(Utils.NickName) && activity.indexOf('$LATEST') === -1)
            definedActivities.push(activity.replace(Utils.NickName + '.', ''));
    }

    res.status(200).json(definedActivities);
});

/// <summary>
/// Direct To S3 
/// ref : https://aps.autodesk.com/blog/new-feature-support-direct-s3-migration-inputoutput-files-design-automation
/// </summary>

const getObjectId = async (bucketKey, objectKey, req) => {
    try {
        let contentStream = _fs.createReadStream(req.file.path);

        //uploadResources takes an Object or Object array of resource to uplaod with their parameters,
        //we are just passing only one object.
        let uploadResponse = await new ForgeAPI.ObjectsApi().uploadResources(
            bucketKey,
            [
                //object
                {
                    objectKey: objectKey,
                    data: contentStream,
                    length: req.file.size
                }
            ],
            {
                useAcceleration: false, //Whether or not to generate an accelerated signed URL
                minutesExpiration: 20, //The custom expiration time within the 1 to 60 minutes range, if not specified, default is 2 minutes
                onUploadProgress: (data) => console.warn(data) // function (progressEvent) => {}
            },
            req.oauth_client, req.oauth_token,
        );
        //lets check for the first and only entry.
        if (uploadResponse[0].hasOwnProperty('error') && uploadResponse[0].error) {
            throw new Error(uploadResponse[0].completed.reason);
        }
        console.log(uploadResponse[0].completed.objectId);
        return (uploadResponse[0].completed.objectId);
    } catch (ex) {
        console.error("Failed to create ObjectID\n", ex)
        throw ex;
    }
}

/// <summary>
/// Start a new workitem
/// </summary>
router.post('/aps/designautomation/workitems', multer({
    dest: 'uploads/'
}).single('inputFile'), async /*StartWorkitem*/(req, res) => {
    const input = req.body;

    // basic input validation
    const workItemData = JSON.parse(input.data);
    const widthParam = parseFloat(workItemData.width);
    const heigthParam = parseFloat(workItemData.height);
    const activityName = `${Utils.NickName}.${workItemData.activityName}`;
    const browserConnectionId = workItemData.browserConnectionId;

    // save the file on the server
    const ContentRootPath = _path.resolve(_path.join(__dirname, '../..'));
    const fileSavePath = _path.join(ContentRootPath, _path.basename(req.file.originalname));

    // upload file to OSS Bucket
    // 1. ensure bucket existis
    const bucketKey = Utils.NickName.toLowerCase() + '-designautomation';
    try {
        let payload = new ForgeAPI.PostBucketsPayload();
        payload.bucketKey = bucketKey;
        payload.policyKey = 'transient'; // expires in 24h
        await new ForgeAPI.BucketsApi().createBucket(payload, {}, req.oauth_client, req.oauth_token);
    } catch (ex) {
        // in case bucket already exists
    }
    // 2. upload inputFile
    const inputFileNameOSS = `${new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14)}_input_${_path.basename(req.file.originalname)}`; // avoid overriding
    // prepare workitem arguments
    const bearerToken = ["Bearer", req.oauth_token.access_token].join(" ");
    // 1. input file
    const inputFileArgument = {
        url: await getObjectId(bucketKey, inputFileNameOSS, req),
        headers: { "Authorization": bearerToken }
    };
    // 2. input json
    const inputJson = {
        width: widthParam,
        height: heigthParam
    };
    const inputJsonArgument = {
        url: "data:application/json, " + JSON.stringify(inputJson).replace(/"/g, "'")
    };
    // 3. output file
    const outputFileNameOSS = `${new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14)}_output_${_path.basename(req.file.originalname)}`; // avoid overriding  
    const outputFileArgument = {
        url: await getObjectId(bucketKey, outputFileNameOSS, req),
        verb: dav3.Verb.put,
        headers: { "Authorization": bearerToken }
    };

    // prepare & submit workitem
    const workItemSpec = {
        activityId: activityName,
        arguments: {
            inputFile: inputFileArgument,
            inputJson: inputJsonArgument,
            outputFile: outputFileArgument,
        }
    };
    let workItemStatus = null;
    try {
        const api = await Utils.dav3API(req.oauth_token);
        workItemStatus = await api.createWorkItem(workItemSpec);
        
        // Log activity for workitem start
        logActivity('da:workitem:started', {
            title: 'WorkItem Started',
            message: `Design Automation workitem started`,
            details: { workItemId: workItemStatus.id, activityName }
        });
        
        monitorWorkItem(req.oauth_client, req.oauth_token, workItemStatus.id, browserConnectionId, outputFileNameOSS, inputFileNameOSS);
    } catch (ex) {
        console.error(ex);
        return (res.status(500).json({
            diagnostic: 'Failed to create a workitem'
        }));
    }
    res.status(200).json({
        workItemId: workItemStatus.id
    });
});

/// <summary>
/// Alias used by DesignAutomationView: POST /api/aps/workitems
/// Accepts { inputUrn, parameters, browerConnectionId } or from-oss fields.
/// </summary>
router.post('/aps/workitems', async (req, res) => {
    try {
        const body = req.body || {};
        let bucketKey = body.bucketKey || body.inputFile?.bucket;
        let objectKey = body.objectKey || body.inputFile?.object;

        if ((!bucketKey || !objectKey) && body.inputUrn) {
            const padded = body.inputUrn + '='.repeat((4 - (body.inputUrn.length % 4)) % 4);
            const decoded = Buffer.from(padded, 'base64').toString('utf8');
            const match = decoded.match(/^urn:adsk\.objects:os\.object:([^/]+)\/(.+)$/);
            if (!match) {
                return res.status(400).json({ diagnostic: 'Invalid inputUrn' });
            }
            bucketKey = match[1];
            objectKey = match[2];
        }

        if (!bucketKey || !objectKey) {
            return res.status(400).json({
                diagnostic: 'Must provide inputUrn, or bucketKey + objectKey'
            });
        }

        req.body = {
            ...body,
            bucketKey,
            objectKey,
            activityName: body.activityName || body.activityId || 'UpdateIPTParamActivity+dev',
            browserConnectionId: body.browserConnectionId || body.browerConnectionId || body.socketId,
            parameters: body.parameters || {}
        };
        req.url = '/aps/designautomation/workitems/from-oss';
        return router.handle(req, res);
    } catch (ex) {
        console.error('Alias workitems error:', ex);
        res.status(500).json({ diagnostic: 'Failed to create workitem: ' + ex.message });
    }
});

/// <summary>
/// Start a workitem using an existing OSS file (no re-upload needed)
/// </summary>
router.post('/aps/designautomation/workitems/from-oss', async (req, res) => {
    console.log('=== WORKITEM FROM OSS ENDPOINT CALLED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
        // Support both formats: 
        // Legacy: { bucketKey, objectKey, activityName }
        // New:    { inputFile: { bucket, object }, activityId }
        const inputFile = req.body.inputFile;
        const bucketKey = req.body.bucketKey || inputFile?.bucket;
        const objectKey = req.body.objectKey || inputFile?.object;
        const activityName = req.body.activityName || req.body.activityId;
        const browserConnectionId = req.body.browserConnectionId || req.body.socketId;
        const parameters = req.body.parameters || {};
        
        console.log(`Using EXISTING file: ${bucketKey}/${objectKey}`);
        console.log(`Activity: ${activityName}`);
        
        if (!bucketKey || !objectKey || !activityName) {
            return res.status(400).json({ 
                diagnostic: 'Missing required fields: bucketKey/inputFile.bucket, objectKey/inputFile.object, activityName/activityId' 
            });
        }

        // Activity name may already be fully qualified (e.g., "UpdateIPTParamActivity+dev")
        // or need the nickname prefix
        const fullActivityName = activityName.includes('.') 
            ? activityName 
            : `${Utils.NickName}.${activityName}`;
        const objectsApi = new ForgeAPI.ObjectsApi();
        const bearerToken = ["Bearer", req.oauth_token.access_token].join(" ");
        
        // === INPUT: Use S3 signed URL (works for reading from ANY bucket) ===
        console.log('Getting S3 signed download URL for input file...');
        const inputSignedUrlResponse = await objectsApi.getS3DownloadURL(
            bucketKey, 
            objectKey, 
            { useAcceleration: false, minutesExpiration: 60 },
            req.oauth_client, req.oauth_token
        );
        
        // Extract URL from response (may be in different locations depending on API version)
        const inputUrl = inputSignedUrlResponse.body?.url || inputSignedUrlResponse.body?.signedUrl || inputSignedUrlResponse.url;
        if (!inputUrl) {
            console.error('Failed to get input signed URL. Full response:', JSON.stringify(inputSignedUrlResponse, null, 2));
            return res.status(500).json({ diagnostic: 'Failed to get signed URL for input file' });
        }
        console.log('Input signed URL obtained:', inputUrl.substring(0, 100) + '...');
        
        // Input file argument - use S3 signed URL (no auth header needed)
        const inputFileArgument = {
            url: inputUrl
        };
        
        // === OUTPUT: Use S3 signed URL for upload to APP'S OWN bucket ===
        // Use the app's own bucket for output - this bucket is owned by the app
        const outputBucketKey = Utils.NickName.toLowerCase() + '-designautomation';
        
        // Ensure output bucket exists
        try {
            let payload = new ForgeAPI.PostBucketsPayload();
            payload.bucketKey = outputBucketKey;
            payload.policyKey = 'transient'; // expires in 24h
            await new ForgeAPI.BucketsApi().createBucket(payload, {}, req.oauth_client, req.oauth_token);
            console.log('Created output bucket:', outputBucketKey);
        } catch (ex) {
            // Bucket already exists - this is fine
            console.log('Output bucket already exists:', outputBucketKey);
        }
        
        // Create output file name
        const timestamp = new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14);
        const outputObjectKey = `${timestamp}_output_${objectKey}`;
        
        // Get S3 signed UPLOAD URL for output (this is what DA needs to write to)
        console.log('Getting S3 signed upload URL for output file...');
        const outputSignedUrlResponse = await objectsApi.getS3UploadURL(
            outputBucketKey, 
            outputObjectKey, 
            { useAcceleration: false, minutesExpiration: 60 },
            req.oauth_client, req.oauth_token
        );
        
        // Extract URL from response
        const outputUrl = outputSignedUrlResponse.body?.urls?.[0] || outputSignedUrlResponse.body?.url || outputSignedUrlResponse.body?.signedUrl;
        const outputUploadKey = outputSignedUrlResponse.body?.uploadKey;
        if (!outputUrl) {
            console.error('Failed to get output signed URL. Full response:', JSON.stringify(outputSignedUrlResponse, null, 2));
            return res.status(500).json({ diagnostic: 'Failed to get signed URL for output file' });
        }
        if (!outputUploadKey) {
            console.error('Failed to get output uploadKey. Full response:', JSON.stringify(outputSignedUrlResponse, null, 2));
            return res.status(500).json({ diagnostic: 'Failed to get upload key for output file' });
        }
        console.log('Output signed URL obtained:', outputUrl.substring(0, 100) + '...');
        
        // Output file argument - use S3 signed URL (no auth header needed)
        const outputFileArgument = {
            url: outputUrl,
            verb: dav3.Verb.put
        };
        
        // Build input JSON from parameters (if provided)
        const inputJson = parameters || {};
        const inputJsonArgument = {
            url: "data:application/json, " + JSON.stringify(inputJson).replace(/"/g, "'")
        };
        
        // Prepare workitem arguments - S3 signed URLs for both:
        // - Input: S3 signed URL (reads from any bucket)
        // - Output: S3 signed URL (writes to app's bucket)
        const workItemSpec = {
            activityId: fullActivityName,
            arguments: {
                inputFile: inputFileArgument,
                inputJson: inputJsonArgument,
                outputFile: outputFileArgument
            }
        };
        
        console.log('WorkItem spec (S3 signed URLs for both):', JSON.stringify({
            activityId: workItemSpec.activityId,
            arguments: {
                inputFile: { url: inputUrl.substring(0, 80) + '... (S3 signed - reads from any bucket)' },
                inputJson: inputJsonArgument,
                outputFile: { 
                    url: outputUrl.substring(0, 80) + '... (S3 signed - writes to app bucket)', 
                    verb: outputFileArgument.verb
                }
            }
        }, null, 2));
        
        // Submit workitem
        const api = await Utils.dav3API(req.oauth_token);
        const workItemStatus = await api.createWorkItem(workItemSpec);
        
        // Log activity
        logActivity('da:workitem:started', {
            title: 'WorkItem Started',
            message: `Design Automation workitem started`,
            details: { 
                workItemId: workItemStatus.id, 
                activityName: fullActivityName,
                inputFile: `${bucketKey}/${objectKey}`,
                outputFile: `${outputBucketKey}/${outputObjectKey}`
            }
        });
        
        // Monitor workitem in background (use the APP's bucket for output)
        monitorWorkItemFromOSS(
            req.oauth_client, 
            req.oauth_token, 
            workItemStatus.id, 
            browserConnectionId, 
            outputBucketKey,  // Use app's bucket for output
            outputObjectKey,
            outputUploadKey
        );
        
        res.status(200).json({
            workItemId: workItemStatus.id,
            outputFile: outputObjectKey,
            bucket: outputBucketKey  // Return app's bucket (where output actually lives)
        });
        
    } catch (ex) {
        console.error('WorkItem from OSS error:', ex);
        res.status(500).json({ diagnostic: 'Failed to create workitem: ' + ex.message });
    }
});

async function monitorWorkItemFromOSS(oauthClient, oauthToken, workItemId, browserConnectionId, bucketKey, outputObjectKey, outputUploadKey) {
    const socketIO = global.socketIO;
    try {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const api = await Utils.dav3API(oauthToken);
            const status = await api.getWorkitemStatus(workItemId);
            const objectsApi = new ForgeAPI.ObjectsApi();
            
            socketIO.to(browserConnectionId).emit('onComplete', status);
            
            if (status.status === 'pending' || status.status === 'inprogress') {
                continue;
            }
            
            // Get report
            let response = await fetch(status.reportUrl);
            socketIO.to(browserConnectionId).emit('onComplete', await response.text());
            
            if (status.status === 'success') {
                // Get fresh token for OSS completion/translation (workitem may have taken minutes)
                const { getClient } = require('./common/oauth');
                const freshClient = await getClient();
                const freshToken = freshClient.getCredentials();

                // Complete S3 upload so the object becomes available in OSS
                try {
                    const completeBody = { uploadKey: outputUploadKey };
                    await objectsApi.completeS3Upload(bucketKey, outputObjectKey, completeBody, {}, freshClient, freshToken);
                    console.log('Completed S3 upload for output object:', `${bucketKey}/${outputObjectKey}`);
                } catch (ex) {
                    console.error('Failed to complete S3 upload for output object:', ex);
                    socketIO.to(browserConnectionId).emit('onError', { message: 'Failed to finalize output upload' });
                    return;
                }

                // Construct the objectId (format: urn:adsk.objects:os.object:bucketKey/objectKey)
                const objectId = `urn:adsk.objects:os.object:${bucketKey}/${outputObjectKey}`;
                const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
                
                console.log('Starting translation for workitem output URN:', urn);
                
                // Trigger Model Derivative translation
                const derivativesApi = new ForgeAPI.DerivativesApi();
                const job = {
                    input: { urn: urn },
                    output: {
                        formats: [{ type: 'svf', views: ['2d', '3d'] }]
                    }
                };
                
                try {
                    await derivativesApi.translate(job, {}, freshClient, freshToken);
                    console.log('Translation job started for workitem output');
                } catch (ex) {
                    console.log('Translation may already exist:', ex.statusCode);
                }
                
                // Emit URN for viewer - both to specific socket AND broadcast to all
                const workitemCompleteData = { 
                    urn: urn,
                    objectId: objectId,
                    bucketKey: bucketKey,
                    objectKey: outputObjectKey
                };
                socketIO.to(browserConnectionId).emit('workitemComplete', workitemCompleteData);
                // Also broadcast to all clients in case the original socket reconnected
                socketIO.emit('workitemComplete', workitemCompleteData);
                console.log('Emitted workitemComplete to socket:', browserConnectionId, 'and broadcast to all');
                
                // Log success
                logActivity('da:workitem:completed', {
                    title: 'WorkItem Completed',
                    message: `Design Automation workitem completed successfully`,
                    details: { workItemId, outputFile: outputObjectKey, bucket: bucketKey }
                });
                
                // Provide download link
                response = await objectsApi.getS3DownloadURL(bucketKey, outputObjectKey, { 
                    useAcceleration: false, minutesExpiration: 15 
                }, freshClient, freshToken);
                socketIO.to(browserConnectionId).emit('downloadResult', response.body.url);
                
            } else {
                logActivity('da:workitem:failed', {
                    title: 'WorkItem Failed',
                    message: `Design Automation workitem failed`,
                    details: { workItemId, status: status.status }
                });
                socketIO.to(browserConnectionId).emit('onError', { message: 'WorkItem failed: ' + status.status });
            }
            return;
        }
    } catch (err) {
        console.error('Monitor workitem error:', err);
        socketIO.to(browserConnectionId).emit('onError', { message: err.message || String(err) });
    }
}

async function monitorWorkItem(oauthClient, oauthToken, workItemId, browserConnectionId, outputFileName, inputFileName) {
    const socketIO = global.socketIO;
    try {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const api = await Utils.dav3API(oauthToken);
            const status = await api.getWorkitemStatus(workItemId);
            const bucketKey = Utils.NickName.toLowerCase() + '-designautomation';
            const objectsApi = new ForgeAPI.ObjectsApi();
            socketIO.to(browserConnectionId).emit('onComplete', status);
            if (status.status == 'pending' || status.status === 'inprogress') {
                continue;
            }
            let response = await fetch(status.reportUrl);
            socketIO.to(browserConnectionId).emit('onComplete', await response.text());
            if (status.status === 'success') {
                // Construct the objectId directly (format: urn:adsk.objects:os.object:bucketKey/objectKey)
                const objectId = `urn:adsk.objects:os.object:${bucketKey}/${outputFileName}`;
                
                // Convert to URN for translation
                const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
                console.log('Starting translation for workitem output URN:', urn);
                
                // Get fresh token for translation (workitem may have taken minutes)
                const { getClient } = require('./common/oauth');
                const freshClient = await getClient();
                const freshToken = freshClient.getCredentials();
                
                // Trigger Model Derivative translation
                const derivativesApi = new ForgeAPI.DerivativesApi();
                const job = {
                    input: { urn: urn },
                    output: {
                        formats: [{ type: 'svf', views: ['2d', '3d'] }]
                    }
                };
                
                try {
                    await derivativesApi.translate(job, {}, freshClient, freshToken);
                    console.log('Translation job started for workitem output');
                } catch (ex) {
                    console.log('Translation may already exist:', ex.statusCode);
                }
                
                // Emit URN for viewer to poll translation status - both to specific socket AND broadcast
                const workitemCompleteData = { 
                    urn: urn,
                    objectId: objectId,
                    bucketKey: bucketKey,
                    objectKey: outputFileName
                };
                socketIO.to(browserConnectionId).emit('workitemComplete', workitemCompleteData);
                // Also broadcast to all clients in case the original socket reconnected
                socketIO.emit('workitemComplete', workitemCompleteData);
                console.log('Emitted workitemComplete to socket:', browserConnectionId, 'and broadcast to all');
                
                // Log activity for workitem completion
                logActivity('da:workitem:completed', {
                    title: 'WorkItem Completed',
                    message: `Design Automation workitem completed successfully`,
                    details: { workItemId, outputFile: outputFileName }
                });
                
                // Also provide download link
                response = await objectsApi.getS3DownloadURL(bucketKey, outputFileName, { 
                    useAcceleration: false, minutesExpiration: 15 
                }, freshClient, freshToken);
                socketIO.to(browserConnectionId).emit('downloadResult', response.body.url);
            } else {
                // Log activity for workitem failure with more details
                console.error('WorkItem failed with status:', status.status);
                console.error('WorkItem report URL:', status.reportUrl);
                
                // Fetch the report to get actual error details
                let reportText = 'No report available';
                try {
                    const reportResponse = await fetch(status.reportUrl);
                    reportText = await reportResponse.text();
                    console.error('WorkItem Report:\n', reportText);
                } catch (e) {
                    console.error('Could not fetch report:', e);
                }
                
                logActivity('da:workitem:failed', {
                    title: 'WorkItem Failed',
                    message: `Design Automation workitem failed`,
                    details: { workItemId, status: status.status, report: reportText.substring(0, 500) }
                });
                
                // Send more detailed error to client
                socketIO.to(browserConnectionId).emit('onError', { 
                    message: `WorkItem failed: ${status.status}`,
                    report: reportText.substring(0, 1000)
                });
                return;
            }
            await objectsApi.deleteObject(bucketKey, inputFileName, oauthClient, oauthToken);
            return;
        }
    } catch (err) {
        console.error(err);
        socketIO.to(browserConnectionId).emit('onError', { message: err.message || String(err) });
    }
}

/// <summary>
/// Clear the accounts (for debugging purpouses)
/// </summary>
router.delete('/aps/designautomation/account', async /*ClearAccount*/(req, res) => {
    let api = await Utils.dav3API(req.oauth_token);
    // clear account
    await api.deleteForgeApp('me');
    res.status(200).end();
});

// =====================================================
// OSS BUCKET MANAGEMENT ROUTES
// =====================================================

/// <summary>
/// List all buckets
/// </summary>
router.get('/oss/buckets', async (req, res) => {
    try {
        const bucketsApi = new ForgeAPI.BucketsApi();
        const buckets = await bucketsApi.getBuckets({ limit: 100 }, req.oauth_client, req.oauth_token);
        res.json(buckets.body.items || []);
    } catch (ex) {
        console.error('List buckets error:', ex);
        res.status(500).json({ diagnostic: 'Failed to list buckets: ' + ex.message });
    }
});

/// <summary>
/// Get bucket details
/// </summary>
router.get('/oss/buckets/:bucketKey', async (req, res) => {
    try {
        const bucketsApi = new ForgeAPI.BucketsApi();
        const details = await bucketsApi.getBucketDetails(req.params.bucketKey, req.oauth_client, req.oauth_token);
        res.json(details.body);
    } catch (ex) {
        console.error('Get bucket details error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get bucket details: ' + ex.message });
    }
});

/// <summary>
/// Create a new bucket
/// </summary>
router.post('/oss/buckets', async (req, res) => {
    try {
        const { bucketKey, policyKey } = req.body;
        if (!bucketKey) {
            return res.status(400).json({ diagnostic: 'bucketKey is required' });
        }
        
        const bucketsApi = new ForgeAPI.BucketsApi();
        let payload = new ForgeAPI.PostBucketsPayload();
        payload.bucketKey = bucketKey.toLowerCase();
        payload.policyKey = policyKey || 'transient';
        
        const result = await bucketsApi.createBucket(payload, {}, req.oauth_client, req.oauth_token);
        
        // Log activity
        logActivity('oss:bucket:created', {
            title: 'Bucket Created',
            message: `Created OSS bucket "${bucketKey}"`,
            details: { bucketKey: payload.bucketKey, policyKey: payload.policyKey }
        });
        
        res.json(result.body);
    } catch (ex) {
        console.error('Create bucket error:', ex);
        if (ex.statusCode === 409) {
            res.status(409).json({ diagnostic: 'Bucket already exists' });
        } else {
            res.status(500).json({ diagnostic: 'Failed to create bucket: ' + ex.message });
        }
    }
});

/// <summary>
/// Delete a bucket
/// </summary>
router.delete('/oss/buckets/:bucketKey', async (req, res) => {
    try {
        const bucketsApi = new ForgeAPI.BucketsApi();
        await bucketsApi.deleteBucket(req.params.bucketKey, req.oauth_client, req.oauth_token);
        
        // Log activity
        logActivity('oss:bucket:deleted', {
            title: 'Bucket Deleted',
            message: `Deleted OSS bucket "${req.params.bucketKey}"`,
            details: { bucketKey: req.params.bucketKey }
        });
        
        res.json({ success: true, message: 'Bucket deleted' });
    } catch (ex) {
        console.error('Delete bucket error:', ex);
        res.status(500).json({ diagnostic: 'Failed to delete bucket: ' + ex.message });
    }
});

/// <summary>
/// List objects in a bucket
/// </summary>
router.get('/oss/buckets/:bucketKey/objects', async (req, res) => {
    try {
        const objectsApi = new ForgeAPI.ObjectsApi();
        const objects = await objectsApi.getObjects(req.params.bucketKey, { limit: 100 }, req.oauth_client, req.oauth_token);
        res.json(objects.body.items || []);
    } catch (ex) {
        console.error('List objects error:', ex);
        res.status(500).json({ diagnostic: 'Failed to list objects: ' + ex.message });
    }
});

/// <summary>
/// Upload object to bucket
/// </summary>
router.post('/oss/buckets/:bucketKey/objects', multer({ dest: 'uploads/' }).single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ diagnostic: 'No file uploaded' });
        }
        
        const bucketKey = req.params.bucketKey;
        const objectKey = req.body.objectKey || req.file.originalname;
        
        const objectsApi = new ForgeAPI.ObjectsApi();
        let contentStream = _fs.createReadStream(req.file.path);
        
        const uploadResponse = await objectsApi.uploadResources(
            bucketKey,
            [{
                objectKey: objectKey,
                data: contentStream,
                length: req.file.size
            }],
            {
                useAcceleration: false,
                minutesExpiration: 60
            },
            req.oauth_client, req.oauth_token
        );
        
        // Clean up temp file
        _fs.unlinkSync(req.file.path);
        
        if (uploadResponse[0].hasOwnProperty('error') && uploadResponse[0].error) {
            throw new Error(uploadResponse[0].completed.reason);
        }
        
        // Log activity
        logActivity('oss:object:uploaded', {
            title: 'File Uploaded',
            message: `Uploaded "${objectKey}" to ${bucketKey}`,
            details: { bucketKey, objectKey, size: req.file.size }
        });
        
        res.json(uploadResponse[0].completed);
    } catch (ex) {
        console.error('Upload object error:', ex);
        res.status(500).json({ diagnostic: 'Failed to upload object: ' + ex.message });
    }
});

/// <summary>
/// Delete object from bucket
/// </summary>
router.delete('/oss/buckets/:bucketKey/objects/:objectKey', async (req, res) => {
    try {
        const objectsApi = new ForgeAPI.ObjectsApi();
        await objectsApi.deleteObject(req.params.bucketKey, req.params.objectKey, req.oauth_client, req.oauth_token);
        
        // Log activity
        logActivity('oss:object:deleted', {
            title: 'File Deleted',
            message: `Deleted "${req.params.objectKey}" from ${req.params.bucketKey}`,
            details: { bucketKey: req.params.bucketKey, objectKey: req.params.objectKey }
        });
        
        res.json({ success: true, message: 'Object deleted' });
    } catch (ex) {
        console.error('Delete object error:', ex);
        res.status(500).json({ diagnostic: 'Failed to delete object: ' + ex.message });
    }
});

/// <summary>
/// Get download URL for object
/// </summary>
router.get('/oss/buckets/:bucketKey/objects/:objectKey/download', async (req, res) => {
    try {
        const objectsApi = new ForgeAPI.ObjectsApi();
        const response = await objectsApi.getS3DownloadURL(
            req.params.bucketKey, 
            req.params.objectKey, 
            { useAcceleration: false, minutesExpiration: 15 }, 
            req.oauth_client, req.oauth_token
        );
        res.json({ url: response.body.url });
    } catch (ex) {
        console.error('Get download URL error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get download URL: ' + ex.message });
    }
});

/// <summary>
/// Get object details
/// </summary>
router.get('/oss/buckets/:bucketKey/objects/:objectKey/details', async (req, res) => {
    try {
        const objectsApi = new ForgeAPI.ObjectsApi();
        const details = await objectsApi.getObjectDetails(req.params.bucketKey, req.params.objectKey, {}, req.oauth_client, req.oauth_token);
        res.json(details.body);
    } catch (ex) {
        console.error('Get object details error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get object details: ' + ex.message });
    }
});

// ============================================================================
// PARAMETER EXTRACTION API - Data-Driven Design Automation
// ============================================================================

// Store for extracted/saved parameters per file
const parameterCache = {};
const PARAM_CACHE_PATH = _path.join(__dirname, '../data/parameter-cache.json');

// Load parameter cache
try {
    if (_fs.existsSync(PARAM_CACHE_PATH)) {
        Object.assign(parameterCache, JSON.parse(_fs.readFileSync(PARAM_CACHE_PATH, 'utf8')));
    }
} catch (err) {
    console.log('No parameter cache found, starting fresh');
}

const saveParameterCache = () => {
    try {
        const dir = _path.dirname(PARAM_CACHE_PATH);
        if (!_fs.existsSync(dir)) _fs.mkdirSync(dir, { recursive: true });
        _fs.writeFileSync(PARAM_CACHE_PATH, JSON.stringify(parameterCache, null, 2));
    } catch (err) {
        console.error('Failed to save parameter cache:', err);
    }
};

/// <summary>
/// Get parameters for a file (data-driven)
/// Returns cached parameters or generates defaults based on file type
/// </summary>
router.get('/oss/buckets/:bucketKey/objects/:objectKey/parameters', async (req, res) => {
    try {
        const { bucketKey, objectKey } = req.params;
        const cacheKey = `${bucketKey}/${objectKey}`;
        
        // Check cache first
        if (parameterCache[cacheKey]) {
            return res.json({
                source: 'cache',
                parameters: parameterCache[cacheKey].parameters,
                lastUpdated: parameterCache[cacheKey].lastUpdated
            });
        }
        
        // Generate default parameters based on file extension
        const ext = objectKey.split('.').pop()?.toLowerCase();
        const parameters = generateDefaultParams(ext, objectKey);
        
        res.json({
            source: 'generated',
            parameters,
            fileType: ext
        });
    } catch (ex) {
        console.error('Get parameters error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get parameters: ' + ex.message });
    }
});

/// <summary>
/// Save/update parameters for a file
/// </summary>
router.post('/oss/buckets/:bucketKey/objects/:objectKey/parameters', async (req, res) => {
    try {
        const { bucketKey, objectKey } = req.params;
        const { parameters } = req.body;
        const cacheKey = `${bucketKey}/${objectKey}`;
        
        parameterCache[cacheKey] = {
            parameters,
            lastUpdated: new Date().toISOString()
        };
        saveParameterCache();
        
        res.json({ success: true, message: 'Parameters saved' });
    } catch (ex) {
        console.error('Save parameters error:', ex);
        res.status(500).json({ diagnostic: 'Failed to save parameters: ' + ex.message });
    }
});

/// <summary>
/// Generate default parameters based on file type
/// </summary>
function generateDefaultParams(extension, filename) {
    const params = [];
    
    // Common output options
    params.push({
        name: 'outputFormat',
        value: extension || 'ipt',
        type: 'select',
        options: ['ipt', 'iam', 'stp', 'step', 'igs', 'iges', 'sat'],
        description: 'Output file format'
    });
    
    // Inventor part files
    if (extension === 'ipt') {
        params.push(
            { name: 'exportSTEP', value: true, type: 'boolean', description: 'Export as STEP file' },
            { name: 'exportPDF', value: false, type: 'boolean', description: 'Export drawing as PDF' },
            { name: 'modelScale', value: 1.0, type: 'number', min: 0.1, max: 10, description: 'Model scale factor' }
        );
    }
    
    // Inventor assembly files
    if (extension === 'iam') {
        params.push(
            { name: 'exportSTEP', value: true, type: 'boolean', description: 'Export assembly as STEP' },
            { name: 'exportPDF', value: false, type: 'boolean', description: 'Export drawing as PDF' },
            { name: 'simplifyForExport', value: false, type: 'boolean', description: 'Simplify geometry for export' },
            { name: 'includeSubAssemblies', value: true, type: 'boolean', description: 'Include sub-assemblies' }
        );
    }
    
    // Drawing files
    if (extension === 'idw' || extension === 'dwg') {
        params.push(
            { name: 'exportPDF', value: true, type: 'boolean', description: 'Export as PDF' },
            { name: 'exportDWG', value: false, type: 'boolean', description: 'Export as DWG' },
            { name: 'paperSize', value: 'A3', type: 'select', options: ['A4', 'A3', 'A2', 'A1', 'A0'], description: 'Paper size' }
        );
    }
    
    return params;
}

/// <summary>
/// Get parameter template for a specific activity/bundle
/// </summary>
router.get('/aps/designautomation/activities/:activityName/parameters', async (req, res) => {
    try {
        const { activityName } = req.params;
        const api = await Utils.dav3API(req.oauth_token);
        
        // Get activity details
        const fullName = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
        const activity = await api.getActivity(fullName);
        
        // Extract parameter definitions from activity
        const params = [];
        if (activity.parameters) {
            Object.entries(activity.parameters).forEach(([name, def]) => {
                if (name !== 'inputFile' && name !== 'outputFile') {
                    params.push({
                        name,
                        description: def.description,
                        required: def.required,
                        type: 'text'
                    });
                }
            });
        }
        
        res.json({ activityName, parameters: params });
    } catch (ex) {
        console.error('Get activity parameters error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get activity parameters: ' + ex.message });
    }
});

/// <summary>
/// Translate object for viewing
/// </summary>
router.post('/oss/translate', async (req, res) => {
    try {
        const { objectId } = req.body;
        if (!objectId) {
            return res.status(400).json({ diagnostic: 'objectId is required' });
        }
        
        // Create URN from objectId
        const urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        const derivativesApi = new ForgeAPI.DerivativesApi();
        const job = {
            input: {
                urn: urn
            },
            output: {
                formats: [
                    {
                        type: 'svf2',
                        views: ['2d', '3d']
                    }
                ]
            }
        };

        try {
            await derivativesApi.translate(job, { xAdsForce: false }, req.oauth_client, req.oauth_token);
            console.log('Translation job started for URN:', urn);
            
            // Log activity
            logActivity('oss:object:translated', {
                title: 'Translation Started',
                message: `Started 3D translation for viewing`,
                details: { urn }
            });
        } catch (ex) {
            // Translation might already be in progress or complete
            console.log('Translation status:', ex.statusCode);
        }

        res.json({ urn: urn, status: 'started' });
    } catch (ex) {
        console.error('Translate error:', ex);
        res.status(500).json({ diagnostic: 'Failed to translate: ' + ex.message });
    }
});

// ============================================================================
// PRODUCT MANAGEMENT API
// ============================================================================

const productsFilePath = _path.join(__dirname, '../data/products.json');

// Helper to read products
function readProductsFile() {
    try {
        const data = _fs.readFileSync(productsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (ex) {
        return { products: [], categories: [] };
    }
}

// Helper to write products
function writeProductsFile(data) {
    _fs.writeFileSync(productsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// Get all products
router.get('/products', async (req, res) => {
    try {
        const data = readProductsFile();
        res.json(data);
    } catch (ex) {
        console.error('Get products error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get products: ' + ex.message });
    }
});

// Get single product
router.get('/products/:id', async (req, res) => {
    try {
        const data = readProductsFile();
        const product = data.products.find(p => p.id === req.params.id);
        if (!product) {
            return res.status(404).json({ diagnostic: 'Product not found' });
        }
        res.json(product);
    } catch (ex) {
        console.error('Get product error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get product: ' + ex.message });
    }
});

// Create product
router.post('/products', async (req, res) => {
    try {
        const data = readProductsFile();
        const newProduct = {
            id: `product-${Date.now()}`,
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        data.products.push(newProduct);
        writeProductsFile(data);
        
        // Log activity
        logActivity('product:created', {
            title: 'Product Created',
            message: `Created product "${newProduct.name || newProduct.id}"`,
            details: { productId: newProduct.id, name: newProduct.name }
        });
        
        res.json(newProduct);
    } catch (ex) {
        console.error('Create product error:', ex);
        res.status(500).json({ diagnostic: 'Failed to create product: ' + ex.message });
    }
});

// Update product
router.put('/products/:id', async (req, res) => {
    try {
        const data = readProductsFile();
        const index = data.products.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ diagnostic: 'Product not found' });
        }
        data.products[index] = {
            ...data.products[index],
            ...req.body,
            id: req.params.id, // Preserve original ID
            updatedAt: new Date().toISOString()
        };
        writeProductsFile(data);
        
        // Log activity
        logActivity('product:updated', {
            title: 'Product Updated',
            message: `Updated product "${data.products[index].name || req.params.id}"`,
            details: { productId: req.params.id, name: data.products[index].name }
        });
        
        res.json(data.products[index]);
    } catch (ex) {
        console.error('Update product error:', ex);
        res.status(500).json({ diagnostic: 'Failed to update product: ' + ex.message });
    }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
    try {
        const data = readProductsFile();
        const index = data.products.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ diagnostic: 'Product not found' });
        }
        const deleted = data.products.splice(index, 1)[0];
        writeProductsFile(data);
        
        // Log activity
        logActivity('product:deleted', {
            title: 'Product Deleted',
            message: `Deleted product "${deleted.name || deleted.id}"`,
            details: { productId: deleted.id, name: deleted.name }
        });
        
        res.json({ success: true, deleted });
    } catch (ex) {
        console.error('Delete product error:', ex);
        res.status(500).json({ diagnostic: 'Failed to delete product: ' + ex.message });
    }
});

// Get categories
router.get('/categories', async (req, res) => {
    try {
        const data = readProductsFile();
        res.json(data.categories || []);
    } catch (ex) {
        console.error('Get categories error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get categories: ' + ex.message });
    }
});

// Get activities list (for product linking)
router.get('/products/meta/activities', async (req, res) => {
    try {
        const api = await Utils.dav3API(req.oauth_token);
        const activities = await api.getActivities();
        res.json(activities.data || []);
    } catch (ex) {
        console.error('Get activities error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get activities: ' + ex.message });
    }
});

// Test a product configuration (run DA workitem)
router.post('/products/:id/test', async (req, res) => {
    try {
        const data = readProductsFile();
        const product = data.products.find(p => p.id === req.params.id);
        if (!product) {
            return res.status(404).json({ diagnostic: 'Product not found' });
        }

        const { parameterValues, browserConnectionId } = req.body;
        
        // Build the workitem based on product configuration
        const bucketKey = product.ossBucket;
        const objectKey = product.ossObjectKey;
        const activityId = product.activityId;

        if (!bucketKey || !objectKey || !activityId) {
            return res.status(400).json({ diagnostic: 'Product not fully configured (missing bucket, object, or activity)' });
        }

        // Get signed URL for input file
        const objectsApi = new ForgeAPI.ObjectsApi();
        const bearerToken = ["Bearer", req.oauth_token.access_token].join(" ");

        // Construct input file URL
        const inputObjectId = `urn:adsk.objects:os.object:${bucketKey}/${objectKey}`;
        const inputFileArgument = {
            url: `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}`,
            headers: { "Authorization": bearerToken }
        };

        // Build parameter JSON from product parameters and user values
        const inputJson = {};
        (product.parameters || []).forEach(param => {
            if (parameterValues && parameterValues[param.name] !== undefined) {
                inputJson[param.name] = parameterValues[param.name];
            } else {
                inputJson[param.name] = param.defaultValue;
            }
        });

        const inputJsonArgument = {
            url: "data:application/json, " + JSON.stringify(inputJson).replace(/"/g, "'")
        };

        // Output file
        const timestamp = new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14);
        const outputFileName = `${timestamp}_test_output_${objectKey}`;
        const outputFileArgument = {
            url: `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(outputFileName)}`,
            verb: dav3.Verb.put,
            headers: { "Authorization": bearerToken }
        };

        // Prepare workitem
        const workItemSpec = {
            activityId: activityId,
            arguments: {
                inputFile: inputFileArgument,
                inputJson: inputJsonArgument,
                outputFile: outputFileArgument,
            }
        };

        const api = await Utils.dav3API(req.oauth_token);
        const workItemStatus = await api.createWorkItem(workItemSpec);
        
        // Monitor the workitem
        monitorWorkItem(req.oauth_client, req.oauth_token, workItemStatus.id, browserConnectionId, outputFileName, objectKey);

        res.json({
            workItemId: workItemStatus.id,
            status: workItemStatus.status,
            outputFileName: outputFileName
        });
    } catch (ex) {
        console.error('Test product error:', ex);
        res.status(500).json({ diagnostic: 'Failed to test product: ' + ex.message });
    }
});

// Update product status
router.patch('/products/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['draft', 'testing', 'live'].includes(status)) {
            return res.status(400).json({ diagnostic: 'Invalid status. Must be draft, testing, or live' });
        }

        const data = readProductsFile();
        const index = data.products.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ diagnostic: 'Product not found' });
        }

        data.products[index].status = status;
        data.products[index].updatedAt = new Date().toISOString();
        writeProductsFile(data);
        
        res.json(data.products[index]);
    } catch (ex) {
        console.error('Update status error:', ex);
        res.status(500).json({ diagnostic: 'Failed to update status: ' + ex.message });
    }
});

// Get live products only (for SydeFlow frontend)
router.get('/products/live', async (req, res) => {
    try {
        const data = readProductsFile();
        const liveProducts = data.products.filter(p => p.status === 'live');
        res.json(liveProducts);
    } catch (ex) {
        console.error('Get live products error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get live products: ' + ex.message });
    }
});

// ============================================================================
// PARAMETER EXTRACTION API - Auto Setup and Execution
// ============================================================================

// Auto-setup ExtractParams bundle and activity
router.post('/extract-parameters/setup', async (req, res) => {
    console.log('=== ExtractParams Setup Started ===');
    try {
        const engineName = req.body.engine || 'Autodesk.Inventor+2025';
        console.log('Engine:', engineName);
        console.log('Getting DA API...');
        const api = await Utils.dav3API(req.oauth_token);
        console.log('DA API obtained');
        const results = { bundle: null, activity: null };
        
        // Bundle and activity names
        const bundleName = 'ExtractParamsBundle';
        const activityName = 'ExtractParamsActivity';
        const qualifiedBundleId = `${Utils.NickName}.${bundleName}+${Utils.Alias}`;
        const qualifiedActivityId = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
        console.log('Bundle ID:', qualifiedBundleId);
        console.log('Activity ID:', qualifiedActivityId);
        
        // Check if bundle already exists
        let bundleExists = false;
        try {
            const bundles = await api.getAppBundles();
            bundleExists = bundles.data.includes(qualifiedBundleId);
        } catch (ex) {
            console.log('Error checking bundles:', ex.message);
        }
        
        if (!bundleExists) {
            // Create the bundle
            console.log('Creating ExtractParams AppBundle...');
            
            // ExtractParams source is in server/bundles
            const bundleFolder = _path.join(__dirname, '..', 'bundles', 'ExtractParams');
            const zipPath = _path.join(__dirname, '..', 'bundles', 'ExtractParamsBundle.zip');
            
            // Remove old ZIP if exists to avoid including it in the new ZIP
            if (_fs.existsSync(zipPath)) {
                _fs.unlinkSync(zipPath);
            }
            
            // Create ZIP using archiver - only include necessary files
            const archiver = require('archiver');
            const output = _fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            await new Promise((resolve, reject) => {
                output.on('close', resolve);
                archive.on('error', reject);
                archive.pipe(output);
                
                // Add PackageContents.xml at bundle root
                archive.file(_path.join(bundleFolder, 'PackageContents.xml'), { 
                    name: 'ExtractParamsBundle.bundle/PackageContents.xml' 
                });
                
                // Add Contents folder with iLogic rule
                archive.file(_path.join(bundleFolder, 'Contents', 'ExtractParams.iLogicVb'), { 
                    name: 'ExtractParamsBundle.bundle/Contents/ExtractParams.iLogicVb' 
                });
                
                archive.finalize();
            });
            
            console.log('Bundle ZIP created at:', zipPath);
            
            // Create app bundle
            const bundleSpec = dav3.AppBundle.constructFromObject({
                package: bundleName,
                engine: engineName,
                id: bundleName,
                description: 'Auto-extracts parameters from Inventor IPT/IAM files'
            });
            
            const newBundle = await api.createAppBundle(bundleSpec);
            
            // Create alias
            await api.createAppBundleAlias(bundleName, { id: Utils.Alias, version: 1 });
            
            // Upload the bundle ZIP
            await Utils.uploadFormDataWithFile(
                zipPath,
                newBundle.uploadParameters.endpointURL,
                newBundle.uploadParameters.formData
            );
            
            results.bundle = { created: true, id: qualifiedBundleId, version: 1 };
            console.log('ExtractParams AppBundle created successfully');
        } else {
            results.bundle = { created: false, id: qualifiedBundleId, exists: true };
        }
        
        // Check if activity already exists
        let activityExists = false;
        try {
            const activities = await api.getActivities();
            activityExists = activities.data.includes(qualifiedActivityId);
        } catch (ex) {
            console.log('Error checking activities:', ex.message);
        }
        
        if (!activityExists) {
            // Create the activity for parameter extraction
            console.log('Creating ExtractParams Activity...');
            
            // Use /s to run iLogic script, /al to load the AppBundle containing the script
            // The AppBundle's PackageContents.xml triggers the rule on document open
            const activitySpec = {
                id: activityName,
                appbundles: [qualifiedBundleId],
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
                        description: 'Extracted parameters JSON',
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
            await api.createActivityAlias(activityName, { id: Utils.Alias, version: 1 });
            
            results.activity = { created: true, id: qualifiedActivityId, version: 1 };
            console.log('ExtractParams Activity created successfully');
        } else {
            results.activity = { created: false, id: qualifiedActivityId, exists: true };
        }
        
        res.json({
            success: true,
            message: 'ExtractParams setup complete',
            ...results
        });
        
    } catch (ex) {
        console.error('Setup extraction error:', ex);
        res.status(500).json({ 
            diagnostic: 'Failed to setup parameter extraction: ' + ex.message,
            stack: ex.stack
        });
    }
});

// Check if extraction setup is complete
router.get('/extract-parameters/status', async (req, res) => {
    try {
        const api = await Utils.dav3API(req.oauth_token);
        
        const bundleName = 'ExtractParamsBundle';
        const activityName = 'ExtractParamsActivity';
        const qualifiedBundleId = `${Utils.NickName}.${bundleName}+${Utils.Alias}`;
        const qualifiedActivityId = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
        
        let bundleExists = false;
        let activityExists = false;
        
        try {
            const bundles = await api.getAppBundles();
            bundleExists = bundles.data.includes(qualifiedBundleId);
        } catch (ex) {}
        
        try {
            const activities = await api.getActivities();
            activityExists = activities.data.includes(qualifiedActivityId);
        } catch (ex) {}
        
        res.json({
            ready: bundleExists && activityExists,
            bundle: { id: qualifiedBundleId, exists: bundleExists },
            activity: { id: qualifiedActivityId, exists: activityExists }
        });
    } catch (ex) {
        res.status(500).json({ diagnostic: ex.message });
    }
});

// Reset/delete extraction bundle and activity (to allow re-creation)
router.delete('/extract-parameters/reset', async (req, res) => {
    try {
        const api = await Utils.dav3API(req.oauth_token);
        const results = { bundle: null, activity: null };
        
        const bundleName = 'ExtractParamsBundle';
        const activityName = 'ExtractParamsActivity';
        
        // Delete activity first (depends on bundle)
        try {
            await api.deleteActivity(activityName);
            results.activity = { deleted: true };
            console.log('ExtractParams Activity deleted');
        } catch (ex) {
            results.activity = { deleted: false, error: ex.message };
        }
        
        // Delete bundle
        try {
            await api.deleteAppBundle(bundleName);
            results.bundle = { deleted: true };
            console.log('ExtractParams Bundle deleted');
        } catch (ex) {
            results.bundle = { deleted: false, error: ex.message };
        }
        
        res.json({
            success: true,
            message: 'Extraction setup reset. Run setup again to recreate.',
            ...results
        });
    } catch (ex) {
        res.status(500).json({ diagnostic: ex.message });
    }
});

// Get iLogic template for parameter extraction
router.get('/extract-parameters/template', async (req, res) => {
    try {
        const templatePath = _path.join(Utils.LocalBundlesFolder, 'ExtractParams', 'Contents', 'ExtractParams.iLogicVb');
        
        if (_fs.existsSync(templatePath)) {
            const code = _fs.readFileSync(templatePath, 'utf8');
            res.json({
                success: true,
                code: code,
                instructions: {
                    step1: 'Copy this iLogic code to your Inventor iLogic editor',
                    step2: 'Run the rule on your IPT/IAM file to test locally',
                    step3: 'The code extracts all user parameters and outputs parameters.json',
                    step4: 'For Design Automation, package this in an AppBundle',
                    step5: 'Use /api/extract-parameters/setup to auto-create the bundle'
                }
            });
        } else {
            res.status(404).json({ diagnostic: 'Template not found' });
        }
    } catch (ex) {
        res.status(500).json({ diagnostic: ex.message });
    }
});

// Extract parameters from an Inventor file using Design Automation
router.post('/extract-parameters', async (req, res) => {
    try {
        const { ossBucket, ossObjectKey, browserConnectionId } = req.body;

        if (!ossBucket || !ossObjectKey) {
            return res.status(400).json({ diagnostic: 'ossBucket and ossObjectKey are required' });
        }

        // Get signed URLs for input and output (required - legacy OSS URLs are deprecated)
        const objectsApi = new ForgeAPI.ObjectsApi();
        
        // Get signed URL for input file (read access)
        let inputSignedUrl;
        try {
            const postBucketsSigned = {
                minutesExpiration: 60
            };
            const inputSigned = await objectsApi.createSignedResource(
                ossBucket,
                ossObjectKey,
                postBucketsSigned,
                { access: 'read' },
                req.oauth_client,
                req.oauth_token
            );
            inputSignedUrl = inputSigned.body.signedUrl;
        } catch (ex) {
            console.error('Failed to create signed URL for input:', ex);
            return res.status(400).json({ 
                diagnostic: 'Failed to access input file. Make sure the file exists in OSS.',
                error: ex.message
            });
        }
        
        // Output JSON file for extracted parameters
        const timestamp = new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14);
        const outputFileName = `${timestamp}_params_${ossObjectKey.replace(/\.[^/.]+$/, '')}.json`;
        
        // Get signed URL for output file (write access)
        let outputSignedUrl;
        try {
            const postBucketsSignedOutput = {
                minutesExpiration: 60
            };
            const outputSigned = await objectsApi.createSignedResource(
                ossBucket,
                outputFileName,
                postBucketsSignedOutput,
                { access: 'write' },
                req.oauth_client,
                req.oauth_token
            );
            outputSignedUrl = outputSigned.body.signedUrl;
        } catch (ex) {
            console.error('Failed to create signed URL for output:', ex);
            return res.status(400).json({ 
                diagnostic: 'Failed to create output location.',
                error: ex.message
            });
        }
        
        // Input file from signed URL (no auth headers needed)
        const inputFileArgument = {
            url: inputSignedUrl,
            verb: dav3.Verb.get
        };

        // Output JSON file with signed URL
        const outputFileArgument = {
            url: outputSignedUrl,
            verb: dav3.Verb.put
        };

        // Check if ExtractParams activity exists, if not inform user
        const activityId = `${Utils.NickName}.ExtractParamsActivity+${Utils.Alias}`;
        
        const workItemSpec = {
            activityId: activityId,
            arguments: {
                inputFile: inputFileArgument,
                outputJson: outputFileArgument
            }
        };

        const api = await Utils.dav3API(req.oauth_token);
        let workItemStatus;
        
        try {
            workItemStatus = await api.createWorkItem(workItemSpec);
        } catch (ex) {
            // Activity might not exist yet
            if (ex.statusCode === 404 || ex.message?.includes('not found')) {
                return res.status(404).json({ 
                    diagnostic: 'ExtractParamsActivity not found. Please create the parameter extraction activity first.',
                    hint: 'Upload ExtractParamsBundle.zip and create ExtractParamsActivity',
                    activityNeeded: activityId
                });
            }
            throw ex;
        }

        // Monitor workitem and return results when complete
        monitorParameterExtraction(
            req.oauth_client, 
            req.oauth_token, 
            workItemStatus.id, 
            browserConnectionId, 
            ossBucket,
            outputFileName
        );

        res.json({
            workItemId: workItemStatus.id,
            status: 'started',
            message: 'Parameter extraction started. Results will be sent via socket.'
        });
    } catch (ex) {
        console.error('Extract parameters error:', ex);
        res.status(500).json({ diagnostic: 'Failed to extract parameters: ' + ex.message });
    }
});

// Monitor parameter extraction workitem
async function monitorParameterExtraction(oauthClient, oauthToken, workItemId, browserConnectionId, bucketKey, outputFileName) {
    const socketIO = global.socketIO;
    
    try {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const api = await Utils.dav3API(oauthToken);
            const status = await api.getWorkitemStatus(workItemId);
            
            socketIO.to(browserConnectionId).emit('extractionProgress', { 
                status: status.status, 
                progress: status.progress 
            });
            
            if (status.status === 'pending' || status.status === 'inprogress') {
                continue;
            }
            
            if (status.status === 'success') {
                // Download the output JSON with extracted parameters
                try {
                    const objectsApi = new ForgeAPI.ObjectsApi();
                    const objectData = await objectsApi.getObject(
                        bucketKey, 
                        outputFileName, 
                        {}, 
                        oauthClient, 
                        oauthToken
                    );
                    
                    // Parse the JSON content
                    let parametersJson;
                    if (Buffer.isBuffer(objectData.body)) {
                        parametersJson = JSON.parse(objectData.body.toString());
                    } else {
                        parametersJson = objectData.body;
                    }
                    
                    socketIO.to(browserConnectionId).emit('extractionComplete', {
                        success: true,
                        parameters: parametersJson.parameters || parametersJson
                    });
                } catch (downloadError) {
                    console.error('Failed to download extracted parameters:', downloadError);
                    socketIO.to(browserConnectionId).emit('extractionComplete', {
                        success: false,
                        error: 'Failed to download extracted parameters'
                    });
                }
            } else {
                // Report failure
                let errorDetails = status.status;
                if (status.reportUrl) {
                    try {
                        const response = await fetch(status.reportUrl);
                        errorDetails = await response.text();
                    } catch (e) {}
                }
                socketIO.to(browserConnectionId).emit('extractionComplete', {
                    success: false,
                    error: errorDetails
                });
            }
            break;
        }
    } catch (ex) {
        console.error('Monitor parameter extraction error:', ex);
        socketIO.to(browserConnectionId).emit('extractionComplete', {
            success: false,
            error: ex.message
        });
    }
}

// ============================================================================
// PROPERTY EXTRACTION API
// ============================================================================

router.post('/extract-properties/setup', async (req, res) => {
    console.log('=== ExtractProperties Setup Started ===');
    try {
        const engineName = req.body.engine || 'Autodesk.Inventor+2025';
        console.log('Engine:', engineName);
        console.log('Getting DA API...');
        const api = await Utils.dav3API(req.oauth_token);
        console.log('DA API obtained');
        const results = { bundle: null, activity: null };
        
        // Bundle and activity names
        const bundleName = 'ExtractPropertiesBundle';
        const activityName = 'ExtractPropertiesActivity';
        const qualifiedBundleId = `${Utils.NickName}.${bundleName}+${Utils.Alias}`;
        const qualifiedActivityId = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
        console.log('Bundle ID:', qualifiedBundleId);
        console.log('Activity ID:', qualifiedActivityId);
        
        // Check if bundle already exists
        let bundleExists = false;
        try {
            const bundles = await api.getAppBundles();
            bundleExists = bundles.data.includes(qualifiedBundleId);
        } catch (ex) {
            console.log('Error checking bundles:', ex.message);
        }
        
        if (!bundleExists) {
            // Create the bundle
            console.log('Creating ExtractProperties AppBundle...');
            
            // ExtractProperties source is in server/bundles
            const bundleFolder = _path.join(__dirname, '..', 'bundles', 'ExtractProperties');
            const zipPath = _path.join(__dirname, '..', 'bundles', 'ExtractPropertiesBundle.zip');
            
            // Remove old ZIP if exists to avoid including it in the new ZIP
            if (_fs.existsSync(zipPath)) {
                _fs.unlinkSync(zipPath);
            }
            
            // Create ZIP using archiver - only include necessary files
            const archiver = require('archiver');
            const output = _fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            await new Promise((resolve, reject) => {
                output.on('close', resolve);
                archive.on('error', reject);
                archive.pipe(output);
                
                // Add PackageContents.xml at bundle root
                archive.file(_path.join(bundleFolder, 'PackageContents.xml'), { 
                    name: 'ExtractPropertiesBundle.bundle/PackageContents.xml' 
                });
                
                // Add Contents folder with iLogic rule
                archive.file(_path.join(bundleFolder, 'Contents', 'ExtractProperties.iLogicVb'), { 
                    name: 'ExtractPropertiesBundle.bundle/Contents/ExtractProperties.iLogicVb' 
                });
                
                archive.finalize();
            });
            
            console.log('Bundle ZIP created at:', zipPath);
            
            // Create app bundle
            const bundleSpec = dav3.AppBundle.constructFromObject({
                package: bundleName,
                engine: engineName,
                id: bundleName,
                description: 'Auto-extracts properties from Inventor IPT/IAM files'
            });
            
            const newBundle = await api.createAppBundle(bundleSpec);
            
            // Create alias
            await api.createAppBundleAlias(bundleName, { id: Utils.Alias, version: 1 });
            
            // Upload the bundle ZIP
            await Utils.uploadFormDataWithFile(
                zipPath,
                newBundle.uploadParameters.endpointURL,
                newBundle.uploadParameters.formData
            );
            
            results.bundle = { created: true, id: qualifiedBundleId, version: 1 };
            console.log('ExtractProperties AppBundle created successfully');
        } else {
            results.bundle = { created: false, id: qualifiedBundleId, exists: true };
        }
        
        // Check if activity already exists
        let activityExists = false;
        try {
            const activities = await api.getActivities();
            activityExists = activities.data.includes(qualifiedActivityId);
        } catch (ex) {
            console.log('Error checking activities:', ex.message);
        }
        
        if (!activityExists) {
            // Create the activity for parameter extraction
            console.log('Creating ExtractProperties Activity...');
            
            // Use /s to run iLogic script, /al to load the AppBundle containing the script
            // The AppBundle's PackageContents.xml triggers the rule on document open
            const activitySpec = {
                id: activityName,
                appbundles: [qualifiedBundleId],
                commandLine: [
                    '$(engine.path)\\InventorCoreConsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[ExtractPropertiesBundle].path)"'
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
                        description: 'Extracted properties JSON',
                        localName: 'properties.json',
                        ondemand: false,
                        required: true,
                        verb: dav3.Verb.put,
                        zip: false
                    }
                }
            };
            
            await api.createActivity(activitySpec);
            
            // Create alias
            await api.createActivityAlias(activityName, { id: Utils.Alias, version: 1 });
            
            results.activity = { created: true, id: qualifiedActivityId, version: 1 };
            console.log('ExtractProperties Activity created successfully');
        } else {
            results.activity = { created: false, id: qualifiedActivityId, exists: true };
        }
        
        res.json({
            success: true,
            message: 'ExtractProperties setup complete',
            ...results
        });
        
    } catch (ex) {
        console.error('Setup extraction error:', ex);
        res.status(500).json({ 
            diagnostic: 'Failed to setup parameter extraction: ' + ex.message,
            stack: ex.stack
        });
    }
});

router.post('/extract-properties', async (req, res) => {
    try {
        const { ossBucket, ossObjectKey, browserConnectionId } = req.body;

        if (!ossBucket || !ossObjectKey) {
            return res.status(400).json({ diagnostic: 'ossBucket and ossObjectKey are required' });
        }

        // Get signed URLs for input and output (required - legacy OSS URLs are deprecated)
        const objectsApi = new ForgeAPI.ObjectsApi();
        
        // Get signed URL for input file (read access)
        let inputSignedUrl;
        try {
            const postBucketsSigned = {
                minutesExpiration: 60
            };
            const inputSigned = await objectsApi.createSignedResource(
                ossBucket,
                ossObjectKey,
                postBucketsSigned,
                { access: 'read' },
                req.oauth_client,
                req.oauth_token
            );
            inputSignedUrl = inputSigned.body.signedUrl;
        } catch (ex) {
            console.error('Failed to create signed URL for input:', ex);
            return res.status(400).json({ 
                diagnostic: 'Failed to access input file. Make sure the file exists in OSS.',
                error: ex.message
            });
        }
        
        // Output JSON file for extracted parameters
        const timestamp = new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14);
        const outputFileName = `${timestamp}_props_${ossObjectKey.replace(/\.[^/.]+$/, '')}.json`;
        
        // Get signed URL for output file (write access)
        let outputSignedUrl;
        try {
            const postBucketsSignedOutput = {
                minutesExpiration: 60
            };
            const outputSigned = await objectsApi.createSignedResource(
                ossBucket,
                outputFileName,
                postBucketsSignedOutput,
                { access: 'write' },
                req.oauth_client,
                req.oauth_token
            );
            outputSignedUrl = outputSigned.body.signedUrl;
        } catch (ex) {
            console.error('Failed to create signed URL for output:', ex);
            return res.status(400).json({ 
                diagnostic: 'Failed to create output location.',
                error: ex.message
            });
        }
        
        // Input file from signed URL (no auth headers needed)
        const inputFileArgument = {
            url: inputSignedUrl,
            verb: dav3.Verb.get
        };

        // Output JSON file with signed URL
        const outputFileArgument = {
            url: outputSignedUrl,
            verb: dav3.Verb.put
        };

        // Check if ExtractProperties activity exists, if not inform user
        const activityId = `${Utils.NickName}.ExtractPropertiesActivity+${Utils.Alias}`;
        
        const workItemSpec = {
            activityId: activityId,
            arguments: {
                inputFile: inputFileArgument,
                outputJson: outputFileArgument
            }
        };

        const api = await Utils.dav3API(req.oauth_token);
        let workItemStatus;
        
        try {
            workItemStatus = await api.createWorkItem(workItemSpec);
        } catch (ex) {
            // Activity might not exist yet
            if (ex.statusCode === 404 || ex.message?.includes('not found')) {
                return res.status(404).json({ 
                    diagnostic: 'ExtractPropertiesActivity not found. Please create the parameter extraction activity first.',
                    hint: 'Upload ExtractPropertiesBundle.zip and create ExtractPropertiesActivity',
                    activityNeeded: activityId
                });
            }
            throw ex;
        }

        // Monitor workitem and return results when complete
        monitorPropertyExtraction(
            req.oauth_client, 
            req.oauth_token, 
            workItemStatus.id, 
            browserConnectionId, 
            ossBucket,
            outputFileName
        );

        res.json({
            workItemId: workItemStatus.id,
            status: 'started',
            message: 'Parameter extraction started. Results will be sent via socket.'
        });
    } catch (ex) {
        console.error('Extract parameters error:', ex);
        res.status(500).json({ diagnostic: 'Failed to extract parameters: ' + ex.message });
    }
});

async function monitorPropertyExtraction(oauthClient, oauthToken, workItemId, browserConnectionId, bucketKey, outputFileName) {
    const socketIO = global.socketIO;
    
    try {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const api = await Utils.dav3API(oauthToken);
            const status = await api.getWorkitemStatus(workItemId);
            
            socketIO.to(browserConnectionId).emit('propertyExtractionProgress', { 
                status: status.status, 
                progress: status.progress 
            });
            
            if (status.status === 'pending' || status.status === 'inprogress') {
                continue;
            }
            
            if (status.status === 'success') {
                // Download the output JSON with extracted properties
                try {
                    const objectsApi = new ForgeAPI.ObjectsApi();
                    const objectData = await objectsApi.getObject(
                        bucketKey, 
                        outputFileName, 
                        {}, 
                        oauthClient, 
                        oauthToken
                    );
                    
                    // Parse the JSON content
                    let parametersJson;
                    if (Buffer.isBuffer(objectData.body)) {
                        parametersJson = JSON.parse(objectData.body.toString());
                    } else {
                        parametersJson = objectData.body;
                    }
                    
                    socketIO.to(browserConnectionId).emit('propertyExtractionComplete', {
                        success: true,
                        properties: parametersJson.properties || parametersJson
                    });
                } catch (downloadError) {
                    console.error('Failed to download extracted properties:', downloadError);
                    socketIO.to(browserConnectionId).emit('propertyExtractionComplete', {
                        success: false,
                        error: 'Failed to download extracted properties'
                    });
                }
            } else {
                // Report failure
                let errorDetails = status.status;
                if (status.reportUrl) {
                    try {
                        const response = await fetch(status.reportUrl);
                        errorDetails = await response.text();
                    } catch (e) {}
                }
                socketIO.to(browserConnectionId).emit('propertyExtractionComplete', {
                    success: false,
                    error: errorDetails
                });
            }
            break;
        }
    } catch (ex) {
        console.error('Monitor parameter extraction error:', ex);
        socketIO.to(browserConnectionId).emit('propertyExtractionComplete', {
            success: false,
            error: ex.message
        });
    }
}




// Simple property reading using Model Derivative API (no Design Automation required)
router.post('/extract-properties-simple', async (req, res) => {
    try {
        const { ossBucket, ossObjectKey } = req.body;

        if (!ossBucket || !ossObjectKey) {
            return res.status(400).json({ success: false, message: 'ossBucket and ossObjectKey are required' });
        }

        // Build URN from OSS object
        const objectId = `urn:adsk.objects:os.object:${ossBucket}/${ossObjectKey}`;
        const urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const derivativesApi = new ForgeAPI.DerivativesApi();
        
        try {
            const metadata = await derivativesApi.getMetadata(urn, {}, req.oauth_client, req.oauth_token);

            if (!metadata?.body?.data?.metadata?.length) {
                return res.json({ 
                    success: false, 
                    message: 'File not translated yet. Translate first by opening it in the viewer.',
                    hint: 'Click View on the file in OSS to trigger translation'
                });
            }

            const viewableId = metadata.body.data.metadata[0]?.guid;
            if (!viewableId) {
                return res.json({ success: false, message: 'No viewable found in metadata' });
            }

            // Get all properties
            const propsResult = await derivativesApi.getModelviewProperties(
                urn, viewableId, {}, req.oauth_client, req.oauth_token
            );
            
            const collection = propsResult?.body?.data?.collection || [];
            
            // Extract physical properties and iProperties from the model
            const physicalProperties = {};
            const iProperties = {};
            
            collection.forEach(item => {
                const props = item.properties || {};
                
                // Look for physical properties
                if (props['Physical']) {
                    const phys = props['Physical'];
                    if (phys['Mass']) physicalProperties.mass = { value: parseFloat(phys['Mass']) || phys['Mass'], unit: 'kg' };
                    if (phys['Volume']) physicalProperties.volume = { value: parseFloat(phys['Volume']) || phys['Volume'], unit: 'cm³' };
                    if (phys['Area']) physicalProperties.area = { value: parseFloat(phys['Area']) || phys['Area'], unit: 'cm²' };
                    if (phys['Material Name']) physicalProperties.material = phys['Material Name'];
                }
                
                // Look for iProperties / document properties
                if (props['Document Summary Information']) {
                    Object.entries(props['Document Summary Information']).forEach(([key, val]) => {
                        if (val && String(val).trim()) iProperties[key] = val;
                    });
                }
                if (props['Design Tracking Properties']) {
                    Object.entries(props['Design Tracking Properties']).forEach(([key, val]) => {
                        if (val && String(val).trim()) iProperties[key] = val;
                    });
                }
            });

            return res.json({
                success: true,
                properties: { physicalProperties, iProperties },
                source: 'model-derivative'
            });

        } catch (ex) {
            if (ex.statusCode === 404) {
                return res.json({ 
                    success: false, 
                    message: 'File not translated yet. Open it in the viewer first to trigger translation.',
                });
            }
            throw ex;
        }
    } catch (ex) {
        console.error('Simple extract properties error:', ex);
        res.status(500).json({ success: false, message: 'Failed to extract properties: ' + ex.message });
    }
});

// Simplified parameter reading for files already translated (using Model Derivative)
router.post('/extract-parameters-simple', async (req, res) => {
    try {
        const { ossBucket, ossObjectKey } = req.body;

        if (!ossBucket || !ossObjectKey) {
            return res.status(400).json({ diagnostic: 'ossBucket and ossObjectKey are required' });
        }

        // Construct URN
        const objectId = `urn:adsk.objects:os.object:${ossBucket}/${ossObjectKey}`;
        const urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // Try to get metadata from Model Derivative API
        const derivativesApi = new ForgeAPI.DerivativesApi();
        
        try {
            const metadata = await derivativesApi.getMetadata(urn, {}, req.oauth_client, req.oauth_token);
            
            if (metadata.body?.data?.metadata) {
                const viewableId = metadata.body.data.metadata[0]?.guid;
                
                if (viewableId) {
                    // Get properties
                    const properties = await derivativesApi.getModelviewProperties(
                        urn, 
                        viewableId, 
                        {}, 
                        req.oauth_client, 
                        req.oauth_token
                    );
                    
                    // Extract parameters from properties
                    const extractedParams = extractParametersFromProperties(properties.body);
                    
                    return res.json({
                        success: true,
                        parameters: extractedParams,
                        source: 'model-derivative'
                    });
                }
            }
            
            res.json({
                success: false,
                message: 'No metadata available. File may need translation first, or use Design Automation extraction.',
                hint: 'Use the full extraction with Design Automation for Inventor parameters'
            });
        } catch (ex) {
            if (ex.statusCode === 404) {
                return res.json({
                    success: false,
                    message: 'File not translated yet. Translate first or use Design Automation extraction.',
                    hint: 'Click "View" on the file in OSS to trigger translation'
                });
            }
            throw ex;
        }
    } catch (ex) {
        console.error('Simple extract parameters error:', ex);
        res.status(500).json({ diagnostic: 'Failed to extract parameters: ' + ex.message });
    }
});

// Helper to extract parameter-like properties from Model Derivative
function extractParametersFromProperties(propertiesData) {
    const parameters = [];
    
    try {
        const collection = propertiesData?.data?.collection || [];
        
        collection.forEach(item => {
            const props = item.properties || {};
            
            // Look for Inventor parameters (usually in specific categories)
            Object.keys(props).forEach(category => {
                if (category.toLowerCase().includes('parameter') || 
                    category.toLowerCase().includes('dimension') ||
                    category === 'Inventor' ||
                    category === 'Parameters') {
                    
                    const categoryProps = props[category];
                    Object.keys(categoryProps).forEach(propName => {
                        const value = categoryProps[propName];
                        
                        // Try to determine type
                        let paramType = 'text';
                        let numValue = parseFloat(value);
                        
                        if (!isNaN(numValue)) {
                            paramType = 'number';
                        } else if (value === 'true' || value === 'false') {
                            paramType = 'boolean';
                        }
                        
                        parameters.push({
                            name: propName,
                            displayName: propName.replace(/([A-Z])/g, ' $1').trim(),
                            type: paramType,
                            defaultValue: paramType === 'number' ? numValue : value,
                            unit: extractUnit(propName, value),
                            group: category
                        });
                    });
                }
            });
        });
    } catch (ex) {
        console.error('Error extracting parameters:', ex);
    }
    
    return parameters;
}

// Helper to extract units from parameter names or values
function extractUnit(name, value) {
    const nameLower = name.toLowerCase();
    const valueStr = String(value);
    
    // Common unit patterns
    if (nameLower.includes('width') || nameLower.includes('height') || 
        nameLower.includes('depth') || nameLower.includes('length') ||
        nameLower.includes('size') || nameLower.includes('dimension')) {
        return 'mm';
    }
    if (nameLower.includes('angle') || nameLower.includes('rotation')) {
        return 'deg';
    }
    if (nameLower.includes('weight') || nameLower.includes('mass')) {
        return 'kg';
    }
    
    // Try to extract from value string
    const unitMatch = valueStr.match(/[\d.]+\s*([a-zA-Z]+)/);
    if (unitMatch) {
        return unitMatch[1];
    }
    
    return '';
}

// Get iLogic code template for parameter extraction
router.get('/extract-parameters/template', (req, res) => {
    const iLogicCode = `' =====================================================
' PARAMETER EXTRACTION iLogic CODE
' For use with Design Automation
' =====================================================
' This code extracts all user parameters from an Inventor
' file and outputs them as JSON for use in SydeFlow
' =====================================================

Imports System.IO
Imports Newtonsoft.Json

Sub Main()
    ' Get the document
    Dim doc As Document = ThisApplication.ActiveDocument
    
    ' Create parameter list
    Dim paramList As New List(Of Object)
    
    ' Handle Part documents
    If TypeOf doc Is PartDocument Then
        Dim partDoc As PartDocument = doc
        ExtractParameters(partDoc.ComponentDefinition.Parameters.UserParameters, paramList)
    
    ' Handle Assembly documents
    ElseIf TypeOf doc Is AssemblyDocument Then
        Dim assyDoc As AssemblyDocument = doc
        ExtractParameters(assyDoc.ComponentDefinition.Parameters.UserParameters, paramList)
    End If
    
    ' Create output object
    Dim output As New Dictionary(Of String, Object)
    output("fileName") = doc.DisplayName
    output("fileType") = doc.DocumentType.ToString()
    output("parameters") = paramList
    output("extractedAt") = DateTime.Now.ToString("o")
    
    ' Serialize to JSON
    Dim json As String = JsonConvert.SerializeObject(output, Formatting.Indented)
    
    ' Write to output file
    Dim outputPath As String = IO.Path.Combine(IO.Path.GetDirectoryName(doc.FullFileName), "parameters.json")
    IO.File.WriteAllText(outputPath, json)
    
    ' Log success
    Logger.Info("Parameters extracted successfully: " & paramList.Count & " parameters")
End Sub

Sub ExtractParameters(userParams As UserParameters, paramList As List(Of Object))
    For Each param As UserParameter In userParams
        Dim paramInfo As New Dictionary(Of String, Object)
        
        paramInfo("name") = param.Name
        paramInfo("displayName") = FormatDisplayName(param.Name)
        paramInfo("expression") = param.Expression
        paramInfo("unit") = GetUnitString(param)
        
        ' Determine type and get value
        If param.ParameterType = ParameterTypeEnum.kTextParameter Then
            paramInfo("type") = "text"
            paramInfo("defaultValue") = param.Expression
        ElseIf param.ParameterType = ParameterTypeEnum.kBooleanParameter Then
            paramInfo("type") = "boolean"
            paramInfo("defaultValue") = param.Value
        Else
            paramInfo("type") = "number"
            paramInfo("defaultValue") = param.Value
            
            ' Try to get numeric limits if defined
            Try
                If param.HasLimits Then
                    paramInfo("min") = param.LowerBound
                    paramInfo("max") = param.UpperBound
                End If
            Catch
                ' Limits not available
            End Try
        End If
        
        ' Add to list
        paramList.Add(paramInfo)
    Next
End Sub

Function FormatDisplayName(name As String) As String
    ' Convert camelCase or d0, d1 style names to readable format
    Dim result As String = name
    
    ' Handle d0, d1, d2 style parameters
    If System.Text.RegularExpressions.Regex.IsMatch(name, "^d\\d+$") Then
        Return "Parameter " & name
    End If
    
    ' Add spaces before capitals
    result = System.Text.RegularExpressions.Regex.Replace(name, "([a-z])([A-Z])", "$1 $2")
    
    ' Capitalize first letter
    If result.Length > 0 Then
        result = Char.ToUpper(result(0)) & result.Substring(1)
    End If
    
    Return result
End Function

Function GetUnitString(param As UserParameter) As String
    Try
        Dim units As UnitsOfMeasure = ThisApplication.ActiveDocument.UnitsOfMeasure
        Dim unitType As UnitsTypeEnum = param.Units
        
        Select Case unitType
            Case UnitsTypeEnum.kMillimeterLengthUnits
                Return "mm"
            Case UnitsTypeEnum.kCentimeterLengthUnits
                Return "cm"
            Case UnitsTypeEnum.kMeterLengthUnits
                Return "m"
            Case UnitsTypeEnum.kInchLengthUnits
                Return "in"
            Case UnitsTypeEnum.kFootLengthUnits
                Return "ft"
            Case UnitsTypeEnum.kDegreeAngleUnits
                Return "deg"
            Case UnitsTypeEnum.kRadianAngleUnits
                Return "rad"
            Case Else
                Return ""
        End Select
    Catch
        Return ""
    End Try
End Function
`;

    res.json({
        code: iLogicCode,
        instructions: {
            step1: "Save this code as 'ExtractParams.iLogicVb'",
            step2: "Create an AppBundle ZIP containing the code",
            step3: "Upload the ZIP to server/bundles/ folder",
            step4: "Create the AppBundle and Activity using Design Automation view",
            step5: "The activity should have: inputFile (input), outputJson (output)",
            activityName: "ExtractParamsActivity",
            bundleName: "ExtractParamsBundle"
        }
    });
});

module.exports = router;
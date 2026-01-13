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

router.use(bodyParser.json());

/// <summary>
/// Get access token for the Autodesk Viewer
/// </summary>
router.get('/auth/token', async (req, res) => {
    try {
        console.log('Token endpoint called, requesting scopes:', config.scopes.public);
        let client = await getClient(config.scopes.public);
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
    req.oauth_client = await getClient(/*config.scopes.internal*/);
    req.oauth_token = req.oauth_client.getCredentials();
    next();
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
        console.error('Translation status error:', ex);
        res.status(500).json({ diagnostic: 'Failed to get translation status: ' + ex.message });
    }
});

/// <summary>
/// Upload file for direct viewing (without Design Automation)
/// </summary>
router.post('/upload', multer({ dest: 'uploads/' }).single('file'), async (req, res) => {
    try {
        console.log('Upload endpoint called for file:', req.file ? req.file.originalname : 'no file');
        
        if (!req.file) {
            return res.status(400).json({ diagnostic: 'No file uploaded' });
        }

        const bucketKey = config.credentials.client_id.toLowerCase() + '-designautomation';
        
        // Ensure bucket exists
        try {
            let payload = new ForgeAPI.PostBucketsPayload();
            payload.bucketKey = bucketKey;
            payload.policyKey = 'transient';
            await new ForgeAPI.BucketsApi().createBucket(payload, {}, req.oauth_client, req.oauth_token);
        } catch (ex) {
            // Bucket might already exist, continue
        }

        // Upload file
        const objectKey = `viewer_${new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14)}_${_path.basename(req.file.originalname)}`;
        
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
});

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
        return (_path.resolve(_path.join(__dirname, '../', 'bundles')));
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
/// Names of app bundles on this project
/// </summary>
router.get('/appbundles', async /*GetLocalBundles*/(req, res) => {
    // this folder is placed under the public folder, which may expose the bundles
    // but it was defined this way so it be published on most hosts easily
    let bundles = await Utils.findFiles(Utils.LocalBundlesFolder, '.zip');
    bundles = bundles.map((fn) => _path.basename(fn, '.zip'));
    res.json(bundles);
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

    // check if ZIP with bundle is here
    const packageZipPath = _path.join(Utils.LocalBundlesFolder, zipFileName + '.zip');

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
                
                // Emit URN for viewer to poll translation status
                socketIO.to(browserConnectionId).emit('workitemComplete', { 
                    urn: urn,
                    objectId: objectId,
                    bucketKey: bucketKey,
                    objectKey: outputFileName
                });
                
                // Also provide download link
                response = await objectsApi.getS3DownloadURL(bucketKey, outputFileName, { 
                    useAcceleration: false, minutesExpiration: 15 
                }, freshClient, freshToken);
                socketIO.to(browserConnectionId).emit('downloadResult', response.body.url);
            } else {
                throw new Error('Work item failed...');
            }
            await objectsApi.deleteObject(bucketKey, inputFileName, oauthClient, oauthToken);
            return;
        }
    } catch (err) {
        console.error(err);
        socketIO.to(browserConnectionId).emit('onError', err);
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
// PARAMETER EXTRACTION API
// ============================================================================

// Extract parameters from an Inventor file using Design Automation
router.post('/extract-parameters', async (req, res) => {
    try {
        const { ossBucket, ossObjectKey, browserConnectionId } = req.body;

        if (!ossBucket || !ossObjectKey) {
            return res.status(400).json({ diagnostic: 'ossBucket and ossObjectKey are required' });
        }

        const bearerToken = ["Bearer", req.oauth_token.access_token].join(" ");
        
        // Input file from OSS
        const inputFileArgument = {
            url: `https://developer.api.autodesk.com/oss/v2/buckets/${ossBucket}/objects/${encodeURIComponent(ossObjectKey)}`,
            headers: { "Authorization": bearerToken }
        };

        // Output JSON file for extracted parameters
        const timestamp = new Date().toISOString().replace(/[-T:\.Z]/gm, '').substring(0, 14);
        const outputFileName = `${timestamp}_params_${ossObjectKey.replace(/\.[^/.]+$/, '')}.json`;
        const outputFileArgument = {
            url: `https://developer.api.autodesk.com/oss/v2/buckets/${ossBucket}/objects/${encodeURIComponent(outputFileName)}`,
            verb: dav3.Verb.put,
            headers: { "Authorization": bearerToken }
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
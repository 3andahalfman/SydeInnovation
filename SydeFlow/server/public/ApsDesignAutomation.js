$(document).ready(function () {
    prepareLists();
    initializeViewer();

    $('#clearAccount').click(clearAccount);
    $('#defineActivityShow').click(defineActivityModal);
    $('#createAppBundleActivity').click(createAppBundleActivity);
    $('#uploadAndView').click(uploadAndView);
    $('#startWorkitem').click(startWorkitem);
    $('#downloadResult').click(downloadResultFile);

    startConnection();
});

// Store the download URL
var downloadUrl = null;

function downloadResultFile() {
    if (downloadUrl) {
        window.open(downloadUrl, '_blank');
    }
}

// Autodesk Viewer variables
var viewer;
var documentId;

function initializeViewer() {
    var viewerContainer = document.getElementById('forgeViewer');
    
    // Check if viewer container exists
    if (!viewerContainer) {
        console.error('Viewer container not found');
        return;
    }
    
    // Check if Autodesk library is loaded
    if (typeof Autodesk === 'undefined') {
        console.error('Autodesk Viewer library not loaded, retrying...');
        setTimeout(initializeViewer, 1000);
        return;
    }
    
    var options = {
        env: 'AutodeskProduction',
        getAccessToken: function (onTokenReady) {
            console.log('Fetching viewer token from /api/auth/token');
            fetch('/api/auth/token')
                .then(response => {
                    console.log('Token response status:', response.status);
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Token received, expires in:', data.expires_in);
                    onTokenReady(data.access_token, data.expires_in);
                })
                .catch(error => {
                    console.error('Error fetching access token:', error);
                    if (typeof writeLog === 'function') {
                        writeLog('Error: Could not fetch viewer token - ' + error.message);
                    }
                });
        }
    };
    
    Autodesk.Viewing.Initializer(options, function onInitialized() {
        console.log('Viewer initialized, creating GuiViewer3D');
        var viewerConfig = {
            extensions: ['Autodesk.ViewCubeUi']
        };
        viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainer, viewerConfig);
        var startedCode = viewer.start();
        if (startedCode > 0) {
            console.error('Failed to create a Viewer: WebGL not supported.');
            return;
        }
        console.log('Viewer started successfully');
        if (typeof writeLog === 'function') {
            writeLog('Autodesk Viewer initialized');
        }
    });
}

function loadModelInViewer(modelUrn) {
    if (!viewer) {
        writeLog('Viewer not initialized');
        return;
    }
    
    viewer.clearAll();
    Autodesk.Viewing.Document.load(
        'urn:' + modelUrn,
        function onDocumentLoadSuccess(doc) {
            var viewables = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewables);
            writeLog('Model loaded in viewer: ' + modelUrn);
        },
        function onDocumentLoadFailure(error) {
            writeLog('Failed to load model: ' + error);
        }
    );
}

function prepareLists() {
    list('activity', '/api/aps/designautomation/activities');
    list('engines', '/api/aps/designautomation/engines');
    list('localBundles', '/api/appbundles');
}

function list(control, endpoint) {
    $('#' + control).find('option').remove().end();
    jQuery.ajax({
        url: endpoint,
        success: function (list) {
            if (list.length === 0)
                $('#' + control).append($('<option>', {
                    disabled: true,
                    text: 'Nothing found'
                }));
            else
                list.forEach(function (item) {
                    $('#' + control).append($('<option>', {
                        value: item,
                        text: item
                    }));
                });
        }
    });
}

function clearAccount() {
    if (!confirm('Clear existing activities & appbundles before start. ' +
        'This is useful if you believe there are wrong settings on your account.' +
        '\n\nYou cannot undo this operation. Proceed?'))
        return;

    jQuery.ajax({
        url: 'api/aps/designautomation/account',
        method: 'DELETE',
        success: function () {
            prepareLists();
            writeLog('Account cleared, all appbundles & activities deleted');
        }
    });
}

function defineActivityModal() {
    $("#defineActivityModal").modal();
}

function createAppBundleActivity() {
    startConnection(function () {
        writeLog("Defining appbundle and activity for " + $('#engines').val());
        $("#defineActivityModal").modal('toggle');
        createAppBundle(function () {
            createActivity(function () {
                prepareLists();
            });
        });
    });
}

function createAppBundle(cb) {
    jQuery.ajax({
        url: 'api/aps/designautomation/appbundles',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            zipFileName: $('#localBundles').val(),
            engine: $('#engines').val()
        }),
        success: function (res) {
            writeLog('AppBundle: ' + res.appBundle + ', v' + res.version);
            if (cb)
                cb();
        },
        error: function (xhr, ajaxOptions, thrownError) {
            writeLog(' -> ' + (xhr.responseJSON && xhr.responseJSON.diagnostic ? xhr.responseJSON.diagnostic : thrownError));
        }
    });
}

function createActivity(cb) {
    jQuery.ajax({
        url: 'api/aps/designautomation/activities',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            zipFileName: $('#localBundles').val(),
            engine: $('#engines').val()
        }),
        success: function (res) {
            writeLog('Activity: ' + res.activity);
            if (cb)
                cb();
        },
        error: function (xhr, ajaxOptions, thrownError) {
            writeLog(' -> ' + (xhr.responseJSON && xhr.responseJSON.diagnostic ? xhr.responseJSON.diagnostic : thrownError));
        }
    });
}

function startWorkitem() {
    var inputFileField = document.getElementById('inputFile');
    if (inputFileField.files.length === 0) {
        alert('Please select an input file');
        return;
    }
    if ($('#activity').val() === null)
        return (alert('Please select an activity'));
    var file = inputFileField.files[0];
    startConnection(function () {
        var formData = new FormData();
        formData.append('inputFile', file);
        formData.append('data', JSON.stringify({
            width: $('#width').val(),
            height: $('#height').val(),
            activityName: $('#activity').val(),
            browserConnectionId: connectionId
        }));
        writeLog('Uploading input file...');
        $.ajax({
            url: 'api/aps/designautomation/workitems',
            data: formData,
            processData: false,
            contentType: false,
            //contentType: 'multipart/form-data',
            //dataType: 'json',
            type: 'POST',
            success: function (res) {
                writeLog('Workitem started: ' + res.workItemId);
            },
            error: function (xhr, ajaxOptions, thrownError) {
                writeLog(' -> ' + (xhr.responseJSON && xhr.responseJSON.diagnostic ? xhr.responseJSON.diagnostic : thrownError));
            }
        });
    });
}

function uploadAndView() {
    var inputFileField = document.getElementById('inputFile');
    if (inputFileField.files.length === 0) {
        alert('Please select a file to upload and view');
        return;
    }
    
    var file = inputFileField.files[0];
    var formData = new FormData();
    formData.append('file', file);
    
    writeLog('Uploading file to view: ' + file.name);
    
    $.ajax({
        url: 'api/upload',
        data: formData,
        processData: false,
        contentType: false,
        type: 'POST',
        success: function (res) {
            writeLog('File uploaded successfully, starting translation...');
            if (res.urn) {
                pollTranslationStatus(res.urn);
            }
        },
        error: function (xhr, ajaxOptions, thrownError) {
            writeLog(' -> Upload failed: ' + (xhr.responseJSON && xhr.responseJSON.diagnostic ? xhr.responseJSON.diagnostic : thrownError));
        }
    });
}

function writeLog(text) {
    $('#outputlog').append('<div style="border-top: 1px dashed #C0C0C0">' + text + '</div>');
    var elem = document.getElementById('outputlog');
    elem.scrollTop = elem.scrollHeight;
}

var connection;
var connectionId;

function startConnection(onReady) {
    if (connection && connection.connected) {
        if (onReady)
            onReady();
        return;
    }
    connection = io();
    connection.on('connect', function () {
        connectionId = connection.id;
        if (onReady)
            onReady();
    });

    connection.on('downloadResult', function (url) {
        writeLog('Result file ready for download');
        downloadUrl = url;
        $('#downloadResult').prop('disabled', false);
    });

    connection.on('workitemComplete', function (data) {
        writeLog('Workitem complete, starting translation for modified model...');
        if (data.urn) {
            pollTranslationStatus(data.urn);
        }
    });

    connection.on('downloadReport', function (url) {
        writeLog('<a href="' + url + '">Download report file here</a>');
    });

    connection.on('onComplete', function (message) {
        if (typeof message === 'object') {
            // Check if this is a workitem status with URN
            if (message.status === 'success' && message.reportUrl) {
                writeLog('Workitem completed successfully!');
            }
            message = JSON.stringify(message, null, 2);
        }
        writeLog(message);
    });
}

function pollTranslationStatus(urn) {
    writeLog('Checking translation status...');
    
    $.ajax({
        url: 'api/translation/' + urn,
        type: 'GET',
        success: function (res) {
            if (res.status === 'success') {
                writeLog('Translation complete, loading model...');
                loadModelFromUrn(urn);
            } else if (res.status === 'inprogress') {
                writeLog('Translation in progress (' + res.progress + ')...');
                setTimeout(function() { pollTranslationStatus(urn); }, 3000);
            } else if (res.status === 'failed') {
                writeLog('Translation failed');
            } else {
                writeLog('Translation status: ' + res.status);
                setTimeout(function() { pollTranslationStatus(urn); }, 3000);
            }
        },
        error: function (xhr, ajaxOptions, thrownError) {
            writeLog('Failed to check translation status: ' + thrownError);
        }
    });
}

function loadModelFromUrn(urn) {
    if (!viewer) {
        writeLog('Viewer not initialized');
        return;
    }
    
    const documentId = 'urn:' + urn;
    writeLog('Loading model in viewer...');
    
    Autodesk.Viewing.Document.load(documentId, function onDocumentLoadSuccess(doc) {
        var viewables = doc.getRoot().getDefaultGeometry();
        viewer.loadDocumentNode(doc, viewables).then(function() {
            writeLog('Model loaded successfully');
        });
    }, function onDocumentLoadFailure(errorCode) {
        writeLog('Failed to load document: ' + errorCode);
    });
}

// Load model from a signed URL
function loadModelFromUrl(signedUrl) {
    if (!viewer) {
        writeLog('Viewer not initialized yet');
        return;
    }
    
    writeLog('Loading model in viewer...');
    
    // Use the viewer's loadModel with the signed URL directly
    viewer.loadModel(signedUrl, {}, function onSuccess() {
        writeLog('Model loaded successfully in viewer');
    }, function onError(errorCode) {
        writeLog('Failed to load model in viewer: ' + errorCode);
    });
}

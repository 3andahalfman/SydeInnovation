'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, FileCode, RefreshCw, CheckCircle, 
  XCircle, Clock, Loader2, ChevronDown, ChevronRight,
  Download, Eye, AlertCircle, Box, Settings, Zap, 
  Package, Folder, File, HardDrive, Cpu, ArrowRight,
  RotateCcw, ExternalLink, Info
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ============================================================================
// TYPES - All data-driven, no hardcoded values
// ============================================================================

interface OSSBucket {
  bucketKey: string;
  createdDate: string;
  policyKey: string;
}

interface OSSObject {
  objectKey: string;
  objectId: string;
  sha1: string;
  size: number;
  location: string;
}

interface CADParameter {
  name: string;
  value: string | number | boolean;
  type: 'number' | 'text' | 'boolean' | 'select';
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  description?: string;
}

interface AppBundle {
  name: string;
  engine: string;
  version?: number;
  status: 'local' | 'registered' | 'ready';
}

interface Activity {
  name: string;
  appBundle: string;
  engine: string;
  status: 'defined' | 'ready';
}

interface WorkItemJob {
  id: string;
  status: 'queued' | 'pending' | 'inprogress' | 'success' | 'failed' | 'cancelled';
  progress: string;
  startTime: Date;
  endTime?: Date;
  inputFile?: string;
  outputFile?: string;
  outputUrn?: string;
  reportUrl?: string;
  error?: string;
}

type WorkflowStep = 'select-file' | 'configure' | 'execute' | 'results';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AutomationDashboard() {
  // Connection state
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('select-file');
  
  // File Selection (Step 1)
  const [buckets, setBuckets] = useState<OSSBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [objects, setObjects] = useState<OSSObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<OSSObject | null>(null);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);

  // Configuration (Step 2) - Data-driven parameters
  const [parameters, setParameters] = useState<CADParameter[]>([]);
  const [loadingParams, setLoadingParams] = useState(false);
  
  // AppBundle & Activity
  const [localBundles, setLocalBundles] = useState<string[]>([]);
  const [registeredBundles, setRegisteredBundles] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [selectedBundle, setSelectedBundle] = useState('');
  const [selectedEngine, setSelectedEngine] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');

  // Execution (Step 3)
  const [currentJob, setCurrentJob] = useState<WorkItemJob | null>(null);
  const [jobHistory, setJobHistory] = useState<WorkItemJob[]>([]);

  // Results (Step 4)
  const [outputFiles, setOutputFiles] = useState<{name: string, url: string}[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewerUrn, setViewerUrn] = useState<string>('');

  // Logs
  const [logs, setLogs] = useState<{time: string, level: 'info' | 'success' | 'error' | 'warn', message: string}[]>([]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    // Connect to socket.io
    socketRef.current = io('http://localhost:8080', {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      addLog('info', 'Connected to Design Automation server');
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
      addLog('warn', 'Disconnected from server');
    });

    // WorkItem status updates
    socketRef.current.on('onComplete', (data: any) => {
      if (typeof data === 'string') {
        // This is the report text
        addLog('info', 'Received workitem report');
      } else {
        updateJobStatus(data);
      }
    });

    socketRef.current.on('workitemComplete', (data: any) => {
      addLog('success', `WorkItem completed! Output ready for viewing.`);
      setCurrentJob(prev => prev ? {
        ...prev,
        status: 'success',
        endTime: new Date(),
        outputUrn: data.urn,
        outputFile: data.objectKey
      } : null);
      setViewerUrn(data.urn);
      setCurrentStep('results');
    });

    socketRef.current.on('downloadResult', (url: string) => {
      setOutputFiles(prev => [...prev, { name: 'Output Model', url }]);
    });

    socketRef.current.on('onError', (error: any) => {
      addLog('error', `WorkItem error: ${error.message || error}`);
      setCurrentJob(prev => prev ? {
        ...prev,
        status: 'failed',
        endTime: new Date(),
        error: error.message || String(error)
      } : null);
    });

    // Load initial data
    loadBuckets();
    loadSetupData();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // ============================================================================
  // LOGGING
  // ============================================================================

  const addLog = useCallback((level: 'info' | 'success' | 'error' | 'warn', message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-100), { time, level, message }]);
  }, []);

  const updateJobStatus = (data: any) => {
    if (data.status) {
      setCurrentJob(prev => prev ? {
        ...prev,
        status: data.status,
        progress: data.progress || prev.progress
      } : null);
      
      if (data.status === 'inprogress') {
        addLog('info', 'WorkItem is processing...');
      }
    }
  };

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadBuckets = async () => {
    setLoadingBuckets(true);
    try {
      const res = await fetch('/api/oss/buckets');
      const data = await res.json();
      setBuckets(Array.isArray(data) ? data : []);
      addLog('info', `Loaded ${data.length || 0} OSS buckets`);
    } catch (err) {
      addLog('error', 'Failed to load buckets');
    } finally {
      setLoadingBuckets(false);
    }
  };

  const loadObjects = async (bucketKey: string) => {
    setLoadingObjects(true);
    setSelectedBucket(bucketKey);
    try {
      const res = await fetch(`/api/oss/buckets/${bucketKey}/objects`);
      const data = await res.json();
      setObjects(Array.isArray(data) ? data : []);
      addLog('info', `Loaded ${data.length || 0} objects from ${bucketKey}`);
    } catch (err) {
      addLog('error', `Failed to load objects from ${bucketKey}`);
    } finally {
      setLoadingObjects(false);
    }
  };

  const loadSetupData = async () => {
    try {
      const [bundlesRes, enginesRes, activitiesRes, registeredRes] = await Promise.all([
        fetch('/api/appbundles'),
        fetch('/api/aps/designautomation/engines'),
        fetch('/api/aps/designautomation/activities'),
        fetch('/api/aps/appbundles')
      ]);

      const bundles = await bundlesRes.json();
      const enginesList = await enginesRes.json();
      const activitiesList = await activitiesRes.json();
      const registered = await registeredRes.json();

      setLocalBundles(Array.isArray(bundles) ? bundles : []);
      setEngines(Array.isArray(enginesList) ? enginesList : []);
      setActivities(Array.isArray(activitiesList) ? activitiesList : []);
      setRegisteredBundles(Array.isArray(registered) ? registered : []);

      // Auto-select Inventor engine
      const inventorEngine = enginesList.find((e: string) => e.includes('Inventor+2025'));
      if (inventorEngine) setSelectedEngine(inventorEngine);
      else if (enginesList.length > 0) setSelectedEngine(enginesList[0]);

      if (bundles.length > 0) setSelectedBundle(bundles[0]);
      if (activitiesList.length > 0) setSelectedActivity(activitiesList[0]);

    } catch (err) {
      addLog('error', 'Failed to load setup data');
    }
  };

  // ============================================================================
  // FILE SELECTION & PARAMETER EXTRACTION
  // ============================================================================

  const selectFile = async (obj: OSSObject) => {
    setSelectedObject(obj);
    addLog('info', `Selected: ${obj.objectKey}`);
    
    // Extract parameters from file (data-driven)
    await extractParameters(obj);
    setCurrentStep('configure');
  };

  const extractParameters = async (obj: OSSObject) => {
    setLoadingParams(true);
    try {
      // Try to get parameters from API (if file has been analyzed)
      const res = await fetch(`/api/oss/buckets/${selectedBucket}/objects/${encodeURIComponent(obj.objectKey)}/parameters`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.parameters && data.parameters.length > 0) {
          setParameters(data.parameters);
          addLog('success', `Extracted ${data.parameters.length} parameters from ${obj.objectKey}`);
        } else {
          setParameters([]);
          addLog('info', 'No parameters defined for this file');
        }
      } else {
        setParameters([]);
      }
    } catch (err) {
      setParameters([]);
    } finally {
      setLoadingParams(false);
    }
  };

  const updateParameter = (name: string, value: string | number | boolean) => {
    setParameters(prev => prev.map(p => 
      p.name === name ? { ...p, value } : p
    ));
  };

  // ============================================================================
  // APPBUNDLE & ACTIVITY MANAGEMENT
  // ============================================================================

  const createAppBundle = async () => {
    if (!selectedBundle || !selectedEngine) {
      addLog('error', 'Please select a bundle and engine');
      return;
    }

    addLog('info', `Creating AppBundle: ${selectedBundle}...`);
    
    try {
      const res = await fetch('/api/aps/designautomation/appbundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFileName: selectedBundle,
          engine: selectedEngine
        })
      });

      if (res.ok) {
        const data = await res.json();
        addLog('success', `AppBundle created: ${data.appBundle} v${data.version}`);
        loadSetupData(); // Refresh
      } else {
        const error = await res.json();
        addLog('error', `Failed to create AppBundle: ${error.diagnostic}`);
      }
    } catch (err) {
      addLog('error', 'AppBundle creation failed');
    }
  };

  const createActivity = async () => {
    if (!selectedBundle || !selectedEngine) {
      addLog('error', 'Please select a bundle and engine');
      return;
    }

    addLog('info', `Creating Activity for ${selectedBundle}...`);
    
    try {
      const res = await fetch('/api/aps/designautomation/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFileName: selectedBundle,
          engine: selectedEngine
        })
      });

      if (res.ok) {
        const data = await res.json();
        addLog('success', `Activity created: ${data.activity}`);
        loadSetupData(); // Refresh
      } else {
        const error = await res.json();
        addLog('error', `Failed to create Activity: ${error.diagnostic}`);
      }
    } catch (err) {
      addLog('error', 'Activity creation failed');
    }
  };

  // ============================================================================
  // WORKITEM EXECUTION
  // ============================================================================

  const executeWorkItem = async () => {
    if (!selectedBucket || !selectedObject || !selectedActivity) {
      addLog('error', 'Please select a bucket, file, and activity');
      return;
    }

    // Convert parameters to JSON payload
    const paramJson: Record<string, any> = {};
    parameters.forEach(p => {
      paramJson[p.name] = p.value;
    });

    addLog('info', `Starting WorkItem with ${selectedActivity}...`);
    addLog('info', `Using existing file in OSS: ${selectedBucket}/${selectedObject.objectKey}`);
    
    const job: WorkItemJob = {
      id: `job-${Date.now()}`,
      status: 'queued',
      progress: 'Initializing...',
      startTime: new Date(),
      inputFile: selectedObject.objectKey
    };
    setCurrentJob(job);
    setCurrentStep('execute');

    try {
      // Use the efficient endpoint that works with existing OSS files directly
      // No need to download and re-upload - just pass bucket/object references
      const res = await fetch('/api/aps/designautomation/workitems/from-oss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucketKey: selectedBucket,
          objectKey: selectedObject.objectKey,
          activityName: selectedActivity,
          browserConnectionId: socketRef.current?.id,
          parameters: paramJson
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentJob(prev => prev ? { 
          ...prev, 
          id: data.workItemId, 
          status: 'pending',
          outputFile: data.outputFile 
        } : null);
        addLog('success', `WorkItem submitted: ${data.workItemId}`);
        addLog('info', `Output will be saved to: ${data.bucket}/${data.outputFile}`);
      } else {
        const error = await res.json();
        addLog('error', `WorkItem failed: ${error.diagnostic}`);
        setCurrentJob(prev => prev ? { ...prev, status: 'failed', error: error.diagnostic } : null);
      }
    } catch (err) {
      addLog('error', 'WorkItem execution failed');
      setCurrentJob(prev => prev ? { ...prev, status: 'failed', error: String(err) } : null);
    }
  };

  // ============================================================================
  // VIEWER
  // ============================================================================

  const [viewerLoaded, setViewerLoaded] = useState(false);
  const viewerInstanceRef = useRef<any>(null);

  // Load Autodesk Viewer script
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).Autodesk) {
      // Load viewer CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
      document.head.appendChild(link);

      // Load viewer script
      const script = document.createElement('script');
      script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
      script.async = true;
      script.onload = () => {
        setViewerLoaded(true);
        addLog('info', 'Autodesk Viewer loaded');
      };
      script.onerror = () => {
        addLog('error', 'Failed to load Autodesk Viewer');
      };
      document.head.appendChild(script);
    } else if ((window as any).Autodesk) {
      setViewerLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (viewerUrn && viewerRef.current && viewerLoaded) {
      initializeViewer(viewerUrn);
    }
    
    // Cleanup viewer on unmount
    return () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.finish();
        viewerInstanceRef.current = null;
      }
    };
  }, [viewerUrn, viewerLoaded]);

  const initializeViewer = async (urn: string) => {
    if (!(window as any).Autodesk) {
      addLog('error', 'Viewer not loaded yet');
      return;
    }

    // Cleanup previous viewer instance
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.finish();
      viewerInstanceRef.current = null;
    }

    try {
      // Get token first
      const tokenRes = await fetch('/api/auth/token');
      const tokenData = await tokenRes.json();

      // Poll translation status before loading (pattern from aps-planique)
      addLog('info', 'Checking translation status...');
      
      const pollTranslationStatus = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const checkStatus = async () => {
            try {
              const manifestRes = await fetch(`/api/translation/${urn}`);
              if (manifestRes.ok) {
                const manifest = await manifestRes.json();
                
                if (manifest.status === 'success') {
                  addLog('success', 'Translation complete, loading model...');
                  resolve(true);
                } else if (manifest.status === 'failed') {
                  addLog('error', 'Translation failed');
                  resolve(false);
                } else if (manifest.status === 'inprogress' || manifest.status === 'pending') {
                  const progress = manifest.progress || 'starting...';
                  addLog('info', `Translation in progress (${progress})...`);
                  setTimeout(checkStatus, 3000); // Poll every 3 seconds (like aps-planique)
                } else {
                  addLog('info', `Translation status: ${manifest.status}`);
                  setTimeout(checkStatus, 3000);
                }
              } else {
                // Manifest not found yet - translation may not have started
                addLog('info', 'Waiting for translation to start...');
                setTimeout(checkStatus, 3000);
              }
            } catch (err) {
              addLog('warn', 'Translation check failed, retrying...');
              setTimeout(checkStatus, 3000);
            }
          };
          checkStatus();
        });
      };

      const translationReady = await pollTranslationStatus();
      if (!translationReady) {
        return;
      }

      const options = {
        env: 'AutodeskProduction',
        api: 'derivativeV2',
        getAccessToken: (callback: (token: string, expires: number) => void) => {
          callback(tokenData.access_token, tokenData.expires_in);
        }
      };

      const Autodesk = (window as any).Autodesk;
      
      Autodesk.Viewing.Initializer(options, () => {
        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerRef.current, {
          extensions: ['Autodesk.ViewCubeUi']
        });
        viewer.start();
        viewerInstanceRef.current = viewer;
        
        const documentId = `urn:${urn}`;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            if (viewables) {
              viewer.loadDocumentNode(doc, viewables).then(() => {
                // Wait for geometry to fully load before setting view
                viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                  // Fit model to view and set isometric camera
                  viewer.fitToView();
                  // Use navigation to set isometric view
                  const nav = viewer.navigation;
                  if (nav) {
                    // Set camera to isometric position (home view with isometric angle)
                    nav.setRequestHomeView(true);
                  }
                });
                addLog('success', 'Model loaded in viewer');
              });
            } else {
              addLog('warn', 'No viewable geometry found');
            }
          },
          (errorCode: number, errorMessage: string) => {
            addLog('error', `Viewer error: ${errorMessage || errorCode}`);
          }
        );
      });
    } catch (err) {
      addLog('error', `Viewer init failed: ${err}`);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['ipt', 'iam', 'idw', 'ipn'].includes(ext || '')) return <Box className="w-4 h-4 text-orange-500" />;
    if (['stp', 'step', 'igs', 'iges'].includes(ext || '')) return <Box className="w-4 h-4 text-blue-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (status: WorkItemJob['status']) => {
    switch (status) {
      case 'queued': return 'text-gray-500';
      case 'pending': return 'text-yellow-500';
      case 'inprogress': return 'text-blue-500';
      case 'success': return 'text-green-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: WorkItemJob['status']) => {
    switch (status) {
      case 'queued': return <Clock className="w-5 h-5" />;
      case 'pending': return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'inprogress': return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'failed': return <XCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Cpu className="w-6 h-6 text-orange-500" />
              Inventor Design Automation
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Data-driven workflow: Select → Configure → Execute → View
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            <button
              onClick={() => { loadBuckets(); loadSetupData(); }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="flex items-center gap-2 mt-4">
          {(['select-file', 'configure', 'execute', 'results'] as WorkflowStep[]).map((step, idx) => (
            <div key={step} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentStep === step 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <span className="capitalize">{step.replace('-', ' ')}</span>
              </button>
              {idx < 3 && <ArrowRight className="w-5 h-5 text-slate-600 mx-2" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Main Workflow */}
        <div className="flex-1 overflow-auto p-6">
          
          {/* Step 1: Select File */}
          {currentStep === 'select-file' && (
            <div className="space-y-6">
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-orange-500" />
                  Select CAD File from OSS Storage
                </h2>
                
                {/* Bucket Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Storage Bucket
                  </label>
                  <select
                    value={selectedBucket}
                    onChange={(e) => loadObjects(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select a bucket...</option>
                    {buckets.map(b => (
                      <option key={b.bucketKey} value={b.bucketKey}>
                        {b.bucketKey} ({b.policyKey})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Object List */}
                {selectedBucket && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Files ({objects.length})
                    </label>
                    {loadingObjects ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    ) : objects.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        No files in this bucket
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto border border-slate-600 rounded-lg">
                        {objects.map(obj => (
                          <button
                            key={obj.objectKey}
                            onClick={() => selectFile(obj)}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-600 last:border-b-0 ${
                              selectedObject?.objectKey === obj.objectKey ? 'bg-orange-500/20' : ''
                            }`}
                          >
                            {getFileIcon(obj.objectKey)}
                            <div className="flex-1 text-left">
                              <div className="text-white font-medium">{obj.objectKey}</div>
                              <div className="text-xs text-slate-400">{formatFileSize(obj.size)}</div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Upload */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-dashed border-slate-600">
                <div className="text-center">
                  <p className="text-slate-400 mb-2">
                    Don't see your file? Use <strong>File Sync</strong> or <strong>OSS Manager</strong> to upload CAD files.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === 'configure' && (
            <div className="space-y-6">
              {/* Selected File Info */}
              {selectedObject && (
                <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                  {getFileIcon(selectedObject.objectKey)}
                  <div className="flex-1">
                    <div className="text-white font-medium">{selectedObject.objectKey}</div>
                    <div className="text-sm text-slate-400">{formatFileSize(selectedObject.size)}</div>
                  </div>
                  <button
                    onClick={() => setCurrentStep('select-file')}
                    className="text-slate-400 hover:text-white"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Activity Selection - Main control */}
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Activity to Execute
                </h2>
                <select
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-base"
                >
                  <option value="">Select activity...</option>
                  {activities.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* AppBundle Management - Collapsible */}
              <details className="bg-slate-800 rounded-xl overflow-hidden group">
                <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">Advanced: Bundle & Activity Management</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="p-4 pt-0 border-t border-slate-700">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Local AppBundle
                      </label>
                      <select
                        value={selectedBundle}
                        onChange={(e) => setSelectedBundle(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        <option value="">Select bundle...</option>
                        {localBundles.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Engine
                      </label>
                      <select
                        value={selectedEngine}
                        onChange={(e) => setSelectedEngine(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        <option value="">Select engine...</option>
                        {engines.filter(e => e.includes('Inventor')).map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createAppBundle}
                      disabled={!selectedBundle || !selectedEngine}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Update Bundle
                    </button>
                    <button
                      onClick={createActivity}
                      disabled={!selectedBundle || !selectedEngine}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Update Activity
                    </button>
                  </div>
                </div>
              </details>

              {/* Parameters - Data Driven */}
              {/* Execute Button */}
              <button
                onClick={executeWorkItem}
                disabled={!selectedObject || !selectedActivity}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="w-6 h-6" />
                Execute Design Automation
              </button>
            </div>
          )}

          {/* Step 3: Execute */}
          {currentStep === 'execute' && currentJob && (
            <div className="space-y-6">
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-orange-500" />
                  WorkItem Execution
                </h2>

                {/* Job Status Card */}
                <div className={`p-6 rounded-xl border-2 ${
                  currentJob.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                  currentJob.status === 'failed' ? 'bg-red-500/10 border-red-500/30' :
                  'bg-slate-700 border-slate-600'
                }`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={getStatusColor(currentJob.status)}>
                      {getStatusIcon(currentJob.status)}
                    </div>
                    <div>
                      <div className="text-white font-semibold capitalize">{currentJob.status}</div>
                      <div className="text-sm text-slate-400">{currentJob.progress}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Job ID:</span>
                      <span className="text-white ml-2 font-mono">{currentJob.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Started:</span>
                      <span className="text-white ml-2">{currentJob.startTime.toLocaleTimeString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Input:</span>
                      <span className="text-white ml-2">{currentJob.inputFile}</span>
                    </div>
                    {currentJob.endTime && (
                      <div>
                        <span className="text-slate-400">Duration:</span>
                        <span className="text-white ml-2">
                          {Math.round((currentJob.endTime.getTime() - currentJob.startTime.getTime()) / 1000)}s
                        </span>
                      </div>
                    )}
                  </div>

                  {currentJob.error && (
                    <div className="mt-4 p-3 bg-red-500/20 rounded-lg border border-red-500/30">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="text-red-300 text-sm">{currentJob.error}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Animation */}
                {(currentJob.status === 'pending' || currentJob.status === 'inprogress') && (
                  <div className="mt-4">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 animate-pulse w-full" />
                    </div>
                    <p className="text-center text-slate-400 text-sm mt-2">
                      Processing in Autodesk Cloud...
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  {currentJob.status === 'success' && (
                    <button
                      onClick={() => setCurrentStep('results')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      View Results
                    </button>
                  )}
                  {currentJob.status === 'failed' && (
                    <button
                      onClick={() => setCurrentStep('configure')}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {currentStep === 'results' && (
            <div className="space-y-4">
              {/* Main Results Grid - Viewer takes priority */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 3D Viewer - Takes 2/3 of space */}
                <div className="lg:col-span-2 bg-slate-800 rounded-xl p-4">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-orange-500" />
                    3D Preview
                  </h2>

                  <div 
                    ref={viewerRef}
                    className="w-full bg-slate-900 rounded-lg border border-slate-600 overflow-hidden relative"
                    style={{ height: '450px' }}
                  >
                    {!viewerUrn && (
                      <div className="flex items-center justify-center h-full text-slate-400 absolute inset-0">
                        <div className="text-center">
                          <Box className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Viewer will load after translation completes</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Output Files Sidebar */}
                <div className="bg-slate-800 rounded-xl p-4 flex flex-col">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Download className="w-5 h-5 text-orange-500" />
                    Output Files
                  </h2>

                  {outputFiles.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                        <p className="text-sm">Waiting for output files...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 flex-1">
                      {outputFiles.map((file, idx) => (
                        <div key={idx} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-orange-500/50 transition-colors">
                          <div className="flex items-center gap-2 mb-2">
                            <FileCode className="w-5 h-5 text-green-400 flex-shrink-0" />
                            <span className="text-white text-sm font-medium truncate">{file.name}</span>
                          </div>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Job Info */}
                  {currentJob && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="text-xs text-slate-400 space-y-1">
                        <p><span className="text-slate-500">Status:</span> <span className="text-green-400">Completed</span></p>
                        <p><span className="text-slate-500">Duration:</span> {currentJob.startTime ? Math.round((Date.now() - new Date(currentJob.startTime).getTime()) / 1000) + 's' : 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* New Job Button */}
              <button
                onClick={() => {
                  setCurrentJob(null);
                  setOutputFiles([]);
                  setViewerUrn('');
                  setCurrentStep('select-file');
                }}
                className="w-full bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border border-slate-600"
              >
                <RotateCcw className="w-5 h-5" />
                Start New Job
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Logs */}
        <div className="w-72 flex-shrink-0 border-l border-slate-700 bg-slate-800/50 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-slate-400" />
              Activity Log
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
            {logs.map((log, idx) => (
              <div key={idx} className={`mb-1 ${
                log.level === 'error' ? 'text-red-400' :
                log.level === 'success' ? 'text-green-400' :
                log.level === 'warn' ? 'text-yellow-400' :
                'text-slate-400'
              }`}>
                <span className="text-slate-500">[{log.time}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

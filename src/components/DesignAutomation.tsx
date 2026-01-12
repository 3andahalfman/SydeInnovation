import { useState, useEffect, useCallback } from 'react';
import { Upload, Play, Settings, RefreshCw, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface DesignAutomationProps {
  onModelReady?: (urn: string) => void;
  onDownloadReady?: (url: string) => void;
  apiEndpoint?: string;
}

interface WorkItemStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed' | 'cancelled';
  progress?: string;
  reportUrl?: string;
  downloadUrl?: string;
}

interface Activity {
  name: string;
  id: string;
}

export default function DesignAutomation({
  onModelReady,
  onDownloadReady,
  apiEndpoint = 'http://localhost:8080'
}: DesignAutomationProps) {
  const [file, setFile] = useState<File | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [width, setWidth] = useState<string>('100');
  const [height, setHeight] = useState<string>('100');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workItemStatus, setWorkItemStatus] = useState<WorkItemStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionId, setConnectionId] = useState<string>('');
  const [showConfig, setShowConfig] = useState(false);
  const [engines, setEngines] = useState<string[]>([]);
  const [bundles, setBundles] = useState<string[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<string>('');
  const [selectedBundle, setSelectedBundle] = useState<string>('');

  // Add log entry
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(apiEndpoint, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnectionId(newSocket.id || '');
      addLog('Connected to server');
    });

    newSocket.on('onProgress', (progress: string) => {
      addLog(`Progress: ${progress}`);
      setWorkItemStatus(prev => prev ? { ...prev, progress } : { status: 'inprogress', progress });
    });

    newSocket.on('onComplete', (data: { status: string; reportUrl?: string; downloadUrl?: string }) => {
      addLog(`Work item completed: ${data.status}`);
      setIsProcessing(false);
      setWorkItemStatus({
        status: data.status as WorkItemStatus['status'],
        reportUrl: data.reportUrl,
        downloadUrl: data.downloadUrl
      });
      
      if (data.downloadUrl) {
        onDownloadReady?.(data.downloadUrl);
      }
    });

    newSocket.on('onError', (error: any) => {
      addLog(`Error: ${JSON.stringify(error)}`);
      setIsProcessing(false);
      setWorkItemStatus({ status: 'failed' });
    });

    newSocket.on('disconnect', () => {
      addLog('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [apiEndpoint, addLog, onDownloadReady]);

  // Fetch activities list
  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/aps/designautomation/activities`);
      const data = await response.json();
      setActivities(data);
      if (data.length > 0) setSelectedActivity(data[0]);
      addLog(`Loaded ${data.length} activities`);
    } catch (err) {
      addLog('Failed to fetch activities');
    }
  }, [apiEndpoint, addLog]);

  // Fetch engines list
  const fetchEngines = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/aps/designautomation/engines`);
      const data = await response.json();
      setEngines(data);
      if (data.length > 0) setSelectedEngine(data[0]);
    } catch (err) {
      addLog('Failed to fetch engines');
    }
  }, [apiEndpoint, addLog]);

  // Fetch local bundles
  const fetchBundles = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/appbundles`);
      const data = await response.json();
      setBundles(data);
      if (data.length > 0) setSelectedBundle(data[0]);
    } catch (err) {
      addLog('Failed to fetch bundles');
    }
  }, [apiEndpoint, addLog]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Upload and view directly
  const handleUploadAndView = async () => {
    if (!file) {
      addLog('Please select a file first');
      return;
    }

    setIsUploading(true);
    addLog(`Uploading ${file.name} for viewing...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiEndpoint}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      addLog('File uploaded successfully');
      addLog(`URN: ${data.urn}`);
      
      // Poll for translation status
      pollTranslation(data.urn);
    } catch (err) {
      addLog(`Upload error: ${err}`);
      setIsUploading(false);
    }
  };

  // Poll translation status
  const pollTranslation = async (urn: string) => {
    addLog('Checking translation status...');
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`${apiEndpoint}/api/translation/${urn}`);
        const data = await response.json();
        
        addLog(`Translation: ${data.status} (${data.progress || '0%'})`);
        
        if (data.status === 'complete' || data.status === 'success') {
          setIsUploading(false);
          addLog('Translation complete! Loading model...');
          onModelReady?.(urn);
        } else if (data.status === 'failed') {
          setIsUploading(false);
          addLog('Translation failed');
        } else {
          // Continue polling
          setTimeout(checkStatus, 3000);
        }
      } catch (err) {
        addLog(`Translation check error: ${err}`);
        setTimeout(checkStatus, 5000);
      }
    };

    checkStatus();
  };

  // Start Design Automation workitem
  const handleStartWorkitem = async () => {
    if (!file || !selectedActivity) {
      addLog('Please select a file and activity');
      return;
    }

    setIsProcessing(true);
    setWorkItemStatus({ status: 'pending' });
    addLog(`Starting workitem with activity: ${selectedActivity}`);

    const formData = new FormData();
    formData.append('inputFile', file);
    formData.append('data', JSON.stringify({
      width: parseFloat(width),
      height: parseFloat(height),
      activityName: selectedActivity,
      browserConnectionId: connectionId
    }));

    try {
      const response = await fetch(`${apiEndpoint}/api/aps/designautomation/workitems`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to start workitem');

      const data = await response.json();
      addLog(`Workitem started: ${data.workItemId}`);
      setWorkItemStatus({ status: 'inprogress' });
    } catch (err) {
      addLog(`Workitem error: ${err}`);
      setIsProcessing(false);
      setWorkItemStatus({ status: 'failed' });
    }
  };

  // Create AppBundle and Activity
  const handleCreateActivity = async () => {
    if (!selectedBundle || !selectedEngine) {
      addLog('Please select a bundle and engine');
      return;
    }

    addLog(`Creating AppBundle for ${selectedBundle}...`);

    try {
      // Create AppBundle
      const bundleResponse = await fetch(`${apiEndpoint}/api/aps/designautomation/appbundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFileName: selectedBundle,
          engine: selectedEngine
        })
      });

      const bundleData = await bundleResponse.json();
      addLog(`AppBundle: ${bundleData.appBundle || bundleData.diagnostic}`);

      // Create Activity
      addLog(`Creating Activity...`);
      const activityResponse = await fetch(`${apiEndpoint}/api/aps/designautomation/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFileName: selectedBundle,
          engine: selectedEngine
        })
      });

      const activityData = await activityResponse.json();
      addLog(`Activity: ${activityData.activity || activityData.diagnostic}`);

      // Refresh activities list
      fetchActivities();
    } catch (err) {
      addLog(`Error creating activity: ${err}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      addLog(`Selected file: ${e.target.files[0].name}`);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Design Automation</h3>
        <button
          onClick={() => {
            setShowConfig(!showConfig);
            if (!showConfig) {
              fetchEngines();
              fetchBundles();
            }
          }}
          className="p-2 glass rounded-lg hover:bg-white/20 transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="glass rounded-xl p-4 space-y-4">
          <h4 className="font-semibold text-white">Configure AppBundle & Activity</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Local Bundle</label>
              <select
                value={selectedBundle}
                onChange={(e) => setSelectedBundle(e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-white bg-transparent border border-white/20"
              >
                {bundles.length === 0 ? (
                  <option value="">No bundles found</option>
                ) : (
                  bundles.map(bundle => (
                    <option key={bundle} value={bundle}>{bundle}</option>
                  ))
                )}
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Engine</label>
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-white bg-transparent border border-white/20"
              >
                {engines.map(engine => (
                  <option key={engine} value={engine}>{engine}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            onClick={handleCreateActivity}
            className="w-full px-4 py-2 bg-orange-500/90 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            Create/Update AppBundle & Activity
          </button>
        </div>
      )}

      {/* File Upload */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Select CAD File</label>
          <div className="relative">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".ipt,.dwg,.rvt,.max,.iam,.stp,.step,.iges,.igs"
              className="hidden"
              id="cad-file-input"
            />
            <label
              htmlFor="cad-file-input"
              className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-orange-500/50 hover:bg-white/5 transition-all"
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-gray-400">
                {file ? file.name : 'Click to select a CAD file'}
              </span>
            </label>
          </div>
        </div>

        {/* Quick View Button */}
        <button
          onClick={handleUploadAndView}
          disabled={!file || isUploading}
          className="w-full px-4 py-3 bg-blue-500/90 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Upload & View
            </>
          )}
        </button>

        {/* Design Automation Section */}
        <div className="border-t border-white/10 pt-4 space-y-4">
          <h4 className="font-semibold text-white">Modify Parameters</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Width</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-white bg-transparent border border-white/20"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-white bg-transparent border border-white/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Activity</label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="w-full glass rounded-lg px-3 py-2 text-white bg-transparent border border-white/20"
            >
              {activities.length === 0 ? (
                <option value="">No activities (configure first)</option>
              ) : (
                activities.map(activity => (
                  <option key={activity} value={activity}>{activity}</option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={handleStartWorkitem}
            disabled={!file || !selectedActivity || isProcessing}
            className="w-full px-4 py-3 bg-orange-500/90 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Automation
              </>
            )}
          </button>
        </div>

        {/* Status */}
        {workItemStatus && (
          <div className={`p-4 rounded-xl ${
            workItemStatus.status === 'success' ? 'bg-green-500/20 border border-green-500/30' :
            workItemStatus.status === 'failed' ? 'bg-red-500/20 border border-red-500/30' :
            'bg-blue-500/20 border border-blue-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {workItemStatus.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : workItemStatus.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
              )}
              <span className="text-white capitalize">{workItemStatus.status}</span>
              {workItemStatus.progress && (
                <span className="text-gray-400 text-sm">({workItemStatus.progress})</span>
              )}
            </div>
            
            {workItemStatus.downloadUrl && (
              <a
                href={workItemStatus.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-orange-400 hover:text-orange-300"
              >
                <Download className="w-4 h-4" />
                Download Result
              </a>
            )}
          </div>
        )}
      </div>

      {/* Console Output */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-400">Console</h4>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        </div>
        <div className="glass rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <span className="text-gray-500">Ready...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-gray-300">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

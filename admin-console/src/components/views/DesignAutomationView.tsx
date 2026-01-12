'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Play, Upload, FileCode, RefreshCw, CheckCircle, 
  XCircle, Clock, Loader2, ChevronDown, ChevronRight,
  Terminal, Download, Eye, Trash2, AlertCircle, Box,
  Settings, Zap, ArrowRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface WorkItemStatus {
  id: string;
  status: 'pending' | 'inprogress' | 'success' | 'failed';
  progress: string;
  report?: string;
  result?: any;
  startTime: Date;
  endTime?: Date;
}

interface Parameter {
  name: string;
  value: string | number;
  type: 'number' | 'text' | 'select';
  options?: string[];
  min?: number;
  max?: number;
}

export default function DesignAutomationView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrn, setUploadedUrn] = useState<string>('');
  const [parameters, setParameters] = useState<Parameter[]>([
    { name: 'Width', value: 1200, type: 'number', min: 600, max: 3000 },
    { name: 'Height', value: 2400, type: 'number', min: 1800, max: 3000 },
    { name: 'Depth', value: 600, type: 'number', min: 400, max: 900 },
    { name: 'Material', value: 'Oak', type: 'select', options: ['Oak', 'Walnut', 'Pine', 'MDF'] },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workItemStatus, setWorkItemStatus] = useState<WorkItemStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'parameters' | 'output'>('upload');
  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Connect to socket.io for real-time updates
    socketRef.current = io('http://localhost:8080', {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      addLog('🔌 Connected to APS server');
    });

    socketRef.current.on('disconnect', () => {
      addLog('❌ Disconnected from APS server');
    });

    socketRef.current.on('downloadResult', (data: any) => {
      addLog(`📦 Work item completed: ${data.status}`);
      if (data.reportUrl) {
        addLog(`📄 Report available at: ${data.reportUrl}`);
      }
      setWorkItemStatus(prev => prev ? {
        ...prev,
        status: data.status === 'success' ? 'success' : 'failed',
        endTime: new Date(),
        result: data
      } : null);
      setIsProcessing(false);
    });

    socketRef.current.on('onComplete', (data: any) => {
      addLog(`✅ Processing complete`);
      setIsProcessing(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      addLog(`📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    addLog(`⬆️ Uploading ${selectedFile.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/aps/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadedUrn(data.urn);
        addLog(`✅ Upload successful! URN: ${data.urn.substring(0, 30)}...`);
        setActiveTab('parameters');
      } else {
        addLog(`❌ Upload failed: ${data.diagnostic || 'Unknown error'}`);
      }
    } catch (error: any) {
      addLog(`❌ Upload error: ${error.message}`);
    }
    setIsProcessing(false);
  };

  const handleStartWorkItem = async () => {
    if (!uploadedUrn) {
      addLog('⚠️ Please upload a file first');
      return;
    }

    setIsProcessing(true);
    setWorkItemStatus({
      id: '',
      status: 'pending',
      progress: 'Starting...',
      startTime: new Date()
    });

    addLog('🚀 Starting Design Automation work item...');

    // Build parameters object
    const params: Record<string, any> = {};
    parameters.forEach(p => {
      params[p.name] = p.value;
    });

    addLog(`📊 Parameters: ${JSON.stringify(params)}`);

    try {
      const response = await fetch('/api/aps/workitems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputUrn: uploadedUrn,
          parameters: params,
          browerConnectionId: socketRef.current?.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        setWorkItemStatus(prev => prev ? {
          ...prev,
          id: data.workItemId,
          status: 'inprogress',
          progress: 'Processing...'
        } : null);
        addLog(`📋 Work item created: ${data.workItemId}`);
        setActiveTab('output');
      } else {
        addLog(`❌ Failed to create work item: ${data.diagnostic || 'Unknown error'}`);
        setWorkItemStatus(prev => prev ? { ...prev, status: 'failed' } : null);
        setIsProcessing(false);
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      setWorkItemStatus(prev => prev ? { ...prev, status: 'failed' } : null);
      setIsProcessing(false);
    }
  };

  const updateParameter = (index: number, value: string | number) => {
    setParameters(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('🧹 Logs cleared');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
      {/* Left Panel - Controls */}
      <div className="flex flex-col space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 bg-slate-800/30 p-2 rounded-xl">
          {(['upload', 'parameters', 'output'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6 overflow-auto">
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-orange-400" />
                  Upload Inventor Model
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Upload an Inventor assembly (.iam) or part (.ipt) file to process with Design Automation.
                </p>
              </div>

              {/* Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 hover:border-orange-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ipt,.iam,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">
                  {selectedFile ? selectedFile.name : 'Click to select or drag and drop'}
                </p>
                <p className="text-xs text-gray-600">
                  Supports .ipt, .iam, and .zip files
                </p>
              </div>

              {/* Selected File Info */}
              {selectedFile && (
                <div className="bg-slate-900/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCode className="w-8 h-8 text-orange-400" />
                    <div>
                      <p className="font-medium text-white">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Upload
                  </button>
                </div>
              )}

              {/* Uploaded URN */}
              {uploadedUrn && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="font-medium text-green-400">File Uploaded</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono break-all">
                    URN: {uploadedUrn}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'parameters' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-400" />
                  Design Parameters
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Configure the parameters that will be passed to your Inventor iLogic rules.
                </p>
              </div>

              <div className="space-y-4">
                {parameters.map((param, index) => (
                  <div key={param.name} className="bg-slate-900/50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {param.name}
                    </label>
                    {param.type === 'select' ? (
                      <select
                        value={param.value as string}
                        onChange={(e) => updateParameter(index, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                      >
                        {param.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={param.value}
                        min={param.min}
                        max={param.max}
                        onChange={(e) => updateParameter(index, Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                      />
                    )}
                    {param.min !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        Range: {param.min} - {param.max}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Run Button */}
              <button
                onClick={handleStartWorkItem}
                disabled={!uploadedUrn || isProcessing}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Start Design Automation
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'output' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Box className="w-5 h-5 text-orange-400" />
                  Output Results
                </h3>
              </div>

              {/* Status */}
              {workItemStatus && (
                <div className={`rounded-lg p-4 border ${
                  workItemStatus.status === 'success' 
                    ? 'bg-green-500/10 border-green-500/30'
                    : workItemStatus.status === 'failed'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    {workItemStatus.status === 'success' && <CheckCircle className="w-6 h-6 text-green-400" />}
                    {workItemStatus.status === 'failed' && <XCircle className="w-6 h-6 text-red-400" />}
                    {(workItemStatus.status === 'pending' || workItemStatus.status === 'inprogress') && (
                      <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                    )}
                    <div>
                      <p className="font-medium text-white capitalize">{workItemStatus.status}</p>
                      <p className="text-xs text-gray-400">{workItemStatus.progress}</p>
                    </div>
                  </div>
                  {workItemStatus.id && (
                    <p className="text-xs text-gray-500 font-mono">
                      Work Item ID: {workItemStatus.id}
                    </p>
                  )}
                </div>
              )}

              {/* Download Buttons */}
              {workItemStatus?.status === 'success' && workItemStatus.result && (
                <div className="space-y-3">
                  {workItemStatus.result.outputUrl && (
                    <a
                      href={workItemStatus.result.outputUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-green-500/30"
                    >
                      <Download className="w-5 h-5" />
                      Download Output Model
                    </a>
                  )}
                  {workItemStatus.result.reportUrl && (
                    <a
                      href={workItemStatus.result.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600"
                    >
                      <Eye className="w-5 h-5" />
                      View Report
                    </a>
                  )}
                </div>
              )}

              {!workItemStatus && (
                <div className="text-center py-12">
                  <Box className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-gray-500">No work item results yet</p>
                  <p className="text-sm text-gray-600">Upload a file and run Design Automation to see results</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Logs */}
      <div className="flex flex-col bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-orange-400" />
            <span className="font-medium text-white">Activity Log</span>
            <span className="text-xs text-gray-500">({logs.length} entries)</span>
          </div>
          <button
            onClick={clearLogs}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <p key={i} className="text-gray-300 leading-relaxed">{log}</p>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

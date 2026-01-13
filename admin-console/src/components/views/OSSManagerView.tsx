'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Database, FolderPlus, Trash2, RefreshCw, Upload, Download,
  File, Folder, ChevronRight, AlertCircle, CheckCircle,
  Loader2, Eye, X, HardDrive, Clock, Shield, Maximize2, Minimize2, Box, CloudCog
} from 'lucide-react';

declare global {
  interface Window {
    Autodesk: any;
  }
}

interface Bucket {
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

interface SyncInfo {
  syncedAt: string;
  sourceFolder?: string;
  sourceFile?: string;
  configId?: string;
}

export default function OSSManagerView() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<OSSObject[]>([]);
  const [syncedFiles, setSyncedFiles] = useState<Record<string, SyncInfo>>({});
  const [loading, setLoading] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New bucket form
  const [showNewBucketForm, setShowNewBucketForm] = useState(false);
  const [newBucketKey, setNewBucketKey] = useState('');
  const [newBucketPolicy, setNewBucketPolicy] = useState('transient');
  
  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Viewer state
  const [showViewer, setShowViewer] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerObject, setViewerObject] = useState<OSSObject | null>(null);
  const [translationStatus, setTranslationStatus] = useState<string | null>(null);
  const [viewerFullscreen, setViewerFullscreen] = useState(false);
  const viewerRef = useRef<any>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Load Autodesk Viewer scripts
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Autodesk) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const fetchBuckets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/oss/buckets');
      if (!response.ok) {
        throw new Error('Failed to fetch buckets');
      }
      const data = await response.json();
      // Handle different response formats
      let bucketList: Bucket[] = [];
      if (Array.isArray(data)) {
        bucketList = data;
      } else if (data.items && Array.isArray(data.items)) {
        bucketList = data.items;
      } else if (data.value && Array.isArray(data.value)) {
        bucketList = data.value;
      }
      setBuckets(bucketList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch buckets');
    } finally {
      setLoading(false);
    }
  };

  const fetchObjects = async (bucketKey: string) => {
    setLoadingObjects(true);
    setError(null);
    try {
      const response = await fetch(`/api/oss/buckets/${bucketKey}/objects`);
      if (!response.ok) {
        throw new Error('Failed to fetch objects');
      }
      const data = await response.json();
      // Handle different response formats
      let objectList: OSSObject[] = [];
      if (Array.isArray(data)) {
        objectList = data;
      } else if (data.items && Array.isArray(data.items)) {
        objectList = data.items;
      } else if (data.value && Array.isArray(data.value)) {
        objectList = data.value;
      }
      setObjects(objectList);
      
      // Fetch sync info for these objects
      if (objectList.length > 0) {
        fetchSyncedFiles(bucketKey, objectList.map(o => o.objectKey));
      } else {
        setSyncedFiles({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch objects');
    } finally {
      setLoadingObjects(false);
    }
  };

  const fetchSyncedFiles = async (bucketKey: string, objectKeys: string[]) => {
    try {
      const response = await fetch('/api/filesync/synced-files/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketKey, objectKeys })
      });
      if (response.ok) {
        const data = await response.json();
        setSyncedFiles(data);
      }
    } catch (err) {
      console.log('Could not fetch sync info:', err);
    }
  };

  const createBucket = async () => {
    if (!newBucketKey.trim()) {
      setError('Bucket key is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const bucketName = newBucketKey.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const response = await fetch('/api/oss/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bucketKey: bucketName,
          policyKey: newBucketPolicy 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // If bucket already exists (409), still close dialog and refresh
        if (response.status === 409) {
          setSuccess('Bucket already exists - refreshing list');
          setNewBucketKey('');
          setShowNewBucketForm(false);
          await fetchBuckets();
          setTimeout(() => setSuccess(null), 3000);
          return;
        }
        throw new Error(data.diagnostic || 'Failed to create bucket');
      }
      
      setSuccess('Bucket created successfully!');
      setNewBucketKey('');
      setShowNewBucketForm(false);
      await fetchBuckets();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bucket');
    } finally {
      setLoading(false);
    }
  };

  const deleteBucket = async (bucketKey: string) => {
    if (!confirm(`Are you sure you want to delete bucket "${bucketKey}"? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/oss/buckets/${bucketKey}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.diagnostic || 'Failed to delete bucket');
      }
      
      setSuccess('Bucket deleted successfully!');
      if (selectedBucket === bucketKey) {
        setSelectedBucket(null);
        setObjects([]);
      }
      fetchBuckets();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bucket');
    } finally {
      setLoading(false);
    }
  };

  const uploadObject = async () => {
    if (!uploadFile || !selectedBucket) return;
    
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('objectKey', uploadFile.name);
      
      const response = await fetch(`/api/oss/buckets/${selectedBucket}/objects`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.diagnostic || 'Failed to upload object');
      }
      
      setSuccess('File uploaded successfully!');
      setUploadFile(null);
      fetchObjects(selectedBucket);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload object');
    } finally {
      setUploading(false);
    }
  };

  const deleteObject = async (objectKey: string) => {
    if (!selectedBucket) return;
    if (!confirm(`Are you sure you want to delete "${objectKey}"?`)) return;
    
    setLoadingObjects(true);
    setError(null);
    try {
      const response = await fetch(`/api/oss/buckets/${selectedBucket}/objects/${encodeURIComponent(objectKey)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.diagnostic || 'Failed to delete object');
      }
      
      setSuccess('Object deleted successfully!');
      fetchObjects(selectedBucket);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete object');
    } finally {
      setLoadingObjects(false);
    }
  };

  const downloadObject = async (objectKey: string) => {
    if (!selectedBucket) return;
    
    try {
      const response = await fetch(`/api/oss/buckets/${selectedBucket}/objects/${encodeURIComponent(objectKey)}/download`);
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download object');
    }
  };

  // View object in 3D viewer
  const viewObject = async (obj: OSSObject) => {
    if (!selectedBucket) return;
    
    setViewerObject(obj);
    setShowViewer(true);
    setViewerLoading(true);
    setTranslationStatus('Starting translation...');
    
    try {
      const urn = btoa(obj.objectId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      // Try to start translation
      try {
        await fetch('/api/oss/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectId: obj.objectId }),
        });
      } catch (e) {
        console.log('Translation endpoint may not exist, continuing...');
      }
      
      setTranslationStatus('Checking translation status...');
      let translationComplete = false;
      let attempts = 0;
      
      while (!translationComplete && attempts < 60) {
        try {
          const statusResponse = await fetch(`/api/translation/${urn}`);
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            setTranslationStatus(`Translation: ${status.status} (${status.progress || '0%'})`);
            if (status.status === 'success' || status.status === 'complete') {
              translationComplete = true;
            } else if (status.status === 'failed') {
              throw new Error('Translation failed');
            }
          }
        } catch (e) {}
        
        if (!translationComplete) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
        }
      }
      
      setTimeout(() => initializeViewer(urn), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to view object');
      setViewerLoading(false);
    }
  };

  const initializeViewer = async (urn: string) => {
    if (!window.Autodesk || !viewerContainerRef.current) {
      setTranslationStatus('Loading viewer...');
      setTimeout(() => initializeViewer(urn), 1000);
      return;
    }

    try {
      const tokenResponse = await fetch('/api/auth/token');
      const tokenData = await tokenResponse.json();
      
      const options = {
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        getAccessToken: (callback: (token: string, expires: number) => void) => {
          callback(tokenData.access_token, tokenData.expires_in);
        }
      };

      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
      }

      window.Autodesk.Viewing.Initializer(options, () => {
        const viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current);
        viewerRef.current = viewer;
        viewer.start();
        
        const documentId = `urn:${urn}`;
        window.Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewables).then(() => {
              setViewerLoading(false);
              setTranslationStatus(null);
            });
          },
          (errorCode: number, errorMessage: string) => {
            console.error('Document load error:', errorCode, errorMessage);
            setError(`Failed to load model: ${errorMessage}`);
            setViewerLoading(false);
            setTranslationStatus(null);
          }
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize viewer');
      setViewerLoading(false);
    }
  };

  const closeViewer = () => {
    if (viewerRef.current) {
      viewerRef.current.finish();
      viewerRef.current = null;
    }
    setShowViewer(false);
    setViewerObject(null);
    setViewerLoading(false);
    setTranslationStatus(null);
    setViewerFullscreen(false);
  };

  const isViewableFile = (objectKey: string) => {
    const ext = objectKey.toLowerCase().split('.').pop();
    const viewableExtensions = ['ipt', 'iam', 'idw', 'dwg', 'dwf', 'rvt', 'rfa', 'nwd', 'nwc', 'stp', 'step', 'iges', 'igs', 'stl', 'obj', 'fbx', '3ds', 'sat', 'sab', 'catpart', 'catproduct', 'cgr', 'prt', 'asm', 'par', 'psm', 'sldprt', 'sldasm', 'slddrw', 'jt', 'x_t', 'x_b', 'neu'];
    return viewableExtensions.includes(ext || '');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPolicyColor = (policy: string) => {
    switch (policy) {
      case 'transient': return 'text-yellow-400 bg-yellow-500/10';
      case 'temporary': return 'text-orange-400 bg-orange-500/10';
      case 'persistent': return 'text-green-400 bg-green-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      fetchObjects(selectedBucket);
    }
  }, [selectedBucket]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">OSS Bucket Manager</h1>
          <p className="text-gray-400 mt-1">Manage Autodesk Object Storage Service buckets and objects</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBuckets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowNewBucketForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Bucket
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-400">{success}</span>
        </div>
      )}

      {/* 3D Viewer Modal */}
      {showViewer && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 ${viewerFullscreen ? 'p-0' : 'p-6'}`}>
          <div className={`bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden flex flex-col ${viewerFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[80vh]'}`}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-lg">
                  <Box className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm font-bold text-cyan-400">3D Viewer SDK</span>
                </div>
                <div className="h-6 w-px bg-slate-600" />
                <div>
                  <h3 className="font-semibold text-white">{viewerObject?.objectKey}</h3>
                  <p className="text-xs text-gray-400">{viewerLoading ? translationStatus : 'Ready'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewerFullscreen(!viewerFullscreen)} className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title={viewerFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {viewerFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button onClick={closeViewer} className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 relative bg-slate-950">
              {viewerLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10">
                  <Loader2 className="w-12 h-12 text-orange-400 animate-spin mb-4" />
                  <p className="text-white font-medium">{translationStatus || 'Loading viewer...'}</p>
                  <p className="text-gray-400 text-sm mt-2">This may take a few minutes for large files</p>
                </div>
              )}
              <div ref={viewerContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
            </div>
          </div>
        </div>
      )}

      {/* New Bucket Form Modal */}
      {showNewBucketForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Create New Bucket</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Bucket Key</label>
                <input
                  type="text"
                  value={newBucketKey}
                  onChange={(e) => setNewBucketKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-bucket-name"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Only lowercase letters, numbers, and hyphens allowed</p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Retention Policy</label>
                <select
                  value={newBucketPolicy}
                  onChange={(e) => setNewBucketPolicy(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="transient">Transient (24 hours)</option>
                  <option value="temporary">Temporary (30 days)</option>
                  <option value="persistent">Persistent (until deleted)</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewBucketForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createBucket}
                disabled={loading || !newBucketKey.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white rounded-lg transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Bucket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Buckets List */}
        <div className="lg:col-span-1 bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-400" />
              Buckets ({buckets.length})
            </h2>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            {loading && buckets.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            ) : buckets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No buckets found</p>
                <p className="text-sm">Create a new bucket to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.bucketKey}
                    onClick={() => setSelectedBucket(bucket.bucketKey)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedBucket === bucket.bucketKey
                        ? 'bg-orange-500/10 border-l-2 border-orange-500'
                        : 'hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <span className="font-medium text-white truncate">{bucket.bucketKey}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getPolicyColor(bucket.policyKey)}`}>
                            {bucket.policyKey}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(bucket.createdDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBucket(bucket.bucketKey);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Objects List */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-orange-400" />
              {selectedBucket ? (
                <>
                  Objects in <span className="text-orange-400">{selectedBucket}</span>
                </>
              ) : (
                'Select a bucket'
              )}
            </h2>
            
            {selectedBucket && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Select File
                </label>
                {uploadFile && (
                  <>
                    <span className="text-sm text-gray-400 truncate max-w-[150px]">{uploadFile.name}</span>
                    <button
                      onClick={uploadObject}
                      disabled={uploading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload
                    </button>
                    <button
                      onClick={() => setUploadFile(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            {!selectedBucket ? (
              <div className="text-center py-12 text-gray-500">
                <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a bucket to view its contents</p>
              </div>
            ) : loadingObjects ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            ) : objects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No objects in this bucket</p>
                <p className="text-sm">Upload a file to get started</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-900/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Size</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {objects.map((obj) => {
                    const syncInfo = syncedFiles[obj.objectKey];
                    return (
                    <tr key={obj.objectKey} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isViewableFile(obj.objectKey) ? (
                            <Box className="w-4 h-4 text-orange-400" />
                          ) : (
                            <File className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-white text-sm truncate max-w-[300px]">{obj.objectKey}</span>
                          {isViewableFile(obj.objectKey) && (
                            <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">3D</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {syncInfo ? (
                          <div className="flex items-center gap-2" title={`Synced: ${new Date(syncInfo.syncedAt).toLocaleString()}`}>
                            <CloudCog className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">Auto-Sync</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Manual Upload</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 text-sm">{formatBytes(obj.size)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isViewableFile(obj.objectKey) && (
                            <button
                              onClick={() => viewObject(obj)}
                              className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                              title="View in 3D"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => downloadObject(obj.objectKey)}
                            className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteObject(obj.objectKey)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Transient</p>
              <p className="text-xs text-gray-500">Objects expire after 24 hours</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Temporary</p>
              <p className="text-xs text-gray-500">Objects expire after 30 days</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Persistent</p>
              <p className="text-xs text-gray-500">Objects kept until deleted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

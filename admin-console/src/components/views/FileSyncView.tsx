'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RefreshCw, Plus, Trash2, Play, Pause, CheckCircle, 
  XCircle, Clock, Loader2, FolderTree, Cloud, HardDrive,
  Link, Unlink, ChevronRight, ChevronDown, Folder, File,
  AlertCircle, Settings, History, Webhook, ArrowRight, Edit,
  Box, Database
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useNotifications } from '@/contexts/NotificationContext';

interface Hub {
  id: string;
  type: string;
  attributes: {
    name: string;
    extension?: { type: string };
  };
}

interface Project {
  id: string;
  type: string;
  attributes: {
    name: string;
  };
}

interface FolderItem {
  id: string;
  type: string;
  attributes: {
    name: string;
    displayName?: string;
    extension?: { type: string };
  };
}

interface SyncConfig {
  id: string;
  name: string;
  sourceProjectId: string;
  sourceFolderId: string;
  sourcePath: string;
  targetBucket: string;
  targetPrefix: string;
  autoTranslate: boolean;
  enabled: boolean;
  createdAt: string;
}

interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  event: string;
  resourceUrn: string;
  status: 'received' | 'processing' | 'completed' | 'error' | 'skipped';
  message?: string;
  ossObject?: {
    bucket: string;
    objectKey: string;
    urn: string;
  };
}

type CloudProvider = 'autodesk' | 'google-drive' | 'dropbox';
type AutodeskStorageType = 'fusion' | 'docs';

interface AutodeskStorageInfo {
  id: AutodeskStorageType;
  name: string;
  shortName: string;
  description: string;
  icon: 'F' | 'D';
  iconLabel: string;
  color: string;
  comingSoon?: boolean;
}

interface Bucket {
  bucketKey: string;
  createdDate: string;
  policyKey: string;
}

export default function FileSyncView() {
  const [activeTab, setActiveTab] = useState<'config' | 'browse' | 'history'>('config');
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  
  // Cloud provider selection
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('autodesk');
  const [selectedAutodeskStorage, setSelectedAutodeskStorage] = useState<AutodeskStorageType>('fusion');
  const [autodeskStorageTypes] = useState<AutodeskStorageInfo[]>([
    {
      id: 'fusion',
      name: 'Autodesk Fusion',
      shortName: 'Fusion',
      description: 'Fusion Team cloud storage',
      icon: 'F',
      iconLabel: '',
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'docs',
      name: 'Autodesk Docs',
      shortName: 'Docs',
      description: 'ACC & BIM 360 Docs',
      icon: 'D',
      iconLabel: 'DOC',
      color: 'from-blue-500 to-blue-600',
      comingSoon: true
    }
  ]);
  
  // Sync configurations
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SyncConfig | null>(null);
  
  // Data Management browser state
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [folderTree, setFolderTree] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FolderItem[]>>(new Map());
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  
  // OSS buckets
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  
  // History
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [unreadHistoryCount, setUnreadHistoryCount] = useState(0);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string>('');
  
  // Sync progress state
  const [syncInProgress, setSyncInProgress] = useState<string | null>(null); // config id being synced
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    completed: number;
    current: string;
  } | null>(null);
  const [syncNotification, setSyncNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  
  // New config form
  const [newConfig, setNewConfig] = useState({
    name: '',
    sourceProjectId: '',
    sourceFolderId: '',
    sourcePath: '',
    targetBucket: '',
    targetPrefix: '',
    autoTranslate: false
  });

  // Track active tab in a ref to avoid recreating socket on tab change
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Socket connection - only create once
  useEffect(() => {
    const socket = io('http://localhost:8080', {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('sync:webhook-received', (data: SyncHistoryEntry) => {
      console.log('Received sync:webhook-received', data);
      setSyncHistory(prev => [data, ...prev].slice(0, 100));
      if (activeTabRef.current !== 'history') {
        setUnreadHistoryCount(prev => prev + 1);
      }
    });

    socket.on('sync:processing', (data: SyncHistoryEntry) => {
      console.log('Received sync:processing', data);
      setSyncHistory(prev => {
        const index = prev.findIndex(h => h.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [data, ...prev].slice(0, 100);
      });
    });

    socket.on('sync:completed', (data: SyncHistoryEntry) => {
      console.log('Received sync:completed', data);
      setSyncHistory(prev => {
        const index = prev.findIndex(h => h.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [data, ...prev].slice(0, 100);
      });
      // Update progress and show notification
      setSyncProgress(prev => prev ? { ...prev, completed: prev.completed + 1, current: data.message || 'File synced' } : null);
      if (data.message) {
        setSyncNotification({ type: 'success', message: data.message });
        // Auto-hide after 5 seconds
        setTimeout(() => setSyncNotification(null), 5000);
      }
      // Increment history unread count only if not viewing history
      if (activeTabRef.current !== 'history') {
        setUnreadHistoryCount(prev => prev + 1);
      }
    });

    socket.on('sync:error', (data: SyncHistoryEntry) => {
      console.log('Received sync:error', data);
      setSyncHistory(prev => {
        const index = prev.findIndex(h => h.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [data, ...prev].slice(0, 100);
      });
      // Show error notification
      if (data.message) {
        setSyncNotification({ type: 'error', message: data.message });
      }
      // Increment history unread count only if not viewing history
      if (activeTabRef.current !== 'history') {
        setUnreadHistoryCount(prev => prev + 1);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Empty dependency array - only create socket once

  // Load initial data
  useEffect(() => {
    fetchSyncConfigs();
    fetchBuckets();
    fetchHistory();
    checkAuthStatus();
    
    // Check URL params for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setIsAuthenticated(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/filesync/auth/status');
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/filesync/auth/login');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to get login URL:', error);
    }
  };

  const fetchSyncConfigs = async () => {
    try {
      const res = await fetch('/api/filesync/config');
      const data = await res.json();
      setSyncConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load sync configs:', error);
    }
  };

  const fetchBuckets = async () => {
    try {
      const res = await fetch('/api/filesync/oss/buckets');
      const data = await res.json();
      setBuckets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load buckets:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/filesync/history');
      const data = await res.json();
      setSyncHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const fetchHubs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/filesync/hubs');
      const data = await res.json();
      
      // Check if we need to login
      if (data.needsLogin) {
        setIsAuthenticated(false);
        if (data.loginUrl) {
          setLoginUrl(data.loginUrl);
        }
        setHubs([]);
      } else {
        setIsAuthenticated(true);
        setHubs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load hubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (hubId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/filesync/hubs/${hubId}/projects`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopFolders = async (projectId: string, hubId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/filesync/projects/${projectId}/topFolders?hubId=${hubId}`);
      const data = await res.json();
      setFolderTree(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderContents = async (projectId: string, folderId: string) => {
    try {
      const res = await fetch(`/api/filesync/projects/${projectId}/folders/${folderId}/contents`);
      const data = await res.json();
      setFolderContents(prev => new Map(prev).set(folderId, Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Failed to load folder contents:', error);
    }
  };

  const toggleFolder = async (folder: FolderItem) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folder.id)) {
      newExpanded.delete(folder.id);
    } else {
      newExpanded.add(folder.id);
      if (!folderContents.has(folder.id) && selectedProject) {
        await fetchFolderContents(selectedProject.id, folder.id);
      }
    }
    setExpandedFolders(newExpanded);
  };

  const selectHub = (hub: Hub) => {
    setSelectedHub(hub);
    setSelectedProject(null);
    setFolderTree([]);
    setSelectedFolder(null);
    fetchProjects(hub.id);
  };

  const selectProject = (project: Project) => {
    setSelectedProject(project);
    setFolderTree([]);
    setSelectedFolder(null);
    if (selectedHub) {
      fetchTopFolders(project.id, selectedHub.id);
    }
    setNewConfig(prev => ({ ...prev, sourceProjectId: project.id }));
  };

  const selectFolder = (folder: FolderItem, path: string) => {
    setSelectedFolder(folder);
    setNewConfig(prev => ({ 
      ...prev, 
      sourceFolderId: folder.id,
      sourcePath: path
    }));
  };

  const resetConfigForm = () => {
    setNewConfig({
      name: '',
      sourceProjectId: '',
      sourceFolderId: '',
      sourcePath: '',
      targetBucket: '',
      targetPrefix: '',
      autoTranslate: false
    });
    setEditingConfig(null);
    setSelectedHub(null);
    setSelectedProject(null);
    setSelectedFolder(null);
    setFolderTree([]);
  };

  const openEditModal = (config: SyncConfig) => {
    setEditingConfig(config);
    setNewConfig({
      name: config.name,
      sourceProjectId: config.sourceProjectId,
      sourceFolderId: config.sourceFolderId,
      sourcePath: config.sourcePath,
      targetBucket: config.targetBucket,
      targetPrefix: config.targetPrefix || '',
      autoTranslate: config.autoTranslate
    });
    fetchHubs();
    setShowConfigModal(true);
  };

  const saveConfig = async () => {
    if (!newConfig.name || !newConfig.targetBucket) {
      alert('Please fill in all required fields');
      return;
    }

    // For new configs, source folder is required
    if (!editingConfig && !newConfig.sourceFolderId) {
      alert('Please select a source folder');
      return;
    }

    try {
      const url = editingConfig 
        ? `/api/filesync/config/${editingConfig.id}`
        : '/api/filesync/config';
      
      const method = editingConfig ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      
      if (res.ok) {
        await fetchSyncConfigs();
        setShowConfigModal(false);
        resetConfigForm();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const toggleConfig = async (configId: string) => {
    try {
      await fetch(`/api/filesync/config/${configId}/toggle`, { method: 'POST' });
      await fetchSyncConfigs();
    } catch (error) {
      console.error('Failed to toggle config:', error);
    }
  };

  const deleteConfig = async (configId: string) => {
    if (!confirm('Delete this sync configuration?')) return;
    
    try {
      await fetch(`/api/filesync/config/${configId}`, { method: 'DELETE' });
      await fetchSyncConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  const triggerManualSync = async (config: SyncConfig) => {
    try {
      setSyncInProgress(config.id);
      setSyncProgress({ total: 0, completed: 0, current: 'Starting sync...' });
      setSyncNotification(null);
      
      const res = await fetch('/api/filesync/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: config.sourceProjectId,
          folderId: config.sourceFolderId,
          targetBucket: config.targetBucket,
          targetPrefix: config.targetPrefix
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setSyncNotification({ type: 'error', message: data.error });
        setSyncInProgress(null);
        setSyncProgress(null);
        return;
      }
      
      if (data.itemCount !== undefined) {
        setSyncProgress({ total: data.itemCount, completed: 0, current: `Syncing ${data.itemCount} files...` });
        
        // Show success after a delay (files sync in background)
        setTimeout(() => {
          setSyncNotification({ type: 'success', message: `Successfully synced ${data.itemCount} files to ${config.targetBucket}` });
          setSyncInProgress(null);
          setSyncProgress(null);
          fetchHistory();
        }, data.itemCount * 2000 + 1000); // Rough estimate: 2s per file
      } else {
        setSyncNotification({ type: 'info', message: data.message || 'Sync triggered' });
        setSyncInProgress(null);
        setSyncProgress(null);
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      setSyncNotification({ type: 'error', message: 'Failed to trigger sync' });
      setSyncInProgress(null);
      setSyncProgress(null);
    }
  };

  const renderFolderTree = (folders: FolderItem[], depth: number = 0, parentPath: string = '') => {
    return folders.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const contents = folderContents.get(folder.id) || [];
      const subfolders = contents.filter(item => item.type === 'folders');
      const files = contents.filter(item => item.type === 'items');
      const isSelected = selectedFolder?.id === folder.id;
      const currentPath = parentPath ? `${parentPath}/${folder.attributes.displayName || folder.attributes.name}` : folder.attributes.displayName || folder.attributes.name;

      return (
        <div key={folder.id} style={{ marginLeft: depth * 16 }}>
          <div 
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
              isSelected ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-slate-700/50'
            }`}
          >
            <button onClick={() => toggleFolder(folder)} className="p-1">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <Folder className="w-4 h-4 text-yellow-500" />
            <span 
              className="flex-1 text-sm truncate"
              onClick={() => selectFolder(folder, currentPath)}
            >
              {folder.attributes.displayName || folder.attributes.name}
            </span>
          </div>
          
          {isExpanded && (
            <div>
              {renderFolderTree(subfolders, depth + 1, currentPath)}
              {files.map(file => (
                <div key={file.id} style={{ marginLeft: (depth + 1) * 16 }} className="flex items-center gap-2 px-2 py-1 text-gray-400">
                  <div className="w-5" />
                  <File className="w-4 h-4 text-blue-400" />
                  <span className="text-sm truncate">{file.attributes.displayName || file.attributes.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Sync Notification Toast */}
      {syncNotification && (
        <div className={`fixed top-20 right-6 z-50 p-4 rounded-xl shadow-lg border backdrop-blur-lg animate-pulse ${
          syncNotification.type === 'success' 
            ? 'bg-green-500/20 border-green-500/50 text-green-400' 
            : syncNotification.type === 'error'
            ? 'bg-red-500/20 border-red-500/50 text-red-400'
            : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
        }`}>
          <div className="flex items-center gap-3">
            {syncNotification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {syncNotification.type === 'error' && <XCircle className="w-5 h-5" />}
            {syncNotification.type === 'info' && <Cloud className="w-5 h-5" />}
            <span className="font-medium">{syncNotification.message}</span>
            <button 
              onClick={() => setSyncNotification(null)}
              className="ml-2 hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Sync Progress Banner */}
      {syncProgress && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white">{syncProgress.current}</span>
                {syncProgress.total > 0 && (
                  <span className="text-sm text-cyan-400">
                    {syncProgress.completed} / {syncProgress.total} files
                  </span>
                )}
              </div>
              {syncProgress.total > 0 && (
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${(syncProgress.completed / syncProgress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">File Sync</h1>
          <p className="text-gray-400">Sync files from cloud storage to OSS automatically</p>
        </div>
        <button
          onClick={() => {
            resetConfigForm();
            setShowConfigModal(true);
            fetchHubs();
          }}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Sync Config
        </button>
      </div>

      {/* Cloud Provider Selector */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Select Cloud Storage Provider</h3>
        <div className="space-y-3">
          {/* Autodesk Cloud - Expandable */}
          <div className={`rounded-xl border-2 transition-all overflow-hidden ${
            selectedProvider === 'autodesk'
              ? 'border-orange-500 bg-orange-500/5'
              : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
          }`}>
            <button
              onClick={() => setSelectedProvider('autodesk')}
              className="w-full p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Box className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium truncate ${
                    selectedProvider === 'autodesk' ? 'text-orange-400' : 'text-white'
                  }`}>
                    Autodesk Cloud
                  </h4>
                  <p className="text-xs text-gray-400 truncate">ACC, BIM360, Fusion Team</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                  selectedProvider === 'autodesk' ? 'rotate-180' : ''
                }`} />
              </div>
            </button>
            
            {/* Autodesk Storage Types - Expanded */}
            {selectedProvider === 'autodesk' && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-700/50">
                <p className="text-xs text-gray-500 mb-3">Select storage type:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {autodeskStorageTypes.map((storage) => (
                    <button
                      key={storage.id}
                      onClick={() => !storage.comingSoon && setSelectedAutodeskStorage(storage.id)}
                      disabled={storage.comingSoon}
                      className={`relative p-3 rounded-lg border transition-all text-left ${
                        selectedAutodeskStorage === storage.id
                          ? 'border-orange-500 bg-orange-500/20'
                          : storage.comingSoon
                            ? 'border-slate-700/50 bg-slate-800/50 opacity-50 cursor-not-allowed'
                            : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-700/50'
                      }`}
                    >
                      {storage.comingSoon && (
                        <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 bg-slate-600/50 text-slate-300 rounded">
                          Soon
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${storage.color} flex flex-col items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold text-sm leading-none">{storage.icon}</span>
                          {storage.iconLabel && (
                            <span className={`text-[5px] font-bold px-0.5 rounded-sm mt-0.5 ${
                              storage.id === 'docs' 
                                ? 'text-blue-600 bg-white' 
                                : 'text-white bg-black/30'
                            }`}>
                              {storage.iconLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className={`text-sm font-medium truncate ${
                            selectedAutodeskStorage === storage.id ? 'text-orange-400' : 'text-white'
                          }`}>
                            {storage.shortName}
                          </h5>
                          <p className="text-[10px] text-gray-400 truncate">{storage.description}</p>
                        </div>
                        {selectedAutodeskStorage === storage.id && !storage.comingSoon && (
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAuthenticated ? 'bg-green-400' : 'bg-gray-500'}`} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Other providers row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Google Drive */}
            <button
              disabled
              className="relative p-4 rounded-xl border-2 border-slate-700/50 bg-slate-800/30 opacity-60 cursor-not-allowed text-left"
            >
              <span className="absolute top-2 right-2 text-xs px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded-full">
                Coming Soon
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#FFC107" d="M17 6L31 6 45 30 31 30z"/>
                    <path fill="#1976D2" d="M9.875 42L16.938 30 45 30 37.938 42z"/>
                    <path fill="#4CAF50" d="M3 30L17 6 24 18 10 42z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">Google Drive</h4>
                  <p className="text-xs text-gray-400 truncate">Sync from Google Drive</p>
                </div>
              </div>
            </button>

            {/* Dropbox */}
            <button
              disabled
              className="relative p-4 rounded-xl border-2 border-slate-700/50 bg-slate-800/30 opacity-60 cursor-not-allowed text-left"
            >
              <span className="absolute top-2 right-2 text-xs px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded-full">
                Coming Soon
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">Dropbox</h4>
                  <p className="text-xs text-gray-400 truncate">Sync from Dropbox</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-800/30 p-2 rounded-xl">
        {(['config', 'browse', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'browse' && hubs.length === 0) {
                fetchHubs();
              }
              if (tab === 'history') {
                setUnreadHistoryCount(0);
              }
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 relative ${
              activeTab === tab
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {tab === 'config' && <Settings className="w-4 h-4" />}
            {tab === 'browse' && <FolderTree className="w-4 h-4" />}
            {tab === 'history' && <History className="w-4 h-4" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {/* Notification badge for history tab - liquid glass theme */}
            {tab === 'history' && unreadHistoryCount > 0 && activeTab !== 'history' && (
              <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 bg-gradient-to-br from-cyan-400/90 via-blue-500/90 to-cyan-600/90 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/40 backdrop-blur-sm border border-white/30 ring-2 ring-cyan-400/20">
                {unreadHistoryCount > 99 ? '99+' : unreadHistoryCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Login Banner - Show for Autodesk when not authenticated */}
      {selectedProvider === 'autodesk' && !isAuthenticated && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-white">Autodesk Login Required</h4>
              <p className="text-sm text-gray-400">
                To browse and sync files from Autodesk Cloud (Fusion, Docs, Drive), log in with your Autodesk account.
              </p>
            </div>
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              Log in with Autodesk
            </button>
          </div>
        </div>
      )}

      {/* Coming Soon Banner for Google Drive and Dropbox */}
      {(selectedProvider === 'google-drive' || selectedProvider === 'dropbox') && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="max-w-md mx-auto">
            {selectedProvider === 'google-drive' ? (
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#FFC107" d="M17 6L31 6 45 30 31 30z"/>
                  <path fill="#1976D2" d="M9.875 42L16.938 30 45 30 37.938 42z"/>
                  <path fill="#4CAF50" d="M3 30L17 6 24 18 10 42z"/>
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z"/>
                </svg>
              </div>
            )}
            <h3 className="text-xl font-bold text-white mb-2">
              {selectedProvider === 'google-drive' ? 'Google Drive' : 'Dropbox'} Integration
            </h3>
            <p className="text-gray-400 mb-4">
              {selectedProvider === 'google-drive' 
                ? 'Sync CAD files directly from your Google Drive to APS Object Storage Service.'
                : 'Connect your Dropbox account to automatically sync CAD files to APS.'}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 rounded-lg text-gray-300">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Coming in a future update</span>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Want this feature sooner? Let us know at feedback@sydeflow.com
            </p>
          </div>
        </div>
      )}

      {/* Content - Only show for Autodesk provider */}
      {selectedProvider === 'autodesk' && (
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        {activeTab === 'config' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Link className="w-5 h-5 text-orange-400" />
              Sync Configurations
              <span className="text-sm font-normal text-gray-400">
                ({selectedAutodeskStorage === 'fusion' ? 'Fusion Team' : 'ACC/BIM 360'})
              </span>
            </h3>
            
            {syncConfigs.length === 0 ? (
              <div className="text-center py-12">
                <Cloud className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No sync configurations yet</p>
                <p className="text-sm text-gray-500">Create a configuration to sync files from Autodesk Cloud to OSS</p>
              </div>
            ) : (
              <div className="space-y-3">
                {syncConfigs.map(config => (
                  <div 
                    key={config.id}
                    className={`p-4 rounded-lg border ${
                      config.enabled 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-slate-900/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {config.enabled ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Pause className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <h4 className="font-medium text-white">{config.name}</h4>
                          <p className="text-sm text-gray-400">{config.sourcePath}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">{config.targetBucket}/{config.targetPrefix || ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => toggleConfig(config.id)}
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          config.enabled
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        {config.enabled ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        onClick={() => triggerManualSync(config)}
                        disabled={syncInProgress === config.id}
                        className={`px-3 py-1 rounded text-sm font-medium flex items-center gap-2 ${
                          syncInProgress === config.id
                            ? 'bg-cyan-500/20 text-cyan-400 cursor-not-allowed'
                            : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                        }`}
                      >
                        {syncInProgress === config.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Sync Now
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(config)}
                        className="px-3 py-1 bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 rounded text-sm font-medium flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteConfig(config.id)}
                        className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'browse' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Hubs */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-orange-400" />
                  Hubs
                  <button onClick={fetchHubs} className="ml-auto p-1 hover:bg-slate-700 rounded" title="Refresh hubs">
                    <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </h4>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {hubs.map(hub => (
                    <button
                      key={hub.id}
                      onClick={() => selectHub(hub)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedHub?.id === hub.id
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'hover:bg-slate-700/50 text-gray-300'
                      }`}
                    >
                      {hub.attributes.name}
                    </button>
                  ))}
                  {hubs.length === 0 && !loading && isAuthenticated && (
                    <p className="text-gray-500 text-sm text-center py-4">No hubs found</p>
                  )}
                  {hubs.length === 0 && !loading && !isAuthenticated && (
                    <p className="text-gray-500 text-sm text-center py-4">Please log in first</p>
                  )}
                </div>
              </div>

              {/* Projects */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-orange-400" />
                  Projects
                </h4>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => selectProject(project)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedProject?.id === project.id
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'hover:bg-slate-700/50 text-gray-300'
                      }`}
                    >
                      {project.attributes.name}
                    </button>
                  ))}
                  {!selectedHub && (
                    <p className="text-gray-500 text-sm text-center py-4">Select a hub first</p>
                  )}
                </div>
              </div>

              {/* Folder Tree */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-orange-400" />
                  Folders
                </h4>
                <div className="max-h-64 overflow-auto">
                  {renderFolderTree(folderTree)}
                  {!selectedProject && (
                    <p className="text-gray-500 text-sm text-center py-4">Select a project first</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-orange-400" />
                Sync History
              </h3>
              <button
                onClick={fetchHistory}
                className="p-2 hover:bg-slate-700/50 rounded-lg"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {syncHistory.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-gray-400">No sync events yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {syncHistory.map(entry => (
                  <div 
                    key={entry.id}
                    className={`p-3 rounded-lg border ${
                      entry.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                      entry.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                      entry.status === 'processing' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      'bg-slate-900/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {entry.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-400" />}
                      {entry.status === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                      {entry.status === 'processing' && <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />}
                      {(entry.status === 'received' || entry.status === 'skipped') && <Clock className="w-5 h-5 text-gray-400" />}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{entry.event}</span>
                          <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                        {entry.message && (
                          <p className="text-sm text-gray-400 mt-1">{entry.message}</p>
                        )}
                        {entry.ossObject && (
                          <p className="text-xs text-gray-500 mt-1">
                            → {entry.ossObject.bucket}/{entry.ossObject.objectKey}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Create/Edit Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingConfig ? 'Edit Sync Configuration' : 'Create Sync Configuration'}
            </h2>
            
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Configuration Name</label>
                <input
                  type="text"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Cabinet Models Sync"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              {/* Source Browser */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Source (Autodesk Cloud)
                  {editingConfig && (
                    <span className="text-xs text-gray-500 ml-2">— Change folder selection if needed</span>
                  )}
                </label>
                {/* Show current source path when editing */}
                {editingConfig && newConfig.sourcePath && (
                  <p className="text-sm text-cyan-400 mb-2 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                    Current: {newConfig.sourcePath}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3 bg-slate-900/50 rounded-lg p-3">
                  {/* Hubs */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Hub</p>
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {hubs.map(hub => (
                        <button
                          key={hub.id}
                          onClick={() => selectHub(hub)}
                          className={`w-full text-left px-2 py-1 rounded text-xs ${
                            selectedHub?.id === hub.id
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'hover:bg-slate-700/50 text-gray-300'
                          }`}
                        >
                          {hub.attributes.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Projects */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Project</p>
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {projects.map(project => (
                        <button
                          key={project.id}
                          onClick={() => selectProject(project)}
                          className={`w-full text-left px-2 py-1 rounded text-xs ${
                            selectedProject?.id === project.id
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'hover:bg-slate-700/50 text-gray-300'
                          }`}
                        >
                          {project.attributes.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Folders */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Folder</p>
                    <div className="max-h-40 overflow-auto">
                      {renderFolderTree(folderTree)}
                    </div>
                  </div>
                </div>
                {!editingConfig && newConfig.sourcePath && (
                  <p className="text-sm text-green-400 mt-2">Selected: {newConfig.sourcePath}</p>
                )}
              </div>

              {/* Target Bucket */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target OSS Bucket</label>
                <select
                  value={newConfig.targetBucket}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, targetBucket: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Select a bucket...</option>
                  {buckets.map(bucket => (
                    <option key={bucket.bucketKey} value={bucket.bucketKey}>
                      {bucket.bucketKey}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Prefix */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Object Key Prefix (optional)</label>
                <input
                  type="text"
                  value={newConfig.targetPrefix}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, targetPrefix: e.target.value }))}
                  placeholder="e.g., synced/ or projects/cabinet/"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              {/* Auto Translate */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newConfig.autoTranslate}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, autoTranslate: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-gray-300">Auto-translate files for Viewer after sync</span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    resetConfigForm();
                  }}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveConfig}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium"
                >
                  {editingConfig ? 'Save Changes' : 'Create Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

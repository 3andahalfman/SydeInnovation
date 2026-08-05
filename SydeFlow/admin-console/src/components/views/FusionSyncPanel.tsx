'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, Loader2, FolderTree, 
  ChevronRight, ChevronDown, Folder, File,
  AlertCircle
} from 'lucide-react';

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

export default function FusionSyncPanel() {
  const [loading, setLoading] = useState(false);
  
  // Data Management browser state
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [folderTree, setFolderTree] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FolderItem[]>>(new Map());
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load initial data
  useEffect(() => {
    checkAuthStatus();
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setIsAuthenticated(true);
      window.history.replaceState({}, '', window.location.pathname);
      fetchHubs();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/filesync/auth/status');
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchHubs();
      }
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

  const fetchHubs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/filesync/hubs');
      const data = await res.json();
      
      if (data.needsLogin) {
        setIsAuthenticated(false);
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
  };

  const selectFolder = (folder: FolderItem) => {
    setSelectedFolder(folder);
  };

  const renderFolderTree = (folders: FolderItem[], depth: number = 0) => {
    return folders.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const contents = folderContents.get(folder.id) || [];
      const subfolders = contents.filter(item => item.type === 'folders');
      const files = contents.filter(item => item.type === 'items');
      const isSelected = selectedFolder?.id === folder.id;

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
              onClick={() => selectFolder(folder)}
            >
              {folder.attributes.displayName || folder.attributes.name}
            </span>
          </div>
          
          {isExpanded && (
            <div>
              {renderFolderTree(subfolders, depth + 1)}
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-bold">F</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Autodesk Fusion Team</h2>
            <p className="text-sm text-gray-400">Browse files from Fusion Team cloud storage</p>
          </div>
        </div>
        <button
          onClick={fetchHubs}
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Login Required Banner */}
      {!isAuthenticated && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-white">Autodesk Login Required</h4>
              <p className="text-sm text-gray-400">
                To browse files from Autodesk Fusion Team, log in with your Autodesk account.
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

      {/* Browse Content */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <FolderTree className="w-5 h-5 text-orange-400" />
          Browse Fusion Team
        </h3>
        
        {loading && hubs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-400">Please log in to browse Fusion Team</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Hubs */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Hubs</h4>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {hubs.length === 0 ? (
                  <p className="text-sm text-gray-500 px-3">No hubs found</p>
                ) : (
                  hubs.map(hub => (
                    <button
                      key={hub.id}
                      onClick={() => selectHub(hub)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedHub?.id === hub.id
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'text-gray-300 hover:bg-slate-700/50'
                      }`}
                    >
                      {hub.attributes.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Projects */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Projects</h4>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {!selectedHub ? (
                  <p className="text-sm text-gray-500 px-3">Select a hub first</p>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-gray-500 px-3">{loading ? 'Loading...' : 'No projects found'}</p>
                ) : (
                  projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => selectProject(project)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedProject?.id === project.id
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'text-gray-300 hover:bg-slate-700/50'
                      }`}
                    >
                      {project.attributes.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Folders */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Folders & Files</h4>
              <div className="max-h-[400px] overflow-y-auto">
                {!selectedProject ? (
                  <p className="text-sm text-gray-500 px-3">Select a project first</p>
                ) : folderTree.length === 0 ? (
                  <p className="text-sm text-gray-500 px-3">{loading ? 'Loading...' : 'No folders found'}</p>
                ) : (
                  renderFolderTree(folderTree)
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

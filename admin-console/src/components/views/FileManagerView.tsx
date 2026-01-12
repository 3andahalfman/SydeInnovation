'use client';

import { useState, useRef } from 'react';
import { 
  Upload, FolderOpen, File, FileCode, Image, 
  Trash2, Download, Eye, RefreshCw, Plus,
  ChevronRight, ChevronDown, MoreVertical, Search,
  Loader2, CheckCircle, AlertCircle, Database
} from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  urn?: string;
  status: 'uploading' | 'translating' | 'ready' | 'error';
  progress?: number;
}

export default function FileManagerView() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles) return;

    setIsUploading(true);

    for (const file of Array.from(uploadFiles)) {
      const newFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type || getFileType(file.name),
        uploadDate: new Date(),
        status: 'uploading',
        progress: 0
      };

      setFiles(prev => [...prev, newFile]);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/aps/upload', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          setFiles(prev => prev.map(f => 
            f.id === newFile.id 
              ? { ...f, status: 'translating', urn: data.urn }
              : f
          ));

          // Poll for translation status
          pollTranslationStatus(newFile.id, data.urn);
        } else {
          setFiles(prev => prev.map(f => 
            f.id === newFile.id 
              ? { ...f, status: 'error' }
              : f
          ));
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === newFile.id 
            ? { ...f, status: 'error' }
            : f
        ));
      }
    }

    setIsUploading(false);
  };

  const pollTranslationStatus = async (fileId: string, urn: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/aps/translation/${urn}`);
        const data = await response.json();

        if (data.status === 'success' || data.status === 'complete') {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'ready', progress: 100 }
              : f
          ));
          return;
        } else if (data.status === 'failed') {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error' }
              : f
          ));
          return;
        }

        // Update progress
        const progress = parseInt(data.progress) || 0;
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, progress }
            : f
        ));

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error' }
              : f
          ));
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        }
      }
    };

    poll();
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      'ipt': 'Inventor Part',
      'iam': 'Inventor Assembly',
      'idw': 'Inventor Drawing',
      'zip': 'Archive',
      'dwg': 'AutoCAD Drawing',
      'rvt': 'Revit Model',
    };
    return types[ext || ''] || 'Unknown';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('Inventor')) return FileCode;
    if (type.includes('Archive')) return FolderOpen;
    if (type.includes('Image')) return Image;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const deleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  const toggleSelect = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">File Manager</h2>
          <p className="text-gray-400 text-sm">Upload and manage Inventor files for Design Automation</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".ipt,.iam,.idw,.zip,.dwg"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden">
        {filteredFiles.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No files uploaded</h3>
            <p className="text-gray-500 mb-6">
              Upload Inventor files (.ipt, .iam) to get started with Design Automation
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg font-medium transition-colors inline-flex items-center gap-2 border border-orange-500/30"
            >
              <Upload className="w-5 h-5" />
              Upload Your First File
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredFiles.map(file => {
                const FileIcon = getFileIcon(file.type);
                return (
                  <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700/50 rounded-lg">
                          <FileIcon className="w-5 h-5 text-orange-400" />
                        </div>
                        <span className="text-white font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{file.type}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{formatFileSize(file.size)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={file.status} progress={file.progress} />
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {file.uploadDate.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {file.status === 'ready' && (
                          <button
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                            title="View in Viewer"
                          >
                            <Eye className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteFile(file.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
            {filteredFiles.map(file => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 hover:border-orange-500/50 transition-colors"
                >
                  <div className="flex items-center justify-center h-24 mb-3">
                    <FileIcon className="w-12 h-12 text-orange-400" />
                  </div>
                  <h4 className="font-medium text-white text-sm truncate mb-1">{file.name}</h4>
                  <p className="text-xs text-gray-500 mb-2">{formatFileSize(file.size)}</p>
                  <StatusBadge status={file.status} progress={file.progress} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, progress }: { status: UploadedFile['status']; progress?: number }) {
  const configs = {
    uploading: { icon: Loader2, text: 'Uploading...', color: 'yellow', animate: true },
    translating: { icon: RefreshCw, text: `Translating ${progress || 0}%`, color: 'blue', animate: true },
    ready: { icon: CheckCircle, text: 'Ready', color: 'green', animate: false },
    error: { icon: AlertCircle, text: 'Error', color: 'red', animate: false },
  };

  const config = configs[status];
  const Icon = config.icon;
  const colorClasses = {
    yellow: 'bg-yellow-500/20 text-yellow-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
  }[config.color];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses}`}>
      <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
      {config.text}
    </span>
  );
}

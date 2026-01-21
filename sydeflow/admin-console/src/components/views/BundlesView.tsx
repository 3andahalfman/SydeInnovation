'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Package, Upload, Trash2, RefreshCw, Plus, 
  CheckCircle, XCircle, AlertCircle, Loader2,
  ChevronDown, ChevronRight, Settings, Code,
  FileCode, Download, Eye, Edit, MoreVertical
} from 'lucide-react';

interface AppBundle {
  id: string;
  name: string;
  engine: string;
  version: number;
  description?: string;
  createdAt?: Date;
  status: 'active' | 'inactive' | 'error';
}

interface Activity {
  id: string;
  name: string;
  appBundles: string[];
  engine: string;
  commandLine: string;
  version: number;
}

export default function BundlesView() {
  const [appBundles, setAppBundles] = useState<AppBundle[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bundles' | 'activities'>('bundles');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state for new bundle
  const [bundleForm, setBundleForm] = useState({
    id: '',
    engine: 'Autodesk.Inventor+2024',
    description: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBundleFile, setSelectedBundleFile] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch app bundles
      const bundlesRes = await fetch('/api/aps/appbundles');
      if (bundlesRes.ok) {
        const bundlesData = await bundlesRes.json();
        const bundles = (bundlesData.data || []).map((name: string, i: number) => ({
          id: name,
          name: name.split('.').pop() || name,
          engine: 'Autodesk.Inventor+2024',
          version: 1,
          status: 'active' as const
        }));
        setAppBundles(bundles);
      }

      // Fetch activities
      const activitiesRes = await fetch('/api/aps/activities');
      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        const acts = (activitiesData.data || []).map((name: string) => ({
          id: name,
          name: name.split('.').pop() || name,
          appBundles: [],
          engine: 'Autodesk.Inventor+2024',
          commandLine: '',
          version: 1
        }));
        setActivities(acts);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  };

  const handleCreateBundle = async () => {
    if (!bundleForm.id || !selectedBundleFile) return;

    setUploading(true);
    try {
      // This would call your backend to create the bundle
      const formData = new FormData();
      formData.append('zipFile', selectedBundleFile);
      formData.append('id', bundleForm.id);
      formData.append('engine', bundleForm.engine);
      formData.append('description', bundleForm.description);

      const response = await fetch('/api/aps/appbundles', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        await fetchData();
        setShowUploadModal(false);
        setBundleForm({ id: '', engine: 'Autodesk.Inventor+2024', description: '' });
        setSelectedBundleFile(null);
      }
    } catch (error) {
      console.error('Failed to create bundle:', error);
    }
    setUploading(false);
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!confirm(`Are you sure you want to delete ${bundleId}?`)) return;

    try {
      const response = await fetch(`/api/aps/appbundles/${encodeURIComponent(bundleId)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAppBundles(prev => prev.filter(b => b.id !== bundleId));
      }
    } catch (error) {
      console.error('Failed to delete bundle:', error);
    }
  };

  const engines = [
    'Autodesk.Inventor+2024',
    'Autodesk.Inventor+2023',
    'Autodesk.Inventor+2022',
    'Autodesk.AutoCAD+2024',
    'Autodesk.Revit+2024',
    'Autodesk.3dsMax+2024'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">App Bundles & Activities</h2>
          <p className="text-gray-400 text-sm">Manage your Design Automation app bundles and activities</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Bundle
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-800/30 p-2 rounded-xl border border-slate-700/50">
        <button
          onClick={() => setActiveTab('bundles')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'bundles'
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Package className="w-4 h-4" />
          App Bundles ({appBundles.length})
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'activities'
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Activities ({activities.length})
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-12 h-12 text-orange-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">Loading...</p>
          </div>
        ) : activeTab === 'bundles' ? (
          appBundles.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No App Bundles</h3>
              <p className="text-gray-500 mb-6">
                Create an app bundle to start using Design Automation
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg font-medium transition-colors inline-flex items-center gap-2 border border-orange-500/30"
              >
                <Plus className="w-5 h-5" />
                Create App Bundle
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {appBundles.map(bundle => (
                <div key={bundle.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-500/20 rounded-xl">
                        <Package className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{bundle.name}</h3>
                        <p className="text-sm text-gray-500">{bundle.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">{bundle.engine}</span>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        v{bundle.version}
                      </span>
                      <StatusBadge status={bundle.status} />
                      <div className="flex items-center gap-1">
                        <button
                          className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteBundle(bundle.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          activities.length === 0 ? (
            <div className="p-12 text-center">
              <Settings className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Activities</h3>
              <p className="text-gray-500">
                Activities will appear here after being created
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {activities.map(activity => (
                <div key={activity.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Settings className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{activity.name}</h3>
                        <p className="text-sm text-gray-500">{activity.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">{activity.engine}</span>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        v{activity.version}
                      </span>
                      <button
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowUploadModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Package className="w-5 h-5 text-orange-400" />
                </div>
                Create App Bundle
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bundle ID
                  </label>
                  <input
                    type="text"
                    value={bundleForm.id}
                    onChange={(e) => setBundleForm(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g., UpdateWardrobe"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Engine
                  </label>
                  <select
                    value={bundleForm.engine}
                    onChange={(e) => setBundleForm(prev => ({ ...prev, engine: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  >
                    {engines.map(engine => (
                      <option key={engine} value={engine}>{engine}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bundle ZIP File
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-600 hover:border-orange-500/50 rounded-lg p-6 text-center cursor-pointer transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={(e) => setSelectedBundleFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {selectedBundleFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileCode className="w-8 h-8 text-orange-400" />
                        <span className="text-white">{selectedBundleFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Click to select bundle .zip file</p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={bundleForm.description}
                    onChange={(e) => setBundleForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this bundle does..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBundle}
                  disabled={!bundleForm.id || !selectedBundleFile || uploading}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Bundle
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AppBundle['status'] }) {
  const configs = {
    active: { icon: CheckCircle, text: 'Active', color: 'green' },
    inactive: { icon: AlertCircle, text: 'Inactive', color: 'yellow' },
    error: { icon: XCircle, text: 'Error', color: 'red' },
  };

  const config = configs[status];
  const Icon = config.icon;
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/20 text-red-400',
  }[config.color];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses}`}>
      <Icon className="w-3 h-3" />
      {config.text}
    </span>
  );
}

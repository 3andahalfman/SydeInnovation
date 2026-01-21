'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Server, Database, Zap, Activity, Upload, 
  FileCode, CheckCircle, XCircle, Clock, RefreshCw,
  ArrowUpRight, Box, Layers, Package,
  Edit, Trash2, Plus, Play, LogIn, LogOut, AlertCircle,
  FolderPlus, ChevronRight, Pencil, Settings, WifiOff
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import type { ViewType } from '@/app/page';

interface DashboardViewProps {
  serverStatus: 'online' | 'offline' | 'checking';
  onRefresh: () => void;
  onNavigate?: (view: ViewType) => void;
}

interface ServerStats {
  appBundles: number;
  activities: number;
  workItems: number;
  buckets: number;
}

interface APSStatus {
  connected: boolean;
  status: string;
  message: string;
  hasCredentials: boolean;
  lastCheck?: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  category: string;
  timestamp: string;
  title?: string;
  message?: string;
  details?: Record<string, any>;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  description?: string;
  status: string;
  parameters?: any[];
  sourceFile?: {
    bucketKey?: string;
    objectKey?: string;
    fileName?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export default function DashboardView({ serverStatus, onRefresh, onNavigate }: DashboardViewProps) {
  const [stats, setStats] = useState<ServerStats>({
    appBundles: 0,
    activities: 0,
    workItems: 0,
    buckets: 0
  });
  const [loading, setLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [apsStatus, setApsStatus] = useState<APSStatus | null>(null);
  const [apsStatusLoading, setApsStatusLoading] = useState(true);
  const [showApsBanner, setShowApsBanner] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Socket connection for real-time activity updates
  useEffect(() => {
    const socket = io('http://localhost:8080', {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Dashboard socket connected');
    });

    socket.on('activity:new', (activity: ActivityEntry) => {
      console.log('New activity received:', activity);
      setActivityLog(prev => [activity, ...prev].slice(0, 50));
    });

    socket.on('activity:cleared', () => {
      setActivityLog([]);
    });

    // Also listen for sync events to show in activity
    socket.on('sync:completed', (data: any) => {
      const activity: ActivityEntry = {
        id: data.id || `sync_${Date.now()}`,
        type: 'sync:completed',
        category: 'File Sync',
        timestamp: data.timestamp || new Date().toISOString(),
        title: 'File Synced',
        message: data.message || 'File synchronized successfully'
      };
      setActivityLog(prev => [activity, ...prev].slice(0, 50));
    });

    socket.on('sync:error', (data: any) => {
      const activity: ActivityEntry = {
        id: data.id || `sync_${Date.now()}`,
        type: 'sync:error',
        category: 'File Sync',
        timestamp: data.timestamp || new Date().toISOString(),
        title: 'Sync Error',
        message: data.message || 'File sync failed'
      };
      setActivityLog(prev => [activity, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchStats();
    fetchActivityLog();
    fetchProducts();
    fetchApsStatus();
  }, [serverStatus]);

  // Fetch APS connection status
  const fetchApsStatus = async () => {
    if (serverStatus !== 'online') {
      setApsStatusLoading(false);
      setApsStatus(null);
      return;
    }

    setApsStatusLoading(true);
    setShowApsBanner(true); // Show banner when checking
    try {
      const res = await fetch('/api/settings/aps-status');
      if (res.ok) {
        const data = await res.json();
        setApsStatus(data);
        
        // Auto-dismiss success banner after 5 seconds
        if (data.connected) {
          setTimeout(() => setShowApsBanner(false), 5000);
        }
      } else {
        setApsStatus({
          connected: false,
          status: 'error',
          message: 'Failed to check APS status',
          hasCredentials: false
        });
      }
    } catch (error) {
      console.error('Failed to fetch APS status:', error);
      setApsStatus({
        connected: false,
        status: 'error',
        message: 'Server unreachable',
        hasCredentials: false
      });
    }
    setApsStatusLoading(false);
  };

  const fetchProducts = async () => {
    if (serverStatus !== 'online') {
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
    setProductsLoading(false);
  };

  const fetchActivityLog = async () => {
    if (serverStatus !== 'online') {
      setActivityLoading(false);
      return;
    }

    setActivityLoading(true);
    try {
      const res = await fetch('/api/activity?limit=20');
      if (res.ok) {
        const data = await res.json();
        setActivityLog(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity log:', error);
    }
    setActivityLoading(false);
  };

  const fetchStats = async () => {
    if (serverStatus !== 'online') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch app bundles
      const bundlesRes = await fetch('/api/aps/appbundles');
      let bundlesData = { data: [] };
      if (bundlesRes.ok) {
        const text = await bundlesRes.text();
        try {
          bundlesData = JSON.parse(text);
        } catch { /* not JSON */ }
      }
      
      // Fetch activities
      const activitiesRes = await fetch('/api/aps/activities');
      let activitiesData = { data: [] };
      if (activitiesRes.ok) {
        const text = await activitiesRes.text();
        try {
          activitiesData = JSON.parse(text);
        } catch { /* not JSON */ }
      }
      
      // Fetch buckets count
      let bucketsCount = 0;
      try {
        const bucketsRes = await fetch('/api/filesync/oss/buckets');
        if (bucketsRes.ok) {
          const bucketsData = await bucketsRes.json();
          bucketsCount = Array.isArray(bucketsData) ? bucketsData.length : 0;
        }
      } catch { /* ignore */ }

      setStats({
        appBundles: bundlesData.data?.length || 0,
        activities: activitiesData.data?.length || 0,
        workItems: 0,
        buckets: bucketsCount
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
    setLoading(false);
  };

  // Get icon component for activity type
  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, React.ElementType> = {
      'sync:started': RefreshCw,
      'sync:completed': CheckCircle,
      'sync:error': XCircle,
      'sync:config:created': Plus,
      'sync:config:updated': Edit,
      'sync:config:deleted': Trash2,
      'oss:bucket:created': FolderPlus,
      'oss:bucket:deleted': Trash2,
      'oss:object:uploaded': Upload,
      'oss:object:deleted': Trash2,
      'oss:object:translated': Layers,
      'da:bundle:created': Package,
      'da:bundle:deleted': Package,
      'da:activity:created': Zap,
      'da:activity:deleted': Zap,
      'da:workitem:started': Play,
      'da:workitem:completed': CheckCircle,
      'da:workitem:failed': XCircle,
      'product:created': Box,
      'product:updated': Edit,
      'product:deleted': Trash2,
      'system:started': Server,
      'auth:login': LogIn,
      'auth:logout': LogOut
    };
    return iconMap[type] || Activity;
  };

  // Get color for activity type
  const getActivityColor = (type: string) => {
    if (type.includes('error') || type.includes('failed') || type.includes('deleted')) {
      return 'text-red-400 bg-red-500/20';
    }
    if (type.includes('completed') || type.includes('created')) {
      return 'text-green-400 bg-green-500/20';
    }
    if (type.includes('started') || type.includes('processing')) {
      return 'text-yellow-400 bg-yellow-500/20';
    }
    if (type.includes('updated')) {
      return 'text-blue-400 bg-blue-500/20';
    }
    return 'text-gray-400 bg-gray-500/20';
  };

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const statCards = [
    { 
      label: 'App Bundles', 
      value: stats.appBundles, 
      icon: Package, 
      color: 'orange',
      description: 'Registered Design Automation bundles'
    },
    { 
      label: 'Activities', 
      value: stats.activities, 
      icon: Zap, 
      color: 'blue',
      description: 'Defined automation activities'
    },
    { 
      label: 'Work Items', 
      value: stats.workItems, 
      icon: Activity, 
      color: 'green',
      description: 'Jobs processed today'
    },
    { 
      label: 'OSS Buckets', 
      value: stats.buckets, 
      icon: Database, 
      color: 'purple',
      description: 'Cloud storage buckets'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Server Status Banner */}
      {serverStatus === 'offline' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-400">Server Offline</h3>
              <p className="text-sm text-gray-400">
                The backend server at localhost:8080 is not responding. Start the server to use Design Automation features.
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* APS Connection Status Banner */}
      {serverStatus === 'online' && showApsBanner && apsStatus && !apsStatus.connected && (
        <div className={`rounded-xl p-4 flex items-center justify-between ${
          !apsStatus.hasCredentials 
            ? 'bg-yellow-500/10 border border-yellow-500/30'
            : 'bg-red-500/10 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {!apsStatus.hasCredentials ? (
              <Settings className="w-6 h-6 text-yellow-400" />
            ) : (
              <WifiOff className="w-6 h-6 text-red-400" />
            )}
            <div>
              <h3 className={`font-semibold ${!apsStatus.hasCredentials ? 'text-yellow-400' : 'text-red-400'}`}>
                {!apsStatus.hasCredentials ? 'APS Not Configured' : 'APS Disconnected'}
              </h3>
              <p className="text-sm text-gray-400">
                {apsStatus.message || 'Configure your Autodesk Platform Services credentials in Settings.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchApsStatus}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                !apsStatus.hasCredentials 
                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${apsStatusLoading ? 'animate-spin' : ''}`} />
              Retry
            </button>
            <button
              onClick={() => setShowApsBanner(false)}
              className="px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* APS Connected Banner */}
      {serverStatus === 'online' && showApsBanner && apsStatus?.connected && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <h3 className="font-semibold text-green-400">APS Connected</h3>
              <p className="text-sm text-gray-400">
                Successfully connected to Autodesk Platform Services
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchApsStatus}
              className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${apsStatusLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowApsBanner(false)}
              className="px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400',
            blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
            green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
            purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
          }[stat.color];

          return (
            <div
              key={stat.label}
              className={`bg-gradient-to-br ${colorClasses} border rounded-xl p-6`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-slate-900/50`}>
                  <Icon className="w-6 h-6" />
                </div>
                {loading ? (
                  <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <span className="text-3xl font-bold">{stat.value}</span>
                )}
              </div>
              <h3 className="font-semibold text-white mb-1">{stat.label}</h3>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          );
        })}
      </div>

      {/* Server Info */}
      <div className="grid grid-cols-1 gap-6">
        {/* Server Info */}
        <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-400" />
            Server Information
          </h2>
          <div className="space-y-4">
            <InfoRow label="Backend URL" value="http://localhost:8080" />
            <InfoRow label="API Endpoint" value="/api" />
            <InfoRow 
              label="Server Status" 
              value={serverStatus.charAt(0).toUpperCase() + serverStatus.slice(1)}
              valueColor={serverStatus === 'online' ? 'text-green-400' : 'text-red-400'}
            />
            <InfoRow 
              label="APS Connection" 
              value={
                apsStatusLoading ? 'Checking...' :
                !apsStatus ? 'Unknown' :
                apsStatus.connected ? 'Connected' :
                !apsStatus.hasCredentials ? 'Not Configured' : 'Disconnected'
              }
              valueColor={
                apsStatus?.connected ? 'text-green-400' :
                !apsStatus?.hasCredentials ? 'text-yellow-400' : 'text-red-400'
              }
              onClick={() => onNavigate?.('settings')}
              linkText="Settings"
            />
            <InfoRow label="Design Automation" value="v3" />
            <InfoRow label="Viewer Version" value="v7" />
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Box className="w-5 h-5 text-orange-400" />
              Product List
            </h2>
            <p className="text-sm text-gray-500">{products.length} products</p>
          </div>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); }}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            See all <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {serverStatus !== 'online' ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400">Server offline - products unavailable</p>
          </div>
        ) : productsLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
            <p className="text-gray-400">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8">
            <Box className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400">No products configured</p>
            <p className="text-sm text-gray-500 mt-1">Create products in the Product Pipeline</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-slate-700/50">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Last Edited</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium text-center">Parameters</th>
                  <th className="pb-3 font-medium text-center">Status</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map((product) => (
                  <tr key={product.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-lg flex items-center justify-center">
                          <Box className="w-5 h-5 text-orange-400" />
                        </div>
                        <span className="font-medium text-white">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-400 text-sm">
                      {product.category || '-'}
                    </td>
                    <td className="py-3 text-gray-400 text-sm">
                      {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit', 
                        year: '2-digit'
                      }) : '-'}
                    </td>
                    <td className="py-3">
                      {product.sourceFile?.objectKey ? (
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium">
                          .{product.sourceFile.objectKey.split('.').pop()}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 text-center text-gray-400">
                      {product.parameters?.length || 0}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        product.status === 'published' || product.status === 'live'
                          ? 'bg-green-500/20 text-green-400'
                          : product.status === 'testing'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {product.status === 'published' ? 'Live' : product.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            Activity Log
          </h2>
          <button
            onClick={fetchActivityLog}
            disabled={serverStatus !== 'online'}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${activityLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {serverStatus !== 'online' ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400">Server offline - activity log unavailable</p>
          </div>
        ) : activityLoading && activityLog.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
            <p className="text-gray-400">Loading activity...</p>
          </div>
        ) : activityLog.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400">No recent activity</p>
            <p className="text-sm text-gray-500 mt-1">Activities will appear here as they happen</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-auto">
            {activityLog.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);
              
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/30 hover:bg-slate-900/50 transition-colors group"
                >
                  <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-white truncate">
                        {activity.title || activity.type}
                      </h4>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatTime(activity.timestamp)}
                      </span>
                    </div>
                    {activity.message && (
                      <p className="text-sm text-gray-400 truncate">{activity.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-gray-400">
                        {activity.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-1" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Getting Started Guide */}
      {serverStatus === 'offline' && (
        <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Getting Started</h2>
          <div className="space-y-4">
            <Step number={1} title="Start the APS Server">
              <code className="bg-slate-900 px-3 py-2 rounded-lg text-orange-400 text-sm block">
                cd server && node start.js
              </code>
            </Step>
            <Step number={2} title="Configure Environment Variables">
              <p className="text-gray-400 text-sm">
                Ensure <code className="text-orange-400">.env</code> file contains valid APS_CLIENT_ID and APS_CLIENT_SECRET
              </p>
            </Step>
            <Step number={3} title="Upload App Bundle">
              <p className="text-gray-400 text-sm">
                Upload your Inventor iLogic bundle via the App Bundles section
              </p>
            </Step>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, valueColor = 'text-white', onClick, linkText }: { 
  label: string; 
  value: string; 
  valueColor?: string;
  onClick?: () => void;
  linkText?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-medium text-sm ${valueColor}`}>{value}</span>
        {onClick && linkText && (
          <button 
            onClick={onClick}
            className="text-xs text-orange-400 hover:text-orange-300 hover:underline transition-colors"
          >
            {linkText}
          </button>
        )}
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-orange-400 font-bold text-sm">{number}</span>
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-white mb-2">{title}</h3>
        {children}
      </div>
    </div>
  );
}

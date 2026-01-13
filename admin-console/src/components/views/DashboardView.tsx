'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Server, Database, Zap, Activity, Upload, 
  FileCode, CheckCircle, XCircle, Clock, RefreshCw,
  ArrowUpRight, Box, Layers, Package, FolderSync,
  Edit, Trash2, Plus, Play, LogIn, LogOut, AlertCircle,
  FolderPlus, ChevronRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface DashboardViewProps {
  serverStatus: 'online' | 'offline' | 'checking';
  onRefresh: () => void;
}

interface ServerStats {
  appBundles: number;
  activities: number;
  workItems: number;
  buckets: number;
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

export default function DashboardView({ serverStatus, onRefresh }: DashboardViewProps) {
  const [stats, setStats] = useState<ServerStats>({
    appBundles: 0,
    activities: 0,
    workItems: 0,
    buckets: 0
  });
  const [loading, setLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
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
  }, [serverStatus]);

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
              <h3 className="font-semibold text-red-400">APS Server Offline</h3>
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

      {/* Quick Actions & Server Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionButton
              icon={Upload}
              label="Upload Model"
              description="Upload Inventor file"
              disabled={serverStatus !== 'online'}
            />
            <QuickActionButton
              icon={FileCode}
              label="New Work Item"
              description="Start automation job"
              disabled={serverStatus !== 'online'}
            />
            <QuickActionButton
              icon={Package}
              label="Manage Bundles"
              description="App bundle settings"
              disabled={serverStatus !== 'online'}
            />
            <QuickActionButton
              icon={FolderSync}
              label="File Sync"
              description="Sync from Autodesk Cloud"
              disabled={serverStatus !== 'online'}
            />
          </div>
        </div>

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
              label="Status" 
              value={serverStatus.charAt(0).toUpperCase() + serverStatus.slice(1)}
              valueColor={serverStatus === 'online' ? 'text-green-400' : 'text-red-400'}
            />
            <InfoRow label="Design Automation" value="v3" />
            <InfoRow label="Viewer Version" value="v7" />
          </div>
        </div>
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

function QuickActionButton({ 
  icon: Icon, 
  label, 
  description, 
  disabled 
}: { 
  icon: React.ElementType; 
  label: string; 
  description: string; 
  disabled: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`p-4 rounded-xl border text-left transition-all duration-200 group ${
        disabled 
          ? 'bg-slate-800/30 border-slate-700/30 opacity-50 cursor-not-allowed'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-orange-500/50 hover:bg-slate-700/50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${disabled ? 'text-gray-600' : 'text-orange-400'}`} />
        {!disabled && <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" />}
      </div>
      <h3 className={`font-medium ${disabled ? 'text-gray-600' : 'text-white'}`}>{label}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}

function InfoRow({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-medium text-sm ${valueColor}`}>{value}</span>
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

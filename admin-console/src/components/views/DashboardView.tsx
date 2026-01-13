'use client';

import { useState, useEffect } from 'react';
import { 
  Server, Database, Zap, Activity, Upload, 
  FileCode, CheckCircle, XCircle, Clock, RefreshCw,
  ArrowUpRight, Box, Layers, Package
} from 'lucide-react';

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

export default function DashboardView({ serverStatus, onRefresh }: DashboardViewProps) {
  const [stats, setStats] = useState<ServerStats>({
    appBundles: 0,
    activities: 0,
    workItems: 0,
    buckets: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, [serverStatus]);

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

      setStats({
        appBundles: bundlesData.data?.length || 0,
        activities: activitiesData.data?.length || 0,
        workItems: 0,
        buckets: 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
    setLoading(false);
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

      {/* Quick Actions & Info */}
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
              icon={Activity}
              label="View Logs"
              description="Check activity logs"
              disabled={false}
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

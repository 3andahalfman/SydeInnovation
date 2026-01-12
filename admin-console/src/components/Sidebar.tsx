'use client';

import { ViewType } from '@/app/page';
import { 
  LayoutDashboard, Workflow, FolderOpen, Package, 
  Activity, Settings, Zap, Server, Box, Database
} from 'lucide-react';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  serverStatus: 'online' | 'offline' | 'checking';
}

const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'automation', label: 'Design Automation', icon: Workflow },
  { id: 'files', label: 'File Manager', icon: FolderOpen },
  { id: 'oss', label: 'OSS Buckets', icon: Database },
  { id: 'bundles', label: 'App Bundles', icon: Package },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeView, setActiveView, serverStatus }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900/50 backdrop-blur-lg border-r border-slate-700/50 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">SydeFlow</h1>
            <p className="text-xs text-gray-500">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                  : 'text-gray-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Server Info */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">APS Backend</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">localhost:8080</span>
            <div className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' 
                ? 'bg-green-400' 
                : serverStatus === 'offline'
                ? 'bg-red-400'
                : 'bg-yellow-400 animate-pulse'
            }`} />
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="p-4 text-center">
        <span className="text-xs text-gray-600">v1.0.0</span>
      </div>
    </aside>
  );
}

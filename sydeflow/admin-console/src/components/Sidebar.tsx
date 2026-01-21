'use client';

import { ViewType } from '@/app/page';
import { useNotifications } from '@/contexts/NotificationContext';
import { 
  LayoutDashboard, Workflow, Package, 
  Activity, Settings, Zap, Server, Database, CloudCog, GitMerge
} from 'lucide-react';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  serverStatus: 'online' | 'offline' | 'checking';
}

const navItems: { id: ViewType; label: string; icon: React.ElementType; description?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & Status' },
  { id: 'sync', label: 'File Sync', icon: CloudCog, description: 'Sync from Cloud' },
  { id: 'oss', label: 'OSS Buckets', icon: Database, description: 'File Storage' },
  { id: 'pipeline', label: 'Product Pipeline', icon: GitMerge, description: 'Create Products' },
  { id: 'automation', label: 'Automation', icon: Workflow, description: 'Inventor DA Workflow' },
  { id: 'activity', label: 'Activity Log', icon: Activity, description: 'History' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration' },
];

export default function Sidebar({ activeView, setActiveView, serverStatus }: SidebarProps) {
  const { notifications, clearNotification } = useNotifications();

  const handleNavClick = (viewId: ViewType) => {
    setActiveView(viewId);
    // Clear notification when user views the tab
    if (notifications[viewId] > 0) {
      clearNotification(viewId);
    }
  };

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
          const notificationCount = notifications[item.id] || 0;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${
                isActive 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                  : 'text-gray-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {notificationCount > 0 && !isActive && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-cyan-400/90 via-blue-500/90 to-cyan-600/90 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/40 backdrop-blur-sm border border-white/30">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </div>
              <span className="font-medium flex-1 text-left">{item.label}</span>
              {notificationCount > 0 && isActive && (
                <span className="text-xs text-cyan-400/60">
                  {notificationCount} new
                </span>
              )}
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

'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, Upload, Play, FileCode, Database, 
  Terminal, Activity, FolderOpen, RefreshCw,
  CheckCircle, XCircle, Clock, Zap, Server,
  Box, Layers, Eye, Download, Trash2, ChevronRight,
  AlertCircle, Loader2, User, LogIn, LogOut
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import DashboardView from '@/components/views/DashboardView';
import DesignAutomationView from '@/components/views/DesignAutomationView';
import ActivityView from '@/components/views/ActivityView';
import SettingsView from '@/components/views/SettingsView';
import BundlesView from '@/components/views/BundlesView';
import OSSManagerView from '@/components/views/OSSManagerView';
import ProductManagerView from '@/components/views/ProductManagerView';
import FileSyncView from '@/components/views/FileSyncView';

export type ViewType = 'dashboard' | 'products' | 'automation' | 'bundles' | 'activity' | 'settings' | 'oss' | 'sync';

export default function AdminConsole() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autodeskAuth, setAutodeskAuth] = useState<{
    authenticated: boolean;
    checking: boolean;
  }>({ authenticated: false, checking: true });

  const checkAutodeskAuth = async () => {
    try {
      const res = await fetch('/api/filesync/auth/status');
      const data = await res.json();
      setAutodeskAuth({ authenticated: data.authenticated, checking: false });
    } catch {
      setAutodeskAuth({ authenticated: false, checking: false });
    }
  };

  const handleAutodeskLogin = async () => {
    try {
      const res = await fetch('/api/filesync/auth/login');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
      const response = await fetch('/api/aps/auth/token', { method: 'GET' });
      if (response.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkServerStatus();
    checkAutodeskAuth();
    
    // Check if returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      // Clean up URL and refresh auth status
      window.history.replaceState({}, '', window.location.pathname);
      checkAutodeskAuth();
    }
    
    const interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView serverStatus={serverStatus} onRefresh={checkServerStatus} />;
      case 'products':
        return <ProductManagerView />;
      case 'automation':
        return <DesignAutomationView />;
      case 'bundles':
        return <BundlesView />;
      case 'oss':
        return <OSSManagerView />;
      case 'sync':
        return <FileSyncView />;
      case 'activity':
        return <ActivityView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView serverStatus={serverStatus} onRefresh={checkServerStatus} />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar */}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        serverStatus={serverStatus}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white capitalize">
                {activeView === 'automation' ? 'Design Automation' : 
                 activeView === 'products' ? 'Product Manager' :
                 activeView === 'oss' ? 'OSS Buckets' : activeView}
              </h1>
              {lastChecked && (
                <span className="text-xs text-gray-500">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Autodesk Account Status */}
              {autodeskAuth.checking ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-700/50 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </div>
              ) : autodeskAuth.authenticated ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-cyan-500/20 text-cyan-400">
                  <User className="w-4 h-4" />
                  Autodesk Connected
                </div>
              ) : (
                <button
                  onClick={handleAutodeskLogin}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in to Autodesk
                </button>
              )}
              
              <button
                onClick={checkServerStatus}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                title="Refresh status"
              >
                <RefreshCw className={`w-5 h-5 text-gray-400 ${serverStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                serverStatus === 'online' 
                  ? 'bg-green-500/20 text-green-400' 
                  : serverStatus === 'offline'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  serverStatus === 'online' 
                    ? 'bg-green-400' 
                    : serverStatus === 'offline'
                    ? 'bg-red-400'
                    : 'bg-yellow-400 animate-pulse'
                }`} />
                APS Server: {serverStatus === 'checking' ? 'Checking...' : serverStatus}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

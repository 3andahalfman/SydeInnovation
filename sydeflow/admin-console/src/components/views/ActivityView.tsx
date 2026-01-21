'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, Clock, CheckCircle, XCircle, 
  AlertCircle, Loader2, RefreshCw, Filter,
  ChevronDown, ChevronRight, Eye, Download,
  Trash2, Search
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  action: string;
  message: string;
  details?: string;
  workItemId?: string;
}

export default function ActivityView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    // Initialize with sample logs
    setLogs([
      {
        id: '1',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        type: 'success',
        action: 'Work Item Completed',
        message: 'Wardrobe customization completed successfully',
        workItemId: 'WI-001234',
        details: 'Parameters: Width=1200mm, Height=2400mm, Material=Oak'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        type: 'info',
        action: 'File Uploaded',
        message: 'Uploaded wardrobe_template.ipt (4.2 MB)',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        type: 'warning',
        action: 'Translation Slow',
        message: 'Model translation taking longer than expected',
        details: 'Consider optimizing model complexity'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        type: 'error',
        action: 'Work Item Failed',
        message: 'Design Automation job failed',
        workItemId: 'WI-001233',
        details: 'Error: Invalid parameter value for Width. Expected range: 600-3000mm'
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        type: 'success',
        action: 'Server Started',
        message: 'APS backend server started on port 8080',
      }
    ]);
  }, []);

  const filteredLogs = logs
    .filter(log => filter === 'all' || log.type === filter)
    .filter(log => 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'error': return XCircle;
      default: return Activity;
    }
  };

  const getColorClasses = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400 bg-green-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20';
      case 'error': return 'text-red-400 bg-red-500/20';
      default: return 'text-blue-400 bg-blue-500/20';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60 / 1000)} min ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 60 / 60 / 1000)} hours ago`;
    return date.toLocaleDateString();
  };

  const clearLogs = () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      setLogs([]);
    }
  };

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.type === 'success').length,
    warning: logs.filter(l => l.type === 'warning').length,
    error: logs.filter(l => l.type === 'error').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Log</h2>
          <p className="text-gray-400 text-sm">Monitor Design Automation activity and events</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-600"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Events" value={stats.total} color="blue" />
        <StatCard label="Successful" value={stats.success} color="green" />
        <StatCard label="Warnings" value={stats.warning} color="yellow" />
        <StatCard label="Errors" value={stats.error} color="red" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
          {(['all', 'info', 'success', 'warning', 'error'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Activity</h3>
            <p className="text-gray-500">
              {searchQuery || filter !== 'all' 
                ? 'No logs match your filters'
                : 'Activity will appear here as you use Design Automation'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {filteredLogs.map(log => {
              const Icon = getIcon(log.type);
              const colorClasses = getColorClasses(log.type);
              const isExpanded = expandedLog === log.id;

              return (
                <div 
                  key={log.id} 
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <button
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${colorClasses}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-white">{log.action}</h3>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(log.timestamp)}
                            </span>
                            {log.details && (
                              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 truncate">{log.message}</p>
                        {log.workItemId && (
                          <span className="inline-block mt-2 px-2 py-1 bg-slate-700/50 text-gray-400 text-xs rounded font-mono">
                            {log.workItemId}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  
                  {isExpanded && log.details && (
                    <div className="px-4 pb-4 pl-16">
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{log.details}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
  }[color];

  return (
    <div className={`rounded-xl p-4 border ${colorClasses}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );
}

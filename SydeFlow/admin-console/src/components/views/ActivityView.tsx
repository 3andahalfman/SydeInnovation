'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Search,
  ChevronDown,
  Database,
  Zap,
  Box,
  Package,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '@/lib/config';

type ActivitySeverity = 'info' | 'success' | 'warning' | 'error';

interface ActivityEntry {
  id: string;
  type: string;
  category: string;
  timestamp: string;
  title?: string;
  message?: string;
  details?: unknown;
}

function getActivitySeverity(type: string): ActivitySeverity {
  if (type.includes('error') || type.includes('failed') || type.includes('deleted')) return 'error';
  if (type.includes('completed') || type.includes('created')) return 'success';
  if (type.includes('started') || type.includes('processing')) return 'warning';
  return 'info';
}

function formatDetails(details: unknown): string {
  if (!details) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export default function ActivityView() {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [filter, setFilter] = useState<'all' | ActivitySeverity>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/activity?limit=200');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity log:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    const socket: Socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('activity:new', (activity: ActivityEntry) => {
      setLogs((prev) => [activity, ...prev].slice(0, 200));
    });

    socket.on('activity:cleared', () => {
      setLogs([]);
    });

    socket.on('sync:completed', (data: any) => {
      const activity: ActivityEntry = {
        id: data.id || `sync_${Date.now()}`,
        type: 'sync:completed',
        category: 'File Sync',
        timestamp: data.timestamp || new Date().toISOString(),
        title: 'File Synced',
        message: data.message || 'File synchronized successfully',
        details: data.details,
      };
      setLogs((prev) => [activity, ...prev].slice(0, 200));
    });

    socket.on('sync:error', (data: any) => {
      const activity: ActivityEntry = {
        id: data.id || `sync_${Date.now()}`,
        type: 'sync:error',
        category: 'File Sync',
        timestamp: data.timestamp || new Date().toISOString(),
        title: 'Sync Error',
        message: data.message || 'File sync failed',
        details: data.details,
      };
      setLogs((prev) => [activity, ...prev].slice(0, 200));
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchLogs]);

  const filteredLogs = logs
    .filter((log) => filter === 'all' || getActivitySeverity(log.type) === filter)
    .filter((log) => {
      const haystack = [
        log.title || '',
        log.message || '',
        log.type || '',
        log.category || '',
        formatDetails(log.details),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });

  const getIcon = (type: string) => {
    if (type.includes('workitem') || type.includes('da:')) return Zap;
    if (type.includes('product')) return Box;
    if (type.includes('sync') || type.includes('oss')) return Database;
    if (type.includes('bundle')) return Package;
    if (type.includes('error') || type.includes('failed')) return XCircle;
    if (type.includes('completed') || type.includes('created')) return CheckCircle;
    return Activity;
  };

  const getColorClasses = (type: string) => {
    const severity = getActivitySeverity(type);
    switch (severity) {
      case 'success':
        return 'text-green-400 bg-green-500/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'error':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-blue-400 bg-blue-500/20';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60 / 1000)} min ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 60 / 60 / 1000)} hours ago`;
    return date.toLocaleDateString();
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) return;

    setIsClearing(true);
    try {
      await fetch('/api/activity', { method: 'DELETE' });
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear activity log:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const stats = {
    total: logs.length,
    success: logs.filter((l) => getActivitySeverity(l.type) === 'success').length,
    warning: logs.filter((l) => getActivitySeverity(l.type) === 'warning').length,
    error: logs.filter((l) => getActivitySeverity(l.type) === 'error').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Log</h2>
          <p className="text-gray-400 text-sm">Live platform activity from dashboard services</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-600"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={clearLogs}
            disabled={isClearing}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-600"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Clear Logs'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Events" value={stats.total} color="blue" />
        <StatCard label="Successful" value={stats.success} color="green" />
        <StatCard label="Warnings" value={stats.warning} color="yellow" />
        <StatCard label="Errors" value={stats.error} color="red" />
      </div>

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
          {(['all', 'info', 'success', 'warning', 'error'] as const).map((f) => (
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

      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-500 mx-auto mb-3 animate-spin" />
            <p className="text-gray-400">Loading activity...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Activity</h3>
            <p className="text-gray-500">
              {searchQuery || filter !== 'all' ? 'No logs match your filters' : 'No events available yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {filteredLogs.map((log) => {
              const Icon = getIcon(log.type);
              const colorClasses = getColorClasses(log.type);
              const isExpanded = expandedLog === log.id;
              const detailsText = formatDetails(log.details);

              return (
                <div key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <button onClick={() => setExpandedLog(isExpanded ? null : log.id)} className="w-full p-4 text-left">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${colorClasses}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-white truncate">{log.title || log.type}</h3>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(log.timestamp)}
                            </span>
                            {detailsText && (
                              <ChevronDown
                                className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            )}
                          </div>
                        </div>
                        {log.message && <p className="text-sm text-gray-400 truncate">{log.message}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-block px-2 py-1 bg-slate-700/50 text-gray-400 text-xs rounded font-mono">
                            {log.type}
                          </span>
                          {log.category && (
                            <span className="inline-block px-2 py-1 bg-slate-700/30 text-gray-500 text-xs rounded">
                              {log.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && detailsText && (
                    <div className="px-4 pb-4 pl-16">
                      <div className="bg-slate-900/50 rounded-lg p-4">
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{detailsText}</pre>
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

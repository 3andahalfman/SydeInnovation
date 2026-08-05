"use client";

import { useState, useEffect, useRef } from "react";
import {
  Server,
  Database,
  Zap,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ArrowUpRight,
  Box,
  Package,
  Plus,
  AlertCircle,
  ChevronRight,
  Settings,
  WifiOff,
  HardDrive,
  Sliders,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { SERVER_URL } from '@/lib/config';
import type { ViewType } from "@/app/page";

interface DashboardViewProps {
  serverStatus: "online" | "offline" | "checking";
  onRefresh: () => void;
  onNavigate?: (view: ViewType) => void;
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
  drawingFile?: {
    bucketKey?: string;
    objectKey?: string;
    fileName?: string;
    urn?: string;
  };
  activityId?: string;
  lastOutputUrn?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function DashboardView({
  serverStatus,
  onRefresh,
  onNavigate,
}: DashboardViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [apsStatus, setApsStatus] = useState<APSStatus | null>(null);
  const [apsStatusLoading, setApsStatusLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Socket connection for real-time activity updates
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("activity:new", (activity: ActivityEntry) => {
      setActivityLog((prev) => [activity, ...prev].slice(0, 50));
    });

    socket.on("activity:cleared", () => {
      setActivityLog([]);
    });

    socket.on("sync:completed", (data: any) => {
      const activity: ActivityEntry = {
        id: data.id || `sync_${Date.now()}`,
        type: "sync:completed",
        category: "File Sync",
        timestamp: data.timestamp || new Date().toISOString(),
        title: "File Synced",
        message: data.message || "File synchronized successfully",
      };
      setActivityLog((prev) => [activity, ...prev].slice(0, 50));
    });

    socket.on("sync:error", (data: any) => {
      const activity: ActivityEntry = {
        id: data.id || `sync_${Date.now()}`,
        type: "sync:error",
        category: "File Sync",
        timestamp: data.timestamp || new Date().toISOString(),
        title: "Sync Error",
        message: data.message || "File sync failed",
      };
      setActivityLog((prev) => [activity, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchApsStatus();
    fetchActivityLog();
  }, [serverStatus]);

  const fetchApsStatus = async () => {
    if (serverStatus !== "online") {
      setApsStatusLoading(false);
      setApsStatus(null);
      return;
    }
    setApsStatusLoading(true);
    try {
      const res = await fetch("/api/settings/aps-status");
      if (res.ok) {
        const data = await res.json();
        setApsStatus(data);
      } else {
        setApsStatus({
          connected: false,
          status: "error",
          message: "Failed to check",
          hasCredentials: false,
        });
      }
    } catch {
      setApsStatus({
        connected: false,
        status: "error",
        message: "Server unreachable",
        hasCredentials: false,
      });
    }
    setApsStatusLoading(false);
  };
  const fetchProducts = async () => {
    if (serverStatus !== "online") {
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/products", { headers });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
    setProductsLoading(false);
  };

  const fetchActivityLog = async () => {
    if (serverStatus !== "online") {
      setActivityLoading(false);
      return;
    }
    setActivityLoading(true);
    try {
      const res = await fetch("/api/activity?limit=15");
      if (res.ok) {
        const data = await res.json();
        setActivityLog(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
    }
    setActivityLoading(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    if (type.includes("workitem") || type.includes("da:")) return Zap;
    if (type.includes("product")) return Box;
    if (type.includes("sync") || type.includes("oss")) return Database;
    if (type.includes("bundle")) return Package;
    if (type.includes("error") || type.includes("failed")) return XCircle;
    if (type.includes("completed") || type.includes("created"))
      return CheckCircle;
    return Activity;
  };

  const getActivityColor = (type: string) => {
    if (
      type.includes("error") ||
      type.includes("failed") ||
      type.includes("deleted")
    )
      return "text-red-400 bg-red-500/20";
    if (type.includes("completed") || type.includes("created"))
      return "text-green-400 bg-green-500/20";
    if (type.includes("started") || type.includes("processing"))
      return "text-yellow-400 bg-yellow-500/20";
    if (type.includes("updated")) return "text-blue-400 bg-blue-500/20";
    return "text-gray-400 bg-gray-500/20";
  };

  const getProductReadiness = (p: Product) => {
    const steps = [
      { done: !!p.sourceFile, label: "Source File" },
      { done: (p.parameters?.length || 0) > 0, label: "Parameters" },
      { done: !!p.activityId, label: "Activity" },
      { done: !!p.lastOutputUrn, label: "Automation" },
    ];
    return {
      steps,
      completed: steps.filter((s) => s.done).length,
      total: steps.length,
    };
  };

  // Derived stats
  const totalProducts = products.length;
  const liveProducts = products.filter(
    (p) => p.status === "live" || p.status === "published",
  ).length;
  const draftProducts = products.filter((p) => p.status === "draft").length;
  const automatedProducts = products.filter((p) => !!p.lastOutputUrn).length;
  const productsWithParams = products.filter(
    (p) => (p.parameters?.length || 0) > 0,
  ).length;
  const productsWithFiles = products.filter((p) => !!p.sourceFile).length;

  return (
    <div className="space-y-6">
      {/* Server Offline Banner */}
      {serverStatus === "offline" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-400">Server Offline</h3>
              <p className="text-sm text-gray-400">
                Backend server is not responding.
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* ────── Quick Stats ────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Products */}
        <button
          onClick={() => onNavigate?.("workspace")}
          className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-5 text-left hover:border-orange-400/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-900/50">
              <Box className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-3xl font-bold text-orange-400">
              {totalProducts}
            </span>
          </div>
          <h3 className="font-semibold text-white mb-0.5">Products</h3>
          <p className="text-xs text-gray-500">
            {liveProducts} live · {draftProducts} draft
          </p>
        </button>

        {/* Automated */}
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-900/50">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-3xl font-bold text-green-400">
              {automatedProducts}
            </span>
          </div>
          <h3 className="font-semibold text-white mb-0.5">Automated</h3>
          <p className="text-xs text-gray-500">
            {productsWithFiles} with source files
          </p>
        </div>

        {/* Configured */}
        <button
          onClick={() => onNavigate?.("configurator")}
          className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-5 text-left hover:border-blue-400/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-900/50">
              <Sliders className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-3xl font-bold text-blue-400">
              {productsWithParams}
            </span>
          </div>
          <h3 className="font-semibold text-white mb-0.5">Configured</h3>
          <p className="text-xs text-gray-500">Products with parameters</p>
        </button>

        {/* APS Status */}
        <button
          onClick={() => onNavigate?.("settings")}
          className={`bg-gradient-to-br border rounded-xl p-5 text-left hover:opacity-90 transition-colors ${
            apsStatusLoading
              ? "from-gray-500/20 to-gray-600/10 border-gray-500/30"
              : apsStatus?.connected
                ? "from-purple-500/20 to-purple-600/10 border-purple-500/30"
                : "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-900/50">
              {apsStatusLoading ? (
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              ) : apsStatus?.connected ? (
                <Server className="w-5 h-5 text-purple-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-yellow-400" />
              )}
            </div>
            <div
              className={`w-3 h-3 rounded-full mt-2 ${
                apsStatusLoading
                  ? "bg-gray-400 animate-pulse"
                  : apsStatus?.connected
                    ? "bg-green-400"
                    : apsStatus?.hasCredentials
                      ? "bg-red-400"
                      : "bg-yellow-400"
              }`}
            />
          </div>
          <h3 className="font-semibold text-white mb-0.5">APS Status</h3>
          <p className="text-xs text-gray-500">
            {apsStatusLoading
              ? "Checking..."
              : apsStatus?.connected
                ? "Connected"
                : !apsStatus?.hasCredentials
                  ? "Not configured"
                  : "Disconnected"}
          </p>
        </button>
      </div>

      {/* ────── Products Overview + Activity ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Overview (2/3 width) */}
        <div className="lg:col-span-2 bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Box className="w-5 h-5 text-orange-400" />
              Products
            </h2>
            <button
              onClick={() => onNavigate?.("workspace")}
              className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {serverStatus !== "online" ? (
            <div className="text-center py-12">
              <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-gray-400">Server offline</p>
            </div>
          ) : productsLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 text-slate-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Box className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-1">No products yet</p>
              <p className="text-xs text-gray-500 mb-4">
                Create your first product to get started
              </p>
              <button
                onClick={() => onNavigate?.("workspace")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Product
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 6).map((product) => {
                const readiness = getProductReadiness(product);
                return (
                  <div
                    key={product.id}
                    onClick={() => onNavigate?.("workspace")}
                    className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/40 hover:bg-slate-900/70 border border-transparent hover:border-slate-700/50 transition-all cursor-pointer group"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Box className="w-5 h-5 text-orange-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-white truncate">
                          {product.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            product.status === "live" ||
                            product.status === "published"
                              ? "bg-green-500/20 text-green-400"
                              : product.status === "testing"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {product.status === "published"
                            ? "live"
                            : product.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {product.sourceFile && (
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {product.sourceFile.fileName ||
                              product.sourceFile.objectKey}
                          </span>
                        )}
                        {product.activityId && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            Activity
                          </span>
                        )}
                        {(product.parameters?.length || 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Sliders className="w-3 h-3 text-blue-400" />
                            {product.parameters!.length} params
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Readiness */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div
                        className="flex items-center gap-1"
                        title={`${readiness.completed}/${readiness.total} setup steps`}
                      >
                        {readiness.steps.map((step, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${step.done ? "bg-green-400" : "bg-slate-600"}`}
                            title={`${step.label}: ${step.done ? "✓" : "○"}`}
                          />
                        ))}
                      </div>

                      {product.lastOutputUrn ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-[10px] font-medium text-green-400 uppercase tracking-wider">
                            Automated
                          </span>
                        </span>
                      ) : product.activityId ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          <span className="text-[10px] font-medium text-yellow-400 uppercase tracking-wider">
                            Pending
                          </span>
                        </span>
                      ) : null}

                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </div>
                );
              })}

              {products.length > 6 && (
                <button
                  onClick={() => onNavigate?.("workspace")}
                  className="w-full text-center py-2.5 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-slate-900/30"
                >
                  +{products.length - 6} more products
                </button>
              )}
            </div>
          )}
        </div>

        {/* Activity Feed (1/3 width) */}
        <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-400" />
              Activity
            </h2>
            <button
              onClick={() => onNavigate?.("activity")}
              className="text-sm text-gray-400 hover:text-white transition-colors"
              title="View all activity"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {serverStatus !== "online" ? (
            <div className="text-center py-12">
              <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Server offline</p>
            </div>
          ) : activityLoading && activityLog.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 text-slate-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Loading...</p>
            </div>
          ) : activityLog.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No recent activity</p>
              <p className="text-xs text-gray-500 mt-1">
                Events appear here in real-time
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-auto">
              {activityLog.slice(0, 15).map((activity) => {
                const Icon = getActivityIcon(activity.type);
                const colorClass = getActivityColor(activity.type);

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-900/40 transition-colors"
                  >
                    <div
                      className={`p-1.5 rounded-md ${colorClass} flex-shrink-0 mt-0.5`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate leading-tight">
                        {activity.title || activity.type}
                      </p>
                      {activity.message && (
                        <p className="text-xs text-gray-500 truncate">
                          {activity.message}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ────── Quick Actions ────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate?.("workspace")}
          className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-orange-500/30 hover:bg-slate-800/50 transition-all group"
        >
          <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
            <Plus className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">New Product</p>
            <p className="text-xs text-gray-500">Create & configure</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.("configurator")}
          className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-blue-500/30 hover:bg-slate-800/50 transition-all group"
        >
          <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
            <Sliders className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Configurator</p>
            <p className="text-xs text-gray-500">Design layouts</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.("oss")}
          className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-cyan-500/30 hover:bg-slate-800/50 transition-all group"
        >
          <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">File Manager</p>
            <p className="text-xs text-gray-500">OSS storage</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.("settings")}
          className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-purple-500/30 hover:bg-slate-800/50 transition-all group"
        >
          <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
            <Settings className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Settings</p>
            <p className="text-xs text-gray-500">APS credentials</p>
          </div>
        </button>
      </div>
    </div>
  );
}

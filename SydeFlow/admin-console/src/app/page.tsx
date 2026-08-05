"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Upload,
  Play,
  FileCode,
  Database,
  Terminal,
  Activity,
  FolderOpen,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Server,
  Box,
  Layers,
  Eye,
  Download,
  Trash2,
  ChevronRight,
  AlertCircle,
  Loader2,
  User,
  LogIn,
  LogOut,
  Bell,
  ChevronDown,
  Package,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import LoginView from "@/components/views/LoginView";
import DashboardView from "@/components/views/DashboardView";
import AutomationDashboard from "@/components/views/AutomationDashboard";
import ActivityView from "@/components/views/ActivityView";
import SettingsView from "@/components/views/SettingsView";
import BundlesView from "@/components/views/BundlesView";
import OSSManagerView from "@/components/views/OSSManagerView";
import ProductPipeline from "@/components/views/ProductPipeline";
import ProductWorkspace from "@/components/views/ProductWorkspace";
import SetupView from "@/components/views/SetupView";
import ConfiguratorView from "@/components/views/ConfiguratorView";
import QuotesView from "@/components/views/QuotesView";
import IntegrationView from "@/components/views/IntegrationView";
import { useNotifications } from "@/contexts/NotificationContext";

export type ViewType =
  | "dashboard"
  | "workspace"
  | "configurator"
  | "quotes"
  | "pipeline"
  | "integration"
  | "orders"
  | "bundles"
  | "activity"
  | "settings"
  | "oss"
  | "setup";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
}

export default function AdminConsole() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>("dashboard");
  const [serverStatus, setServerStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autodeskAuth, setAutodeskAuth] = useState<{
    authenticated: boolean;
    checking: boolean;
  }>({ authenticated: false, checking: true });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Notifications State
  const {
    notifications,
    getTotalCount,
    clearAllNotifications,
    clearNotification,
  } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Restrict admin-only views for non-admin users
  const isAdmin = user?.role === "admin";
  const adminOnlyViews: ViewType[] = ["activity", "bundles", "setup"];

  // Check authentication on mount
  useEffect(() => {
    setIsMounted(true);

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        const userJson = localStorage.getItem("user");

        if (!token) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        // Verify token with backend
        const response = await fetch("/api/auth/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        if (data.success && userJson) {
          setUser(JSON.parse(userJson));
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Redirect non-admin users away from admin-only views
  useEffect(() => {
    if (adminOnlyViews.includes(activeView) && !isAdmin) {
      setActiveView("dashboard");
    }
  }, [activeView, isAdmin]);

  const checkAutodeskAuth = async () => {
    try {
      const res = await fetch("/api/filesync/auth/status");
      const data = await res.json();
      setAutodeskAuth({ authenticated: data.authenticated, checking: false });
    } catch {
      setAutodeskAuth({ authenticated: false, checking: false });
    }
  };

  const checkServerStatus = async () => {
    setServerStatus("checking");
    try {
      // Use /api endpoint which doesn't require APS authentication
      const response = await fetch("/api");
      if (response.ok) {
        setServerStatus("online");
      } else {
        setServerStatus("offline");
      }
    } catch {
      setServerStatus("offline");
    }
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkServerStatus();
    checkAutodeskAuth();

    // Check if returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auth") === "success") {
      // Clean up URL and refresh auth status
      window.history.replaceState({}, "", window.location.pathname);
      checkAutodeskAuth();
    }

    const interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (token: string, userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
    setActiveView("dashboard");
  };

  const handleAutodeskLogin = async () => {
    try {
      const res = await fetch("/api/filesync/auth/login");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  // Show loading state until mounted
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-200">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-200">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <DashboardView
            serverStatus={serverStatus}
            onRefresh={checkServerStatus}
            onNavigate={setActiveView}
          />
        );
      case "workspace":
        return <ProductWorkspace onNavigate={setActiveView} />;
      case "configurator":
        return <ConfiguratorView />;
      case "quotes":
        return <QuotesView />;
      case "pipeline":
        return <ProductPipeline />;
      case "integration":
        return <IntegrationView />;
      case "orders":
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Box className="w-16 h-16 mx-auto text-slate-600 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Orders</h2>
              <p className="text-slate-400">Order management coming soon</p>
            </div>
          </div>
        );
      case "bundles":
        return <BundlesView />;
      case "oss":
        return <OSSManagerView />;
      case "activity":
        return <ActivityView />;
      case "settings":
        return <SettingsView user={user} onSettingsSaved={checkServerStatus} />;
      default:
        return (
          <DashboardView
            serverStatus={serverStatus}
            onRefresh={checkServerStatus}
            onNavigate={setActiveView}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        serverStatus={serverStatus}
        isAdmin={isAdmin}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-[73px] bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-white capitalize">
                  {activeView === "workspace"
                    ? "Product Manager"
                    : activeView === "pipeline"
                      ? "Product Automation Pipeline"
                      : activeView === "oss"
                        ? "File Manager"
                        : activeView === "configurator"
                          ? "Configurator"
                          : activeView === "quotes"
                            ? "Quotes"
                            : activeView === "integration"
                              ? "Integration"
                              : activeView === "orders"
                                ? "Orders"
                                : activeView}
                </h1>
                {lastChecked && (
                  <span className="text-xs text-gray-500">
                    Last checked: {lastChecked.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-0.5">
                {activeView === "configurator"
                  ? "Configure and preview your products in 3D"
                  : activeView === "quotes"
                    ? "Customer quote requests and lead management"
                    : activeView === "workspace"
                      ? "Manage your CAD products and parameters"
                      : activeView === "pipeline"
                        ? "Automated production workflows"
                        : activeView === "oss"
                          ? "Browse and manage cloud storage"
                          : activeView === "integration"
                            ? "API & Webhooks configuration"
                            : activeView === "orders"
                              ? "Order management and tracking"
                              : activeView === "bundles"
                                ? "App bundles for Design Automation"
                                : activeView === "activity"
                                  ? "System activity and logs"
                                  : activeView === "settings"
                                    ? "Application configuration"
                                    : activeView === "setup"
                                      ? "Initial setup wizard"
                                      : activeView === "dashboard"
                                        ? "Overview and quick actions"
                                        : ""}
              </p>
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
                <RefreshCw
                  className={`w-5 h-5 text-gray-400 ${serverStatus === "checking" ? "animate-spin" : ""}`}
                />
              </button>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  serverStatus === "online"
                    ? "bg-green-500/20 text-green-400"
                    : serverStatus === "offline"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    serverStatus === "online"
                      ? "bg-green-400"
                      : serverStatus === "offline"
                        ? "bg-red-400"
                        : "bg-yellow-400 animate-pulse"
                  }`}
                />
                APS Server:{" "}
                {serverStatus === "checking" ? "Checking..." : serverStatus}
              </div>

              {/* Notification Bell */}
              <div
                className="relative"
                onMouseEnter={() => setNotificationsOpen(true)}
                onMouseLeave={() => setNotificationsOpen(false)}
              >
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-gray-400" />
                  {getTotalCount() > 0 && (
                    <span className="absolute top-1 right-1.5 min-w-[14px] h-[14px] bg-red-500 rounded-full border-2 border-slate-900" />
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 top-full pt-2 z-50 min-w-[280px]">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
                        <p className="text-white font-semibold text-sm">
                          Notifications
                        </p>
                        {getTotalCount() > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAllNotifications();
                            }}
                            className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      <div className="max-h-[300px] overflow-y-auto">
                        {getTotalCount() === 0 ? (
                          <div className="px-4 py-6 text-center flex flex-col items-center justify-center space-y-2">
                            <CheckCircle className="w-8 h-8 text-gray-500 opacity-50 mb-1" />
                            <p className="text-gray-400 text-sm font-medium">
                              You're all caught up!
                            </p>
                            <p className="text-gray-500 text-xs">
                              No new notifications
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-700/50">
                            {Object.entries(notifications)
                              .filter(([_, count]) => count > 0)
                              .map(([viewKey, count]) => (
                                <button
                                  key={viewKey}
                                  onClick={() => {
                                    setActiveView(viewKey as ViewType);
                                    clearNotification(viewKey as ViewType);
                                    setNotificationsOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors flex items-start justify-between group"
                                >
                                  <div>
                                    <p className="text-white text-sm font-medium capitalize flex items-center gap-2">
                                      {viewKey === "oss"
                                        ? "File Manager"
                                        : viewKey === "workspace"
                                          ? "Products"
                                          : viewKey}
                                      <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {count}
                                      </span>
                                    </p>
                                    <p className="text-gray-400 text-xs mt-1">
                                      Updates available in this section
                                    </p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors mt-1" />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Account */}
              <div
                className="relative flex items-center gap-3 pl-3 border-l border-slate-700"
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 hover:bg-slate-700/50 px-2 py-1 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-white font-medium text-sm">
                      {user?.fullName || "User"}
                    </p>
                    <p className="text-gray-500 text-xs capitalize">
                      {user?.role}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full pt-2 z-50 min-w-[200px]">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                      <div className="px-4 py-2 border-b border-slate-700">
                        <p className="text-white font-medium text-sm">
                          {user?.fullName}
                        </p>
                        <p className="text-gray-500 text-xs">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-slate-700/50 transition-colors text-sm cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 h-[calc(100vh-73px)] flex flex-col">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

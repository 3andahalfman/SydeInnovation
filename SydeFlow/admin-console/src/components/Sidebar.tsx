"use client";

import { ViewType } from "@/app/page";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  LayoutDashboard,
  Workflow,
  Package,
  Activity,
  Settings,
  Zap,
  Server,
  Database,
  GitMerge,
  Wrench,
  Box,
  Sliders,
  FileText,
} from "lucide-react";

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  serverStatus: "online" | "offline" | "checking";
  isAdmin?: boolean;
}

// Reorganized navigation - product-centric approach
const navItems: {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  description?: string;
  section?: string;
}[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview & Status",
  },
  // Products section
  {
    id: "workspace",
    label: "Products",
    icon: Box,
    description: "Product Management",
    section: "Products",
  },
  {
    id: "configurator",
    label: "Configurator",
    icon: Sliders,
    description: "Configure Products",
    section: "Products",
  },
  {
    id: "quotes",
    label: "Quotes",
    icon: FileText,
    description: "Quote Requests",
    section: "Products",
  },
  // Advanced section
  {
    id: "oss",
    label: "File Manager",
    icon: Database,
    description: "OSS & Sync",
    section: "Advanced",
  },
  {
    id: "integration",
    label: "Integration",
    icon: GitMerge,
    description: "API & Webhooks",
    section: "Advanced",
  },
  {
    id: "orders",
    label: "Orders",
    icon: Package,
    description: "Order Management",
    section: "Advanced",
  },
  // System section
  {
    id: "activity",
    label: "Activity Log",
    icon: Activity,
    description: "History",
    section: "System",
  },
];

export default function Sidebar({
  activeView,
  setActiveView,
  serverStatus,
  isAdmin = true,
}: SidebarProps) {
  const { notifications, clearNotification } = useNotifications();

  // Filter navigation items based on user role
  const filteredNavItems = navItems.filter((item) => {
    const adminOnlyItems = ["activity"];
    if (!isAdmin && adminOnlyItems.includes(item.id)) {
      return false;
    }
    return true;
  });

  const handleNavClick = (viewId: ViewType) => {
    setActiveView(viewId);
    // Clear notification when user views the tab
    if (notifications[viewId] > 0) {
      clearNotification(viewId);
    }
  };

  return (
    <aside className="w-56 bg-slate-900/50 backdrop-blur-lg border-r border-slate-700/50 flex flex-col">
      {/* Logo - matches header height */}
      <div className="h-14 px-4 flex items-center border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">SydeFlow</h1>
            <p className="text-[10px] text-gray-500 leading-tight">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {(() => {
          let lastSection = "";
          return filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const notificationCount = notifications[item.id] || 0;
            const showSection = item.section && item.section !== lastSection;
            lastSection = item.section || "";

            return (
              <div key={item.id}>
                {showSection && (
                  <div className="pt-3 pb-1 px-2 first:pt-1">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {item.section}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                    isActive
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "text-gray-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4" />
                    {notificationCount > 0 && !isActive && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-gradient-to-br from-cyan-400/90 via-blue-500/90 to-cyan-600/90 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/40 backdrop-blur-sm border border-white/30">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    )}
                  </div>
                  <span className="font-medium flex-1 text-left">
                    {item.label}
                  </span>
                  {notificationCount > 0 && isActive && (
                    <span className="text-[10px] text-cyan-400/60">
                      {notificationCount} new
                    </span>
                  )}
                </button>
              </div>
            );
          });
        })()}
      </nav>

      {/* Settings Tab - Pinned to bottom */}
      <div className="px-2.5 pb-2.5">
        <button
          onClick={() => handleNavClick("settings")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
            activeView === "settings"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "text-gray-400 hover:bg-slate-700/50 hover:text-white"
          }`}
        >
          <div className="relative">
            <Settings className="w-4 h-4" />
            {notifications["settings"] > 0 && activeView !== "settings" && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-gradient-to-br from-cyan-400/90 via-blue-500/90 to-cyan-600/90 text-white text-[9px] font-bold rounded-full shadow-lg shadow-cyan-500/40 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                {notifications["settings"] > 99
                  ? "99+"
                  : notifications["settings"]}
              </span>
            )}
          </div>
          <span className="font-medium flex-1 text-left">Settings</span>
          {notifications["settings"] > 0 && activeView === "settings" && (
            <span className="text-[10px] text-cyan-400/60">
              {notifications["settings"]} new
            </span>
          )}
        </button>
      </div>

      {/* Version */}
      <div className="p-2.5 text-center">
        <span className="text-[10px] text-gray-600">v1.0.0</span>
      </div>
    </aside>
  );
}

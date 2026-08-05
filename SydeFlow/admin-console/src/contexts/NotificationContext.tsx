'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ViewType } from '@/app/page';

interface Notifications {
  sync: number;
  oss: number;
  activity: number;
  integration: number;
  orders: number;
  bundles: number;
  products: number;
  pipeline: number;
  workspace: number;
  configurator: number;
  quotes: number;
  dashboard: number;
  settings: number;
  setup: number;
}

interface NotificationContextType {
  notifications: Notifications;
  addNotification: (view: ViewType, count?: number) => void;
  clearNotification: (view: ViewType) => void;
  clearAllNotifications: () => void;
  getTotalCount: () => number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = 'sydeflow_notifications';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notifications>({
    sync: 0,
    oss: 0,
    activity: 0,
    integration: 0,
    orders: 0,
    bundles: 0,
    products: 0,
    pipeline: 0,
    workspace: 0,
    configurator: 0,
    quotes: 0,
    dashboard: 0,
    settings: 0,
    setup: 0,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch {
        // Invalid data, use defaults
      }
    }
  }, []);

  // Save to localStorage when notifications change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((view: ViewType, count = 1) => {
    setNotifications(prev => ({
      ...prev,
      [view]: prev[view] + count,
    }));
  }, []);

  const clearNotification = useCallback((view: ViewType) => {
    setNotifications(prev => ({
      ...prev,
      [view]: 0,
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications({
      sync: 0,
      oss: 0,
      activity: 0,
      integration: 0,
      orders: 0,
      bundles: 0,
      products: 0,
      pipeline: 0,
      workspace: 0,
      configurator: 0,
      quotes: 0,
      dashboard: 0,
      settings: 0,
      setup: 0,
    });
  }, []);

  const getTotalCount = useCallback(() => {
    return Object.values(notifications).reduce((sum, count) => sum + count, 0);
  }, [notifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      clearNotification,
      clearAllNotifications,
      getTotalCount,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    // Defensive fallback: return no-op context and warn
    if (typeof window !== 'undefined' && !(window as any).__sydeflow_notification_warned) {
      // Only warn once per session
      (window as any).__sydeflow_notification_warned = true;
      console.warn('useNotifications called outside NotificationProvider. Notifications will be disabled.');
    }
    // Return a no-op context
    return {
      notifications: {
        sync: 0, oss: 0, activity: 0, integration: 0, orders: 0, bundles: 0, products: 0, pipeline: 0, workspace: 0, configurator: 0, quotes: 0, dashboard: 0, settings: 0, setup: 0,
      },
      addNotification: () => {},
      clearNotification: () => {},
      clearAllNotifications: () => {},
      getTotalCount: () => 0,
    };
  }
  return context;
}

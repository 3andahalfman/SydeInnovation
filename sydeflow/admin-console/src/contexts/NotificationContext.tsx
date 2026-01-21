'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ViewType } from '@/app/page';

interface Notifications {
  sync: number;
  oss: number;
  activity: number;
  automation: number;
  bundles: number;
  products: number;
  pipeline: number;
  dashboard: number;
  settings: number;
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
    automation: 0,
    bundles: 0,
    products: 0,
    pipeline: 0,
    dashboard: 0,
    settings: 0,
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
      automation: 0,
      bundles: 0,
      products: 0,
      pipeline: 0,
      dashboard: 0,
      settings: 0,
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
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

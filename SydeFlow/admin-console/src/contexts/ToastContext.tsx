'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  // Convenience methods
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ) => Promise<T>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Defensive fallback: return no-op context
    if (typeof window !== 'undefined' && !(window as any).__sydeflow_toast_warned) {
      (window as any).__sydeflow_toast_warned = true;
      console.warn('useToast called outside ToastProvider. Toast notifications will be disabled.');
    }
    // Return a no-op context
    return {
      toasts: [],
      addToast: () => '',
      removeToast: () => {},
      updateToast: () => {},
      success: () => '',
      error: () => '',
      warning: () => '',
      info: () => '',
      loading: () => '',
      promise: <T,>(promise: Promise<T>) => promise,
    };
  }
  return context;
}

const toastIcons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  loading: Loader2,
};

const toastColors: Record<ToastType, string> = {
  success: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
  error: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
  warning: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
  info: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  loading: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
};

function ToastComponent({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = toastIcons[toast.type];
  const colorClass = toastColors[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border
        bg-gradient-to-r ${colorClass}
        backdrop-blur-xl shadow-lg shadow-black/20
        animate-slide-in-right
        max-w-sm w-full
      `}
    >
      {/* Glass effect overlay */}
      <div className="absolute inset-0 bg-slate-900/60" />
      
      <div className="relative flex items-start gap-3 p-4">
        <div className={`flex-shrink-0 mt-0.5 ${toast.type === 'loading' ? 'animate-spin' : ''}`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-xs text-slate-300 line-clamp-2">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-xs font-medium hover:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        
        {toast.type !== 'loading' && (
          <button
            onClick={onRemove}
            className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Dismiss"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>
      
      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-current opacity-50 animate-shrink-width"
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? (toast.type === 'loading' ? 0 : 5000),
    };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration (except for loading toasts)
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    
    // If updating to a non-loading type, set auto-remove
    if (updates.type && updates.type !== 'loading') {
      const duration = updates.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    }
  }, [removeToast]);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message, duration: 8000 });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const loading = useCallback((title: string, message?: string) => {
    return addToast({ type: 'loading', title, message, duration: 0 });
  }, [addToast]);

  const promise = useCallback(async <T,>(
    promiseArg: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ): Promise<T> => {
    const id = addToast({ type: 'loading', title: messages.loading });
    
    try {
      const result = await promiseArg;
      const successMsg = typeof messages.success === 'function' 
        ? messages.success(result) 
        : messages.success;
      updateToast(id, { type: 'success', title: successMsg });
      return result;
    } catch (err) {
      const errorMsg = typeof messages.error === 'function'
        ? messages.error(err as Error)
        : messages.error;
      updateToast(id, { type: 'error', title: errorMsg });
      throw err;
    }
  }, [addToast, updateToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        updateToast,
        success,
        error,
        warning,
        info,
        loading,
        promise,
      }}
    >
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastComponent
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md bg-slate-800 border border-red-500/30 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
              <h1 className="text-xl font-bold text-red-400">Error Loading Dashboard</h1>
            </div>
            <p className="text-slate-400 mb-4">
              An unexpected error occurred while loading the application.
            </p>
            <div className="bg-slate-900 border border-slate-700 rounded p-3 mb-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-red-300 font-mono whitespace-pre-wrap break-words">
                {this.state.error?.message}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              Reload Page
            </button>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Check browser console for more details
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

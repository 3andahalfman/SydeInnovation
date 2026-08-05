'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ViewType } from '@/app/page';

interface WelcomeBannerProps {
  onNavigate?: (view: ViewType) => void;
  onDismiss?: () => void;
}

const STORAGE_KEY = 'sydeflow_welcome_dismissed';

export default function WelcomeBanner({ onNavigate, onDismiss }: WelcomeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setIsVisible(true);
      // Trigger entrance animation
      setTimeout(() => setIsAnimating(true), 50);
    }
  }, []);

  const handleDismiss = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem(STORAGE_KEY, 'true');
      onDismiss?.();
    }, 300);
  };

  const handleGetStarted = () => {
    onNavigate?.('settings');
    handleDismiss();
  };

  if (!isVisible) return null;

  return (
    <div className={`
      relative overflow-hidden rounded-2xl mb-6
      transform transition-all duration-300 ease-out
      ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
    `}>
      {/* Liquid glass background */}
      <div className="
        absolute inset-0
        bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10
        backdrop-blur-xl
      " />
      
      {/* Animated water ripple effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-1/2 h-full bg-gradient-radial from-cyan-400/20 to-transparent rounded-full animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/4 w-1/2 h-full bg-gradient-radial from-blue-400/15 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Glass border effect */}
      <div className="absolute inset-0 rounded-2xl border border-white/20" />
      <div className="absolute inset-[1px] rounded-2xl border border-white/5" />
      
      {/* Content */}
      <div className="relative px-6 py-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="
            flex-shrink-0 w-12 h-12 rounded-xl
            bg-gradient-to-br from-cyan-500/20 to-blue-500/20
            border border-white/10
            flex items-center justify-center
            shadow-lg
          ">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          
          {/* Text */}
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              Welcome to SydeFlow! 
              <span className="text-2xl">👋</span>
            </h3>
            <p className="text-sm text-slate-300 mt-0.5">
              Let's set up your first product in 3 simple steps: 
              <span className="text-cyan-400"> Configure → Upload → Run</span>
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGetStarted}
            className="
              inline-flex items-center gap-2 px-4 py-2
              bg-gradient-to-r from-cyan-500 to-blue-500
              hover:from-cyan-400 hover:to-blue-400
              text-white text-sm font-medium
              rounded-xl
              shadow-lg shadow-cyan-500/25
              hover:shadow-cyan-500/40
              transition-all duration-200
              hover:scale-105
              active:scale-95
            "
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Progress Checklist Component  
interface ProgressChecklistProps {
  apsConnected: boolean;
  hasProducts: boolean;
  hasBundles: boolean;
  hasActivities: boolean;
  onNavigate?: (view: ViewType) => void;
}

export function ProgressChecklist({ 
  apsConnected, 
  hasProducts, 
  hasBundles, 
  hasActivities, 
  onNavigate 
}: ProgressChecklistProps) {
  // Build steps from current state
  const steps: Array<{
    id: string;
    label: string;
    description: string;
    completed: boolean;
    view: ViewType;
  }> = [
    {
      id: 'settings',
      label: 'Configure APS Credentials',
      description: 'Add your Autodesk Client ID and Secret',
      completed: apsConnected,
      view: 'settings'
    },
    {
      id: 'bundles',
      label: 'Set Up App Bundles',
      description: 'Upload or register your plugin code',
      completed: hasBundles,
      view: 'bundles'
    },
    {
      id: 'activities',
      label: 'Create Activities',
      description: 'Define what your automation does',
      completed: hasActivities,
      view: 'setup'
    },
    {
      id: 'products',
      label: 'Create Your First Product',
      description: 'Link a CAD file and define parameters',
      completed: hasProducts,
      view: 'pipeline'
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;

  if (allComplete) return null; // Hide when all done

  return (
    <div className="
      relative overflow-hidden rounded-2xl
      bg-gradient-to-br from-white/5 to-white/[0.02]
      backdrop-blur-xl
      border border-white/10
      shadow-[0_8px_32px_rgba(0,0,0,0.2)]
    ">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Setup Progress</h3>
          <span className="text-xs text-slate-400">{completedCount}/{steps.length} complete</span>
        </div>
        
        {/* Progress bar with liquid effect */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 rounded-full transition-all duration-500 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
      
      {/* Steps */}
      <div className="p-3">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => !step.completed && onNavigate?.(step.view)}
            disabled={step.completed}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              transition-all duration-200
              ${step.completed 
                ? 'text-slate-500 cursor-default' 
                : 'text-white hover:bg-white/5 cursor-pointer'
              }
            `}
          >
            {/* Step indicator */}
            <div className={`
              flex-shrink-0 w-6 h-6 rounded-full
              flex items-center justify-center text-xs font-medium
              transition-all duration-200
              ${step.completed 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-slate-700 text-slate-300 border border-slate-600'
              }
            `}>
              {step.completed ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            
            {/* Step content */}
            <div className="flex-1 text-left">
              <p className={`text-sm font-medium ${step.completed ? 'line-through' : ''}`}>
                {step.label}
              </p>
              {!step.completed && (
                <p className="text-xs text-slate-500">{step.description}</p>
              )}
            </div>
            
            {/* Arrow for incomplete steps */}
            {!step.completed && (
              <ArrowRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

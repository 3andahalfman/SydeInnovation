'use client';

import { ReactNode } from 'react';
import { 
  FolderOpen, Upload, Database, Package, 
  Settings, Zap, ArrowRight, Sparkles 
} from 'lucide-react';

type EmptyStateType = 
  | 'products' 
  | 'buckets' 
  | 'files' 
  | 'activities' 
  | 'configurations'
  | 'workitems'
  | 'generic';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  showIcon?: boolean;
}

const emptyStateConfig: Record<EmptyStateType, {
  icon: typeof FolderOpen;
  title: string;
  description: string;
  actionLabel: string;
  iconColor: string;
}> = {
  products: {
    icon: Package,
    title: "No products yet",
    description: "Upload your first Inventor file (.ipt, .iam) to get started with parametric configuration.",
    actionLabel: "Upload Inventor File",
    iconColor: "text-orange-400"
  },
  buckets: {
    icon: Database,
    title: "No storage buckets",
    description: "Create a bucket to store your CAD files in Autodesk cloud storage.",
    actionLabel: "Create Bucket",
    iconColor: "text-purple-400"
  },
  files: {
    icon: FolderOpen,
    title: "No files in this bucket",
    description: "Upload Inventor files to this bucket to use them for automation.",
    actionLabel: "Upload Files",
    iconColor: "text-blue-400"
  },
  activities: {
    icon: Zap,
    title: "No activities configured",
    description: "Activities define how your CAD files are processed. Set up your first automation workflow.",
    actionLabel: "Create Activity",
    iconColor: "text-yellow-400"
  },
  configurations: {
    icon: Settings,
    title: "No configurations saved",
    description: "Configurations store parameter values for your products. Create one to save your settings.",
    actionLabel: "New Configuration",
    iconColor: "text-cyan-400"
  },
  workitems: {
    icon: Sparkles,
    title: "No jobs run yet",
    description: "Run your first automation job to see results here.",
    actionLabel: "Run Job",
    iconColor: "text-green-400"
  },
  generic: {
    icon: FolderOpen,
    title: "Nothing here yet",
    description: "Get started by adding your first item.",
    actionLabel: "Get Started",
    iconColor: "text-slate-400"
  }
};

export default function EmptyState({ 
  type, 
  title, 
  description, 
  actionLabel, 
  onAction,
  showIcon = true 
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;
  
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayActionLabel = actionLabel || config.actionLabel;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {/* Liquid glass container */}
      <div className="
        relative p-8 rounded-2xl
        bg-gradient-to-br from-white/5 to-white/[0.02]
        backdrop-blur-xl
        border border-white/10
        shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]
        max-w-sm
      ">
        {/* Subtle water reflection effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-gradient-to-b from-cyan-500/5 to-transparent" />
        </div>
        
        {showIcon && (
          <div className={`
            relative w-16 h-16 mx-auto mb-4 rounded-2xl
            bg-gradient-to-br from-slate-800/80 to-slate-900/80
            border border-white/10
            flex items-center justify-center
            shadow-lg
          `}>
            <Icon className={`w-8 h-8 ${config.iconColor}`} />
          </div>
        )}
        
        <h3 className="relative text-lg font-semibold text-white mb-2">
          {displayTitle}
        </h3>
        
        <p className="relative text-sm text-slate-400 mb-6 leading-relaxed">
          {displayDescription}
        </p>
        
        {onAction && (
          <button
            onClick={onAction}
            className="
              relative inline-flex items-center gap-2 px-5 py-2.5
              bg-gradient-to-r from-orange-500 to-orange-600
              hover:from-orange-400 hover:to-orange-500
              text-white text-sm font-medium
              rounded-xl
              shadow-lg shadow-orange-500/25
              hover:shadow-orange-500/40
              transition-all duration-200
              hover:scale-105
              active:scale-95
            "
          >
            {displayActionLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Inline empty state for smaller contexts (like tables, lists)
interface InlineEmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function InlineEmptyState({ message, actionLabel, onAction }: InlineEmptyStateProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
      <FolderOpen className="w-5 h-5" />
      <span className="text-sm">{message}</span>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          {actionLabel}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

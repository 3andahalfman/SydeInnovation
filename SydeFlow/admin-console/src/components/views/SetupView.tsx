'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Play, 
  Check, 
  X, 
  RefreshCw, 
  Package, 
  Activity, 
  Upload, 
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronRight,
  FileCode,
  Server,
  Database
} from 'lucide-react';

interface SetupStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message?: string;
  icon: React.ReactNode;
}

interface SetupStatus {
  extractParamsBundle: boolean;
  extractParamsActivity: boolean;
  updateIPTParamActivity: boolean;
  bundles: string[];
  activities: string[];
}

export function SetupView() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'bundle',
      name: 'Register ExtractParams Bundle',
      description: 'Upload and register the parameter extraction iLogic bundle with APS',
      status: 'pending',
      icon: <Package className="w-5 h-5" />
    },
    {
      id: 'extract-activity',
      name: 'Create ExtractParams Activity',
      description: 'Create the Design Automation activity for parameter extraction',
      status: 'pending',
      icon: <Activity className="w-5 h-5" />
    },
    {
      id: 'upload',
      name: 'Upload Sample File',
      description: 'Upload the Custom Box IPT file to OSS for testing',
      status: 'pending',
      icon: <Upload className="w-5 h-5" />
    },
    {
      id: 'update-activity',
      name: 'Create UpdateIPTParam Activity',
      description: 'Create the activity for model regeneration with new parameters',
      status: 'pending',
      icon: <FileCode className="w-5 h-5" />
    }
  ]);

  // Check current setup status
  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/setup/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatus(data.status);
          
          // Update step statuses based on current state
          setSteps(prev => prev.map(step => {
            if (step.id === 'bundle' && data.status.extractParamsBundle) {
              return { ...step, status: 'success', message: 'Bundle registered' };
            }
            if (step.id === 'extract-activity' && data.status.extractParamsActivity) {
              return { ...step, status: 'success', message: 'Activity exists' };
            }
            if (step.id === 'update-activity' && data.status.updateIPTParamActivity) {
              return { ...step, status: 'success', message: 'Activity exists' };
            }
            return step;
          }));
        }
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Run individual setup step
  const runStep = async (stepId: string) => {
    const endpointMap: { [key: string]: string } = {
      'bundle': '/api/setup/extract-params-bundle',
      'extract-activity': '/api/setup/extract-params-activity',
      'upload': '/api/setup/upload-sample-file',
      'update-activity': '/api/setup/update-ipt-activity'
    };

    setSteps(prev => prev.map(s => 
      s.id === stepId ? { ...s, status: 'running' } : s
    ));

    try {
      const res = await fetch(endpointMap[stepId], { method: 'POST' });
      const data = await res.json();

      setSteps(prev => prev.map(s => 
        s.id === stepId ? { 
          ...s, 
          status: data.success ? 'success' : 'error',
          message: data.message || data.error
        } : s
      ));

      return data.success;
    } catch (error) {
      setSteps(prev => prev.map(s => 
        s.id === stepId ? { 
          ...s, 
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        } : s
      ));
      return false;
    }
  };

  // Run all steps in sequence
  const runAllSteps = async () => {
    setRunning(true);
    
    // Reset all steps to pending
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending', message: undefined })));

    for (const step of steps) {
      const success = await runStep(step.id);
      if (!success && step.id !== 'update-activity') {
        // Continue on update-activity failure as UpdateIPTParam bundle may not exist yet
        break;
      }
      await new Promise(r => setTimeout(r, 500)); // Small delay between steps
    }

    setRunning(false);
    await checkStatus();
  };

  const getStatusIcon = (stepStatus: SetupStep['status']) => {
    switch (stepStatus) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error': return <X className="w-5 h-5 text-red-600" />;
      case 'running': return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'skipped': return <Circle className="w-5 h-5 text-slate-400" />;
      default: return <Circle className="w-5 h-5 text-slate-300" />;
    }
  };

  const allComplete = status?.extractParamsBundle && status?.extractParamsActivity;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Design Automation Setup</h1>
          <p className="text-slate-600 mt-1">
            Configure bundles and activities for parameter extraction and model regeneration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkStatus}
            disabled={loading || running}
            className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg 
              transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={runAllSteps}
            disabled={loading || running}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
              transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running Setup...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run All Steps
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Overview */}
      {status && (
        <div className={`p-4 rounded-lg border ${allComplete 
          ? 'bg-green-50 border-green-200' 
          : 'bg-amber-50 border-amber-200'}`}
        >
          <div className="flex items-center gap-3">
            {allComplete ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <h3 className={`font-semibold ${allComplete ? 'text-green-900' : 'text-amber-900'}`}>
                {allComplete ? 'Setup Complete' : 'Setup Incomplete'}
              </h3>
              <p className={`text-sm ${allComplete ? 'text-green-700' : 'text-amber-700'}`}>
                {allComplete 
                  ? 'All required bundles and activities are registered. Ready to extract parameters.'
                  : 'Run the setup to register bundles and create activities.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Setup Steps */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 rounded-t-lg">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Setup Steps
          </h2>
        </div>
        <div className="divide-y">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`p-4 flex items-center gap-4 ${
                step.status === 'running' ? 'bg-blue-50' : ''
              }`}
            >
              {/* Step Number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                {index + 1}
              </div>

              {/* Icon */}
              <div className={`flex-shrink-0 p-2 rounded-lg ${
                step.status === 'success' ? 'bg-green-100 text-green-600' :
                step.status === 'error' ? 'bg-red-100 text-red-600' :
                step.status === 'running' ? 'bg-blue-100 text-blue-600' :
                'bg-slate-100 text-slate-500'
              }`}>
                {step.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-900">{step.name}</h3>
                <p className="text-sm text-slate-500">{step.description}</p>
                {step.message && (
                  <p className={`text-sm mt-1 ${
                    step.status === 'error' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {step.message}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="flex-shrink-0 flex items-center gap-3">
                {getStatusIcon(step.status)}
                {step.status === 'pending' && !running && (
                  <button
                    onClick={() => runStep(step.id)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 
                      rounded transition-colors flex items-center gap-1"
                  >
                    Run
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Registered Resources */}
      {status && (status.bundles.length > 0 || status.activities.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Bundles */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50 rounded-t-lg">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                Registered Bundles
              </h3>
            </div>
            <div className="p-4">
              {status.bundles.length > 0 ? (
                <ul className="space-y-2">
                  {status.bundles.map(bundle => (
                    <li key={bundle} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {bundle}
                      </code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No bundles registered</p>
              )}
            </div>
          </div>

          {/* Activities */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50 rounded-t-lg">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Registered Activities
              </h3>
            </div>
            <div className="p-4">
              {status.activities.length > 0 ? (
                <ul className="space-y-2">
                  {status.activities.map(activity => (
                    <li key={activity} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {activity}
                      </code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No activities created</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Next Steps */}
      {allComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">🎉 Ready to Use!</h3>
          <p className="text-sm text-blue-700 mb-3">
            Your Design Automation setup is complete. You can now:
          </p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Extract parameters from Inventor files using the Product Manager</li>
            <li>Create product configurations with custom parameter values</li>
            <li>Generate customized models on-demand</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default SetupView;

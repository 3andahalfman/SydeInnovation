'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, Save, Eye, EyeOff, RefreshCw, 
  CheckCircle, AlertCircle, Server, Key,
  Globe, Database, Zap, Info
} from 'lucide-react';

interface SettingsConfig {
  apsClientId: string;
  apsClientSecret: string;
  callbackUrl: string;
  webhookUrl: string;
  bucketKey: string;
  activityId: string;
  appBundleId: string;
}

export default function SettingsView() {
  const [settings, setSettings] = useState<SettingsConfig>({
    apsClientId: '',
    apsClientSecret: '',
    callbackUrl: 'http://localhost:8080/api/aps/callback/oauth',
    webhookUrl: '',
    bucketKey: '',
    activityId: '',
    appBundleId: ''
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Load settings from local storage or environment
    const savedSettings = localStorage.getItem('sydeflow_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('sydeflow_settings', JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      const response = await fetch('/api/aps/auth/token');
      if (response.ok) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
    
    setTestingConnection(false);
    setTimeout(() => setConnectionStatus('idle'), 5000);
  };

  const updateSetting = (key: keyof SettingsConfig, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-gray-400 text-sm">Configure your APS credentials and Design Automation settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* APS Credentials */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Key className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">APS Credentials</h3>
            <p className="text-sm text-gray-400">Your Autodesk Platform Services credentials</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Client ID
            </label>
            <input
              type="text"
              value={settings.apsClientId}
              onChange={(e) => updateSetting('apsClientId', e.target.value)}
              placeholder="Enter your APS Client ID"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecrets ? 'text' : 'password'}
                value={settings.apsClientSecret}
                onChange={(e) => updateSetting('apsClientSecret', e.target.value)}
                placeholder="Enter your APS Client Secret"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-12 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono"
              />
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
              >
                {showSecrets ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={testConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-600"
            >
              {testingConnection ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              Test Connection
            </button>
            {connectionStatus === 'success' && (
              <span className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Connection successful
              </span>
            )}
            {connectionStatus === 'error' && (
              <span className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                Connection failed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* URLs Configuration */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Globe className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">URL Configuration</h3>
            <p className="text-sm text-gray-400">Callback and webhook URLs for APS</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Callback URL
            </label>
            <input
              type="text"
              value={settings.callbackUrl}
              onChange={(e) => updateSetting('callbackUrl', e.target.value)}
              placeholder="http://localhost:8080/api/aps/callback/oauth"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Webhook URL (Optional)
            </label>
            <input
              type="text"
              value={settings.webhookUrl}
              onChange={(e) => updateSetting('webhookUrl', e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Design Automation Settings */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Design Automation</h3>
            <p className="text-sm text-gray-400">Default settings for automation jobs</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Bucket Key
            </label>
            <input
              type="text"
              value={settings.bucketKey}
              onChange={(e) => updateSetting('bucketKey', e.target.value)}
              placeholder="Leave empty to auto-generate"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              If empty, bucket key will be generated from Client ID
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Activity ID
            </label>
            <input
              type="text"
              value={settings.activityId}
              onChange={(e) => updateSetting('activityId', e.target.value)}
              placeholder="e.g., your-nickname.UpdateWardrobeActivity+prod"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default App Bundle ID
            </label>
            <input
              type="text"
              value={settings.appBundleId}
              onChange={(e) => updateSetting('appBundleId', e.target.value)}
              placeholder="e.g., your-nickname.UpdateWardrobe+prod"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-400 mb-1">Environment Variables</h4>
            <p className="text-sm text-gray-400">
              For production deployments, set these credentials as environment variables in your 
              <code className="bg-slate-800 px-1.5 py-0.5 rounded text-orange-400 mx-1">.env</code> 
              file instead of storing them in the browser.
            </p>
            <div className="mt-3 bg-slate-900/50 rounded-lg p-3 font-mono text-xs text-gray-300">
              <p>APS_CLIENT_ID=your_client_id</p>
              <p>APS_CLIENT_SECRET=your_client_secret</p>
              <p>APS_CALLBACK_URL=http://localhost:8080/api/aps/callback/oauth</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

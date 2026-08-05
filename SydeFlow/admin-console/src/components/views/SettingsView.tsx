"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Settings,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Server,
  Key,
  Globe,
  Database,
  Info,
  Loader2,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { InfoTooltip } from "../ui/Tooltip";

interface SettingsConfig {
  apsClientId: string;
  apsClientSecret: string;
  callbackUrl: string;
  webhookUrl: string;
  bucketKey: string;
  activityId: string;
  appBundleId: string;
  sectionStyle: string;
  controlSize: string;
  panelWidth: string;
}

interface EnvStatus {
  hasEnvClientId: boolean;
  hasEnvClientSecret: boolean;
  hasEnvCallbackUrl: boolean;
}

interface SettingsViewProps {
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: "admin" | "user";
  } | null;
  onSettingsSaved?: () => void; // Callback to refresh parent components
}

export default function SettingsView({
  user,
  onSettingsSaved,
}: SettingsViewProps = {}) {
  // Accent color logic: fallback to orange if not set in localStorage
  const accentColor = useMemo(() => {
    if (typeof window !== "undefined") {
      // Try to get from localStorage (used by layout.styling)
      const stored = window.localStorage.getItem("sydeflow.accentColor");
      if (stored) return stored;
    }
    return "#f97316"; // Tailwind orange-500
  }, []);
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsConfig>({
    apsClientId: "",
    apsClientSecret: "",
    callbackUrl: "http://localhost:8080/api/aps/callback/oauth",
    webhookUrl: "",
    bucketKey: "",
    activityId: "",
    appBundleId: "",
    sectionStyle: "card",
    controlSize: "normal",
    panelWidth: "medium",
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [secretModified, setSecretModified] = useState(false); // Track if user modified the secret
  const [hasStoredSecret, setHasStoredSecret] = useState(false); // Track if a secret is stored on server
  const [apsStatus, setApsStatus] = useState<{
    connected: boolean;
    message: string;
    hasCredentials: boolean;
  } | null>(null);
  const [apsStatusLoading, setApsStatusLoading] = useState(false);

  // Fetch APS connection status
  const fetchApsStatus = async () => {
    setApsStatusLoading(true);
    try {
      const res = await fetch("/api/settings/aps-status");
      if (res.ok) {
        const data = await res.json();
        setApsStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch APS status:", error);
    }
    setApsStatusLoading(false);
  };

  // Load settings from server on mount
  useEffect(() => {
    fetchSettings();
    fetchApsStatus();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        // Check if a secret is stored (masked value indicates stored secret)
        const secretIsStored =
          data.hasClientSecret || data.apsClientSecret === "••••••••••••••••";
        setHasStoredSecret(secretIsStored);

        setSettings({
          apsClientId: data.apsClientId || "",
          apsClientSecret: secretIsStored ? "••••••••••••••••" : "",
          callbackUrl:
            data.callbackUrl || "http://localhost:8080/api/aps/callback/oauth",
          webhookUrl: data.webhookUrl || "",
          bucketKey: data.bucketKey || "",
          activityId: data.activityId || "",
          appBundleId: data.appBundleId || "",
          sectionStyle: data.sectionStyle || "card",
          controlSize: data.controlSize || "normal",
          panelWidth: data.panelWidth || "medium",
        });
        setEnvStatus(data.envStatus || null);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving settings...");

    try {
      // Determine what to send for the secret:
      // - If not modified and has stored secret, send masked value to keep existing
      // - If modified and not empty, send the new value
      // - If modified and empty, user wants to clear the secret
      let secretToSave = "••••••••••••••••"; // Default: keep existing
      if (secretModified) {
        secretToSave = settings.apsClientSecret; // Send whatever user entered (including empty to clear)
      }

      const settingsToSave = {
        ...settings,
        apsClientSecret: secretToSave,
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
      });

      if (res.ok) {
        const data = await res.json();
        setSaved(true);
        setSecretModified(false); // Reset modified flag

        // Update hasStoredSecret based on what's now stored
        const newSecretStored =
          data.settings?.apsClientSecret === "••••••••••••••••";
        setHasStoredSecret(newSecretStored);

        // Reset the input to show masked value if secret is stored
        if (newSecretStored) {
          setSettings((prev) => ({
            ...prev,
            apsClientSecret: "••••••••••••••••",
          }));
        }

        setTimeout(() => setSaved(false), 3000);

        // Clear OAuth cache to force re-authentication with new credentials
        if (data.credentialsChanged) {
          await fetch("/api/settings/clear-cache", { method: "POST" });
        }

        // Refresh APS status after saving
        fetchApsStatus();

        // Notify parent to refresh (e.g., dashboard APS status)
        if (onSettingsSaved) {
          onSettingsSaved();
        }

        toast.updateToast(toastId, {
          type: "success",
          title: "Settings saved successfully!",
        });
      } else {
        toast.updateToast(toastId, {
          type: "error",
          title: "Failed to save settings",
        });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to save settings",
      });
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus("idle");
    setConnectionMessage("");

    const toastId = toast.loading("Testing APS connection...");

    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: settings.apsClientId,
          clientSecret:
            settings.apsClientSecret !== "••••••••••••••••"
              ? settings.apsClientSecret
              : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConnectionStatus("success");
        setConnectionMessage(data.message || "Connection successful");
        toast.updateToast(toastId, {
          type: "success",
          title: "Connection successful!",
          message: "APS credentials are valid",
        });
      } else {
        setConnectionStatus("error");
        setConnectionMessage(data.message || "Connection failed");
        toast.updateToast(toastId, {
          type: "error",
          title: "Connection failed",
          message: data.message,
        });
      }
    } catch {
      setConnectionStatus("error");
      setConnectionMessage("Network error - server may be offline");
      toast.updateToast(toastId, {
        type: "error",
        title: "Network error",
        message: "Server may be offline",
      });
    }

    setTestingConnection(false);
    setTimeout(() => {
      setConnectionStatus("idle");
      setConnectionMessage("");
    }, 5000);
  };

  const updateSetting = (key: keyof SettingsConfig, value: string) => {
    // Track if user is modifying the secret
    if (key === "apsClientSecret") {
      // If they start typing and it was showing masked value, clear it first
      if (
        hasStoredSecret &&
        !secretModified &&
        settings.apsClientSecret === "••••••••••••••••"
      ) {
        setSettings((prev) => ({ ...prev, apsClientSecret: value }));
        setSecretModified(true);
        return;
      }
      setSecretModified(true);
    }
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: accentColor }}
        />
      </div>
    );
  }

  // Helper for accent button style
  const accentButtonStyle = {
    backgroundColor: accentColor,
    color: "#fff",
    fontWeight: 600,
    boxShadow: `0 1px 4px 0 ${accentColor}33`,
    border: "none",
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-gray-400 text-sm">
            Configure your Autodesk Platform Services credentials
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: accentColor, opacity: saving ? 0.5 : 1 }}
          className="px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {saving ? (
            <RefreshCw
              className="w-4 h-4 animate-spin"
              style={{ color: "#fff" }}
            />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" style={{ color: "#fff" }} />
          ) : (
            <Save className="w-4 h-4" style={{ color: "#fff" }} />
          )}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      {/* Account Information Card - Visible to all users */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: accentColor + "20" }}
          >
            <Info className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Account Information
            </h3>
            <p className="text-sm text-gray-400">Your profile details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Full Name
            </label>
            <div className="text-white font-medium bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50">
              {user?.fullName || "Not provided"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Email Address
            </label>
            <div className="text-white font-medium bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50">
              {user?.email || "Not provided"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Account Role
            </label>
            <div className="inline-block text-white font-medium bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50 capitalize">
              {user?.role || "user"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Account ID
            </label>
            <div className="text-white font-mono text-sm bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50 truncate">
              {user?.id || "Unknown"}
            </div>
          </div>
        </div>
      </div>

      {user?.role === "admin" && (
        <>
          {/* APS Connection Status Banner */}
          {apsStatus && !apsStatus.connected && (
            <div
              className={`rounded-xl p-4 flex items-center justify-between ${
                !apsStatus.hasCredentials
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <div className="flex items-center gap-3">
                {!apsStatus.hasCredentials ? (
                  <Settings className="w-6 h-6 text-yellow-400" />
                ) : (
                  <WifiOff className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <h3
                    className={`font-semibold ${!apsStatus.hasCredentials ? "text-yellow-400" : "text-red-400"}`}
                  >
                    {!apsStatus.hasCredentials
                      ? "APS Not Configured"
                      : "APS Disconnected"}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {apsStatus.message ||
                      "Configure your credentials below to connect."}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchApsStatus}
                disabled={apsStatusLoading}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  !apsStatus.hasCredentials
                    ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400"
                    : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${apsStatusLoading ? "animate-spin" : ""}`}
                />
                Retry
              </button>
            </div>
          )}

          {/* APS Connected Banner */}
          {apsStatus?.connected && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <h3 className="font-semibold text-green-400">
                    APS Connected
                  </h3>
                  <p className="text-sm text-gray-400">
                    Successfully connected to Autodesk Platform Services
                  </p>
                </div>
              </div>
              <button
                onClick={fetchApsStatus}
                disabled={apsStatusLoading}
                className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${apsStatusLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          )}

          {/* UI Preferences */}
          <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              UI Preferences
            </h3>
            {/* Section Style */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-300 mb-2">
                Section Style
              </div>
              <div className="flex gap-3">
                {["Card", "Flat", "Bordered"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`px-5 py-2 rounded-lg transition-colors font-semibold ${settings.sectionStyle === label.toLowerCase() ? "" : "bg-slate-700/50 text-gray-300 hover:bg-slate-700"}`}
                    style={
                      settings.sectionStyle === label.toLowerCase()
                        ? accentButtonStyle
                        : {}
                    }
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        sectionStyle: label.toLowerCase(),
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Control Size */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-300 mb-2">
                Control Size
              </div>
              <div className="flex gap-3">
                {["Compact", "Normal", "Large"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`px-5 py-2 rounded-lg transition-colors font-semibold ${settings.controlSize === label.toLowerCase() ? "" : "bg-slate-700/50 text-gray-300 hover:bg-slate-700"}`}
                    style={
                      settings.controlSize === label.toLowerCase()
                        ? accentButtonStyle
                        : {}
                    }
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        controlSize: label.toLowerCase(),
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Panel Width */}
            <div className="mb-2">
              <div className="text-sm font-medium text-gray-300 mb-2">
                Panel Width
              </div>
              <div className="flex gap-3">
                {["Narrow", "Medium", "Wide"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`px-5 py-2 rounded-lg transition-colors font-semibold ${settings.panelWidth === label.toLowerCase() ? "" : "bg-slate-700/50 text-gray-300 hover:bg-slate-700"}`}
                    style={
                      settings.panelWidth === label.toLowerCase()
                        ? accentButtonStyle
                        : {}
                    }
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        panelWidth: label.toLowerCase(),
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* APS Credentials */}
          <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: accentColor + "20" }}
              >
                <Key className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  APS Credentials
                </h3>
                <p className="text-sm text-gray-400">
                  Your Autodesk Platform Services credentials
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-2">
                  Client ID
                  <InfoTooltip
                    content="Found in your APS application settings on the Autodesk developer portal."
                    learnMoreUrl="https://aps.autodesk.com/en/docs/oauth/v2/tutorials/create-app/"
                  />
                </label>
                <input
                  type="text"
                  value={settings.apsClientId}
                  onChange={(e) => updateSetting("apsClientId", e.target.value)}
                  placeholder="Enter your APS Client ID"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none font-mono"
                  style={{
                    borderColor: accentColor,
                    boxShadow: "0 0 0 1.5px " + accentColor,
                  }}
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-2">
                  Client Secret
                  <InfoTooltip
                    content="Keep this secret safe! Only visible once in the Autodesk portal."
                    learnMoreUrl="https://aps.autodesk.com/en/docs/oauth/v2/tutorials/create-app/"
                  />
                  {hasStoredSecret && !secretModified && (
                    <span className="ml-2 text-xs text-green-400">
                      (secret stored securely)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={settings.apsClientSecret}
                    onChange={(e) =>
                      updateSetting("apsClientSecret", e.target.value)
                    }
                    placeholder="Enter your APS Client Secret"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-12 text-white placeholder-gray-500 outline-none font-mono"
                    style={{
                      borderColor: accentColor,
                      boxShadow: "0 0 0 1.5px " + accentColor,
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (hasStoredSecret && !secretModified && !showSecrets) {
                        // Fetch the actual secret to reveal it
                        try {
                          const res = await fetch(
                            "/api/settings/reveal-secret",
                          );
                          if (res.ok) {
                            const data = await res.json();
                            setSettings((prev) => ({
                              ...prev,
                              apsClientSecret: data.secret,
                            }));
                            setShowSecrets(true);
                          }
                        } catch (err) {
                          console.error("Failed to reveal secret:", err);
                        }
                      } else {
                        setShowSecrets(!showSecrets);
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded transition-colors hover:bg-slate-700"
                    title={showSecrets ? "Hide secret" : "Show secret"}
                  >
                    {showSecrets ? (
                      <EyeOff
                        className="w-5 h-5"
                        style={{ color: accentColor }}
                      />
                    ) : (
                      <Eye className="w-5 h-5" style={{ color: accentColor }} />
                    )}
                  </button>
                </div>
                {hasStoredSecret && !secretModified && !showSecrets && (
                  <p className="text-xs text-gray-500 mt-1">
                    🔒 Click the eye icon to reveal the stored secret.
                  </p>
                )}
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
                {connectionStatus === "success" && (
                  <span className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {connectionMessage || "Connection successful"}
                  </span>
                )}
                {connectionStatus === "error" && (
                  <span className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {connectionMessage || "Connection failed"}
                  </span>
                )}
              </div>

              {/* Environment Status */}
              {envStatus && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-sm text-gray-400 mb-2">
                    Environment Variables Status:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        envStatus.hasEnvClientId
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-700/50 text-gray-500"
                      }`}
                    >
                      {envStatus.hasEnvClientId ? "✓" : "○"} APS_CLIENT_ID
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        envStatus.hasEnvClientSecret
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-700/50 text-gray-500"
                      }`}
                    >
                      {envStatus.hasEnvClientSecret ? "✓" : "○"}{" "}
                      APS_CLIENT_SECRET
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        envStatus.hasEnvCallbackUrl
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-700/50 text-gray-500"
                      }`}
                    >
                      {envStatus.hasEnvCallbackUrl ? "✓" : "○"} APS_CALLBACK_URL
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* URLs Configuration */}
          <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  URL Configuration
                </h3>
                <p className="text-sm text-gray-400">
                  Callback and webhook URLs for APS
                </p>
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
                  onChange={(e) => updateSetting("callbackUrl", e.target.value)}
                  placeholder="http://localhost:8080/api/aps/callback/oauth"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none font-mono text-sm"
                  style={{
                    borderColor: accentColor,
                    boxShadow: "0 0 0 1.5px " + accentColor,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Webhook URL (Optional)
                </label>
                <input
                  type="text"
                  value={settings.webhookUrl}
                  onChange={(e) => updateSetting("webhookUrl", e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none font-mono text-sm"
                  style={{
                    borderColor: accentColor,
                    boxShadow: "0 0 0 1.5px " + accentColor,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-400 mb-1">
                  Environment Variables
                </h4>
                <p className="text-sm text-gray-400">
                  For production deployments, set these credentials as
                  environment variables in your
                  <code
                    className="bg-slate-800 px-1.5 py-0.5 rounded mx-1"
                    style={{ color: accentColor }}
                  >
                    .env
                  </code>
                  file instead of storing them in the browser.
                </p>
                <div className="mt-3 bg-slate-900/50 rounded-lg p-3 font-mono text-xs text-gray-300">
                  <p>APS_CLIENT_ID=your_client_id</p>
                  <p>APS_CLIENT_SECRET=your_client_secret</p>
                  <p>
                    APS_CALLBACK_URL=http://localhost:8080/api/aps/callback/oauth
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

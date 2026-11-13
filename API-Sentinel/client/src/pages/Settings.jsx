import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Server,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Lock,
} from 'lucide-react';
import { settingsAPI } from '../services/api';

export function Settings() {
  const [settings, setSettings] = useState(null);
  const [newHost, setNewHost] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await settingsAPI.get();
        setSettings(res.data.settings);
      } catch (err) {
        setError('Failed to fetch system settings.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleAddHost = () => {
    if (!newHost.trim()) return;
    const clean = newHost.trim().toLowerCase();
    if (!settings.allowedHosts.includes(clean)) {
      setSettings({
        ...settings,
        allowedHosts: [...settings.allowedHosts, clean],
      });
      setNewHost('');
    }
  };

  const handleRemoveHost = (host) => {
    setSettings({
      ...settings,
      allowedHosts: settings.allowedHosts.filter(h => h !== host),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await settingsAPI.update(settings);
      setMessage('Settings updated successfully!');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-slate-500 font-mono text-xs">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-indigo-400" />
            <span>System Settings & Security Policies</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            SSRF guard host approval policies, default execution timeouts, and database configuration.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SSRF Guard Whitelist */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">SSRF Guard: Approved Target Hosts</h3>
              <p className="text-xs text-slate-400">Only requests to approved hosts are permitted by the executor</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              placeholder="e.g. api.mycompany.internal"
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddHost}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {settings.allowedHosts.map((host) => (
              <div
                key={host}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#111C38] border border-slate-800/80 text-xs font-mono text-slate-200"
              >
                <span>{host}</span>
                <button
                  onClick={() => handleRemoveHost(host)}
                  className="p-1 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Global Execution Defaults */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Engine Execution Thresholds</h3>
              <p className="text-xs text-slate-400">Default fallback parameters for workflow execution</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Default Step Timeout (ms)</label>
              <input
                type="number"
                step="500"
                value={settings.defaultTimeoutMs}
                onChange={(e) => setSettings({ ...settings, defaultTimeoutMs: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Default Max Retry Limit</label>
              <input
                type="number"
                min="0"
                max="5"
                value={settings.defaultMaxRetries}
                onChange={(e) => setSettings({ ...settings, defaultMaxRetries: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-white font-mono"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowLocalNetwork)}
                  onChange={(e) => setSettings({ ...settings, allowLocalNetwork: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-300 font-medium">Permit Loopback & Local Testing Network (127.0.0.1)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;


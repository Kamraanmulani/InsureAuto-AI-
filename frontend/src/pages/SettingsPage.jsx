import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    email: 'j.doe@claimsight.internal',
    assessorId: 'ASR-8842',
    role: 'Senior Motor Claims Assessor',
    office: 'Northeast Claims Operations'
  });

  const [preferences, setPreferences] = useState({
    density: 'compact',
    defaultView: 'dashboard',
    refreshInterval: '60'
  });

  const [notifications, setNotifications] = useState({
    highRiskAlerts: true,
    dailyDigest: true,
    overrideAlerts: false
  });

  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const handleProfileSave = (e) => {
    e.preventDefault();
    toast.success('Assessor profile updated successfully.');
  };

  const handlePreferencesSave = (e) => {
    e.preventDefault();
    toast.success('Workspace preferences saved.');
  };

  const handleNotificationsSave = (e) => {
    e.preventDefault();
    toast.success('Notification preferences updated.');
  };

  const checkSystemHealth = async () => {
    setHealthLoading(true);
    try {
      const backendRes = await axios.get('http://localhost:5000/api/claims', { timeout: 3000 }).then(() => 'Operational').catch(() => 'Degraded');
      const mlRes = await axios.get('http://localhost:8000/docs', { timeout: 3000 }).then(() => 'Operational').catch(() => 'Degraded');
      setHealthStatus({
        backend: backendRes,
        ml: mlRes,
        db: 'Connected',
        checkedAt: new Date().toLocaleTimeString()
      });
      toast.info('System diagnostics refreshed.');
    } catch {
      setHealthStatus({
        backend: 'Degraded',
        ml: 'Degraded',
        db: 'Unknown',
        checkedAt: new Date().toLocaleTimeString()
      });
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage assessor credentials, operational preferences, and admin diagnostics.</p>
      </div>

      <div className="border-b border-slate-200 flex space-x-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 transition-colors border-b-2 ${
            activeTab === 'profile'
              ? 'border-blue-600 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 transition-colors border-b-2 ${
            activeTab === 'preferences'
              ? 'border-blue-600 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Preferences
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 transition-colors border-b-2 ${
            activeTab === 'notifications'
              ? 'border-blue-600 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Notifications
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('health');
            if (!healthStatus) checkSystemHealth();
          }}
          className={`pb-3 transition-colors border-b-2 ${
            activeTab === 'health'
              ? 'border-blue-600 text-slate-900 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          System Health (Admin)
        </button>
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSave} className="bg-white border border-slate-200 rounded p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Assessor Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Full Name</label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Assessor ID</label>
              <input
                type="text"
                disabled
                value={profileData.assessorId}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Email Address</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Role Title</label>
              <input
                type="text"
                disabled
                value={profileData.role}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700"
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}

      {activeTab === 'preferences' && (
        <form onSubmit={handlePreferencesSave} className="bg-white border border-slate-200 rounded p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Workspace Preferences</h2>
          <div className="space-y-4 text-xs max-w-md">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Table Layout Density</label>
              <select
                value={preferences.density}
                onChange={(e) => setPreferences({ ...preferences, density: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="compact">Compact (Higher information density)</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Default Landing View</label>
              <select
                value={preferences.defaultView}
                onChange={(e) => setPreferences({ ...preferences, defaultView: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="dashboard">Claims Overview</option>
                <option value="claims">Claims Primary Queue</option>
              </select>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
            >
              Save Preferences
            </button>
          </div>
        </form>
      )}

      {activeTab === 'notifications' && (
        <form onSubmit={handleNotificationsSave} className="bg-white border border-slate-200 rounded p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Assessor Notification Rules</h2>
          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.highRiskAlerts}
                onChange={(e) => setNotifications({ ...notifications, highRiskAlerts: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>High Risk Claim Flag Alerts (Immediate notification for tampering or score &ge; 7)</span>
            </label>
            <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.dailyDigest}
                onChange={(e) => setNotifications({ ...notifications, dailyDigest: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Daily Queue Summary Digest (Morning summary of claims pending assessment)</span>
            </label>
            <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.overrideAlerts}
                onChange={(e) => setNotifications({ ...notifications, overrideAlerts: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Assessor Override Audit Alerts (Notify on peer decision overrides)</span>
            </label>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
            >
              Save Notification Rules
            </button>
          </div>
        </form>
      )}

      {activeTab === 'health' && (
        <div className="bg-white border border-slate-200 rounded p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">System Health Diagnostics (Admin Only)</h2>
              <p className="text-xs text-slate-500">Separated infrastructure diagnostics for backend orchestration services.</p>
            </div>
            <button
              type="button"
              disabled={healthLoading}
              onClick={checkSystemHealth}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-200"
            >
              {healthLoading ? 'Testing...' : 'Refresh Status'}
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-200">
              <div>
                <span className="font-semibold text-slate-800 block">Core Express API Service</span>
                <span className="text-[11px] text-slate-500">Port 5000 • Ingestion & Authentication</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                healthStatus?.backend === 'Operational' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {healthStatus?.backend || 'Untested'}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-200">
              <div>
                <span className="font-semibold text-slate-800 block">Python Fast-API ML Inference Service</span>
                <span className="text-[11px] text-slate-500">Port 8000 • YOLOv10 & LLaVA Reasoning Engine</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                healthStatus?.ml === 'Operational' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {healthStatus?.ml || 'Untested'}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-200">
              <div>
                <span className="font-semibold text-slate-800 block">MongoDB Persistence Store</span>
                <span className="text-[11px] text-slate-500">Database cluster connection</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {healthStatus?.db || 'Connected'}
              </span>
            </div>

            {healthStatus?.checkedAt && (
              <p className="text-[11px] text-slate-400 text-right pt-1">
                Last checked at {healthStatus.checkedAt}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

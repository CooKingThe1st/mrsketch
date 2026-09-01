import React, { useState, useEffect } from 'react';
import { Cloud, CloudUpload, CloudDownload, Key, Lock, CheckCircle2, AlertTriangle, X, RefreshCw, Layers } from 'lucide-react';
import type { ProjectLayout } from '../types/schema';
import { getApiBaseUrl } from '../utils/api';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLayout: ProjectLayout;
  onApplyLayout: (layout: ProjectLayout) => void;
}

interface SyncStatus {
  connected: boolean;
  has_state?: boolean;
  updated_at?: string;
  scene_elements?: number;
  message?: string;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  currentLayout,
  onApplyLayout,
}) => {
  const [secret, setSecret] = useState<string>(() => {
    try {
      return localStorage.getItem('mrsketch_admin_secret') || '';
    } catch {
      return '';
    }
  });
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sync/status`);
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setStatus({ connected: false, message: err?.message || 'Failed to connect to backend' });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSecretChange = (val: string) => {
    setSecret(val);
    try {
      localStorage.setItem('mrsketch_admin_secret', val);
    } catch {}
  };

  const handlePush = async () => {
    if (!secret.trim()) {
      setFeedback({ type: 'error', message: 'Please enter your Admin Passcode first.' });
      return;
    }

    setPushing(true);
    setFeedback(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret.trim(),
        },
        body: JSON.stringify(currentLayout),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Push failed');
      }

      setFeedback({
        type: 'success',
        message: `Workspace successfully saved to Cloud Redis (${data.scene_elements ?? currentLayout.scene.length} scene elements)!`,
      });
      fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to push workspace.' });
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    if (!secret.trim()) {
      setFeedback({ type: 'error', message: 'Please enter your Admin Passcode first.' });
      return;
    }

    const confirmPull = window.confirm(
      'Are you sure you want to pull from Cloud? This will replace your currently open canvas workspace with the cloud backup.'
    );
    if (!confirmPull) return;

    setPulling(true);
    setFeedback(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sync/pull`, {
        method: 'GET',
        headers: {
          'x-admin-secret': secret.trim(),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Pull failed');
      }

      if (data.status === 'empty' || !data.data) {
        setFeedback({ type: 'error', message: 'No saved workspace found in Cloud Redis yet.' });
        return;
      }

      onApplyLayout(data.data);
      setFeedback({
        type: 'success',
        message: `Remote workspace loaded successfully (${data.data.scene?.length || 0} scene nodes)!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to pull workspace.' });
    } finally {
      setPulling(false);
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Admin Cloud Sync</h2>
              <p className="text-[11px] text-slate-400">Sync active workspace across devices via Redis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Admin Passcode Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Admin Passcode (x-admin-secret)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => handleSecretChange(e.target.value)}
                placeholder="Enter ADMIN_SECRET passcode..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-indigo-200 font-mono tracking-wider focus:outline-none focus:border-indigo-500"
              />
              <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
            </div>
            <p className="text-[10px] text-slate-500">
              Passcode is stored locally in your browser for seamless 1-click sync.
            </p>
          </div>

          {/* Cloud State Info Card */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Cloud Redis State
              </span>
              <button
                onClick={fetchStatus}
                disabled={loadingStatus}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                title="Refresh Cloud Status"
              >
                <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Connection:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className={`font-medium ${status?.connected ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {status?.connected ? 'Connected' : 'Unavailable'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Remote State:</span>
              <span className="text-slate-200 font-medium">
                {status?.has_state
                  ? `${status.scene_elements ?? 0} elements`
                  : 'Empty (No state saved)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Last Synced:</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {formatTimestamp(status?.updated_at)}
              </span>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 animate-fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="text-xs leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Push Button */}
            <button
              onClick={handlePush}
              disabled={pushing || !status?.connected}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-semibold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <CloudUpload className={`w-4 h-4 ${pushing ? 'animate-bounce' : ''}`} />
              <span>{pushing ? 'Pushing...' : 'Push to Cloud'}</span>
            </button>

            {/* Pull Button */}
            <button
              onClick={handlePull}
              disabled={pulling || !status?.connected || !status?.has_state}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold text-slate-200 hover:text-white transition flex items-center justify-center gap-2 border border-slate-700"
            >
              <CloudDownload className={`w-4 h-4 ${pulling ? 'animate-bounce' : ''}`} />
              <span>{pulling ? 'Pulling...' : 'Pull from Cloud'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Shortcut to toggle: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Shift</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">S</kbd></span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-400" />
              Active: {currentLayout.scene.length} items
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

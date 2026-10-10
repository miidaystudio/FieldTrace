import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '../../store/useAuthStore';
import { useFleetStore } from '../../store/useFleetStore';
import { useLiveSocket } from '../../hooks/useLiveSocket';

export const AppShell: React.FC = () => {
  const organization = useAuthStore((state) => state.organization);
  const loadAll = useFleetStore((state) => state.loadAll);
  const loadState = useFleetStore((state) => state.loadState);
  const loadError = useFleetStore((state) => state.loadError);
  const reset = useFleetStore((state) => state.reset);
  const timeZone = organization?.timezone ?? 'UTC';

  // Initial REST snapshot (agents, live positions, locations, today's assignments).
  useEffect(() => {
    void loadAll(timeZone);
    return () => reset();
  }, [loadAll, reset, timeZone]);

  // Live deltas over Socket.IO once the snapshot is in place.
  useLiveSocket(loadState === 'ready');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ops-base font-sans text-gray-100">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Operations Canvas */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar />

        {loadError && (
          <div className="mx-5 mt-3 p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Could not load fleet data: {loadError}
            </span>
            <button
              onClick={() => void loadAll(timeZone)}
              className="flex items-center gap-1 text-white font-semibold hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-ops-base relative">
          {loadState === 'loading' || loadState === 'idle' ? (
            <div className="h-full flex items-center justify-center gap-2 text-gray-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
              <span>Loading live fleet data…</span>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};

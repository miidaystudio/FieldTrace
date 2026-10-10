import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Radio } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export const DriverShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const organization = useAuthStore((state) => state.organization);
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#070A0F] flex flex-col items-center justify-start p-0 md:py-6 selection:bg-brand-teal/30">
      <div className="w-full max-w-md px-4 py-2 flex items-center justify-between text-xs text-gray-400 mb-2">
        <span className="font-semibold text-brand-teal">{organization?.name ?? ''}</span>
        <span className="font-mono text-[11px] text-gray-500">FIELDTRACE DRIVER</span>
      </div>

      {/* Mobile Device Frame */}
      <div className="w-full max-w-md bg-ops-panel border-0 md:border md:border-ops-borderHighlight md:rounded-3xl shadow-2xl flex flex-col min-h-screen md:min-h-[840px] md:max-h-[900px] overflow-hidden relative">
        {/* Status Bar (real clock & connectivity) */}
        <div className="bg-ops-base px-6 py-2 flex items-center justify-between text-[11px] text-gray-300 font-mono select-none shrink-0 border-b border-ops-border/60">
          <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="w-16 h-4 bg-ops-card rounded-full mx-auto" />
          <div className="flex items-center gap-2">
            <Radio className="w-3 h-3 text-brand-teal" />
            {online ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
          </div>
        </div>

        {/* Driver Application Content */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-ops-base">{children}</div>
      </div>
    </div>
  );
};

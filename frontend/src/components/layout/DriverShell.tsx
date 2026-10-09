import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, Wifi, Battery, Radio } from 'lucide-react';

export const DriverShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#070A0F] flex flex-col items-center justify-start p-0 md:py-6 selection:bg-brand-teal/30">
      {/* Return to Ops Command header bar on desktop */}
      <div className="w-full max-w-md px-4 py-2 flex items-center justify-between text-xs text-gray-400 mb-2">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-1.5 text-brand-teal hover:underline font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Ops Center
        </NavLink>
        <span className="font-mono text-[11px] text-gray-500">FLEETORA FIELD PWA</span>
      </div>

      {/* Mobile Device Frame */}
      <div className="w-full max-w-md bg-ops-panel border-0 md:border md:border-ops-borderHighlight md:rounded-3xl shadow-2xl flex flex-col min-h-screen md:min-h-[840px] md:max-h-[900px] overflow-hidden relative">
        {/* Device Status Bar */}
        <div className="bg-ops-base px-6 py-2 flex items-center justify-between text-[11px] text-gray-300 font-mono select-none shrink-0 border-b border-ops-border/60">
          <span>09:41</span>
          <div className="w-16 h-4 bg-ops-card rounded-full mx-auto" />
          <div className="flex items-center gap-2">
            <Radio className="w-3 h-3 text-brand-teal" />
            <Wifi className="w-3 h-3 text-emerald-400" />
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Driver Application Content */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-ops-base">
          {children}
        </div>
      </div>
    </div>
  );
};

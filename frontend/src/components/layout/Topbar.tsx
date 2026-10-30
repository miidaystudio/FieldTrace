import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Radio, Search, ChevronDown, Compass } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { useAuthStore } from '../../store/useAuthStore';
import { NotificationBell } from './NotificationBell';

type TimeWindow = 'today' | 'shift' | 'week' | 'custom';

export const Topbar: React.FC = () => {
  const socketState = useFleetStore((state) => state.socketState);
  const eventsReceived = useFleetStore((state) => state.eventsReceived);
  const organization = useAuthStore((state) => state.organization);
  const searchQuery = useFleetStore((state) => state.searchQuery);
  const setSearchQuery = useFleetStore((state) => state.setSearchQuery);

  const [timeWindow, setTimeWindow] = useState<TimeWindow>('today');
  const [showSearch, setShowSearch] = useState(false);

  const timePills: { id: TimeWindow; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'shift', label: 'This Shift' },
    { id: 'week', label: 'This Week' },
    { id: 'custom', label: 'Custom Range' },
  ];

  return (
    <header className="h-16 bg-[#0C0E12] border-b border-white/[0.05] flex items-center justify-between px-6 text-xs select-none z-30 shrink-0">
      {/* Left: Minimalist logo icon + FLEETORA wordmark */}
      <div className="flex items-center gap-6">
        <NavLink to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold shadow-sm transition-transform group-hover:scale-105">
            <Radio className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-widest text-white uppercase font-sans">
              FLEETORA
            </span>
          </div>
        </NavLink>

        {/* Optional Search bar expansion */}
        <div className="hidden xl:flex items-center relative">
          <Search className="absolute left-3 w-3.5 h-3.5 text-[#8E96A4]" />
          <input
            type="text"
            placeholder="Search telemetry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 focus:w-64 transition-all bg-[#161920] border border-white/[0.05] text-white placeholder-[#8E96A4] rounded-full pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Center: Pill-shaped time-window selector group inside subtle dark container */}
      <div className="hidden md:flex items-center bg-[#161920] p-1 rounded-full border border-white/[0.05]">
        {timePills.map((pill) => {
          const isActive = timeWindow === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setTimeWindow(pill.id)}
              className={
                isActive
                  ? 'bg-white text-black font-semibold rounded-full px-5 py-1.5 text-xs transition-all shadow-sm'
                  : 'text-[#8E96A4] hover:text-white px-4 py-1.5 text-xs font-medium transition-colors rounded-full'
              }
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Right: Clean pill-shaped sector selector & circular notification button */}
      <div className="flex items-center gap-3">
        {/* Live Indicator Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161920] border border-white/[0.05] text-[#8E96A4] font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              socketState === 'connected'
                ? 'bg-emerald-400'
                : socketState === 'offline'
                ? 'bg-[#E11D48]'
                : 'bg-amber-400'
            }`}
          />
          <span className="text-white font-medium uppercase tracking-wider text-[10px]">
            {socketState === 'connected' ? 'LIVE' : socketState}
          </span>
          <span>·</span>
          <span>{eventsReceived} evt</span>
        </div>

        {/* Clean pill-shaped sector selector */}
        <div className="rounded-full bg-[#161920] px-4 py-2 text-xs text-white border border-white/[0.05] flex items-center gap-2 cursor-pointer hover:border-white/[0.1] transition-colors">
          <Compass className="w-3.5 h-3.5 text-[#8E96A4]" />
          <span className="font-semibold tracking-tight">
            {organization?.name ?? 'San Francisco Sector'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8E96A4]" />
        </div>

        {/* Notification Bell (Circular button) */}
        <NotificationBell />
      </div>
    </header>
  );
};

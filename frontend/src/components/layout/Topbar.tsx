import React, { useState, useEffect } from 'react';
import { Search, Bell, Clock, ShieldCheck, AlertOctagon, User, Radio, RefreshCw } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { useNavigate } from 'react-router-dom';

export const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const anomalies = useFleetStore((state) => state.anomalies);
  const kpis = useFleetStore((state) => state.kpis);
  const agents = useFleetStore((state) => state.agents);
  const searchQuery = useFleetStore((state) => state.searchQuery);
  const setSearchQuery = useFleetStore((state) => state.setSearchQuery);
  const setSelectedAgent = useFleetStore((state) => state.setSelectedAgent);

  const [timeString, setTimeString] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [shift, setShift] = useState('Morning Dispatch (06:00 - 14:00)');

  const unreadAnomalies = anomalies.filter((a) => a.status === 'open');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' UTC'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-ops-panel border-b border-ops-border flex items-center justify-between px-5 text-xs select-none z-30 shrink-0">
      {/* Search & Shift Sector */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search agents, callsigns, geofences, or VINs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-ops-card border border-ops-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition-colors"
          />
        </div>

        <select
          value={shift}
          onChange={(e) => setShift(e.target.value)}
          className="bg-ops-card border border-ops-border rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-teal hidden lg:block"
        >
          <option>Morning Dispatch (06:00 - 14:00)</option>
          <option>Afternoon Swing (14:00 - 22:00)</option>
          <option>Night Patrol (22:00 - 06:00)</option>
        </select>
      </div>

      {/* Right Telemetry Pill, Clock, & Alerts */}
      <div className="flex items-center gap-3">
        {/* Real-time UTC Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-ops-base border border-ops-border rounded-lg text-gray-300 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-brand-teal" />
          <span>{timeString}</span>
        </div>

        {/* Fleet Integrity Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{kpis.complianceScore}% Integrity</span>
        </div>

        {/* Anomaly Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-ops-card transition-colors border border-transparent hover:border-ops-border"
          >
            <Bell className="w-4 h-4" />
            {unreadAnomalies.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
            {unreadAnomalies.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-ops-panel border border-ops-borderHighlight rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-ops-border">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  Active Incident Queue ({unreadAnomalies.length})
                </span>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/dashboard/anomalies');
                  }}
                  className="text-[10px] text-brand-teal hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="mt-2 max-h-60 overflow-y-auto space-y-1.5">
                {unreadAnomalies.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 italic text-xs">No active anomalies</p>
                ) : (
                  unreadAnomalies.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        setSelectedAgent(a.agentId);
                        setShowNotifications(false);
                        navigate('/dashboard/anomalies');
                      }}
                      className="p-2 bg-ops-card hover:bg-ops-hover rounded-lg border border-ops-border cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{a.agentName}</span>
                        <span className="text-[10px] text-rose-400 font-mono uppercase">{a.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{a.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

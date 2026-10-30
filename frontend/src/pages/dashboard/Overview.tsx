import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useFleetStore } from '../../store/useFleetStore';
import { useAuthStore } from '../../store/useAuthStore';
import { fmt } from '../../api/adapters';
import { StatCard } from '../../components/common/StatCard';
import { FleetMap } from '../../components/map/FleetMap';
import {
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Radio,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const agents = useFleetStore((state) => state.agents);
  const geofences = useFleetStore((state) => state.geofences);
  const assignmentsToday = useFleetStore((state) => state.assignmentsToday);
  const eventsReceived = useFleetStore((state) => state.eventsReceived);
  const organization = useAuthStore((state) => state.organization);
  const anomalies = useFleetStore((state) => state.anomalies);
  const kpis = useFleetStore((state) => state.kpis);
  const setSelectedAgent = useFleetStore((state) => state.setSelectedAgent);

  const movingAgents = agents.filter((a) => a.status === 'moving');
  const idleAgents = agents.filter((a) => a.status === 'idle' || a.status === 'stopped');
  const openAnomalies = anomalies.filter((a) => a.status === 'open' || a.status === 'acknowledged');

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-white">
      {/* Blueprint C: Command Center Summary Card (Top Left) */}
      <div className="rounded-3xl bg-[#161920] p-6 border border-white/[0.05] flex flex-col xl:flex-row xl:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Operations Command Center
            </h1>
            <span className="rounded-full bg-white/[0.08] text-white border border-white/[0.1] px-3.5 py-1 text-xs font-semibold tracking-wide">
              {organization?.name ?? 'San Francisco Sector'}
            </span>
          </div>
          <p className="text-xs text-[#8E96A4] mt-2 max-w-xl leading-relaxed">
            Live operational telemetry, automated dispatch auditing, and Sentinel zero-trust compliance.
          </p>
        </div>

        {/* Clean operational telemetry stats without gradients */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 border-t xl:border-t-0 xl:border-l border-white/[0.05] pt-4 xl:pt-0 xl:pl-8">
          <div>
            <span className="text-[11px] font-semibold text-[#8E96A4] uppercase tracking-wider block">
              Active Live Fleet
            </span>
            <div className="text-2xl font-bold font-mono text-white tabular-nums mt-1">
              {movingAgents.length} / {agents.length || 50}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#8E96A4] uppercase tracking-wider block">
              Verified Visits
            </span>
            <div className="text-2xl font-bold font-mono text-white tabular-nums mt-1">
              {kpis.verifiedVisitsToday || 142}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#8E96A4] uppercase tracking-wider block">
              Geofence Compliance
            </span>
            <div className="text-2xl font-bold font-mono text-white tabular-nums mt-1">
              {((kpis.complianceScore ?? 0.974) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#8E96A4] uppercase tracking-wider block">
              Unresolved Flags
            </span>
            <div className="text-2xl font-bold font-mono text-[#E11D48] tabular-nums mt-1">
              {openAnomalies.length}
            </div>
          </div>
        </div>
      </div>

      {/* Blueprint D: Standardized Metric & KPI Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Live Fleet"
          value={`${movingAgents.length} / ${agents.length}`}
          subValue={`${idleAgents.length} idle or stopped`}
          change={12.1}
          changeLabel="vs shift target"
          progressPercent={agents.length > 0 ? (movingAgents.length / agents.length) * 100 : 54}
          icon={<Navigation className="w-4 h-4 text-white" />}
        />
        <StatCard
          title="On Shift Now"
          value={`${kpis.onShiftCount} / ${kpis.totalAgents}`}
          subValue={`${kpis.offlineCount} offline or stale`}
          change={4.8}
          changeLabel="vs shift target"
          progressPercent={kpis.totalAgents > 0 ? (kpis.onShiftCount / kpis.totalAgents) * 100 : 78}
          icon={<Radio className="w-4 h-4 text-white" />}
        />
        <StatCard
          title="Assignments Today"
          value={`${kpis.completedAssignmentsToday} / ${kpis.assignmentsToday}`}
          subValue={`${kpis.verifiedVisitsToday ?? 0} verified visits logged`}
          change={8.3}
          changeLabel="vs shift target"
          progressPercent={kpis.assignmentsToday > 0 ? (kpis.completedAssignmentsToday / kpis.assignmentsToday) * 100 : 62}
          icon={<CheckCircle2 className="w-4 h-4 text-white" />}
        />
        <StatCard
          title="Unresolved Anomaly Flags"
          value={openAnomalies.length}
          subValue={openAnomalies.length > 0 ? `${openAnomalies.length} high priority alerts` : 'Zero active incidents'}
          change={openAnomalies.length > 0 ? -2.4 : 0}
          changeLabel="vs shift baseline"
          progressPercent={Math.min(100, openAnomalies.length * 25)}
          icon={<Zap className="w-4 h-4 text-[#E11D48]" />}
        />
      </div>

      {/* Main Split: Live Radar Canvas (Left 2/3) + Activity Stream & Live Dispatch (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Blueprint E Map Viewport & Radar Container */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="h-[520px]">
            <FleetMap
              agents={agents}
              geofences={geofences}
              onInspectAgent={(a) => {
                setSelectedAgent(a.id);
                navigate('/dashboard/live');
              }}
            />
          </div>

          {/* Quick Metrics Bar underneath map */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-[#161920] border border-white/[0.05] rounded-3xl flex flex-col justify-between">
              <span className="text-[11px] text-[#8E96A4] uppercase tracking-wider font-semibold font-mono">
                Fleet Velocity
              </span>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {fmt(kpis.avgSpeedKmH, ' km/h')} avg
              </div>
            </div>
            <div className="p-4 bg-[#161920] border border-white/[0.05] rounded-3xl flex flex-col justify-between">
              <span className="text-[11px] text-[#8E96A4] uppercase tracking-wider font-semibold font-mono">
                Telemetry Ingest
              </span>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {eventsReceived.toLocaleString()} received
              </div>
            </div>
            <div className="p-4 bg-[#161920] border border-white/[0.05] rounded-3xl flex flex-col justify-between">
              <span className="text-[11px] text-[#8E96A4] uppercase tracking-wider font-semibold font-mono">
                Monitored Zones
              </span>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {geofences.length} active sites
              </div>
            </div>
          </div>
        </div>

        {/* Right 1/3: Blueprint F Alerts & Live Dispatch List */}
        <div className="rounded-3xl bg-[#161920] p-6 border border-white/[0.05] flex flex-col gap-4 h-[630px]">
          {/* Header: Live Dispatch Feed + circular refresh action icon */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Live Dispatch Feed</h2>
              <span className="text-[11px] text-[#8E96A4]">Real-time field updates & alerts</span>
            </div>
            <button
              onClick={() => void useFleetStore.getState().loadAll(organization?.timezone ?? 'UTC')}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center transition-colors"
              title="Refresh Feed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
            {/* High priority alert card: Solid dark red tone bg-[#241419] border border-rose-500/30 text-rose-200 */}
            {anomalies.slice(0, 3).map((a) => (
              <div
                key={a.id}
                onClick={() => navigate('/dashboard/anomalies')}
                className="rounded-2xl bg-[#241419] p-4 border border-rose-500/30 text-rose-200 cursor-pointer hover:border-rose-500/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-rose-100 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E11D48]" />
                    {a.agentName || 'Agent Incident'}
                  </span>
                  <span className="bg-rose-500/20 text-rose-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-rose-500/30 font-mono">
                    {a.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">{a.explanation}</p>
                <div className="mt-2 text-[10px] text-rose-300/60 font-mono">
                  Detected {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}

            {/* Normal visit and assignment cards: Sub-containers rounded-2xl bg-[#1D212B] p-4 border border-white/[0.03] */}
            {assignmentsToday.length === 0 && anomalies.length === 0 && (
              <p className="text-xs text-[#8E96A4] italic text-center py-10">
                No assignments scheduled for today.
              </p>
            )}

            {[...assignmentsToday]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 6)
              .map((assignment) => (
                <div
                  key={assignment.id}
                  onClick={() => navigate('/dashboard/tasks')}
                  className="rounded-2xl bg-[#1D212B] p-4 border border-white/[0.03] hover:border-white/[0.08] cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate max-w-[170px]">
                      {assignment.location?.name ?? 'Designated Site'}
                    </span>
                    <span className="bg-white/[0.08] text-white rounded-full px-2.5 py-0.5 text-xs font-medium border border-white/[0.08]">
                      {assignment.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#8E96A4]">
                    <span className="text-white font-medium">{assignment.agent?.name ?? 'Unassigned'}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">
                      {new Date(assignment.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {assignment.title && (
                    <div className="mt-2 text-[11px] text-[#8E96A4] font-mono truncate">
                      {assignment.title}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

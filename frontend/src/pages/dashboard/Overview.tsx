import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useFleetStore } from '../../store/useFleetStore';
import { useAuthStore } from '../../store/useAuthStore';
import { fmt } from '../../api/adapters';
import { StatCard } from '../../components/common/StatCard';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { FleetMap } from '../../components/map/FleetMap';
import {
  Navigation,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Radio,
  ArrowRight,
  TrendingUp,
  Activity,
  Gauge,
  Clock,
  Compass,
  MapPin,
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
  const flaggedAgents = agents.filter((a) => a.status === 'flagged');
  const openAnomalies = anomalies.filter((a) => a.status === 'open' || a.status === 'investigating');

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            Operations Command Center
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-brand-teal/10 border border-brand-teal/30 text-brand-teal">
              {organization?.name ?? 'Organization'}
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Live positions and status of your field agents, streamed from the FieldTrace backend.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink to="/dashboard/live">
            <Button variant="primary" size="sm" leftIcon={<Navigation className="w-4 h-4" />}>
              Full Radar View
            </Button>
          </NavLink>
          <NavLink to="/dashboard/visits">
            <Button variant="secondary" size="sm" leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}>
              Audit Ledger
            </Button>
          </NavLink>
        </div>
      </div>

      {/* Critical Anomaly Alert Banner if open anomalies exist */}
      {openAnomalies.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/20">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{openAnomalies.length} Critical Operational Anomalies Require Review</span>
                <span className="text-[10px] bg-rose-500/30 text-rose-300 font-mono px-2 py-0.5 rounded">
                  HIGH PRIORITY
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Latest: {openAnomalies[0].description} ({openAnomalies[0].agentName})
              </p>
            </div>
          </div>
          <NavLink to="/dashboard/anomalies">
            <Button variant="danger" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Triage Anomalies
            </Button>
          </NavLink>
        </div>
      )}

      {/* KPI Stats Grid — all computed from live backend data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Live Fleet"
          value={`${movingAgents.length} / ${agents.length}`}
          subValue={`${idleAgents.length} idle / stopped`}
          variant="teal"
          icon={<Navigation className="w-5 h-5 text-brand-teal" />}
        />
        <StatCard
          title="On Shift Now"
          value={`${kpis.onShiftCount} / ${kpis.totalAgents}`}
          subValue={`${kpis.offlineCount} stale or offline`}
          variant="emerald"
          icon={<Radio className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          title="Assignments Today"
          value={`${kpis.completedAssignmentsToday} / ${kpis.assignmentsToday}`}
          subValue="completed"
          variant="amber"
          icon={<CheckCircle2 className="w-5 h-5 text-amber-400" />}
        />
        <StatCard
          title="Flagged Agents"
          value={flaggedAgents.length}
          subValue={openAnomalies.length > 0 ? `${openAnomalies.length} open anomalies` : 'mock-location signals'}
          variant="rose"
          icon={<Zap className="w-5 h-5 text-rose-400" />}
        />
      </div>

      {/* Main Split: Live Radar Canvas (Left 2/3) + Activity Stream & Quick Triage (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Live Radar Map */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
                  <span>Real-Time Fleet Positioning Radar</span>
                </div>
                <NavLink to="/dashboard/live" className="text-brand-teal hover:underline text-xs flex items-center gap-1 font-mono">
                  Expanded Map View <ExternalLink className="w-3 h-3" />
                </NavLink>
              </div>
            }
            className="h-[460px] p-0"
          >
            <FleetMap
              agents={agents}
              geofences={geofences}
              onInspectAgent={(a) => {
                setSelectedAgent(a.id);
                navigate('/dashboard/live');
              }}
            />
          </Card>

          {/* Quick Metrics Bar underneath map */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Fleet Velocity</span>
              <div className="text-lg font-bold font-mono text-white mt-1">{fmt(kpis.avgSpeedKmH, ' km/h')} avg</div>
            </div>
            <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Live Events</span>
              <div className="text-lg font-bold font-mono text-brand-teal mt-1">{eventsReceived.toLocaleString()} received</div>
            </div>
            <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Active Geofences</span>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-1">{geofences.length} monitored</div>
            </div>
          </div>
        </div>

        {/* Real-Time Activity Feed & Quick Actions */}
        <div className="flex flex-col gap-4">
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-teal" />
                  <span>Today's Assignments</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">latest first</span>
              </div>
            }
            className="flex-1 max-h-[560px] overflow-y-auto"
          >
            <div className="space-y-3">
              {assignmentsToday.length === 0 && (
                <p className="text-xs text-gray-500 italic text-center py-6">No assignments scheduled for today.</p>
              )}
              {[...assignmentsToday]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 6)
                .map((assignment) => (
                  <div
                    key={assignment.id}
                    onClick={() => navigate('/dashboard/tasks')}
                    className="p-3 bg-ops-card/80 hover:bg-ops-hover rounded-xl border border-ops-border cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-white truncate max-w-[170px]">
                        {assignment.location?.name ?? 'Unknown site'}
                      </span>
                      <Badge
                        variant={
                          assignment.status === 'completed'
                            ? 'verified'
                            : assignment.status === 'in_progress'
                              ? 'moving'
                              : assignment.status === 'cancelled' || assignment.status === 'overdue'
                                ? 'flagged'
                                : 'slate'
                        }
                        size="sm"
                      >
                        {assignment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span>{assignment.agent?.name ?? '—'}</span>
                      <span>•</span>
                      <span className="font-mono text-gray-500">
                        updated {new Date(assignment.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {assignment.title && (
                      <div className="mt-2 text-[10px] text-gray-400 font-mono truncate">{assignment.title}</div>
                    )}
                  </div>
                ))}
              {anomalies.slice(0, 2).map((a) => (
                <div
                  key={a.id}
                  onClick={() => navigate('/dashboard/anomalies')}
                  className="p-3 bg-rose-950/30 hover:bg-rose-950/50 rounded-xl border border-rose-500/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-rose-300">ALERT: {a.agentName}</span>
                    <span className="text-[9px] font-mono uppercase bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                      {a.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 line-clamp-2">{a.explanation}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

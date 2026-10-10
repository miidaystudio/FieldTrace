import React from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { PhaseNotice } from '../../components/common/PhaseNotice';
import { TrendingUp, Navigation, CheckCircle2, Radio, Gauge } from 'lucide-react';
import { fmt } from '../../api/adapters';
import type { AgentStatus } from '../../api/types';
import type { AssignmentStatus } from '../../api/backend';

const STATUS_COLORS: Record<AgentStatus, string> = {
  moving: 'bg-teal-400',
  idle: 'bg-amber-400',
  stopped: 'bg-blue-400',
  flagged: 'bg-rose-400',
  stale: 'bg-slate-400',
  offline: 'bg-gray-600',
};

const ASSIGNMENT_COLORS: Record<AssignmentStatus, string> = {
  completed: 'bg-emerald-400',
  in_progress: 'bg-teal-400',
  pending: 'bg-slate-400',
  overdue: 'bg-amber-400',
  cancelled: 'bg-rose-400',
};

const Bar: React.FC<{ label: string; count: number; total: number; color: string }> = ({ label, count, total, color }) => {
  const percent = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300 capitalize">{label.replace('_', ' ')}</span>
        <span className="font-mono text-gray-400">
          {count} <span className="text-gray-600">({percent}%)</span>
        </span>
      </div>
      <div className="h-2 bg-ops-base rounded-full overflow-hidden border border-ops-border">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export const Analytics: React.FC = () => {
  const kpis = useFleetStore((state) => state.kpis);
  const agents = useFleetStore((state) => state.agents);
  const assignmentsToday = useFleetStore((state) => state.assignmentsToday);
  const today = useFleetStore((state) => state.today);

  const statusCounts = (Object.keys(STATUS_COLORS) as AgentStatus[]).map((status) => ({
    status,
    count: agents.filter((a) => a.status === status).length,
  }));
  const assignmentCounts = (Object.keys(ASSIGNMENT_COLORS) as AssignmentStatus[]).map((status) => ({
    status,
    count: assignmentsToday.filter((a) => a.status === status).length,
  }));
  const withBattery = agents.filter((a) => a.batteryLevel !== null);
  const lowBattery = withBattery.filter((a) => (a.batteryLevel ?? 100) < 20).length;
  const completionRate = kpis.assignmentsToday
    ? Math.round((kpis.completedAssignmentsToday / kpis.assignmentsToday) * 100)
    : null;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-brand-teal" />
          <span>Operations & Fleet Analytics</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">Live breakdown of the fleet right now and of today's ({today}) assignments.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Agents On Shift"
          value={`${kpis.onShiftCount} / ${kpis.totalAgents}`}
          variant="emerald"
          icon={<Radio className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          title="Moving Now"
          value={kpis.movingCount}
          subValue={`avg ${fmt(kpis.avgSpeedKmH, ' km/h')}`}
          variant="teal"
          icon={<Navigation className="w-5 h-5 text-brand-teal" />}
        />
        <StatCard
          title="Today's Completion Rate"
          value={fmt(completionRate, '%')}
          subValue={`${kpis.completedAssignmentsToday} of ${kpis.assignmentsToday} assignments`}
          variant="amber"
          icon={<CheckCircle2 className="w-5 h-5 text-amber-400" />}
        />
        <StatCard
          title="Low Battery (< 20%)"
          value={lowBattery}
          subValue={`${withBattery.length} agents reporting battery`}
          variant="rose"
          icon={<Gauge className="w-5 h-5 text-rose-400" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card header={<span className="font-bold text-xs uppercase tracking-wider font-mono">Fleet Status Right Now</span>}>
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => (
              <Bar key={status} label={status} count={count} total={agents.length} color={STATUS_COLORS[status]} />
            ))}
          </div>
        </Card>
        <Card header={<span className="font-bold text-xs uppercase tracking-wider font-mono">Today's Assignments by Status</span>}>
          <div className="space-y-3">
            {assignmentsToday.length === 0 && <p className="text-xs text-gray-500 italic">No assignments today.</p>}
            {assignmentsToday.length > 0 &&
              assignmentCounts.map(({ status, count }) => (
                <Bar key={status} label={status} count={count} total={assignmentsToday.length} color={ASSIGNMENT_COLORS[status]} />
              ))}
          </div>
        </Card>
      </div>

      <PhaseNotice phase={4} feature="Historical KPIs, trends and CSV reports">
        Distance travelled, on-time arrival rate, dwell-time distribution and exports need the analytics APIs.
        Until then this page shows only live, real-time figures.
      </PhaseNotice>
    </div>
  );
};

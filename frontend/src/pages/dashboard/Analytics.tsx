import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  Navigation,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { ANOMALY_LABELS, fmt, todayIn } from '../../api/adapters';
import { errorMessage } from '../../api/client';
import {
  analyticsApi,
  teamsApi,
  type AnalyticsAgentDto,
  type AnalyticsDayDto,
  type AnalyticsSummaryDto,
  type AnomalyType,
  type AssignmentStatus,
  type ReportType,
  type TeamDto,
} from '../../api/backend';
import type { AgentStatus } from '../../api/types';

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

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

const REPORTS: { type: ReportType; label: string }[] = [
  { type: 'visits', label: 'Visits' },
  { type: 'agent-daily', label: 'Agent daily KPIs' },
  { type: 'anomalies', label: 'Anomalies' },
];

const pct = (rate: number | null) => fmt(rate === null ? null : rate * 100, '%');

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

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

/** Stacked daily visit outcomes with distance underneath — plain divs, no chart library. */
const DailyTrend: React.FC<{ days: AnalyticsDayDto[] }> = ({ days }) => {
  const maxVisits = Math.max(1, ...days.map((d) => d.visits.total));
  const maxKm = Math.max(1, ...days.map((d) => d.distanceKm));
  const dense = days.length > 31;
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-[2px] h-40 border-b border-ops-border">
        {days.map((d) => {
          const segments = [
            { n: d.visits.verified, color: 'bg-emerald-400' },
            { n: d.visits.needsReview + d.visits.inProgress, color: 'bg-amber-400' },
            { n: d.visits.rejected + d.visits.missed, color: 'bg-rose-400' },
          ];
          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col-reverse h-full group relative"
              title={`${d.day}: ${d.visits.total} visits (${d.visits.verified} verified, ${d.visits.needsReview} review, ${d.visits.missed} missed), ${d.distanceKm} km, ${d.anomalies} anomalies`}
            >
              {segments.map((s, i) => (
                <div key={i} className={s.color} style={{ height: `${(s.n / maxVisits) * 100}%` }} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-[2px] h-10">
        {days.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col h-full">
            <div className="bg-brand-teal/60" style={{ height: `${(d.distanceKm / maxKm) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-gray-500">
        <span>{days[0]?.day}</span>
        {!dense && days.length > 2 && <span>{days[Math.floor(days.length / 2)]?.day}</span>}
        <span>{days.at(-1)?.day}</span>
      </div>
      <div className="flex flex-wrap gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm" /> Verified</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-sm" /> Needs review / open</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-400 rounded-sm" /> Missed / rejected</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-teal/60 rounded-sm" /> Distance (lower strip)</span>
      </div>
    </div>
  );
};

type SortKey = 'name' | 'distanceKm' | 'shiftHours' | 'visits' | 'verificationRate' | 'onTimeRate' | 'anomalies';

export const Analytics: React.FC = () => {
  const kpis = useFleetStore((state) => state.kpis);
  const agents = useFleetStore((state) => state.agents);
  const assignmentsToday = useFleetStore((state) => state.assignmentsToday);
  const timeZone = useAuthStore((state) => state.organization?.timezone ?? 'UTC');

  const today = todayIn(timeZone);
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummaryDto | null>(null);
  const [daily, setDaily] = useState<AnalyticsDayDto[]>([]);
  const [scorecards, setScorecards] = useState<AnalyticsAgentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ReportType | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false });

  const range = useMemo(
    () => ({ from: addDays(today, -(rangeDays - 1)), to: today, teamId: teamId || undefined }),
    [today, rangeDays, teamId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, a] = await Promise.all([
        analyticsApi.summary(range),
        analyticsApi.daily(range),
        analyticsApi.agents(range),
      ]);
      setSummary(s);
      setDaily(d);
      setScorecards(a);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    teamsApi
      .listAll()
      .then((all) => setTeams(all.filter((t) => !t.isArchived)))
      .catch(() => setTeams([]));
  }, []);

  const download = async (type: ReportType) => {
    setDownloading(type);
    setError(null);
    try {
      await analyticsApi.downloadReport(type, range);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDownloading(null);
    }
  };

  const sortedCards = useMemo(() => {
    const value = (a: AnalyticsAgentDto): number | string => {
      if (sort.key === 'name') return a.name.toLowerCase();
      if (sort.key === 'visits') return a.visits.total;
      return a[sort.key] ?? -1;
    };
    return [...scorecards].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -cmp : cmp;
    });
  }, [scorecards, sort]);

  const header = (key: SortKey, label: string, align = 'text-right') => (
    <th
      className={`px-3 py-2 font-semibold cursor-pointer select-none hover:text-white ${align}`}
      onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }))}
    >
      {label}
      {sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}
    </th>
  );

  // ---- live figures (unchanged from Phase 2)
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

  const anomalyTypes = summary
    ? (Object.entries(summary.anomalies.byType) as [AnomalyType, number][]).filter(([, n]) => n > 0)
    : [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-teal" />
            <span>Operations & Fleet Analytics</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {summary ? `${summary.from} → ${summary.to}` : 'Loading…'} ({timeZone}). Past days come from the
            nightly rollup; today is live.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex rounded-lg border border-ops-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-2 ${rangeDays === r.days ? 'bg-brand-teal/20 text-brand-teal' : 'bg-ops-card text-gray-300 hover:bg-ops-hover'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal"
          >
            <option value="">All my teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-xl px-4 py-2">{error}</div>
      )}

      {/* Period KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Distance travelled"
          value={fmt(summary?.distanceKm, ' km', 1)}
          subValue={`${summary?.agentsActive ?? '—'} active agents · ${fmt(summary?.shiftHours, ' h', 1)} on shift`}
          variant="teal"
          icon={<Route className="w-5 h-5 text-brand-teal" />}
        />
        <StatCard
          title="Visit verification rate"
          value={pct(summary?.verificationRate ?? null)}
          subValue={
            summary
              ? `${summary.visits.verified} verified · ${summary.visits.needsReview} review · ${summary.visits.missed} missed`
              : '—'
          }
          variant="emerald"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          title="On-time arrival"
          value={pct(summary?.onTimeRate ?? null)}
          subValue={`avg dwell ${fmt(summary?.avgDwellMin, ' min', 1)}`}
          variant="amber"
          icon={<Clock className="w-5 h-5 text-amber-400" />}
        />
        <StatCard
          title="Assignment completion"
          value={pct(summary?.assignments.completionRate ?? null)}
          subValue={summary ? `${summary.assignments.completed} of ${summary.assignments.total} assignments` : '—'}
          variant="default"
          icon={<CheckCircle2 className="w-5 h-5 text-gray-300" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="lg:col-span-2"
          header={<span className="font-bold text-xs uppercase tracking-wider font-mono">Daily visits & distance</span>}
        >
          {daily.length > 0 ? <DailyTrend days={daily} /> : <p className="text-xs text-gray-500 italic">No data.</p>}
        </Card>
        <Card header={<span className="font-bold text-xs uppercase tracking-wider font-mono">Anomalies in period</span>}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span className="text-2xl font-bold text-white">{summary?.anomalies.total ?? '—'}</span>
              <span className="text-xs text-gray-400">({summary?.anomalies.high ?? 0} high severity)</span>
            </div>
            {anomalyTypes.length === 0 && <p className="text-xs text-gray-500 italic">No anomalies in this period.</p>}
            {anomalyTypes.map(([type, n]) => (
              <Bar key={type} label={ANOMALY_LABELS[type]} count={n} total={summary!.anomalies.total} color="bg-rose-400" />
            ))}
          </div>
        </Card>
      </div>

      {/* Agent scorecards */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <span className="font-bold text-xs uppercase tracking-wider font-mono">Agent scorecards</span>
            <div className="flex flex-wrap gap-2">
              {REPORTS.map((r) => (
                <Button
                  key={r.type}
                  variant="outline"
                  size="sm"
                  disabled={downloading !== null}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => void download(r.type)}
                >
                  {downloading === r.type ? 'Preparing…' : `${r.label} CSV`}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-ops-border">
              <tr>
                {header('name', 'Agent', 'text-left')}
                <th className="px-3 py-2 font-semibold text-right">Days</th>
                {header('distanceKm', 'Distance')}
                {header('shiftHours', 'Shift')}
                {header('visits', 'Visits')}
                {header('verificationRate', 'Verified')}
                {header('onTimeRate', 'On time')}
                <th className="px-3 py-2 font-semibold text-right">Missed</th>
                <th className="px-3 py-2 font-semibold text-right">Tasks done</th>
                {header('anomalies', 'Anomalies')}
              </tr>
            </thead>
            <tbody>
              {sortedCards.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-500 italic">
                    No agent activity in this period.
                  </td>
                </tr>
              )}
              {sortedCards.map((a) => (
                <tr key={a.agentId} className="border-b border-ops-border/50 hover:bg-ops-hover/40">
                  <td className="px-3 py-2 text-white font-semibold">{a.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{a.daysActive}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{fmt(a.distanceKm, ' km', 1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{fmt(a.shiftHours, ' h', 1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{a.visits.total}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{pct(a.verificationRate)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{pct(a.onTimeRate)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${a.visits.missed ? 'text-amber-300' : 'text-gray-500'}`}>{a.visits.missed}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {a.assignmentsCompleted}/{a.assignmentsTotal}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${a.highAnomalies ? 'text-rose-300' : a.anomalies ? 'text-amber-300' : 'text-gray-500'}`}>
                    {a.anomalies}
                    {a.highAnomalies > 0 && <span className="text-[10px]"> ({a.highAnomalies} high)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Live right now */}
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
          title="Open anomalies"
          value={kpis.openAnomalies}
          subValue="open or acknowledged"
          variant="rose"
          icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
        />
        <StatCard
          title="Low Battery (< 20%)"
          value={lowBattery}
          subValue={`${withBattery.length} agents reporting battery`}
          variant="amber"
          icon={<Gauge className="w-5 h-5 text-amber-400" />}
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
    </div>
  );
};

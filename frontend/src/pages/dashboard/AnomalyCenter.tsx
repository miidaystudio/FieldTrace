import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  RefreshCw,
  Repeat,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import type { AnomalyEvent, AnomalySeverity, AnomalyType } from '../../api/types';
import {
  ANOMALY_LABELS,
  formatMetric,
  isActiveAnomaly,
  metricLabel,
} from '../../api/adapters';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';

const SEVERITY_STYLES: Record<AnomalySeverity, string> = {
  high: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const STATUS_BADGE: Record<AnomalyEvent['status'], 'flagged' | 'idle' | 'verified' | 'stale'> = {
  open: 'flagged',
  acknowledged: 'idle',
  resolved: 'verified',
  dismissed: 'stale',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

const time = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type Decision = { anomaly: AnomalyEvent; action: 'resolved' | 'dismissed' };

export const AnomalyCenter: React.FC = () => {
  const navigate = useNavigate();
  const anomalies = useFleetStore((state) => state.anomalies);
  const loadError = useFleetStore((state) => state.anomaliesError);
  const reloadAnomalies = useFleetStore((state) => state.reloadAnomalies);
  const acknowledgeAnomaly = useFleetStore((state) => state.acknowledgeAnomaly);
  const resolveAnomaly = useFleetStore((state) => state.resolveAnomaly);
  const dismissAnomaly = useFleetStore((state) => state.dismissAnomaly);
  const setSelectedAgent = useFleetStore((state) => state.setSelectedAgent);

  const [activeTab, setActiveTab] = useState('active');
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(
    () =>
      anomalies.filter(
        (a) =>
          (typeFilter === 'all' || a.type === typeFilter) &&
          (severityFilter === 'all' || a.severity === severityFilter),
      ),
    [anomalies, typeFilter, severityFilter],
  );
  const counts = {
    active: filtered.filter(isActiveAnomaly).length,
    closed: filtered.filter((a) => !isActiveAnomaly(a)).length,
    all: filtered.length,
  };
  const visible = filtered.filter((a) =>
    activeTab === 'active' ? isActiveAnomaly(a) : activeTab === 'closed' ? !isActiveAnomaly(a) : true,
  );
  const activeHigh = anomalies.filter((a) => isActiveAnomaly(a) && a.severity === 'high').length;

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmDecision = async () => {
    if (!decision) return;
    const { anomaly, action } = decision;
    const ok = await run(anomaly.id, () =>
      action === 'resolved' ? resolveAnomaly(anomaly.id, note) : dismissAnomaly(anomaly.id, note),
    );
    if (ok) {
      setDecision(null);
      setNote('');
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await reloadAnomalies();
    setRefreshing(false);
  };

  const tabs = [
    { id: 'active', label: 'Needs attention', count: counts.active },
    { id: 'closed', label: 'Resolved / dismissed', count: counts.closed },
    { id: 'all', label: 'All recent', count: counts.all },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-rose-400" />
            <span>Anomaly Center</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Explainable rules flag implausible speed, GPS jumps, mock locations, signal gaps, long
            stops away from client sites, visit problems and off-hours tracking. Each item shows the
            numbers behind it — a signal to review, not proof of misconduct.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeHigh > 0 && (
            <div className="flex items-center gap-2 font-mono text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>{activeHigh} HIGH SEVERITY ACTIVE</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {(loadError || actionError) && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-xl px-4 py-2">
          {actionError ?? `Could not load anomalies: ${loadError}`}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AnomalyType | 'all')}
          className="bg-[#161920] border border-white/[0.08] rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-white/30"
        >
          <option value="all" className="bg-[#161920] text-white">All types</option>
          {(Object.keys(ANOMALY_LABELS) as AnomalyType[]).map((type) => (
            <option key={type} value={type} className="bg-[#161920] text-white">
              {ANOMALY_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AnomalySeverity | 'all')}
          className="bg-[#161920] border border-white/[0.08] rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-white/30"
        >
          <option value="all" className="bg-[#161920] text-white">All severities</option>
          <option value="high" className="bg-[#161920] text-white">High</option>
          <option value="medium" className="bg-[#161920] text-white">Medium</option>
          <option value="low" className="bg-[#161920] text-white">Low</option>
        </select>
        <span className="text-[#8E96A4]">Showing the 100 most recent anomalies in your scope.</span>
      </div>

      <div className="mb-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Incidents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-[#8E96A4] italic bg-[#161920] border border-white/[0.05] rounded-3xl">
            {activeTab === 'active'
              ? 'Nothing needs attention right now.'
              : 'No anomalies match these filters.'}
          </div>
        ) : (
          visible.map((item) => {
            const active = isActiveAnomaly(item);
            const busy = busyId === item.id;
            return (
              <div
                key={item.id}
                className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${
                  item.status === 'open'
                    ? 'bg-[#161920] border-rose-500/50 shadow-lg shadow-rose-950/20'
                    : active
                      ? 'bg-[#161920] border-amber-500/40'
                      : 'bg-[#161920]/80 border-white/[0.05] opacity-80'
                }`}
              >
                <div>
                  {/* Header row */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.05] gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-2.5 text-left"
                      onClick={() => {
                        setSelectedAgent(item.agentId);
                        navigate('/dashboard/live');
                      }}
                      title="Show on the live map"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1D212B] border border-white/20 flex items-center justify-center text-[11px] font-bold text-white">
                        {initials(item.agentName)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs leading-none">{item.agentName}</div>
                        <div className="text-[10px] text-[#8E96A4] font-mono mt-0.5">
                          Last seen {time(item.timestamp)}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-[10px] font-mono uppercase bg-white/[0.06] text-white px-2 py-0.5 rounded-full border border-white/[0.08]">
                        {ANOMALY_LABELS[item.type]}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[item.severity]}`}
                      >
                        {item.severity}
                      </span>
                      <Badge variant={STATUS_BADGE[item.status]}>{item.status}</Badge>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-3">{item.description}</h3>

                  {/* Explanation */}
                  <div className="mt-3 p-3.5 bg-[#12151C] rounded-2xl border border-white/[0.05] text-xs space-y-1">
                    <div className="text-[10px] font-mono text-white font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-white" />
                      <span>WHY THIS WAS FLAGGED</span>
                    </div>
                    <p className="text-[#8E96A4] leading-relaxed text-[11px]">{item.explanation}</p>
                  </div>

                  {/* Metrics */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                    {Object.entries(item.metricDetails).map(([key, value]) => (
                      <div key={key} className="p-2.5 bg-[#1D212B] rounded-2xl border border-white/[0.05]">
                        <div className="text-[#8E96A4] text-[9px] uppercase tracking-wider">{metricLabel(key)}</div>
                        <div className="text-white font-bold text-[11px] mt-0.5 break-words">{formatMetric(value)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> First seen {time(item.firstSeenAt)}
                    </span>
                    {item.occurrences > 1 && (
                      <span className="flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Seen {item.occurrences}×
                      </span>
                    )}
                    {item.lat !== null && item.lng !== null && (
                      <a
                        className="flex items-center gap-1 hover:text-brand-teal"
                        href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="w-3 h-3" /> {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                      </a>
                    )}
                    {item.acknowledgedBy && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Acknowledged by {item.acknowledgedBy}
                      </span>
                    )}
                  </div>

                  {item.status === 'resolved' || item.status === 'dismissed' ? (
                    <div
                      className={`mt-3 text-[11px] font-mono p-2.5 rounded-xl border ${
                        item.status === 'resolved'
                          ? 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30'
                          : 'text-[#8E96A4] bg-[#1D212B] border-white/[0.05]'
                      }`}
                    >
                      {item.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                      {item.resolvedBy ? ` by ${item.resolvedBy}` : ''}
                      {item.actionTaken ? `: ${item.actionTaken}` : ''}
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                {active && (
                  <div className="mt-4 pt-3 border-t border-white/[0.05] flex flex-wrap items-center justify-end gap-2">
                    {item.visitId && (
                      <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/visits')}>
                        Open visits
                      </Button>
                    )}
                    {item.status === 'open' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => void run(item.id, () => acknowledgeAnomaly(item.id))}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                      onClick={() => setDecision({ anomaly: item, action: 'dismissed' })}
                    >
                      Dismiss
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={() => setDecision({ anomaly: item, action: 'resolved' })}
                    >
                      Resolve
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Resolve / dismiss modal */}
      <Modal
        isOpen={decision !== null}
        onClose={() => setDecision(null)}
        title={decision?.action === 'resolved' ? 'Resolve anomaly' : 'Dismiss as false positive'}
        subtitle={
          decision ? `${decision.anomaly.agentName} • ${ANOMALY_LABELS[decision.anomaly.type]}` : undefined
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={
                busyId !== null || (decision?.action === 'resolved' && note.trim().length === 0)
              }
              onClick={() => void confirmDecision()}
            >
              {decision?.action === 'resolved' ? 'Resolve' : 'Dismiss'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-300">{decision?.anomaly.explanation}</p>
          <div>
            <label className="block text-[#8E96A4] font-semibold mb-1">
              {decision?.action === 'resolved'
                ? 'What was found / action taken (required)'
                : 'Why is this a false positive? (optional)'}
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder={
                decision?.action === 'resolved'
                  ? 'e.g. Called the agent: phone had a GPS test app installed; removed.'
                  : 'e.g. Known tunnel on this route; signal loss expected.'
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#1D212B] border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-white/30"
            />
          </div>
          {actionError && (
            <p className="text-rose-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {actionError}
            </p>
          )}
          <p className="text-gray-500">This decision is recorded in the audit log.</p>
        </div>
      </Modal>
    </div>
  );
};

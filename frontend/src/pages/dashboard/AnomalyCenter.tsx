import React, { useState } from 'react';
import { PhaseNotice } from '../../components/common/PhaseNotice';
import { useFleetStore } from '../../store/useFleetStore';
import { AnomalyEvent, AnomalySeverity } from '../../api/types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import {
  AlertTriangle,
  Zap,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Sparkles,
  ArrowRight,
  Info,
  Phone,
} from 'lucide-react';

export const AnomalyCenter: React.FC = () => {
  const anomalies = useFleetStore((state) => state.anomalies);
  const resolveAnomaly = useFleetStore((state) => state.resolveAnomaly);
  const dismissAnomaly = useFleetStore((state) => state.dismissAnomaly);

  const [activeTab, setActiveTab] = useState('open');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyEvent | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const filteredAnomalies = anomalies.filter((a) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'open') return a.status === 'open' || a.status === 'investigating';
    if (activeTab === 'resolved') return a.status === 'resolved' || a.status === 'dismissed';
    return true;
  });

  const counts = {
    all: anomalies.length,
    open: anomalies.filter((a) => a.status === 'open' || a.status === 'investigating').length,
    resolved: anomalies.filter((a) => a.status === 'resolved' || a.status === 'dismissed').length,
  };

  const tabs = [
    { id: 'open', label: 'Active Incidents Requiring Triage', count: counts.open },
    { id: 'resolved', label: 'Resolved / Verified Exceptions', count: counts.resolved },
    { id: 'all', label: 'Complete Anomaly Log', count: counts.all },
  ];

  const handleResolve = () => {
    if (selectedAnomaly) {
      resolveAnomaly(selectedAnomaly.id, resolutionNote || 'Verified as legitimate emergency detour.');
      setSelectedAnomaly(null);
      setResolutionNote('');
    }
  };

  const handleDismiss = () => {
    if (selectedAnomaly) {
      dismissAnomaly(selectedAnomaly.id);
      setSelectedAnomaly(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <PhaseNotice phase={4} feature="GPS anomaly detection">
        Explainable rules (impossible speed, GPS jumps, mock-location signals) are built in Phase 4. Mock-location flags reported by devices already mark agents as "flagged" on the live map.
      </PhaseNotice>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-rose-400" />
            <span>Explainable AI Anomaly Detection & Incident Hub</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Kinematic fraud detection, GPS mock location signatures, and automated safety rule enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 px-3 py-1.5 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{counts.open} ACTIONABLE THREATS ACTIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAnomalies.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-gray-500 italic bg-ops-panel border border-ops-border rounded-xl">
            No incidents found for the active filter.
          </div>
        ) : (
          filteredAnomalies.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                item.status === 'open'
                  ? 'bg-ops-panel border-rose-500/50 shadow-lg shadow-rose-950/20'
                  : 'bg-ops-panel/60 border-ops-border opacity-75'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-3 border-b border-ops-border/60">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={item.agentAvatar}
                      alt={item.agentName}
                      className="w-8 h-8 rounded-full object-cover border border-ops-border"
                    />
                    <div>
                      <div className="font-bold text-white text-xs leading-none">{item.agentName}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/40">
                      {item.type.replace('_', ' ')}
                    </span>
                    <Badge variant={item.status === 'open' ? 'flagged' : item.status === 'resolved' ? 'verified' : 'stale'}>
                      {item.status}
                    </Badge>
                  </div>
                </div>

                {/* Threat Description */}
                <h3 className="text-sm font-bold text-white mt-3">{item.description}</h3>

                {/* Explainable AI Rationale */}
                <div className="mt-2 p-3 bg-ops-base/80 rounded-xl border border-ops-border text-xs space-y-1">
                  <div className="text-[10px] font-mono text-brand-teal font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-brand-teal" />
                    <span>EXPLAINABLE AI REASONING</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed text-[11px]">{item.explanation}</p>
                </div>

                {/* Metrics Breakdown */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                  {Object.entries(item.metricDetails).map(([k, v]) => (
                    <div key={k} className="p-2 bg-ops-card rounded-lg border border-ops-border">
                      <div className="text-gray-400 text-[9px] uppercase tracking-wider">{k}</div>
                      <div className="text-white font-bold text-[11px] mt-0.5">{String(v)}</div>
                    </div>
                  ))}
                </div>

                {item.actionTaken && (
                  <div className="mt-3 text-[11px] text-emerald-400 font-mono bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/30">
                    Resolution: {item.actionTaken}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              {item.status === 'open' && (
                <div className="mt-4 pt-3 border-t border-ops-border flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-mono">Severity: {item.severity.toUpperCase()}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss()}
                    >
                      Dismiss
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setSelectedAnomaly(item)}
                    >
                      Investigate & Resolve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Incident Resolution Modal */}
      <Modal
        isOpen={!!selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        title="Resolve Anomaly Incident"
        subtitle={`Agent: ${selectedAnomaly?.agentName} • Type: ${selectedAnomaly?.type}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAnomaly(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleResolve}>
              Confirm Resolution Sign-off
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-300">{selectedAnomaly?.explanation}</p>
          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              Resolution Reason / Dispatch Action Taken
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Driver contacted via radio; cleared detours due to burst water main."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full bg-ops-card border border-ops-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-teal"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

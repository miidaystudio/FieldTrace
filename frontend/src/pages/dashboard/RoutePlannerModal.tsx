import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { AlertTriangle, Route as RouteIcon, Save, Sparkles } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { routesApi, type AssignmentDto, type PlanRouteRequest, type RoutePlanDto } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { FormError, inputClass } from '../auth/LoginPage';

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const minutes = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min` : `${Math.round(sec / 60)} min`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const FitBounds: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0]!, 14);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
  }, [points, map]);
  return null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  /** All assignments of the date (the planner picks each agent's open ones). */
  assignments: AssignmentDto[];
  onSaved: () => void;
}

/** Pick an agent, preview the optimized order on a map, then save it as the agent's route. */
export const RoutePlannerModal: React.FC<Props> = ({ isOpen, onClose, date, assignments, onSaved }) => {
  const openByAgent = useMemo(() => {
    const groups = new Map<string, { name: string; count: number }>();
    for (const a of assignments) {
      if (!['pending', 'overdue', 'in_progress'].includes(a.status)) continue;
      const entry = groups.get(a.agentId) ?? { name: a.agent?.name ?? 'Agent', count: 0 };
      entry.count += 1;
      groups.set(a.agentId, entry);
    }
    return [...groups.entries()].sort((x, y) => x[1].name.localeCompare(y[1].name));
  }, [assignments]);

  const [agentId, setAgentId] = useState('');
  const [start, setStart] = useState<'current' | 'first_stop'>('current');
  const [serviceMin, setServiceMin] = useState(10);
  const [returnToStart, setReturnToStart] = useState(false);
  const [plan, setPlan] = useState<RoutePlanDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen && !agentId && openByAgent[0]) setAgentId(openByAgent[0][0]);
  }, [isOpen, agentId, openByAgent]);
  useEffect(() => setPlan(null), [agentId, start, serviceMin, returnToStart]);

  const request = (): PlanRouteRequest => ({ agentId, date, start: { type: start }, serviceMin, returnToStart });

  const run = async (save: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = save ? await routesApi.save(request()) : await routesApi.optimize(request());
      setPlan(result);
      if (save) onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const points: [number, number][] = plan
    ? [[plan.start.position.lat, plan.start.position.lng], ...plan.stops.map((s): [number, number] => [s.position.lat, s.position.lng])]
    : [];
  const line: [number, number][] = plan ? plan.geometry.map((p): [number, number] => [p.lat, p.lng]) : [];
  const saving = plan?.baseline ? plan.baseline.durationSec - plan.totals.durationSec : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Optimize route"
      subtitle={`Best visiting order for ${date} — up to 20 open assignments, respecting time windows and priority`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" size="sm" disabled={!agentId || busy} leftIcon={<Sparkles className="w-4 h-4" />} onClick={() => void run(false)}>
            Preview
          </Button>
          <Button variant="primary" size="sm" disabled={!agentId || busy} leftIcon={<Save className="w-4 h-4" />} onClick={() => void run(true)}>
            {plan?.id ? 'Saved ✓ — save again' : 'Save as agent route'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <FormError message={error} />
        {openByAgent.length === 0 ? (
          <p className="text-gray-400">No open assignments on this date.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="col-span-2 md:col-span-1">
              <span className="block text-gray-300 font-semibold mb-1">Agent</span>
              <select className={inputClass} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                {openByAgent.map(([id, { name, count }]) => (
                  <option key={id} value={id}>
                    {name} ({count} stops)
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-gray-300 font-semibold mb-1">Start from</span>
              <select className={inputClass} value={start} onChange={(e) => setStart(e.target.value as 'current' | 'first_stop')}>
                <option value="current">Agent's GPS position</option>
                <option value="first_stop">First stop</option>
              </select>
            </label>
            <label>
              <span className="block text-gray-300 font-semibold mb-1">Time per stop (min)</span>
              <input type="number" min={0} max={240} className={inputClass} value={serviceMin} onChange={(e) => setServiceMin(Number(e.target.value))} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-gray-300">
              <input type="checkbox" className="accent-teal-400 w-4 h-4" checked={returnToStart} onChange={(e) => setReturnToStart(e.target.checked)} />
              Return to start
            </label>
          </div>
        )}

        {plan && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-80 rounded-xl overflow-hidden border border-ops-border">
              <MapContainer center={points[0] ?? [12.97, 77.59]} zoom={13} className="w-full h-full" scrollWheelZoom>
                <TileLayer
                  className="map-tiles-dark"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds points={points} />
                <Polyline positions={line} pathOptions={{ color: '#2dd4bf', weight: 4, opacity: 0.8 }} />
                <CircleMarker center={points[0]!} radius={7} pathOptions={{ color: '#fff', fillColor: '#64748b', fillOpacity: 1 }}>
                  <Tooltip>Start ({plan.start.source.replace('_', ' ')})</Tooltip>
                </CircleMarker>
                {plan.stops.map((s) => (
                  <CircleMarker
                    key={s.assignmentId}
                    center={[s.position.lat, s.position.lng]}
                    radius={9}
                    pathOptions={{ color: '#fff', fillColor: s.lateSec > 0 ? '#f43f5e' : '#14b8a6', fillOpacity: 1 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -8]}>
                      {s.sequence}
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div className="p-2 rounded-lg bg-ops-card border border-ops-border">
                  <div className="text-[9px] text-gray-400 uppercase">Distance</div>
                  <div className="text-white font-bold">{km(plan.totals.distanceM)}</div>
                </div>
                <div className="p-2 rounded-lg bg-ops-card border border-ops-border">
                  <div className="text-[9px] text-gray-400 uppercase">Total time</div>
                  <div className="text-white font-bold">{minutes(plan.totals.durationSec)}</div>
                </div>
                <div className="p-2 rounded-lg bg-ops-card border border-ops-border">
                  <div className="text-[9px] text-gray-400 uppercase">Late stops</div>
                  <div className={`font-bold ${plan.totals.lateStops ? 'text-rose-300' : 'text-emerald-400'}`}>{plan.totals.lateStops}</div>
                </div>
              </div>
              {plan.baseline && saving > 60 && (
                <p className="text-emerald-400 flex items-center gap-1">
                  <RouteIcon className="w-3.5 h-3.5" /> Saves {minutes(saving)} and {km(Math.max(0, plan.baseline.distanceM - plan.totals.distanceM))} versus the current order.
                </p>
              )}
              {plan.warnings.map((w) => (
                <p key={w} className="text-amber-300 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                </p>
              ))}
              <ol className="space-y-1.5 max-h-52 overflow-y-auto">
                {plan.stops.map((s) => (
                  <li key={s.assignmentId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-ops-panel border border-ops-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-brand-teal text-ops-base text-[10px] font-bold flex items-center justify-center shrink-0">{s.sequence}</span>
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{s.title ?? s.locationName ?? 'Stop'}</div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {s.locationName} · {s.priority}
                          {s.window ? ` · window ${clock(s.window.start)}–${clock(s.window.end)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className={s.lateSec > 0 ? 'text-rose-300' : 'text-white'}>ETA {clock(s.eta)}</div>
                      <div className="text-[10px] text-gray-500">
                        +{km(s.legDistanceM)}
                        {s.waitSec > 60 ? ` · wait ${minutes(s.waitSec)}` : ''}
                        {s.lateSec > 0 ? ` · late ${minutes(s.lateSec)}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

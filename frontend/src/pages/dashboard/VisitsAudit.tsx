import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Calendar, ShieldAlert, XCircle, Loader2, MapPin } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Drawer } from '../../components/common/Drawer';
import { Tabs } from '../../components/common/Tabs';
import { FleetMap } from '../../components/map/FleetMap';
import { visitsApi, type VisitDto, type VisitStatus } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { REASON_LABELS, avatarFor, fmt } from '../../api/adapters';
import { DarkFormError, darkInputClass } from '../../components/common/FormInputs';

const STATUS_VARIANT: Record<VisitStatus, 'verified' | 'moving' | 'idle' | 'flagged' | 'slate' | 'offline'> = {
  verified: 'verified',
  in_progress: 'moving',
  needs_review: 'idle',
  rejected: 'flagged',
  missed: 'offline',
  pending: 'slate',
};


const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const minutes = (sec: number | null) => (sec === null ? '—' : `${Math.round(sec / 60)} min`);

export const VisitsAudit: React.FC = () => {
  const today = useFleetStore((state) => state.today);
  const liveVisits = useFleetStore((state) => state.visits);
  const geofences = useFleetStore((state) => state.geofences);

  const [date, setDate] = useState(today);
  const [historic, setHistoric] = useState<VisitDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Today's ledger is live from the store (socket); other days are fetched on demand.
  const isToday = date === today;
  const loadHistoric = useCallback(async () => {
    if (isToday || !date) return;
    setLoading(true);
    setError(null);
    try {
      setHistoric(await visitsApi.listForDate(date));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [date, isToday]);

  useEffect(() => {
    void loadHistoric();
  }, [loadHistoric]);

  const visits = isToday ? liveVisits : historic;
  const selectedVisit = visits.find((v) => v.id === selectedId) ?? null;
  const filtered = visits.filter((v) => activeTab === 'all' || v.status === activeTab);
  const count = (status: VisitStatus) => visits.filter((v) => v.status === status).length;
  const tabs = [
    { id: 'all', label: 'All Visits', count: visits.length },
    { id: 'needs_review', label: 'Needs Review', count: count('needs_review') },
    { id: 'in_progress', label: 'On Site Now', count: count('in_progress') },
    { id: 'verified', label: 'Verified', count: count('verified') },
    { id: 'missed', label: 'Missed', count: count('missed') },
    { id: 'rejected', label: 'Rejected', count: count('rejected') },
  ];

  const handleReview = async (decision: 'verified' | 'rejected') => {
    if (!selectedVisit) return;
    if (decision === 'rejected' && !reviewNote.trim()) {
      setError('A note is required to reject a visit.');
      return;
    }
    setReviewing(true);
    setError(null);
    try {
      const updated = await visitsApi.review(selectedVisit.id, decision, reviewNote.trim());
      if (!isToday) setHistoric((rows) => rows.map((v) => (v.id === updated.id ? updated : v)));
      setReviewNote('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  const columns: Column<VisitDto>[] = [
    {
      key: 'agent',
      header: 'Agent',
      render: (item) => (
        <div className="flex items-center gap-2">
          <img src={avatarFor(item.agent?.name ?? '?')} alt="" className="w-7 h-7 rounded-full border border-ops-border" />
          <span className="text-xs text-white font-semibold">{item.agent?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Client Site',
      render: (item) => (
        <div>
          <div className="text-xs text-white font-semibold">{item.location?.name ?? '—'}</div>
          <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{item.location?.address ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'checkInAt',
      header: 'Check-in / out',
      sortable: true,
      render: (item) => (
        <div className="text-xs font-mono text-gray-300">
          {time(item.checkInAt)} → {item.isOpen ? 'on site' : time(item.checkOutAt)}
          <div className="text-[10px] text-gray-500">{minutes(item.durationSec)}</div>
        </div>
      ),
    },
    {
      key: 'arrival',
      header: 'Arrival',
      render: (item) =>
        item.arrival ? (
          <Badge variant={item.arrival.onTime ? 'verified' : 'idle'} size="sm">
            {item.arrival.onTime ? 'on time' : `late ${Math.round(item.arrival.delaySec / 60)}m`}
          </Badge>
        ) : (
          <span className="text-[10px] text-gray-500">no window</span>
        ),
    },
    {
      key: 'method',
      header: 'Method / GPS',
      render: (item) => (
        <div className="text-[11px] font-mono text-gray-300">
          {item.method === 'auto' ? 'Geofence auto' : 'Manual check-in'}
          <div className="text-[10px] text-gray-500">
            {item.signals.sampleCount} fixes • ±{fmt(item.signals.avgAccuracyM, 'm')}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={STATUS_VARIANT[item.status]} size="sm">
          {item.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  const fence = selectedVisit ? geofences.find((g) => g.id === selectedVisit.locationId) : undefined;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-white" />
            <span>Proof-of-Visit Audit Ledger</span>
          </h1>
          <p className="text-xs text-[#8E96A4] mt-1">
            Visits detected from geofence dwell or manual check-in. A GPS fix inside a geofence is evidence,
            not proof: anything doubtful lands in "Needs Review".
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#161920] hover:bg-[#1D212B] text-white border border-white/[0.08] rounded-full px-4 py-2 text-xs font-medium cursor-pointer transition-colors shadow-none">
          <Calendar className="w-3.5 h-3.5 text-[#8E96A4]" />
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white focus:outline-none font-mono text-xs cursor-pointer"
          />
        </div>
      </div>

      <DarkFormError message={error} />
      <div className="mb-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#8E96A4] p-8 bg-[#161920] border border-white/[0.05] rounded-3xl">
          <Loader2 className="w-4 h-4 animate-spin text-white" /> Loading visits…
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => {
            setSelectedId(item.id);
            setReviewNote('');
          }}
          emptyMessage="No visits for this day yet."
          searchPlaceholder="Search by agent or site..."
          searchFilter={(item, q) =>
            (item.agent?.name ?? '').toLowerCase().includes(q) || (item.location?.name ?? '').toLowerCase().includes(q)
          }
        />
      )}

      <Drawer
        isOpen={!!selectedVisit}
        onClose={() => setSelectedId(null)}
        title={selectedVisit?.location?.name ?? 'Visit'}
        subtitle={`${selectedVisit?.agent?.name ?? ''} • ${selectedVisit?.visitDate ?? ''}`}
        width="w-full md:w-[520px]"
        footer={
          selectedVisit && !selectedVisit.isOpen && selectedVisit.status !== 'missed' ? (
            <>
              <Button
                variant="danger"
                size="sm"
                disabled={reviewing}
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                onClick={() => void handleReview('rejected')}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={reviewing}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => void handleReview('verified')}
              >
                Verify
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedVisit && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[selectedVisit.status]} size="md">
                {selectedVisit.status.replace('_', ' ')}
              </Badge>
              <span className="text-gray-400 font-mono">
                {selectedVisit.method === 'auto' ? 'Geofence auto-detected' : 'Manual check-in'}
              </span>
            </div>

            {selectedVisit.reviewReasons.length > 0 && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <ShieldAlert className="w-4 h-4" /> Why this needs a human look
                </div>
                <ul className="list-disc list-inside text-amber-100/90 space-y-0.5">
                  {selectedVisit.reviewReasons.map((reason) => (
                    <li key={reason}>{REASON_LABELS[reason]}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedVisit.location && (
              <div className="h-56 rounded-xl overflow-hidden border border-ops-border">
                <FleetMap
                  key={selectedVisit.id}
                  geofences={fence ? [fence] : []}
                  activeRouteWaypoints={selectedVisit.evidence.map((e) => ({
                    lat: e.position.lat,
                    lng: e.position.lng,
                    timestamp: e.at,
                    speedKmH: 0,
                    status: e.insideGeofence ? 'moving' : 'flagged',
                  }))}
                  interactiveLayersControl={false}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                <div className="text-gray-400 text-[10px]">Check-in → out</div>
                <div className="text-white font-bold mt-0.5">
                  {time(selectedVisit.checkInAt)} → {selectedVisit.isOpen ? 'on site' : time(selectedVisit.checkOutAt)}
                </div>
              </div>
              <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                <div className="text-gray-400 text-[10px]">Time on site</div>
                <div className="text-white font-bold mt-0.5">{minutes(selectedVisit.durationSec)}</div>
              </div>
              <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                <div className="text-gray-400 text-[10px]">GPS fixes inside / avg accuracy</div>
                <div className="text-white font-bold mt-0.5">
                  {selectedVisit.signals.sampleCount} / ±{fmt(selectedVisit.signals.avgAccuracyM, 'm')}
                </div>
              </div>
              <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                <div className="text-gray-400 text-[10px]">Arrival vs window</div>
                <div className="text-white font-bold mt-0.5">
                  {selectedVisit.arrival
                    ? selectedVisit.arrival.onTime
                      ? 'On time'
                      : `Late by ${Math.round(selectedVisit.arrival.delaySec / 60)} min`
                    : 'No time window'}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider font-mono mb-2">Evidence</h4>
              {selectedVisit.evidence.length === 0 && <p className="text-gray-500">No evidence recorded.</p>}
              <div className="space-y-1.5">
                {selectedVisit.evidence.map((e, index) => (
                  <div key={index} className="p-2 bg-ops-base border border-ops-border rounded-lg flex items-center justify-between font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 text-gray-200">
                      <MapPin className={`w-3.5 h-3.5 ${e.insideGeofence ? 'text-emerald-400' : 'text-rose-400'}`} />
                      {e.type.replace('_', ' ')} • {new Date(e.at).toLocaleTimeString()}
                    </span>
                    <span className="text-gray-400">
                      {e.distanceM !== null ? `${e.distanceM}m from centre` : ''} ±{fmt(e.accuracyM, 'm')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedVisit.review && (
              <div className="p-3 bg-[#1D212B] border border-white/[0.05] rounded-xl text-white">
                Reviewed ({selectedVisit.review.decision}) at {new Date(selectedVisit.review.at).toLocaleString()}
                {selectedVisit.review.note ? ` — "${selectedVisit.review.note}"` : ''}
              </div>
            )}

            {!selectedVisit.isOpen && selectedVisit.status !== 'missed' && (
              <div>
                <label className="block text-[#8E96A4] font-semibold mb-1.5">Review note (required to reject)</label>
                <input className={darkInputClass} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="e.g. Confirmed with the client by phone" />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

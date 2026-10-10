import React, { useCallback, useEffect, useState } from 'react';
import { DriverShell } from '../../components/layout/DriverShell';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Navigation,
  CheckCircle2,
  MapPin,
  Clock,
  Calendar,
  History,
  Radio,
  Play,
  Coffee,
  LogOut,
  AlertTriangle,
  UploadCloud,
  LogIn,
  LogOut as CheckOutIcon,
  ShieldAlert,
} from 'lucide-react';
import { agentsApi, assignmentsApi, visitsApi, type AgentDto, type AssignmentDto, type VisitDto } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { REASON_LABELS, VEHICLE_LABELS, avatarFor, fmt, timeAgo, todayIn } from '../../api/adapters';
import { useAuthStore } from '../../store/useAuthStore';
import { useDriverTracking } from '../../hooks/useDriverTracking';

type DriverTab = 'my_day' | 'my_route' | 'history' | 'status';

const windowLabel = (a: AssignmentDto) =>
  a.window
    ? `${new Date(a.window.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${new Date(
        a.window.end,
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Any time today';

export const DriverPortal: React.FC = () => {
  const organization = useAuthStore((state) => state.organization);
  const logout = useAuthStore((state) => state.logout);
  const tracking = useDriverTracking();

  const [activeDriverTab, setActiveDriverTab] = useState<DriverTab>('my_day');
  const [profile, setProfile] = useState<AgentDto | null>(null);
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [visits, setVisits] = useState<VisitDto[]>([]);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayIn(organization?.timezone ?? 'UTC');

  const loadAssignments = useCallback(async () => {
    try {
      const [mine, myVisits] = await Promise.all([assignmentsApi.mine(today), visitsApi.mine(today)]);
      setAssignments(mine);
      setVisits(myVisits);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [today]);

  useEffect(() => {
    agentsApi.me().then(setProfile).catch((err) => setError(errorMessage(err)));
    void loadAssignments();
    // Visits are also opened/closed automatically from GPS dwell: refresh periodically.
    const timer = setInterval(() => void loadAssignments(), 20_000);
    return () => clearInterval(timer);
  }, [loadAssignments]);

  const ordered = [...assignments].sort((a, b) =>
    (a.window?.start ?? a.createdAt).localeCompare(b.window?.start ?? b.createdAt),
  );
  const open = ordered.filter((a) => a.status === 'in_progress' || a.status === 'pending' || a.status === 'overdue');
  const current = open.find((a) => a.status === 'in_progress') ?? open[0];
  const completed = ordered.filter((a) => a.status === 'completed');
  const openVisit = visits.find((v) => v.isOpen) ?? null;
  const fix = tracking.lastFix;

  const checkIn = async (assignment: AssignmentDto) => {
    if (!fix) return;
    setActing(true);
    setError(null);
    try {
      await visitsApi.checkIn({
        assignmentId: assignment.id,
        position: { lat: fix.lat, lng: fix.lng },
        accuracyM: fix.accuracyM,
      });
      await loadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const checkOut = async (visit: VisitDto) => {
    if (!fix) return;
    setActing(true);
    setError(null);
    try {
      await tracking.flush(); // make sure the last fixes inside are counted as evidence
      await visitsApi.checkOut(visit.id, { position: { lat: fix.lat, lng: fix.lng }, accuracyM: fix.accuracyM });
      await loadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const shiftLabel = !tracking.onShift
    ? '○ OFF DUTY'
    : tracking.session?.shiftStatus === 'on_break'
      ? '◐ ON BREAK'
      : '● ON SHIFT';

  return (
    <DriverShell>
      <div className="flex-1 flex flex-col p-4 space-y-4 text-gray-100 pb-20">
        {/* Driver Profile & Shift Status Header */}
        <div className="p-3.5 bg-ops-panel rounded-2xl border border-ops-border flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full border-2 border-brand-teal overflow-hidden bg-ops-card shrink-0">
              <img src={avatarFor(profile?.name ?? '?')} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white leading-tight">{profile?.name ?? '…'}</h2>
              <p className="text-[10px] text-gray-400 font-mono">
                {profile
                  ? [profile.employeeCode, VEHICLE_LABELS[profile.vehicle.type], profile.vehicle.plate].filter(Boolean).join(' • ')
                  : ''}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border font-mono ${
              tracking.onShift
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-ops-card text-gray-400 border-ops-border'
            }`}
          >
            {shiftLabel}
          </span>
        </div>

        {(error || tracking.error || tracking.gpsError) && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error ?? tracking.error ?? `GPS: ${tracking.gpsError}`}</span>
          </div>
        )}

        {/* Shift controls */}
        {tracking.loading ? (
          <div className="text-xs text-gray-400">Checking shift…</div>
        ) : !tracking.onShift ? (
          <Button
            variant="primary"
            size="md"
            className="w-full font-bold"
            disabled={tracking.busy}
            leftIcon={<Play className="w-4 h-4" />}
            onClick={() => void tracking.startShift()}
          >
            Start Shift & Share Location
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={tracking.busy}
              leftIcon={<Coffee className="w-4 h-4" />}
              onClick={() => void tracking.setBreak(tracking.session?.shiftStatus !== 'on_break')}
            >
              {tracking.session?.shiftStatus === 'on_break' ? 'End Break' : 'Take Break'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={tracking.busy}
              onClick={() => {
                if (window.confirm('End your shift? Location sharing will stop.')) void tracking.endShift();
              }}
            >
              End Shift
            </Button>
          </div>
        )}

        {/* Tab Content */}
        {activeDriverTab === 'my_day' && (
          <div className="space-y-4 animate-in fade-in">
            {current ? (
              <div className="p-4 bg-gradient-to-br from-ops-panel via-ops-panel to-teal-950/30 rounded-2xl border border-brand-teal/40 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-brand-teal font-bold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 animate-pulse" />
                    {current.status === 'in_progress' ? 'IN PROGRESS' : 'NEXT STOP'}
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {completed.length} / {ordered.length} DONE
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{current.location?.name ?? 'Site'}</h3>
                  {current.title && <p className="text-xs text-gray-300 mt-0.5">{current.title}</p>}
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                    <span>{current.location?.address ?? '—'}</span>
                  </p>
                </div>
                <div className="pt-2 border-t border-ops-border/60 flex items-center justify-between text-xs font-mono text-gray-400">
                  <span>Window: {windowLabel(current)}</span>
                  <span className="text-brand-teal capitalize">{current.priority}</span>
                </div>
                {openVisit ? (
                  <>
                    <p className="text-[11px] font-mono text-emerald-300">
                      On site at {openVisit.location?.name ?? 'site'} since{' '}
                      {openVisit.checkInAt ? new Date(openVisit.checkInAt).toLocaleTimeString() : '—'}
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full font-bold"
                      disabled={acting || !fix}
                      leftIcon={<CheckOutIcon className="w-4 h-4" />}
                      onClick={() => void checkOut(openVisit)}
                    >
                      Check Out
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full font-bold"
                    disabled={acting || !fix || !tracking.onShift}
                    leftIcon={<LogIn className="w-4 h-4" />}
                    onClick={() => void checkIn(current)}
                  >
                    Check In Here
                  </Button>
                )}
                {(!fix || !tracking.onShift) && (
                  <p className="text-[10px] text-amber-300 font-mono">
                    Start your shift and allow location access to check in.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-ops-panel rounded-2xl border border-ops-border text-xs text-gray-400">
                {ordered.length === 0 ? 'No assignments for today.' : 'All of today’s assignments are done. 🎉'}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
                <span className="text-gray-400 text-[10px]">GPS Accuracy</span>
                <div className="text-base font-bold text-emerald-400 mt-0.5">±{fmt(tracking.lastFix?.accuracyM, 'm')}</div>
              </div>
              <div className="p-3 bg-ops-panel border border-ops-border rounded-xl">
                <span className="text-gray-400 text-[10px]">Fixes Uploaded (shift)</span>
                <div className="text-base font-bold text-white mt-0.5">
                  {(tracking.session?.sampleCount ?? 0) + tracking.uploadedThisSession}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              Visits are also recorded automatically when you stay inside a client site for a few minutes.
            </p>
          </div>
        )}

        {activeDriverTab === 'my_route' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Today's Itinerary ({today})</div>
            {ordered.length === 0 && <p className="text-xs text-gray-500">No assignments for today.</p>}
            <div className="space-y-2.5">
              {ordered.map((assignment, idx) => {
                const isCompleted = assignment.status === 'completed';
                const isCurrent = assignment.id === current?.id;
                return (
                  <div
                    key={assignment.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-ops-card border-brand-teal ring-1 ring-brand-teal/40'
                        : isCompleted
                          ? 'bg-ops-base border-ops-border opacity-60'
                          : 'bg-ops-panel border-ops-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isCurrent
                              ? 'bg-brand-teal text-ops-base'
                              : 'bg-ops-card text-gray-400 border border-ops-border'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white leading-tight">{assignment.location?.name ?? 'Site'}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {windowLabel(assignment)} • {assignment.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeDriverTab === 'history' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Today's Visits</div>
            {visits.length === 0 && <p className="text-xs text-gray-500">No visits recorded yet today.</p>}
            {visits.map((visit) => (
              <div key={visit.id} className="p-3.5 bg-ops-panel rounded-xl border border-ops-border space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>{visit.location?.name ?? 'Site'}</span>
                  <Badge
                    variant={
                      visit.status === 'verified'
                        ? 'verified'
                        : visit.status === 'in_progress'
                          ? 'moving'
                          : visit.status === 'needs_review'
                            ? 'idle'
                            : 'flagged'
                    }
                    size="sm"
                  >
                    {visit.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-gray-400 text-[10px]">
                  {visit.checkInAt ? new Date(visit.checkInAt).toLocaleTimeString() : '—'} →{' '}
                  {visit.isOpen ? 'on site' : visit.checkOutAt ? new Date(visit.checkOutAt).toLocaleTimeString() : '—'}
                  {visit.durationSec !== null ? ` • ${Math.round(visit.durationSec / 60)} min` : ''}
                </div>
                {visit.reviewReasons.length > 0 && (
                  <div className="text-[10px] text-amber-300 flex items-start gap-1">
                    <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{visit.reviewReasons.map((reason) => REASON_LABELS[reason]).join('; ')}</span>
                  </div>
                )}
              </div>
            ))}
            {tracking.session && (
              <div className="p-3.5 bg-ops-panel rounded-xl border border-ops-border text-[11px] font-mono text-gray-400 space-y-1">
                <div>Shift started: {new Date(tracking.session.startedAt).toLocaleTimeString()}</div>
                {tracking.session.endedAt && <div>Shift ended: {new Date(tracking.session.endedAt).toLocaleTimeString()}</div>}
              </div>
            )}
          </div>
        )}

        {activeDriverTab === 'status' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Device & Telemetry Uplink</div>
            <div className="p-4 bg-ops-panel border border-ops-border rounded-xl space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">GPS Permission:</span>
                <span className={tracking.permission === 'granted' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {tracking.permission.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">Last Fix:</span>
                <span className="text-cyan-400 font-bold">
                  {tracking.lastFix
                    ? `${timeAgo(tracking.lastFix.recordedAt)} • ±${tracking.lastFix.accuracyM}m`
                    : 'none yet'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">Offline Queue:</span>
                <span className="text-brand-teal font-bold">{tracking.queueLength} pending</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-ops-border">
                <span className="text-gray-400">Last Upload:</span>
                <span className="text-white">
                  {tracking.lastUpload
                    ? `${timeAgo(tracking.lastUpload.at)} • ${tracking.lastUpload.accepted} ok / ${tracking.lastUpload.duplicates} dup / ${tracking.lastUpload.rejected} rej`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Clock Skew vs Server:</span>
                <span className="text-white">{tracking.lastUpload ? `${Math.round(tracking.lastUpload.serverSkewMs / 1000)}s` : '—'}</span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!tracking.onShift || tracking.queueLength === 0}
              leftIcon={<UploadCloud className="w-4 h-4" />}
              onClick={() => void tracking.flush()}
            >
              Upload Queued Fixes Now
            </Button>
            <p className="text-[11px] text-gray-500">
              Keep this app open while on shift: browsers pause GPS in the background, and the operations team will
              then see you as stale/offline.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={() => void logout()}
            >
              Sign Out
            </Button>
          </div>
        )}
      </div>

      {/* Bottom PWA Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-ops-panel/95 backdrop-blur-xl border-t border-ops-border p-2 grid grid-cols-4 gap-1 text-[10px] font-mono z-40">
        {(
          [
            ['my_day', 'My Day', Calendar],
            ['my_route', 'Route', Navigation],
            ['history', 'History', History],
            ['status', 'Status', Radio],
          ] as const
        ).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveDriverTab(tab)}
            className={`flex flex-col items-center gap-1 py-1 rounded-lg transition-colors ${
              activeDriverTab === tab ? 'text-brand-teal font-bold' : 'text-gray-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </DriverShell>
  );
};

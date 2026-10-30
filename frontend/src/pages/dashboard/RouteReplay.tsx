import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFleetStore } from '../../store/useFleetStore';
import { FleetMap } from '../../components/map/FleetMap';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Play, Pause, RotateCcw, Clock, Calendar, CheckCircle2, Loader2, CircleDashed } from 'lucide-react';
import { assignmentsApi, fleetApi, routeAnalysisApi, type RouteAnalysisDto } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { toRouteStops, toWaypoints } from '../../api/adapters';
import type { Agent, RouteStop, RouteWaypoint } from '../../api/types';
import { DarkFormError } from '../../components/common/FormInputs';

const timeLabel = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString() : '—');

export const RouteReplay: React.FC = () => {
  const agents = useFleetStore((state) => state.agents);
  const geofences = useFleetStore((state) => state.geofences);
  const today = useFleetStore((state) => state.today);
  const [params, setParams] = useSearchParams();

  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));
  const selectedAgentId = params.get('agent') || sortedAgents[0]?.id || '';
  const [selectedDate, setSelectedDate] = useState(today);

  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [analysis, setAnalysis] = useState<RouteAnalysisDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scrub Index (0 to waypoints.length - 1)
  const [scrubIndex, setScrubIndex] = useState(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Load the agent's GPS history and that day's assignments (planned stops).
  useEffect(() => {
    if (!selectedAgentId || !selectedDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsPlayingReplay(false);
    setScrubIndex(0);
    const from = new Date(`${selectedDate}T00:00:00`);
    const end = new Date(from.getTime() + 24 * 3_600_000 - 1);
    const to = end > new Date() ? new Date() : end;
    Promise.all([
      from < to ? fleetApi.track(selectedAgentId, from.toISOString(), to.toISOString()) : null,
      assignmentsApi.listForDate(selectedDate),
      from < to ? routeAnalysisApi.get(selectedAgentId, from.toISOString(), to.toISOString()) : null,
    ])
      .then(([track, assignments, routeAnalysis]) => {
        if (cancelled) return;
        setAnalysis(routeAnalysis);
        setWaypoints(track ? toWaypoints(track.points) : []);
        setDistanceM(track?.distanceM ?? 0);
        setStops(toRouteStops(assignments.filter((a) => a.agentId === selectedAgentId)));
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId, selectedDate]);

  const currentWaypoint = waypoints[scrubIndex] ?? waypoints[0];

  // Playback timer loop
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isPlayingReplay) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const intervalMs = Math.max(40, Math.floor(1000 / playbackSpeed));
    timerRef.current = setInterval(() => {
      setScrubIndex((prev) => {
        if (prev >= waypoints.length - 1) {
          setIsPlayingReplay(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlayingReplay, playbackSpeed, waypoints.length]);

  const agent = agents.find((a) => a.id === selectedAgentId);
  const scrubAgent: Agent | null =
    agent && currentWaypoint
      ? {
          ...agent,
          hasPosition: true,
          currentLat: currentWaypoint.lat,
          currentLng: currentWaypoint.lng,
          speedKmH: currentWaypoint.speedKmH,
          bearing: currentWaypoint.telemetry?.heading ?? agent.bearing,
          status: currentWaypoint.status,
        }
      : null;

  const progressPercent = waypoints.length > 1 ? Math.round((scrubIndex / (waypoints.length - 1)) * 100) : 0;
  const durationMinutes =
    waypoints.length > 1
      ? Math.round((Date.parse(waypoints[waypoints.length - 1]!.timestamp) - Date.parse(waypoints[0]!.timestamp)) / 60_000)
      : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-teal" />
            <span>Historical Route Playback & Telemetry Scrubber</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Replay the recorded GPS trail of an agent for a day, with the assignments planned for that day.
          </p>
        </div>

        {/* Agent & Date Selectors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#161920] border border-white/[0.08] rounded-full px-4 py-2 text-xs text-white">
            <Calendar className="w-4 h-4 text-[#8E96A4]" />
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-mono"
            />
          </div>
          <select
            value={selectedAgentId}
            onChange={(e) => setParams({ agent: e.target.value })}
            className="bg-[#161920] border border-white/[0.08] rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-white/30"
          >
            {sortedAgents.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#161920] text-white">
                {a.callsign} - {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DarkFormError message={error} />

      {/* Main Map + Side Telemetry Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Column (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-ops-border shadow-2xl relative">
            <FleetMap
              key={`${selectedAgentId}-${selectedDate}-${waypoints.length}`}
              agents={scrubAgent ? [scrubAgent] : []}
              geofences={geofences}
              activeRouteWaypoints={waypoints.slice(0, scrubIndex + 1)}
              activeRouteStops={stops}
              selectedAgentId={scrubAgent?.id}
            />

            {/* Floating Replay HUD */}
            <div className="absolute top-4 left-4 z-10 bg-ops-panel/90 backdrop-blur-md border border-ops-border px-3 py-2 rounded-xl text-xs font-mono text-gray-300 shadow-xl space-y-1">
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-teal" /> Loading track…
                </div>
              ) : currentWaypoint ? (
                <>
                  <div className="text-brand-teal font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
                    PLAYBACK POSITION: {timeLabel(currentWaypoint.timestamp)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    LAT: {currentWaypoint.lat.toFixed(5)} • LNG: {currentWaypoint.lng.toFixed(5)}
                  </div>
                </>
              ) : (
                <div>No GPS points recorded for this agent on {selectedDate}.</div>
              )}
            </div>
          </div>

          {/* Interactive Scrub Timeline Controller Bar */}
          <div className="bg-ops-panel border border-ops-border rounded-2xl p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                <span>Start: {timeLabel(waypoints[0]?.timestamp)}</span>
                <span className="text-brand-teal font-bold text-sm">
                  {waypoints.length} points • {progressPercent}%
                </span>
                <span>End: {timeLabel(waypoints[waypoints.length - 1]?.timestamp)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, waypoints.length - 1)}
                value={scrubIndex}
                disabled={waypoints.length < 2}
                onChange={(e) => setScrubIndex(Number(e.target.value))}
                className="w-full accent-brand-teal h-2 bg-ops-base rounded-lg cursor-pointer appearance-none border border-ops-border"
              />
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-ops-border">
              <div className="flex items-center gap-2">
                <button
                  disabled={waypoints.length < 2}
                  onClick={() => {
                    if (scrubIndex >= waypoints.length - 1) setScrubIndex(0);
                    setIsPlayingReplay(!isPlayingReplay);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                    isPlayingReplay
                      ? 'bg-amber-500 text-ops-base hover:bg-amber-400'
                      : 'bg-brand-teal text-ops-base hover:bg-[#4dd4be] shadow-lg shadow-teal-950/40'
                  }`}
                >
                  {isPlayingReplay ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlayingReplay ? 'Pause Scrub' : 'Play Playback'}</span>
                </button>
                <button
                  onClick={() => {
                    setIsPlayingReplay(false);
                    setScrubIndex(0);
                  }}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-ops-card border border-ops-border transition-colors"
                  title="Reset to Start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Speed Multiplier Pills (points per second) */}
              <div className="flex items-center gap-1 bg-ops-base p-1 rounded-xl border border-ops-border">
                {[1, 5, 15, 30].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      playbackSpeed === spd ? 'bg-brand-teal text-ops-base shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Instantaneous Telemetry & Stop Manifest */}
        <div className="space-y-4">
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-xs uppercase tracking-wider font-mono">Instantaneous Telemetry</span>
                {currentWaypoint && (
                  <Badge variant={currentWaypoint.status} size="sm">
                    {currentWaypoint.status}
                  </Badge>
                )}
              </div>
            }
          >
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                <span className="text-[10px] text-gray-400 font-mono">Recorded Velocity</span>
                <div className="text-2xl font-bold font-mono text-brand-teal mt-0.5 flex items-baseline gap-1">
                  <span>{currentWaypoint?.speedKmH ?? '—'}</span>
                  <span className="text-xs text-gray-400 font-normal">km/h</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2.5 bg-ops-card rounded-lg border border-ops-border">
                  <div className="text-gray-400 text-[10px]">Total Distance</div>
                  <div className="text-white font-bold mt-0.5">{(distanceM / 1000).toFixed(2)} km</div>
                </div>
                <div className="p-2.5 bg-ops-card rounded-lg border border-ops-border">
                  <div className="text-gray-400 text-[10px]">Tracked Duration</div>
                  <div className="text-white font-bold mt-0.5">{durationMinutes} mins</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detected stops & gaps (backend route analysis) */}
          <Card
            header={
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-xs uppercase tracking-wider font-mono">Detected Stops & Gaps</span>
                {analysis?.outOfOrder && (
                  <Badge variant="idle" size="sm">
                    out of planned order
                  </Badge>
                )}
              </div>
            }
          >
            <div className="space-y-2 max-h-[220px] overflow-y-auto text-xs">
              {!analysis || (analysis.stops.length === 0 && analysis.gaps.length === 0) ? (
                <p className="text-gray-500 italic">No stops (≥ 3 min) or GPS gaps (&gt; 2 min) in this period.</p>
              ) : null}
              {analysis?.stops.map((stop) => (
                <div key={stop.start} className="p-2 bg-ops-card rounded-lg border border-ops-border flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{stop.locationName ?? 'Unplanned stop'}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {timeLabel(stop.start)} • {Math.round(stop.durationSec / 60)} min
                    </div>
                  </div>
                  <Badge variant={stop.kind === 'client_site' ? 'verified' : 'idle'} size="sm">
                    {stop.kind === 'client_site' ? 'site' : 'unplanned'}
                  </Badge>
                </div>
              ))}
              {analysis?.gaps.map((gap) => (
                <div key={gap.from} className="p-2 bg-ops-base rounded-lg border border-ops-border text-[10px] font-mono text-gray-400">
                  GPS gap {timeLabel(gap.from)} → {timeLabel(gap.to)} ({Math.round(gap.durationSec / 60)} min)
                </div>
              ))}
            </div>
          </Card>

          {/* Stops Manifest */}
          <Card header={<span className="font-bold text-xs uppercase tracking-wider font-mono">Planned Stops ({stops.length})</span>}>
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto text-xs">
              {stops.length === 0 && <p className="text-gray-500 italic">No assignments on this day.</p>}
              {stops.map((stop, idx) => (
                <div key={stop.id} className="p-2.5 bg-ops-card rounded-xl border border-ops-border flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-brand-teal/20 text-brand-teal border border-brand-teal/40 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{stop.siteName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {stop.actualArrival ? `Completed: ${stop.actualArrival}` : `Status: ${stop.status}`} (Sched:{' '}
                      {stop.scheduledArrival})
                    </div>
                  </div>
                  {stop.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <CircleDashed className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { mockRouteReplay } from '../../api/mockFleetData';
import { FleetMap } from '../../components/map/FleetMap';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Gauge,
  Compass,
  Clock,
  Calendar,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Share2,
} from 'lucide-react';

export const RouteReplay: React.FC = () => {
  const agents = useFleetStore((state) => state.agents);
  const geofences = useFleetStore((state) => state.geofences);

  const [selectedAgentId, setSelectedAgentId] = useState('agent-001');
  const [selectedDate, setSelectedDate] = useState('2026-10-09');
  
  // Scrub Index (0 to waypoints.length - 1)
  const [scrubIndex, setScrubIndex] = useState(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const waypoints = mockRouteReplay.waypoints;
  const stops = mockRouteReplay.stops;
  const currentWaypoint = waypoints[scrubIndex] || waypoints[0];

  // Playback timer loop
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlayingReplay) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(80, Math.floor(1000 / playbackSpeed));

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

  // Synthetic single moving agent for the map at current scrub waypoint
  const currentScrubAgent = {
    ...agents[0],
    currentLat: currentWaypoint.lat,
    currentLng: currentWaypoint.lng,
    speedKmH: currentWaypoint.speedKmH,
    status: currentWaypoint.status,
  };

  const progressPercent = Math.round((scrubIndex / (waypoints.length - 1)) * 100);

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
            Frame-accurate forensic playback of driver trajectories, speed violations, and route deviations.
          </p>
        </div>

        {/* Agent & Date Selectors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-ops-panel border border-ops-border rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-brand-teal" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-mono"
            />
          </div>

          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-ops-panel border border-ops-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-teal"
          >
            {agents.slice(0, 10).map((a) => (
              <option key={a.id} value={a.id}>
                {a.callsign} - {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Map + Side Telemetry Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Column (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-ops-border shadow-2xl relative">
            <FleetMap
              agents={[currentScrubAgent]}
              geofences={geofences}
              activeRouteWaypoints={waypoints.slice(0, scrubIndex + 1)}
              activeRouteStops={stops}
              selectedAgentId={currentScrubAgent.id}
            />

            {/* Floating Replay HUD */}
            <div className="absolute top-4 left-4 z-10 bg-ops-panel/90 backdrop-blur-md border border-ops-border px-3 py-2 rounded-xl text-xs font-mono text-gray-300 shadow-xl space-y-1">
              <div className="text-brand-teal font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
                PLAYBACK POSITION: {currentWaypoint.timestamp}
              </div>
              <div className="text-[11px] text-gray-400">
                LAT: {currentWaypoint.lat.toFixed(5)} • LNG: {currentWaypoint.lng.toFixed(5)}
              </div>
            </div>
          </div>

          {/* Interactive Scrub Timeline Controller Bar */}
          <div className="bg-ops-panel border border-ops-border rounded-2xl p-4 space-y-3">
            {/* Scrubber Range Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                <span>Start: {waypoints[0]?.timestamp}</span>
                <span className="text-brand-teal font-bold text-sm">
                  Scrubbing: {currentWaypoint.timestamp} ({progressPercent}%)
                </span>
                <span>End: {waypoints[waypoints.length - 1]?.timestamp}</span>
              </div>
              <input
                type="range"
                min={0}
                max={waypoints.length - 1}
                value={scrubIndex}
                onChange={(e) => setScrubIndex(Number(e.target.value))}
                className="w-full accent-brand-teal h-2 bg-ops-base rounded-lg cursor-pointer appearance-none border border-ops-border"
              />
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-ops-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingReplay(!isPlayingReplay)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
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

              {/* Speed Multiplier Pills */}
              <div className="flex items-center gap-1 bg-ops-base p-1 rounded-xl border border-ops-border">
                {[1, 5, 15, 30].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      playbackSpeed === spd
                        ? 'bg-brand-teal text-ops-base shadow-sm'
                        : 'text-gray-400 hover:text-white'
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
                <span className="font-bold text-xs uppercase tracking-wider font-mono">
                  Instantaneous Telemetry
                </span>
                <Badge variant={currentWaypoint.status as any} size="sm">
                  {currentWaypoint.status}
                </Badge>
              </div>
            }
          >
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-ops-base border border-ops-border rounded-xl">
                <span className="text-[10px] text-gray-400 font-mono">Recorded Velocity</span>
                <div className="text-2xl font-bold font-mono text-brand-teal mt-0.5 flex items-baseline gap-1">
                  <span>{currentWaypoint.speedKmH}</span>
                  <span className="text-xs text-gray-400 font-normal">km/h</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2.5 bg-ops-card rounded-lg border border-ops-border">
                  <div className="text-gray-400 text-[10px]">Total Distance</div>
                  <div className="text-white font-bold mt-0.5">{mockRouteReplay.totalDistanceKm} km</div>
                </div>
                <div className="p-2.5 bg-ops-card rounded-lg border border-ops-border">
                  <div className="text-gray-400 text-[10px]">Shift Duration</div>
                  <div className="text-white font-bold mt-0.5">{mockRouteReplay.durationMinutes} mins</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Stops Manifest */}
          <Card
            header={
              <span className="font-bold text-xs uppercase tracking-wider font-mono">
                Route Stops ({stops.length})
              </span>
            }
          >
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto text-xs">
              {stops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="p-2.5 bg-ops-card rounded-xl border border-ops-border flex items-start gap-2.5"
                >
                  <div className="w-5 h-5 rounded-full bg-brand-teal/20 text-brand-teal border border-brand-teal/40 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{stop.siteName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Arrival: {stop.actualArrival} (Sched: {stop.scheduledArrival})
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

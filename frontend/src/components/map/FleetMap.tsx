import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Agent, Geofence, RouteWaypoint, RouteStop } from '../../api/types';
import { AgentMarker } from './AgentMarker';
import { GeofenceLayer } from './GeofenceLayer';
import { RoutePolyline } from './RoutePolyline';
import { Layers, Maximize2, Shield, Navigation, Eye, LocateFixed } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';

interface FleetMapProps {
  agents?: Agent[];
  geofences?: Geofence[];
  selectedAgentId?: string | null;
  selectedGeofenceId?: string | null;
  onSelectAgent?: (agent: Agent) => void;
  onSelectGeofence?: (geofence: Geofence) => void;
  onInspectAgent?: (agent: Agent) => void;
  activeRouteWaypoints?: RouteWaypoint[];
  activeRouteStops?: RouteStop[];
  center?: [number, number];
  zoom?: number;
  interactiveLayersControl?: boolean;
  className?: string;
}

// Subcomponent to animate camera pan smoothly
const MapController: React.FC<{
  targetCoords?: [number, number] | null;
  zoom?: number;
}> = ({ targetCoords, zoom = 14 }) => {
  const map = useMap();

  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, zoom, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [targetCoords, zoom, map]);

  return null;
};

/** Fits the camera to the data the first time any points are available. */
const FitToData: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) map.setView(points[0]!, 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
};

export const FleetMap: React.FC<FleetMapProps> = ({
  agents = [],
  geofences = [],
  selectedAgentId,
  selectedGeofenceId,
  onSelectAgent,
  onSelectGeofence,
  onInspectAgent,
  activeRouteWaypoints,
  activeRouteStops,
  center,
  zoom = 12,
  interactiveLayersControl = true,
  className,
}) => {
  const [showGeofences, setShowGeofences] = useState(true);
  const [showAgents, setShowAgents] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [tileMode, setTileMode] = useState<'dark' | 'streets'>('dark');

  // Only agents that have reported a GPS fix can be drawn.
  const placedAgents = agents.filter((a) => a.hasPosition);
  const dataPoints: [number, number][] = [
    ...placedAgents.map((a): [number, number] => [a.currentLat, a.currentLng]),
    ...geofences.map((g) => g.center),
    ...(activeRouteWaypoints ?? []).map((w): [number, number] => [w.lat, w.lng]),
  ];
  const initialCenter: [number, number] = center ?? dataPoints[0] ?? [20.5937, 78.9629];

  // Determine focus target coordinate
  const selectedAgent = placedAgents.find((a) => a.id === selectedAgentId);
  const selectedGeo = geofences.find((g) => g.id === selectedGeofenceId);
  
  const targetFocusCoords: [number, number] | null = selectedAgent
    ? [selectedAgent.currentLat, selectedAgent.currentLng]
    : selectedGeo
    ? selectedGeo.center
    : null;

  // High-contrast CartoDB Dark Matter tiles for sleek operations map
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1x' | '2x' | '5x'>('1x');
  const handleAnomaly = useFleetStore((state) => state.handleAnomaly);

  const handleInjectAnomaly = () => {
    const targetAgent = placedAgents[0] ?? { id: 'sim-agent', name: 'Agent Marcus Chen' };
    handleAnomaly({
      id: `sim-anomaly-${Date.now()}`,
      agentId: targetAgent.id,
      agentName: targetAgent.name,
      type: 'mock_location',
      severity: 'high',
      status: 'open',
      detectedAt: new Date().toISOString(),
      explanation: 'Simulated GNSS spoofing & mock-provider alert flagged by Sentinel engine.',
      metadata: { mockProvider: 'com.incorporateapps.fakegps', speedKmH: 104 },
    } as any);
  };

  return (
    <div className={`relative w-full h-full min-h-[460px] rounded-3xl overflow-hidden bg-[#161920] border border-white/[0.05] ${className}`}>
      {/* Top Header Overlay inside map */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        {/* Real-Time Fleet Positioning Radar Title Badge */}
        <div className="pointer-events-auto bg-[#161920]/90 backdrop-blur-md border border-white/[0.08] px-4 py-2 rounded-full flex items-center gap-2.5 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide">
            Real-Time Fleet Positioning Radar
          </span>
        </div>

        {/* Top-Right Pill Toggles */}
        {interactiveLayersControl && (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setShowAgents(!showAgents)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all border ${
                showAgents
                  ? 'bg-white text-black border-white shadow-sm font-semibold'
                  : 'bg-[#202530] text-white border-white/[0.05] hover:bg-[#282F3E]'
              }`}
            >
              Agents ({placedAgents.length})
            </button>
            <button
              onClick={() => setShowGeofences(!showGeofences)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all border ${
                showGeofences
                  ? 'bg-white text-black border-white shadow-sm font-semibold'
                  : 'bg-[#202530] text-white border-white/[0.05] hover:bg-[#282F3E]'
              }`}
            >
              Zones ({geofences.length})
            </button>
            <button
              onClick={() => setTileMode(tileMode === 'dark' ? 'streets' : 'dark')}
              className="w-8 h-8 rounded-full bg-[#202530] border border-white/[0.05] text-[#8E96A4] hover:text-white flex items-center justify-center transition-colors"
              title="Toggle Tile Provider"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <MapContainer
        center={initialCenter}
        zoom={center || dataPoints.length > 0 ? zoom : 5}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          key={tileMode}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url={tileMode === 'dark' ? tileUrl : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
          maxZoom={19}
        />

        {!center && <FitToData points={dataPoints} />}

        {/* Dynamic camera pan */}
        <MapController targetCoords={targetFocusCoords} zoom={selectedAgent ? 15 : zoom} />

        {/* Geofence Layer */}
        {showGeofences && (
          <GeofenceLayer
            geofences={geofences}
            selectedGeofenceId={selectedGeofenceId}
            onSelectGeofence={onSelectGeofence}
          />
        )}

        {/* Route Polyline Layer */}
        {showRoutes && activeRouteWaypoints && (
          <RoutePolyline
            waypoints={activeRouteWaypoints}
            stops={activeRouteStops}
          />
        )}

        {/* Agent Markers Layer */}
        {showAgents &&
          placedAgents.map((agent) => (
            <AgentMarker
              key={agent.id}
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onClick={onSelectAgent}
              onInspect={onInspectAgent}
            />
          ))}
      </MapContainer>

      {/* Floating Playback Scrubber at Bottom */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[#12151D]/90 backdrop-blur-md border border-white/[0.08] px-5 py-2.5 rounded-full flex items-center gap-4 shadow-2xl">
          {/* Flat Play/Pause Icon Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-slate-200 transition-colors shadow-sm"
            title={isPlaying ? 'Pause telemetry stream' : 'Resume telemetry stream'}
          >
            {isPlaying ? (
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-2.5 bg-black rounded-xs" />
                <span className="w-1 h-2.5 bg-black rounded-xs" />
              </span>
            ) : (
              <span className="border-y-[4px] border-y-transparent border-l-[7px] border-l-black ml-0.5" />
            )}
          </button>

          {/* Pill Speed Selectors */}
          <div className="flex items-center bg-white/[0.05] p-0.5 rounded-full border border-white/[0.05]">
            {(['1x', '2x', '5x'] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${
                  playbackSpeed === spd
                    ? 'bg-white text-black font-semibold shadow-xs'
                    : 'text-[#8E96A4] hover:text-white'
                }`}
              >
                {spd}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/[0.08]" />

          {/* Clean Flat Inject Anomaly Button */}
          <button
            onClick={handleInjectAnomaly}
            className="bg-[#E11D48] text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-rose-600 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>Inject Anomaly</span>
          </button>
        </div>
      </div>
    </div>
  );
};

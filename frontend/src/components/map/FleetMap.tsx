import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Agent, Geofence, RouteWaypoint, RouteStop } from '../../api/types';
import { AgentMarker } from './AgentMarker';
import { GeofenceLayer } from './GeofenceLayer';
import { RoutePolyline } from './RoutePolyline';
import { Layers, Maximize2, Shield, Navigation, Eye, LocateFixed } from 'lucide-react';

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

  // OpenStreetMap standard tiles (no API key; attribution required). The dark look is a CSS
  // filter on the tile pane (see index.css .map-tiles-dark), so labels stay readable.
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className={`relative w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-ops-border ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={center || dataPoints.length > 0 ? zoom : 5}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          key={tileMode}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
          className={tileMode === 'dark' ? 'map-tiles-dark' : ''}
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

      {/* Floating Tactical Layer Toggles */}
      {interactiveLayersControl && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <div className="bg-[#151C28]/90 backdrop-blur-md border border-ops-border rounded-xl p-1.5 shadow-2xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setShowAgents(!showAgents)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                showAgents ? 'bg-brand-teal text-[#0B0F17] font-semibold' : 'text-gray-400 hover:text-white'
              }`}
              title="Toggle Live Agents"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Agents ({placedAgents.length})</span>
            </button>
            <button
              onClick={() => setShowGeofences(!showGeofences)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                showGeofences ? 'bg-emerald-500 text-[#0B0F17] font-semibold' : 'text-gray-400 hover:text-white'
              }`}
              title="Toggle Geofences"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Zones ({geofences.length})</span>
            </button>
            <button
              onClick={() => setTileMode(tileMode === 'dark' ? 'streets' : 'dark')}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-ops-card transition-colors"
              title="Toggle Map Style"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Live Map Watermark / Coordinates */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
        <div className="bg-ops-panel/85 backdrop-blur-md border border-ops-border px-2.5 py-1 rounded-md text-[10px] font-mono text-gray-400 shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
          <span>
            LIVE • {placedAgents.length} on map
            {agents.length > placedAgents.length ? ` • ${agents.length - placedAgents.length} without GPS fix` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

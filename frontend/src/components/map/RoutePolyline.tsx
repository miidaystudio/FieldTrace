import React from 'react';
import { Polyline, CircleMarker } from 'react-leaflet';
import { RouteStop, RouteWaypoint } from '../../api/types';

interface RoutePolylineProps {
  waypoints: RouteWaypoint[];
  stops?: RouteStop[];
  color?: string;
  glowColor?: string;
}

export const RoutePolyline: React.FC<RoutePolylineProps> = ({
  waypoints,
  stops = [],
  color = '#5EEAD4',
  glowColor = 'rgba(94, 234, 212, 0.4)',
}) => {
  if (!waypoints || waypoints.length === 0) return null;

  const positions: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lng]);

  return (
    <>
      {/* Outer Glow Line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: glowColor,
          weight: 7,
          opacity: 0.5,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      {/* Core Sharp Route Line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: 3,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      {/* Render Stop Pins */}
      {stops.map((stop) => (
        <CircleMarker
          key={stop.id}
          center={stop.coordinates}
          radius={7}
          pathOptions={{
            color: stop.status === 'completed' ? '#10B981' : stop.status === 'in_progress' ? '#5EEAD4' : '#FBBF24',
            fillColor: '#0B0F17',
            fillOpacity: 1,
            weight: 2.5,
          }}
        />
      ))}
    </>
  );
};

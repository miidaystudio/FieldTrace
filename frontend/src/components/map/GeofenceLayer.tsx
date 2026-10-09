import React from 'react';
import { Polygon, Circle, Tooltip } from 'react-leaflet';
import { Geofence } from '../../api/types';

interface GeofenceLayerProps {
  geofences: Geofence[];
  selectedGeofenceId?: string | null;
  onSelectGeofence?: (geofence: Geofence) => void;
}

export const GeofenceLayer: React.FC<GeofenceLayerProps> = ({
  geofences,
  selectedGeofenceId,
  onSelectGeofence,
}) => {
  return (
    <>
      {geofences.map((geo) => {
        const isSelected = selectedGeofenceId === geo.id;
        const baseColor = geo.color || (geo.riskLevel === 'high' ? '#F43F5E' : geo.riskLevel === 'medium' ? '#FBBF24' : '#5EEAD4');

        const pathOptions = {
          color: baseColor,
          weight: isSelected ? 3 : 1.5,
          opacity: isSelected ? 1 : 0.8,
          fillColor: baseColor,
          fillOpacity: isSelected ? 0.28 : 0.12,
          dashArray: geo.riskLevel === 'high' ? '4, 4' : undefined,
        };

        if (geo.type === 'circle') {
          return (
            <Circle
              key={geo.id}
              center={geo.center}
              radius={geo.radiusMeters || 200}
              pathOptions={pathOptions}
              eventHandlers={{
                click: () => onSelectGeofence && onSelectGeofence(geo),
              }}
            >
              <Tooltip sticky direction="top" className="geofence-custom-tooltip">
                <div className="text-xs font-mono font-semibold bg-ops-panel text-white p-1 rounded border border-ops-border shadow-lg">
                  <div className="text-brand-teal">{geo.name}</div>
                  <div className="text-[10px] text-gray-400">{geo.clientName} • {geo.activeAgentsCount} Agents active</div>
                </div>
              </Tooltip>
            </Circle>
          );
        }

        if (geo.type === 'polygon' && geo.coordinates) {
          return (
            <Polygon
              key={geo.id}
              positions={geo.coordinates}
              pathOptions={pathOptions}
              eventHandlers={{
                click: () => onSelectGeofence && onSelectGeofence(geo),
              }}
            >
              <Tooltip sticky direction="top" className="geofence-custom-tooltip">
                <div className="text-xs font-mono font-semibold bg-ops-panel text-white p-1 rounded border border-ops-border shadow-lg">
                  <div className="text-brand-teal">{geo.name}</div>
                  <div className="text-[10px] text-gray-400">{geo.clientName} • {geo.activeAgentsCount} Agents active</div>
                </div>
              </Tooltip>
            </Polygon>
          );
        }

        return null;
      })}
    </>
  );
};

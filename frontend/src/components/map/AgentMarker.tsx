import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Agent } from '../../api/types';
import { Badge } from '../common/Badge';
import { Battery, Signal, Gauge, Compass, ShieldAlert, Phone, ExternalLink } from 'lucide-react';

interface AgentMarkerProps {
  agent: Agent;
  isSelected?: boolean;
  onClick?: (agent: Agent) => void;
  onInspect?: (agent: Agent) => void;
}

export const AgentMarker: React.FC<AgentMarkerProps> = ({
  agent,
  isSelected = false,
  onClick,
  onInspect,
}) => {
  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'moving': return '#5EEAD4';
      case 'idle': return '#FBBF24';
      case 'stopped': return '#60A5FA';
      case 'flagged': return '#F43F5E';
      case 'stale': return '#94A3B8';
      case 'offline': return '#4B5563';
      default: return '#5EEAD4';
    }
  };

  const color = getStatusColor(agent.status);

  // Custom SVG icon with heading orientation and glowing radar pulse
  const customIcon = L.divIcon({
    className: 'custom-fleet-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing radar ring for moving / flagged agents -->
        ${agent.status === 'moving' || agent.status === 'flagged' ? `
          <div style="
            position: absolute;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: 2px solid ${color};
            opacity: 0.75;
            animation: pulse-glow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        ` : ''}

        <!-- Active selection glow -->
        ${isSelected ? `
          <div style="
            position: absolute;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(94, 234, 212, 0.4) 0%, transparent 70%);
            border: 2px dashed #5EEAD4;
            animation: spin 8s linear infinite;
          "></div>
        ` : ''}

        <!-- Marker Core Disk with Heading Arrow -->
        <div style="
          width: 30px;
          height: 30px;
          background: #151C28;
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px ${color}66, 0 4px 6px rgba(0,0,0,0.6);
          position: relative;
          z-index: 10;
        ">
          <!-- Direction Arrow rotated by bearing -->
          <div style="
            transform: rotate(${agent.bearing}deg);
            transition: transform 0.4s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="1">
              <polygon points="12 2 19 21 12 17 5 21 12 2" />
            </svg>
          </div>
        </div>

        <!-- Floating Speed / Callsign Tag -->
        <div style="
          position: absolute;
          bottom: -10px;
          background: #0B0F17;
          border: 1px solid ${color}88;
          color: #F3F4F6;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 4px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.8);
          z-index: 11;
        ">
          ${agent.status === 'moving' ? `${agent.speedKmH}k` : agent.callsign}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

  return (
    <Marker
      position={[agent.currentLat, agent.currentLng]}
      icon={customIcon}
      eventHandlers={{
        click: () => onClick && onClick(agent),
      }}
    >
      <Popup className="fleet-custom-popup">
        <div className="p-3.5 bg-ops-panel text-gray-100 rounded-xl w-64">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-ops-border">
            <div className="flex items-center gap-2">
              <img
                src={agent.avatar}
                alt={agent.name}
                className="w-8 h-8 rounded-full border border-ops-border object-cover"
              />
              <div>
                <h4 className="text-xs font-bold text-white leading-none">{agent.name}</h4>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{agent.callsign} • {agent.role}</p>
              </div>
            </div>
            <Badge variant={agent.status as any} size="sm">
              {agent.status}
            </Badge>
          </div>

          {/* Anomaly banner if flagged */}
          {agent.anomalyFlag && (
            <div className="mb-2 p-2 bg-rose-950/60 border border-rose-500/50 rounded-lg flex items-center gap-1.5 text-rose-300 text-[11px]">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Anomaly: {agent.anomalyFlag.replace('_', ' ').toUpperCase()}</span>
            </div>
          )}

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs py-1">
            <div className="flex items-center gap-1.5 text-gray-300">
              <Gauge className="w-3.5 h-3.5 text-brand-teal" />
              <span className="font-mono font-semibold">{agent.speedKmH} km/h</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <Compass className="w-3.5 h-3.5 text-brand-teal" />
              <span className="font-mono">{agent.bearing}° Heading</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <Battery className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono">{agent.batteryLevel}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <Signal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono">{agent.signalStrength} dBm</span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-ops-border text-[11px] text-gray-400">
            <p className="truncate"><strong className="text-gray-300">Dest:</strong> {agent.destinationName || 'En route'}</p>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <a
              href={`tel:${agent.phone}`}
              className="flex-1 flex items-center justify-center gap-1 bg-ops-card hover:bg-ops-hover text-gray-200 py-1 px-2 rounded border border-ops-border text-xs transition-colors"
            >
              <Phone className="w-3 h-3" /> Call
            </a>
            {onInspect && (
              <button
                onClick={() => onInspect(agent)}
                className="flex-1 flex items-center justify-center gap-1 bg-brand-teal hover:bg-[#4dd4be] text-ops-base font-semibold py-1 px-2 rounded text-xs transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Inspect
              </button>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

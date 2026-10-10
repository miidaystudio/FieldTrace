import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { FleetMap } from '../../components/map/FleetMap';
import { Badge } from '../../components/common/Badge';
import { Drawer } from '../../components/common/Drawer';
import { Button } from '../../components/common/Button';
import { Agent, AgentStatus } from '../../api/types';
import {
  Search,
  Filter,
  Navigation,
  Battery,
  Signal,
  Gauge,
  Compass,
  Phone,
  Radio,
  Clock,
  ShieldAlert,
  MapPin,
  Truck,
  CheckCircle2,
  Share2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fmt, fmtTime, timeAgo } from '../../api/adapters';

export const LiveFleet: React.FC = () => {
  const navigate = useNavigate();
  const agents = useFleetStore((state) => state.agents);
  const geofences = useFleetStore((state) => state.geofences);
  const selectedAgentId = useFleetStore((state) => state.selectedAgentId);
  const setSelectedAgent = useFleetStore((state) => state.setSelectedAgent);

  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  // Filtering
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.callsign.toLowerCase().includes(search.toLowerCase()) ||
      (agent.destinationName && agent.destinationName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      selectedStatusFilter === 'all' || agent.status === selectedStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: agents.length,
    moving: agents.filter((a) => a.status === 'moving').length,
    idle: agents.filter((a) => a.status === 'idle' || a.status === 'stopped').length,
    flagged: agents.filter((a) => a.status === 'flagged').length,
    offline: agents.filter((a) => a.status === 'offline' || a.status === 'stale').length,
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent.id);
  };

  const handleInspectAgent = (agent: Agent) => {
    setSelectedAgent(agent.id);
    setInspectorOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-ops-base">
      {/* Left Column: Fleet List & Dynamic Telemetry Stream */}
      <div className="w-full md:w-96 lg:w-[420px] bg-ops-panel border-r border-ops-border flex flex-col h-full shrink-0">
        {/* Filter & Search Header */}
        <div className="p-4 border-b border-ops-border bg-ops-base/40 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Navigation className="w-4 h-4 text-brand-teal" />
              <span>Live Radar Manifest</span>
            </h2>
            <span className="text-[11px] font-mono text-gray-400">
              {filteredAgents.length} visible
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search agent, callsign, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-ops-card border border-ops-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition-colors"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium no-scrollbar">
            {(['all', 'moving', 'idle', 'flagged', 'offline'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedStatusFilter === st
                    ? 'bg-brand-teal text-ops-base font-bold border-brand-teal'
                    : 'bg-ops-card text-gray-400 border-ops-border hover:text-white'
                }`}
              >
                <span className="capitalize">{st}</span>
                <span className="font-mono text-[10px] opacity-80">({statusCounts[st]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Agent Cards List */}
        <div className="flex-1 overflow-y-auto divide-y divide-ops-border/60">
          {filteredAgents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs italic">
              No field agents match the selected filter.
            </div>
          ) : (
            filteredAgents.map((agent) => {
              const isSelected = selectedAgentId === agent.id;

              return (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className={`p-3.5 transition-all cursor-pointer flex flex-col gap-2 relative ${
                    isSelected
                      ? 'bg-brand-teal/10 border-l-4 border-l-brand-teal'
                      : 'hover:bg-ops-card/80'
                  }`}
                >
                  {/* Top Row: Avatar, Name, Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-8 h-8 rounded-full border border-ops-border object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                          <span>{agent.name}</span>
                          <span className="text-[10px] font-mono text-gray-400 font-normal">
                            ({agent.callsign})
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 capitalize">{agent.role}</div>
                      </div>
                    </div>

                    <Badge variant={agent.status as any} size="sm">
                      {agent.status}
                    </Badge>
                  </div>

                  {/* Destination / ETA */}
                  <div className="text-[11px] text-gray-300 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-brand-teal shrink-0" />
                    <span className="truncate">{agent.destinationName || 'No open assignment'}</span>
                    <span className="text-[10px] font-mono text-gray-500 shrink-0 ml-auto">{timeAgo(agent.lastHeartbeat)}</span>
                    {agent.etaMinutes ? (
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0 ml-auto">
                        ETA {agent.etaMinutes}m
                      </span>
                    ) : null}
                  </div>

                  {/* Bottom Telemetry Strip */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 border-t border-ops-border/40">
                    <div className="flex items-center gap-1 text-white">
                      <Gauge className="w-3 h-3 text-brand-teal" />
                      <span>{agent.speedKmH} km/h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Compass className="w-3 h-3 text-gray-400" />
                      <span>{agent.bearing}°</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Battery className="w-3 h-3 text-amber-400" />
                      <span>{fmt(agent.batteryLevel, '%')}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspectAgent(agent);
                      }}
                      className="text-brand-teal hover:underline flex items-center gap-0.5 ml-1"
                    >
                      Inspect <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Full Interactive Leaflet Radar Map */}
      <div className="flex-1 h-full relative">
        <FleetMap
          agents={agents}
          geofences={geofences}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
          onInspectAgent={handleInspectAgent}
          className="rounded-none border-0"
        />
      </div>

      {/* Slide-out Agent Inspector Drawer */}
      <Drawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title={activeAgent?.name || 'Agent Dossier'}
        subtitle={`Callsign: ${activeAgent?.callsign} • ID: ${activeAgent?.id}`}
        width="w-full md:w-[480px]"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Phone className="w-3.5 h-3.5" />}
              disabled={!activeAgent?.phone}
              onClick={() => activeAgent?.phone && window.open(`tel:${activeAgent.phone}`)}
            >
              Direct Call
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={() => {
                setInspectorOpen(false);
                navigate(`/dashboard/replay?agent=${activeAgent?.id ?? ''}`);
              }}
            >
              Route Replay
            </Button>
          </>
        }
      >
        {activeAgent && (
          <div className="space-y-6 text-xs">
            {/* Agent Bio Header */}
            <div className="flex items-center gap-4 p-4 bg-ops-card rounded-xl border border-ops-border">
              <img
                src={activeAgent.avatar}
                alt={activeAgent.name}
                className="w-16 h-16 rounded-xl object-cover border-2 border-brand-teal"
              />
              <div className="space-y-1">
                <div className="text-base font-bold text-white">{activeAgent.name}</div>
                <div className="text-gray-400 font-mono text-[11px]">{activeAgent.phone ?? activeAgent.email ?? '—'}</div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={activeAgent.status as any} size="sm">
                    {activeAgent.status}
                  </Badge>
                  <span className="text-gray-400 font-mono text-[11px]">Type: {activeAgent.type}</span>
                </div>
              </div>
            </div>

            {/* Anomaly Callout if present */}
            {activeAgent.anomalyFlag && (
              <div className="p-4 bg-rose-950/50 border border-rose-500/60 rounded-xl space-y-1.5 text-rose-200">
                <div className="flex items-center gap-2 font-bold text-rose-400 text-xs">
                  <ShieldAlert className="w-4 h-4" />
                  <span>ACTIVE TELEMETRY ANOMALY DETECTED</span>
                </div>
                <p className="text-[11px] text-rose-300">
                  Flags: {activeAgent.anomalyFlag.replace('_', ' ').toUpperCase()}
                </p>
                <button
                  onClick={() => {
                    setInspectorOpen(false);
                    navigate('/dashboard/anomalies');
                  }}
                  className="text-xs text-white underline font-semibold mt-1 inline-block"
                >
                  Open Incident Investigation &rarr;
                </button>
              </div>
            )}

            {/* Live Kinematic Telemetry Matrix */}
            <div>
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono mb-2.5">
                Real-Time Kinematic Sensors
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400 font-mono">Velocity</span>
                  <div className="text-lg font-bold font-mono text-brand-teal mt-0.5">
                    {activeAgent.speedKmH} km/h
                  </div>
                </div>
                <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400 font-mono">Compass Heading</span>
                  <div className="text-lg font-bold font-mono text-white mt-0.5">
                    {activeAgent.bearing}° ({activeAgent.bearing < 90 ? 'NE' : activeAgent.bearing < 180 ? 'SE' : activeAgent.bearing < 270 ? 'SW' : 'NW'})
                  </div>
                </div>
                <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400 font-mono">GPS Accuracy</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    ±{fmt(activeAgent.telemetry.accuracyMeters, ' meters')}
                  </div>
                </div>
                <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400 font-mono">Shift / Connectivity</span>
                  <div className="text-lg font-bold font-mono text-white mt-0.5 capitalize">
                    {activeAgent.shiftStatus.replace('_', ' ')} · {activeAgent.connectivity}
                  </div>
                </div>
                <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400 font-mono">Battery Level</span>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                    {fmt(activeAgent.batteryLevel, '%')}
                  </div>
                </div>
                <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                  <span className="text-[10px] text-gray-400 font-mono">Last GPS Fix</span>
                  <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                    {timeAgo(activeAgent.lastHeartbeat)}
                  </div>
                </div>
              </div>
            </div>

            {/* Coordinates & Raw Telemetry Payload */}
            <div className="p-3.5 bg-ops-base border border-ops-border rounded-xl font-mono text-[11px] space-y-1 text-gray-400">
              <div className="flex justify-between">
                <span>LAT / LNG:</span>
                <span className="text-gray-200">
                  {activeAgent.hasPosition ? `${activeAgent.currentLat.toFixed(5)}, ${activeAgent.currentLng.toFixed(5)}` : 'no fix yet'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>MOTION / FLAGS:</span>
                <span className="text-gray-200">
                  {activeAgent.motion ?? '—'}
                  {activeAgent.flags.length > 0 ? ` · ${activeAgent.flags.join(', ')}` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span>HEARTBEAT:</span>
                <span className="text-brand-teal">{fmtTime(activeAgent.lastHeartbeat)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

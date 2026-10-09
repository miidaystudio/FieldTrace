import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { useLiveSocket } from '../../hooks/useLiveSocket';
import { Play, Pause, FastForward, RotateCcw, AlertTriangle, Zap, Activity, Radio } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AnomalyType } from '../../api/types';

export const SimulationController: React.FC = () => {
  const isPlaying = useFleetStore((state) => state.isPlaying);
  const speedMultiplier = useFleetStore((state) => state.speedMultiplier);
  const togglePlay = useFleetStore((state) => state.togglePlay);
  const setSpeedMultiplier = useFleetStore((state) => state.setSpeedMultiplier);
  const tickSimulation = useFleetStore((state) => state.tickSimulation);
  const resetSimulation = useFleetStore((state) => state.resetSimulation);
  const injectAnomaly = useFleetStore((state) => state.injectAnomaly);
  const agents = useFleetStore((state) => state.agents);
  const packetsPerSecond = useFleetStore((state) => state.packetsPerSecond);

  const socketStats = useLiveSocket();

  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState(agents[0]?.id || '');
  const [anomalyType, setAnomalyType] = useState<AnomalyType>('gps_spoof');

  const speeds = [1, 2, 5, 10];

  const handleInject = () => {
    if (targetAgentId) {
      injectAnomaly(targetAgentId, anomalyType);
      setIsInjectModalOpen(false);
    }
  };

  return (
    <>
      {/* Floating Simulation Control Bar */}
      <aside aria-label="Live Simulation Control Toolbar" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-ops-panel/95 backdrop-blur-xl border border-ops-borderHighlight rounded-2xl px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center gap-3 md:gap-4 text-xs">
        {/* Stream Status Indicator */}
        <div className="flex items-center gap-2 pr-3 border-r border-ops-border">
          <span className="relative flex h-2.5 w-2.5">
            {isPlaying && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-teal opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isPlaying ? 'bg-brand-teal' : 'bg-amber-400'
              }`}
            />
          </span>
          <div className="hidden sm:block">
            <div className="font-bold text-white leading-none">
              {isPlaying ? 'LIVE STREAM' : 'STREAM PAUSED'}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 text-brand-teal" />
              {socketStats.latencyMs}ms • {packetsPerSecond} pkt/s
            </div>
          </div>
        </div>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className={`p-2 rounded-xl flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
              : 'bg-brand-teal text-ops-base font-bold hover:bg-[#4dd4be] shadow-lg shadow-teal-950/50'
          }`}
          title={isPlaying ? 'Pause Telemetry Simulation' : 'Resume Telemetry Simulation'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {/* Step Forward (single tick) */}
        <button
          onClick={() => tickSimulation()}
          className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-ops-card border border-transparent hover:border-ops-border transition-colors hidden sm:flex items-center justify-center"
          title="Step Telemetry Single Tick"
        >
          <FastForward className="w-4 h-4" />
        </button>

        {/* Speed Multipliers */}
        <div className="flex items-center gap-1 bg-ops-base/60 p-1 rounded-xl border border-ops-border">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => setSpeedMultiplier(s)}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
                speedMultiplier === s
                  ? 'bg-brand-teal text-ops-base shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Inject Anomaly Trigger */}
        <button
          onClick={() => setIsInjectModalOpen(true)}
          className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-rose-950/30"
        >
          <Zap className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Inject Anomaly</span>
        </button>

        {/* Reset Simulation */}
        <button
          onClick={resetSimulation}
          className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-ops-card transition-colors"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </aside>

      {/* Anomaly Injection Modal */}
      <Modal
        isOpen={isInjectModalOpen}
        onClose={() => setIsInjectModalOpen(false)}
        title="Simulate Real-Time Telemetry Anomaly"
        subtitle="Test automated fraud detection, GPS spoofing, and speed violation triggers"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsInjectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" leftIcon={<AlertTriangle className="w-4 h-4" />} onClick={handleInject}>
              Trigger Anomaly
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1.5">Target Field Agent</label>
            <select
              value={targetAgentId}
              onChange={(e) => setTargetAgentId(e.target.value)}
              className="w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-teal"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.callsign} - {agent.name} ({agent.status}, {agent.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1.5">Anomaly Threat Profile</label>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  type: 'gps_spoof',
                  name: 'GPS Teleportation / Mock Location',
                  desc: 'Simulates instantaneous 2.6 km coordinate jump with Android mock provider flag',
                },
                {
                  type: 'speed_violation',
                  name: 'High-Speed Urban Hazard',
                  desc: 'Simulates 104 km/h surge in 40 km/h pedestrian district',
                },
                {
                  type: 'route_deviation',
                  name: 'Unauthorized Off-Corridor Detour',
                  desc: 'Simulates 3.1 km unapproved detour away from route manifest',
                },
              ].map((item) => (
                <div
                  key={item.type}
                  onClick={() => setAnomalyType(item.type as AnomalyType)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    anomalyType === item.type
                      ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/40'
                      : 'bg-ops-card border-ops-border hover:border-ops-borderHighlight'
                  }`}
                >
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{item.name}</span>
                    {anomalyType === item.type && (
                      <span className="text-[10px] bg-rose-500/30 text-rose-300 px-2 py-0.5 rounded font-mono">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

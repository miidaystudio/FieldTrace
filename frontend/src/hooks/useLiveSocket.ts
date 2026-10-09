import { useEffect, useState, useRef } from 'react';
import { useFleetStore } from '../store/useFleetStore';

export interface SocketTelemetryStats {
  status: 'connected' | 'reconnecting' | 'paused' | 'offline';
  latencyMs: number;
  packetsReceived: number;
  bytesReceived: number;
  lastPacketTimestamp: string;
}

export function useLiveSocket() {
  const isPlaying = useFleetStore((state) => state.isPlaying);
  const speedMultiplier = useFleetStore((state) => state.speedMultiplier);
  const tickSimulation = useFleetStore((state) => state.tickSimulation);

  const [stats, setStats] = useState<SocketTelemetryStats>({
    status: 'connected',
    latencyMs: 24,
    packetsReceived: 1240,
    bytesReceived: 894000,
    lastPacketTimestamp: new Date().toISOString(),
  });

  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setStats((prev) => ({ ...prev, status: 'paused' }));
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      return;
    }

    setStats((prev) => ({ ...prev, status: 'connected' }));

    // Dynamic interval based on speed: base is 1000ms / speedMultiplier
    const intervalMs = Math.max(100, Math.floor(1000 / speedMultiplier));

    tickIntervalRef.current = setInterval(() => {
      tickSimulation();
      
      setStats((prev) => ({
        ...prev,
        latencyMs: Math.floor(18 + Math.random() * 14),
        packetsReceived: prev.packetsReceived + 1,
        bytesReceived: prev.bytesReceived + Math.floor(720 + Math.random() * 200),
        lastPacketTimestamp: new Date().toISOString(),
      }));
    }, intervalMs);

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [isPlaying, speedMultiplier, tickSimulation]);

  return stats;
}

import { create } from 'zustand';
import { Agent, ProofOfVisit, Geofence, AnomalyEvent, KPIOverview, AnomalyType } from '../api/types';
import { mockAgents, mockGeofences, mockVisits, mockAnomalies, mockKPIOverview } from '../api/mockFleetData';

interface FleetState {
  agents: Agent[];
  geofences: Geofence[];
  visits: ProofOfVisit[];
  anomalies: AnomalyEvent[];
  kpis: KPIOverview;
  
  selectedAgentId: string | null;
  selectedVisitId: string | null;
  selectedGeofenceId: string | null;
  selectedAnomalyId: string | null;
  
  // Search & Filter
  statusFilter: string;
  searchQuery: string;

  // Simulation Controls
  isPlaying: boolean;
  speedMultiplier: number;
  packetsPerSecond: number;
  lastTickTimestamp: number;
  simulatedTime: Date;

  // Actions
  setSelectedAgent: (id: string | null) => void;
  setSelectedVisit: (id: string | null) => void;
  setSelectedGeofence: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setStatusFilter: (status: string) => void;
  setSearchQuery: (query: string) => void;
  
  togglePlay: () => void;
  setSpeedMultiplier: (mult: number) => void;
  tickSimulation: () => void;
  injectAnomaly: (agentId: string, anomalyType: AnomalyType) => void;
  resolveAnomaly: (anomalyId: string, resolutionNote: string) => void;
  dismissAnomaly: (anomalyId: string) => void;
  updateVisitStatus: (visitId: string, status: ProofOfVisit['status'], notes?: string) => void;
  addGeofence: (geofence: Geofence) => void;
  resetSimulation: () => void;
}

export const useFleetStore = create<FleetState>((set, get) => ({
  agents: mockAgents,
  geofences: mockGeofences,
  visits: mockVisits,
  anomalies: mockAnomalies,
  kpis: mockKPIOverview,

  selectedAgentId: mockAgents[0].id,
  selectedVisitId: null,
  selectedGeofenceId: null,
  selectedAnomalyId: null,

  statusFilter: 'all',
  searchQuery: '',

  isPlaying: true,
  speedMultiplier: 1,
  packetsPerSecond: 48,
  lastTickTimestamp: Date.now(),
  simulatedTime: new Date(),

  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  setSelectedVisit: (id) => set({ selectedVisitId: id }),
  setSelectedGeofence: (id) => set({ selectedGeofenceId: id }),
  setSelectedAnomaly: (id) => set({ selectedAnomalyId: id }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setSpeedMultiplier: (mult) => set({ speedMultiplier: mult }),

  tickSimulation: () => {
    const { agents, isPlaying, speedMultiplier } = get();
    if (!isPlaying) return;

    const delta = (speedMultiplier * 0.0003);

    const updatedAgents = agents.map((agent) => {
      if (agent.status !== 'moving') return agent;

      // Realistic drift along current heading
      const rad = (agent.bearing * Math.PI) / 180;
      let newLat = agent.currentLat + Math.cos(rad) * delta;
      let newLng = agent.currentLng + Math.sin(rad) * delta * 1.3;

      // Wrap-around bounds for SF Metro
      if (newLat > 37.83) newLat = 37.73;
      if (newLat < 37.70) newLat = 37.81;
      if (newLng > -122.36) newLng = -122.48;
      if (newLng < -122.51) newLng = -122.38;

      // Slight natural heading adjustments
      const headingJitter = (Math.random() - 0.5) * 12;
      const newBearing = (agent.bearing + headingJitter + 360) % 360;
      const speedJitter = Math.floor(Math.max(15, Math.min(65, agent.speedKmH + (Math.random() - 0.5) * 4)));

      return {
        ...agent,
        currentLat: Number(newLat.toFixed(6)),
        currentLng: Number(newLng.toFixed(6)),
        bearing: Math.round(newBearing),
        speedKmH: speedJitter,
        lastHeartbeat: new Date().toISOString(),
        telemetry: {
          ...agent.telemetry,
          speedKmH: speedJitter,
          heading: Math.round(newBearing),
          odometerKm: Number((agent.telemetry.odometerKm + (speedJitter / 3600) * speedMultiplier).toFixed(2)),
          timestamp: new Date().toISOString(),
        }
      };
    });

    set({
      agents: updatedAgents,
      lastTickTimestamp: Date.now(),
      simulatedTime: new Date(Date.now()),
      packetsPerSecond: Math.floor(45 + Math.random() * 12 * speedMultiplier),
    });
  },

  injectAnomaly: (agentId, anomalyType) => {
    const { agents, anomalies, kpis } = get();
    const targetAgent = agents.find((a) => a.id === agentId);
    if (!targetAgent) return;

    let desc = '';
    let expl = '';
    let metricDetails: Record<string, any> = {};

    switch (anomalyType) {
      case 'gps_spoof':
        desc = 'Mock Location & Coordinate Jump Detected';
        expl = `Agent jumped instantly by 2.6 km outside route bounds. Spoof provider active on device.`;
        metricDetails = { jumpDistance: '2,620m', deltaTime: '1.1s' };
        break;
      case 'speed_violation':
        desc = 'Excessive Speed Surge (104 km/h)';
        expl = `Vehicle exceeded local street speed limit by 64 km/h for > 20 seconds.`;
        metricDetails = { recordedSpeed: '104 km/h', speedLimit: '40 km/h' };
        break;
      case 'route_deviation':
        desc = 'Off-Corridor Route Breach';
        expl = `Unscheduled 3.1 km detour detected away from designated delivery stops.`;
        metricDetails = { deviatedMeters: 3100 };
        break;
      default:
        desc = 'Telemetry Telemetry Integrity Anomaly';
        expl = `Sensor signal discrepancy flagged by automated heuristics.`;
    }

    const newAnomaly: AnomalyEvent = {
      id: `anom-${Date.now().toString().slice(-4)}`,
      agentId: targetAgent.id,
      agentName: targetAgent.name,
      agentAvatar: targetAgent.avatar,
      type: anomalyType,
      severity: 'critical',
      timestamp: new Date().toISOString(),
      lat: targetAgent.currentLat,
      lng: targetAgent.currentLng,
      description: desc,
      explanation: expl,
      metricDetails,
      status: 'open',
    };

    const updatedAgents = agents.map((a) =>
      a.id === agentId ? { ...a, status: 'flagged' as const, anomalyFlag: anomalyType } : a
    );

    set({
      agents: updatedAgents,
      anomalies: [newAnomaly, ...anomalies],
      kpis: {
        ...kpis,
        flaggedCount: kpis.flaggedCount + 1,
        openAnomalies: kpis.openAnomalies + 1,
      },
    });
  },

  resolveAnomaly: (anomalyId, note) => {
    set((state) => ({
      anomalies: state.anomalies.map((a) =>
        a.id === anomalyId ? { ...a, status: 'resolved', actionTaken: note } : a
      ),
      kpis: {
        ...state.kpis,
        openAnomalies: Math.max(0, state.kpis.openAnomalies - 1),
      },
    }));
  },

  dismissAnomaly: (anomalyId) => {
    set((state) => ({
      anomalies: state.anomalies.map((a) =>
        a.id === anomalyId ? { ...a, status: 'dismissed' } : a
      ),
      kpis: {
        ...state.kpis,
        openAnomalies: Math.max(0, state.kpis.openAnomalies - 1),
      },
    }));
  },

  updateVisitStatus: (visitId, status, notes) => {
    set((state) => ({
      visits: state.visits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              status,
              notes: notes || v.notes,
              verifiedBy: 'Ops Dispatcher (Manual Review)',
            }
          : v
      ),
    }));
  },

  addGeofence: (newGeo) => {
    set((state) => ({
      geofences: [newGeo, ...state.geofences],
    }));
  },

  resetSimulation: () => {
    set({
      agents: mockAgents,
      anomalies: mockAnomalies,
      visits: mockVisits,
      kpis: mockKPIOverview,
      isPlaying: true,
      speedMultiplier: 1,
    });
  },
}));

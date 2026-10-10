import { create } from 'zustand';
import {
  agentsApi,
  assignmentsApi,
  fleetApi,
  locationsApi,
  type AgentDto,
  type AgentStatusPayload,
  type AssignmentDto,
  type LocationDto,
  type LocationUpdatePayload,
} from '../api/backend';
import { errorMessage } from '../api/client';
import {
  applyAgentStatus,
  applyLocationUpdate,
  toAgent,
  toGeofence,
  todayIn,
} from '../api/adapters';
import type { Agent, AnomalyEvent, Geofence, KPIOverview, ProofOfVisit } from '../api/types';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
export type SocketState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface FleetState {
  // ---- data (all from the backend)
  agents: Agent[];
  directory: AgentDto[];
  locations: LocationDto[];
  geofences: Geofence[];
  assignmentsToday: AssignmentDto[];
  today: string;
  /** Visit verification ships in backend Phase 3. */
  visits: ProofOfVisit[];
  /** Anomaly detection ships in backend Phase 4. */
  anomalies: AnomalyEvent[];
  kpis: KPIOverview;

  loadState: LoadState;
  loadError: string | null;
  lastSnapshotAt: string | null;

  // ---- realtime connection stats
  socketState: SocketState;
  eventsReceived: number;
  lastEventAt: number | null;
  lastLatencyMs: number | null;

  // ---- UI selection & search
  selectedAgentId: string | null;
  selectedVisitId: string | null;
  selectedGeofenceId: string | null;
  selectedAnomalyId: string | null;
  statusFilter: string;
  searchQuery: string;

  // ---- actions
  loadAll: (timeZone: string) => Promise<void>;
  refreshLive: () => Promise<void>;
  reloadLocations: () => Promise<void>;
  reloadAssignments: () => Promise<void>;
  handleLocationUpdate: (update: LocationUpdatePayload, latencyMs: number) => void;
  handleAgentStatus: (update: AgentStatusPayload) => void;
  setSocketState: (state: SocketState) => void;
  reset: () => void;

  setSelectedAgent: (id: string | null) => void;
  setSelectedVisit: (id: string | null) => void;
  setSelectedGeofence: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setStatusFilter: (status: string) => void;
  setSearchQuery: (query: string) => void;
  resolveAnomaly: (anomalyId: string, resolutionNote: string) => void;
  dismissAnomaly: (anomalyId: string) => void;
  updateVisitStatus: (visitId: string, status: ProofOfVisit['status'], notes?: string) => void;
}

function computeKpis(agents: Agent[], assignments: AssignmentDto[], anomalies: AnomalyEvent[]): KPIOverview {
  const moving = agents.filter((a) => a.status === 'moving');
  return {
    totalAgents: agents.length,
    onShiftCount: agents.filter((a) => a.shiftStatus !== 'off_shift').length,
    movingCount: moving.length,
    idleCount: agents.filter((a) => a.status === 'idle' || a.status === 'stopped').length,
    flaggedCount: agents.filter((a) => a.status === 'flagged').length,
    offlineCount: agents.filter((a) => a.status === 'offline' || a.status === 'stale').length,
    verifiedVisitsToday: null,
    pendingVisitsToday: null,
    assignmentsToday: assignments.length,
    completedAssignmentsToday: assignments.filter((a) => a.status === 'completed').length,
    openAnomalies: anomalies.filter((a) => a.status === 'open' || a.status === 'investigating').length,
    complianceScore: null,
    avgSpeedKmH: moving.length ? Math.round(moving.reduce((sum, a) => sum + a.speedKmH, 0) / moving.length) : null,
    totalDistanceKmToday: null,
  };
}

/** Current destination per agent: the in-progress assignment, else the next pending one. */
function destinations(assignments: AssignmentDto[]): Map<string, string> {
  const result = new Map<string, string>();
  const ordered = [...assignments].sort((a, b) =>
    (a.window?.start ?? a.createdAt).localeCompare(b.window?.start ?? b.createdAt),
  );
  for (const status of ['in_progress', 'pending', 'overdue'] as const) {
    for (const assignment of ordered) {
      if (assignment.status === status && assignment.location && !result.has(assignment.agentId)) {
        result.set(assignment.agentId, assignment.location.name);
      }
    }
  }
  return result;
}

const EMPTY_KPIS = computeKpis([], [], []);

const initialData = {
  agents: [] as Agent[],
  directory: [] as AgentDto[],
  locations: [] as LocationDto[],
  geofences: [] as Geofence[],
  assignmentsToday: [] as AssignmentDto[],
  today: '',
  visits: [] as ProofOfVisit[],
  anomalies: [] as AnomalyEvent[],
  kpis: EMPTY_KPIS,
  loadState: 'idle' as LoadState,
  loadError: null as string | null,
  lastSnapshotAt: null as string | null,
  socketState: 'offline' as SocketState,
  eventsReceived: 0,
  lastEventAt: null as number | null,
  lastLatencyMs: null as number | null,
};

export const useFleetStore = create<FleetState>((set, get) => {
  /** Re-derives everything that depends on agents (geofence occupancy, KPIs). */
  const withDerived = (agents: Agent[], extra: Partial<FleetState> = {}): Partial<FleetState> => {
    const state = { ...get(), ...extra };
    return {
      ...extra,
      agents,
      geofences: state.locations.map((location) => toGeofence(location, agents)),
      kpis: computeKpis(agents, state.assignmentsToday, state.anomalies),
    };
  };

  const buildAgents = async (directory: AgentDto[], assignments: AssignmentDto[]) => {
    const live = await fleetApi.live();
    const profiles = new Map(directory.map((profile) => [profile.id, profile]));
    const dest = destinations(assignments);
    return {
      agents: live.agents.map((entry) => toAgent(entry, profiles.get(entry.agentId), dest.get(entry.agentId))),
      asOf: live.asOf,
    };
  };

  return {
    ...initialData,
    selectedAgentId: null,
    selectedVisitId: null,
    selectedGeofenceId: null,
    selectedAnomalyId: null,
    statusFilter: 'all',
    searchQuery: '',

    loadAll: async (timeZone) => {
      set({ loadState: 'loading', loadError: null });
      try {
        const today = todayIn(timeZone);
        const [directory, locations, assignmentsToday] = await Promise.all([
          agentsApi.listAll(),
          locationsApi.listAll(),
          assignmentsApi.listForDate(today),
        ]);
        set({ directory, locations, assignmentsToday, today });
        const { agents, asOf } = await buildAgents(directory, assignmentsToday);
        set({ ...withDerived(agents), loadState: 'ready', lastSnapshotAt: asOf });
      } catch (error) {
        set({ loadState: 'error', loadError: errorMessage(error) });
      }
    },

    refreshLive: async () => {
      try {
        const { directory, assignmentsToday } = get();
        const { agents, asOf } = await buildAgents(directory, assignmentsToday);
        set({ ...withDerived(agents), lastSnapshotAt: asOf });
      } catch (error) {
        set({ loadError: errorMessage(error) });
      }
    },

    reloadLocations: async () => {
      const locations = await locationsApi.listAll();
      set(withDerived(get().agents, { locations }));
    },

    reloadAssignments: async () => {
      const today = get().today;
      if (!today) return;
      const assignmentsToday = await assignmentsApi.listForDate(today);
      const dest = destinations(assignmentsToday);
      const agents = get().agents.map((agent) => ({ ...agent, destinationName: dest.get(agent.id) }));
      set(withDerived(agents, { assignmentsToday }));
    },

    handleLocationUpdate: (update, latencyMs) => {
      const agents = get().agents;
      const index = agents.findIndex((agent) => agent.id === update.agentId);
      if (index === -1) {
        // New agent in scope (e.g. created after the snapshot) — fetch a fresh snapshot.
        void get().refreshLive();
        return;
      }
      const next = [...agents];
      next[index] = applyLocationUpdate(agents[index]!, update);
      set({
        ...withDerived(next),
        eventsReceived: get().eventsReceived + 1,
        lastEventAt: Date.now(),
        lastLatencyMs: latencyMs,
      });
    },

    handleAgentStatus: (update) => {
      const agents = get().agents;
      const index = agents.findIndex((agent) => agent.id === update.agentId);
      if (index === -1) {
        void get().refreshLive();
        return;
      }
      const next = [...agents];
      next[index] = applyAgentStatus(agents[index]!, update);
      set({ ...withDerived(next), eventsReceived: get().eventsReceived + 1, lastEventAt: Date.now() });
    },

    setSocketState: (socketState) => set({ socketState }),
    reset: () => set({ ...initialData, selectedAgentId: null }),

    setSelectedAgent: (id) => set({ selectedAgentId: id }),
    setSelectedVisit: (id) => set({ selectedVisitId: id }),
    setSelectedGeofence: (id) => set({ selectedGeofenceId: id }),
    setSelectedAnomaly: (id) => set({ selectedAnomalyId: id }),
    setStatusFilter: (status) => set({ statusFilter: status }),
    setSearchQuery: (query) => set({ searchQuery: query }),

    // Anomaly and visit review workflows are wired to the backend in Phases 3–4. Until then the
    // lists are empty and these only update local state.
    resolveAnomaly: (anomalyId, note) =>
      set((state) => ({
        anomalies: state.anomalies.map((a) => (a.id === anomalyId ? { ...a, status: 'resolved', actionTaken: note } : a)),
      })),
    dismissAnomaly: (anomalyId) =>
      set((state) => ({
        anomalies: state.anomalies.map((a) => (a.id === anomalyId ? { ...a, status: 'dismissed' } : a)),
      })),
    updateVisitStatus: (visitId, status, notes) =>
      set((state) => ({
        visits: state.visits.map((v) => (v.id === visitId ? { ...v, status, notes: notes || v.notes } : v)),
      })),
  };
});

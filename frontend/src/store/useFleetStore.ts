import { create } from 'zustand';
import {
  agentsApi,
  anomaliesApi,
  notificationsApi,
  type AnomalyDto,
  type NotificationDto,
  assignmentsApi,
  fleetApi,
  locationsApi,
  visitsApi,
  type AgentDto,
  type GeofenceTransitionPayload,
  type VisitDto,
  type AgentStatusPayload,
  type AssignmentDto,
  type LocationDto,
  type LocationUpdatePayload,
} from '../api/backend';
import { errorMessage } from '../api/client';
import {
  applyAgentStatus,
  applyLocationUpdate,
  isActiveAnomaly,
  toAgent,
  toAnomalyEvent,
  toGeofence,
  todayIn,
} from '../api/adapters';
import type { Agent, AnomalyEvent, Geofence, KPIOverview } from '../api/types';

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
  /** Today's visits (proof-of-visit ledger), kept live via `visit:updated`. */
  visits: VisitDto[];
  /** Most recent geofence entries/exits seen on the socket (newest first). */
  geofenceFeed: GeofenceTransitionPayload[];
  /** Most recent anomalies (all statuses, newest activity first), kept live via the socket. */
  anomalies: AnomalyEvent[];
  anomaliesError: string | null;
  /** My recent notifications (newest first) and the unread count, kept live via the socket. */
  notifications: NotificationDto[];
  unreadNotifications: number;
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
  handleVisitUpdated: (visit: VisitDto) => void;
  handleAssignmentUpdated: (assignment: AssignmentDto) => void;
  handleGeofenceTransition: (event: GeofenceTransitionPayload) => void;
  reloadVisits: () => Promise<void>;
  reloadAnomalies: () => Promise<void>;
  handleAnomaly: (anomaly: AnomalyDto) => void;
  reloadNotifications: () => Promise<void>;
  handleNotification: (notification: NotificationDto) => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  setSocketState: (state: SocketState) => void;
  reset: () => void;

  setSelectedAgent: (id: string | null) => void;
  setSelectedVisit: (id: string | null) => void;
  setSelectedGeofence: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setStatusFilter: (status: string) => void;
  setSearchQuery: (query: string) => void;
  acknowledgeAnomaly: (anomalyId: string) => Promise<void>;
  resolveAnomaly: (anomalyId: string, resolutionNote: string) => Promise<void>;
  dismissAnomaly: (anomalyId: string, note?: string) => Promise<void>;
}

function computeKpis(
  agents: Agent[],
  assignments: AssignmentDto[],
  anomalies: AnomalyEvent[],
  visits: VisitDto[],
): KPIOverview {
  const moving = agents.filter((a) => a.status === 'moving');
  return {
    totalAgents: agents.length,
    onShiftCount: agents.filter((a) => a.shiftStatus !== 'off_shift').length,
    movingCount: moving.length,
    idleCount: agents.filter((a) => a.status === 'idle' || a.status === 'stopped').length,
    flaggedCount: agents.filter((a) => a.status === 'flagged').length,
    offlineCount: agents.filter((a) => a.status === 'offline' || a.status === 'stale').length,
    verifiedVisitsToday: visits.filter((v) => v.status === 'verified').length,
    pendingVisitsToday: visits.filter((v) => v.status === 'needs_review').length,
    assignmentsToday: assignments.length,
    completedAssignmentsToday: assignments.filter((a) => a.status === 'completed').length,
    openAnomalies: anomalies.filter(isActiveAnomaly).length,
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

const EMPTY_KPIS = computeKpis([], [], [], []);

const initialData = {
  agents: [] as Agent[],
  directory: [] as AgentDto[],
  locations: [] as LocationDto[],
  geofences: [] as Geofence[],
  assignmentsToday: [] as AssignmentDto[],
  today: '',
  visits: [] as VisitDto[],
  geofenceFeed: [] as GeofenceTransitionPayload[],
  anomalies: [] as AnomalyEvent[],
  anomaliesError: null as string | null,
  notifications: [] as NotificationDto[],
  unreadNotifications: 0,
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
      kpis: computeKpis(agents, state.assignmentsToday, state.anomalies, state.visits),
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
        const [directory, locations, assignmentsToday, visits] = await Promise.all([
          agentsApi.listAll(),
          locationsApi.listAll(),
          assignmentsApi.listForDate(today),
          visitsApi.listForDate(today),
        ]);
        set({ directory, locations, assignmentsToday, visits, today });
        const { agents, asOf } = await buildAgents(directory, assignmentsToday);
        set({ ...withDerived(agents), loadState: 'ready', lastSnapshotAt: asOf });
        void get().reloadAnomalies();
        void get().reloadNotifications();
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

    reloadVisits: async () => {
      const today = get().today;
      if (!today) return;
      const visits = await visitsApi.listForDate(today);
      set(withDerived(get().agents, { visits }));
    },

    handleVisitUpdated: (visit) => {
      if (visit.visitDate !== get().today) return;
      const visits = get().visits.filter((v) => v.id !== visit.id);
      set(withDerived(get().agents, { visits: [visit, ...visits], eventsReceived: get().eventsReceived + 1 }));
    },

    handleAssignmentUpdated: (assignment) => {
      if (assignment.scheduledDate !== get().today) return;
      const others = get().assignmentsToday.filter((a) => a.id !== assignment.id);
      const assignmentsToday = [...others, assignment];
      const dest = destinations(assignmentsToday);
      const agents = get().agents.map((agent) => ({ ...agent, destinationName: dest.get(agent.id) }));
      set(withDerived(agents, { assignmentsToday, eventsReceived: get().eventsReceived + 1 }));
    },

    handleGeofenceTransition: (event) => {
      const agents = get().agents.map((agent) =>
        agent.id === event.agentId
          ? { ...agent, currentGeofenceId: event.type === 'entered' ? event.locationId : undefined }
          : agent,
      );
      set({
        ...withDerived(agents),
        geofenceFeed: [event, ...get().geofenceFeed].slice(0, 50),
        eventsReceived: get().eventsReceived + 1,
        lastEventAt: Date.now(),
      });
    },

    reloadAnomalies: async () => {
      try {
        const anomalies = (await anomaliesApi.recent(100)).map(toAnomalyEvent);
        set(withDerived(get().agents, { anomalies, anomaliesError: null }));
      } catch (error) {
        set({ anomaliesError: errorMessage(error) });
      }
    },

    handleAnomaly: (dto) => {
      const event = toAnomalyEvent(dto);
      const others = get().anomalies.filter((a) => a.id !== event.id);
      const anomalies = [event, ...others]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 200);
      set(withDerived(get().agents, { anomalies, eventsReceived: get().eventsReceived + 1 }));
    },

    reloadNotifications: async () => {
      try {
        const [notifications, unreadNotifications] = await Promise.all([
          notificationsApi.recent(30),
          notificationsApi.unreadCount(),
        ]);
        set({ notifications, unreadNotifications });
      } catch {
        // The bell simply stays empty; nothing else depends on it.
      }
    },

    handleNotification: (notification) => {
      if (get().notifications.some((n) => n.id === notification.id)) return;
      set({
        notifications: [notification, ...get().notifications].slice(0, 50),
        unreadNotifications: get().unreadNotifications + (notification.readAt ? 0 : 1),
      });
    },

    markNotificationRead: async (id) => {
      const target = get().notifications.find((n) => n.id === id);
      if (!target || target.readAt) return;
      const updated = await notificationsApi.markRead(id);
      set({
        notifications: get().notifications.map((n) => (n.id === id ? updated : n)),
        unreadNotifications: Math.max(0, get().unreadNotifications - 1),
      });
    },

    markAllNotificationsRead: async () => {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      set({
        notifications: get().notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })),
        unreadNotifications: 0,
      });
    },

    setSocketState: (socketState) => set({ socketState }),
    reset: () => set({ ...initialData, selectedAgentId: null }),

    setSelectedAgent: (id) => set({ selectedAgentId: id }),
    setSelectedVisit: (id) => set({ selectedVisitId: id }),
    setSelectedGeofence: (id) => set({ selectedGeofenceId: id }),
    setSelectedAnomaly: (id) => set({ selectedAnomalyId: id }),
    setStatusFilter: (status) => set({ statusFilter: status }),
    setSearchQuery: (query) => set({ searchQuery: query }),

    acknowledgeAnomaly: async (anomalyId) => {
      get().handleAnomaly(await anomaliesApi.setStatus(anomalyId, 'acknowledged'));
    },
    resolveAnomaly: async (anomalyId, note) => {
      get().handleAnomaly(await anomaliesApi.setStatus(anomalyId, 'resolved', note));
    },
    dismissAnomaly: async (anomalyId, note) => {
      get().handleAnomaly(await anomaliesApi.setStatus(anomalyId, 'dismissed', note));
    },
  };
});

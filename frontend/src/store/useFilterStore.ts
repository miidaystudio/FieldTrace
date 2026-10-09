import { create } from 'zustand';

interface FilterState {
  timeRange: 'today' | '7d' | '30d' | 'custom';
  severityFilter: string;
  geofenceFilter: string;
  vehicleTypeFilter: string;
  
  setTimeRange: (range: 'today' | '7d' | '30d' | 'custom') => void;
  setSeverityFilter: (sev: string) => void;
  setGeofenceFilter: (geo: string) => void;
  setVehicleTypeFilter: (type: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  timeRange: 'today',
  severityFilter: 'all',
  geofenceFilter: 'all',
  vehicleTypeFilter: 'all',

  setTimeRange: (timeRange) => set({ timeRange }),
  setSeverityFilter: (severityFilter) => set({ severityFilter }),
  setGeofenceFilter: (geofenceFilter) => set({ geofenceFilter }),
  setVehicleTypeFilter: (vehicleTypeFilter) => set({ vehicleTypeFilter }),
  resetFilters: () => set({
    timeRange: 'today',
    severityFilter: 'all',
    geofenceFilter: 'all',
    vehicleTypeFilter: 'all',
  }),
}));

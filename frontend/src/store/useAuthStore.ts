import { create } from 'zustand';

export type UserRole = 'ops_manager' | 'supervisor' | 'driver';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  assignedDriverAgentId?: string;
  facility: string;
}

interface AuthState {
  currentUser: UserProfile;
  setRole: (role: UserRole) => void;
  setDriverId: (agentId: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: {
    id: 'usr-901',
    name: 'Cmdr. Sarah Jenkins',
    email: 's.jenkins@fleetora.io',
    role: 'ops_manager',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    facility: 'SF Main Operations Hub',
    assignedDriverAgentId: 'agent-001',
  },
  setRole: (role) =>
    set((state) => ({
      currentUser: { ...state.currentUser, role },
    })),
  setDriverId: (agentId) =>
    set((state) => ({
      currentUser: { ...state.currentUser, assignedDriverAgentId: agentId },
    })),
  updateProfile: (updates) =>
    set((state) => ({
      currentUser: { ...state.currentUser, ...updates },
    })),
}));

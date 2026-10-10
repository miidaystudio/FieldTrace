import { create } from 'zustand';
import { authApi, type AuthResponse, type OrganizationDto, type Role, type UserDto } from '../api/backend';
import { onSessionChange, refreshSession, type SessionPayload } from '../api/client';
import { avatarFor } from '../api/adapters';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: UserDto | null;
  organization: OrganizationDto | null;
  /** Restores the session from the httpOnly refresh cookie (call once on app start). */
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserDto>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setOrganization: (organization: OrganizationDto) => void;
}

const fromSession = (session: SessionPayload | null) => {
  const auth = session as AuthResponse | null;
  return auth
    ? { status: 'authenticated' as const, user: auth.user, organization: auth.organization }
    : { status: 'anonymous' as const, user: null, organization: null };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  organization: null,

  bootstrap: async () => {
    const session = await refreshSession();
    set(fromSession(session));
  },

  login: async (email, password) => {
    const session = await authApi.login(email, password);
    set(fromSession(session));
    return session.user;
  },

  logout: async () => {
    await authApi.logout();
    set(fromSession(null));
  },

  changePassword: async (currentPassword, newPassword) => {
    await authApi.changePassword(currentPassword, newPassword);
    const user = get().user;
    if (user) set({ user: { ...user, mustChangePassword: false } });
  },

  setOrganization: (organization) => set({ organization }),
}));

// Keep the store in sync with token refreshes and forced sign-outs from the HTTP client.
onSessionChange((session) => {
  const { status } = useAuthStore.getState();
  if (session) useAuthStore.setState(fromSession(session));
  else if (status === 'authenticated') useAuthStore.setState(fromSession(null));
});

export const isStaff = (role: Role | undefined) => role === 'admin' || role === 'manager';
export const homePathFor = (role: Role) => (role === 'agent' ? '/driver' : '/dashboard');
export const userAvatar = (user: UserDto | null) => avatarFor(user?.name ?? '?');

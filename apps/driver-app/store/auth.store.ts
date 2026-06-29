import { create } from 'zustand';
import { queryClient, setUnauthorizedHandler, disconnectSocket } from '@yaanam/api-client';
import type { ActiveMembership, Role } from '@yaanam/types';

interface Person { id: string; phone: string; name: string; }
interface MembershipOption { id: string; tenantId: string; tenantName: string; role: Role; }

interface AuthState {
  person: Person | null;
  activeMembership: ActiveMembership | null;
  memberships: MembershipOption[];
  isAuthenticated: boolean;
  setAuth: (person: Person, memberships: MembershipOption[], active: ActiveMembership) => void;
  setActiveMembership: (membership: MembershipOption) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  person: null,
  activeMembership: null,
  memberships: [],
  isAuthenticated: false,
  setAuth: (person, memberships, activeMembership) => {
    // Fresh login: tear down any previous session's socket and cache so the old
    // user's live feed / data can't leak into the new one (account-switch leak).
    disconnectSocket();
    queryClient.clear();
    set({ person, memberships, activeMembership, isAuthenticated: true });
  },
  setActiveMembership: (m) => {
    // Identity changed — drop the old socket (re-auths under the new tenant) and
    // cache (no cross-tenant data).
    disconnectSocket();
    queryClient.clear();
    set({
      activeMembership: {
        personId: '',
        membershipId: m.id,
        tenantId: m.tenantId,
        role: m.role,
      },
    });
  },
  logout: () => {
    disconnectSocket();
    queryClient.clear();
    set({ person: null, activeMembership: null, memberships: [], isAuthenticated: false });
  },
}));

// A hard 401 (missing/expired refresh token) clears the stored tokens inside the
// api-client; mirror that here so the (app) layout's auth guard redirects to login.
setUnauthorizedHandler(() => useAuthStore.getState().logout());

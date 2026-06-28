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
  /** Patch the cached identity (e.g. after a self profile edit) so the UI stays fresh. */
  updatePerson: (patch: Partial<Person>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  person: null,
  activeMembership: null,
  memberships: [],
  isAuthenticated: false,
  setAuth: (person, memberships, activeMembership) => {
    // Fresh login: wipe any cached data AND tear down any socket from a previous
    // session, so the old user's live feed can't leak into the new one.
    disconnectSocket();
    queryClient.clear();
    set({ person, memberships, activeMembership, isAuthenticated: true });
  },
  setActiveMembership: (m) => {
    // Switching school/role changes socket room scoping — drop the old socket so
    // the next connect re-auths under the new tenant.
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
  updatePerson: (patch) =>
    set((s) => (s.person ? { person: { ...s.person, ...patch } } : {})),
  logout: () => {
    disconnectSocket();
    queryClient.clear();
    set({ person: null, activeMembership: null, memberships: [], isAuthenticated: false });
  },
}));

// A hard 401 (missing/expired refresh token) clears the stored tokens inside the
// api-client; mirror that here so the (app) layout's auth guard redirects to login.
setUnauthorizedHandler(() => useAuthStore.getState().logout());

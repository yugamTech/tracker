import { create } from 'zustand';
import { queryClient, setUnauthorizedHandler, disconnectSocket } from '@yaanam/api-client';
import type { ActiveMembership, Role } from '@yaanam/types';
import { useChildStore } from './child.store';

interface Person {
  id: string;
  phone: string;
  name: string;
}

interface MembershipOption {
  id: string;
  tenantId: string;
  tenantName: string;
  role: Role;
}

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
    // Fresh login: tear down the previous session's socket, cache and active child
    // so one user can never briefly see another user's data (account-switch leak).
    disconnectSocket();
    queryClient.clear();
    useChildStore.getState().clearActiveChild();
    set({ person, memberships, activeMembership, isAuthenticated: true });
  },

  setActiveMembership: (m) => {
    // Switching school changes socket scoping and which children are visible —
    // drop the socket, query cache and active child so nothing carries across.
    disconnectSocket();
    queryClient.clear();
    useChildStore.getState().clearActiveChild();
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
    // Tear down socket + cached queries before dropping auth so the next user starts clean.
    disconnectSocket();
    queryClient.clear();
    useChildStore.getState().clearActiveChild();
    set({ person: null, activeMembership: null, memberships: [], isAuthenticated: false });
  },
}));

// A hard 401 (missing/expired refresh token) clears the stored tokens inside the
// api-client; mirror that here so the (app) layout's auth guard redirects to login.
setUnauthorizedHandler(() => useAuthStore.getState().logout());

import { create } from 'zustand';
import { queryClient } from '@saarthi/api-client';
import type { ActiveMembership, Role } from '@saarthi/types';
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
    // Fresh login: wipe any cached data from a previous session so one user can
    // never briefly see another user's data (account-switch leak).
    queryClient.clear();
    useChildStore.getState().clearActiveChild();
    set({ person, memberships, activeMembership, isAuthenticated: true });
  },

  setActiveMembership: (m) =>
    set({
      activeMembership: {
        personId: '',
        membershipId: m.id,
        tenantId: m.tenantId,
        role: m.role,
      },
    }),

  logout: () => {
    // Clear cached queries before dropping auth so the next user starts clean.
    queryClient.clear();
    useChildStore.getState().clearActiveChild();
    set({ person: null, activeMembership: null, memberships: [], isAuthenticated: false });
  },
}));

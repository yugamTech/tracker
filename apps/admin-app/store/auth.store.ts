import { create } from 'zustand';
import type { ActiveMembership, Role } from '@saarthi/types';

interface Person { id: string; phone: string; name: string; }
interface MembershipOption { id: string; tenantId: string; tenantName: string; role: Role; }

interface AuthState {
  person: Person | null;
  activeMembership: ActiveMembership | null;
  memberships: MembershipOption[];
  isAuthenticated: boolean;
  setAuth: (person: Person, memberships: MembershipOption[], active: ActiveMembership) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  person: null,
  activeMembership: null,
  memberships: [],
  isAuthenticated: false,
  setAuth: (person, memberships, activeMembership) =>
    set({ person, memberships, activeMembership, isAuthenticated: true }),
  logout: () =>
    set({ person: null, activeMembership: null, memberships: [], isAuthenticated: false }),
}));

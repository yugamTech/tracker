import { create } from 'zustand';

/**
 * Which child the parent is currently viewing. A parent can have several
 * children on different routes; the rest of the app (home, tracking, etc.)
 * scopes to whichever one is active here. Chosen on the Netflix-style
 * child-select landing and changed via the "Switch child" control.
 *
 * Cleared on login/logout (see auth.store) so a switched account never inherits
 * the previous parent's selection.
 */
interface ChildState {
  activeChildId: string | null;
  setActiveChild: (id: string) => void;
  clearActiveChild: () => void;
}

export const useChildStore = create<ChildState>((set) => ({
  activeChildId: null,
  setActiveChild: (id) => set({ activeChildId: id }),
  clearActiveChild: () => set({ activeChildId: null }),
}));

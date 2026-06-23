import { create } from 'zustand';
import type { LocationPingPayload } from '@yaanam/types';

interface TripState {
  activeTripId: string | null;
  latestLocation: LocationPingPayload | null;
  etaMinutes: number | null;
  setActiveTrip: (tripId: string | null) => void;
  setLocation: (loc: LocationPingPayload) => void;
  setEta: (minutes: number) => void;
  reset: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  activeTripId: null,
  latestLocation: null,
  etaMinutes: null,

  setActiveTrip: (tripId) => set({ activeTripId: tripId }),
  setLocation: (loc) => set({ latestLocation: loc }),
  setEta: (minutes) => set({ etaMinutes: minutes }),
  reset: () => set({ activeTripId: null, latestLocation: null, etaMinutes: null }),
}));

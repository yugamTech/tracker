import { create } from 'zustand';
import type { Trip } from '@yaanam/types';

interface LocationPing {
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number;
  ts: string;
  sequence: number;
}

interface TripState {
  activeTrip: Trip | null;
  buffer: LocationPing[];
  isTracking: boolean;
  setActiveTrip: (trip: Trip | null) => void;
  addPing: (ping: LocationPing) => void;
  flushBuffer: () => LocationPing[];
  setTracking: (v: boolean) => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  activeTrip: null,
  buffer: [],
  isTracking: false,
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  addPing: (ping) => set((s) => ({ buffer: [...s.buffer, ping] })),
  flushBuffer: () => {
    const buf = get().buffer;
    set({ buffer: [] });
    return buf;
  },
  setTracking: (v) => set({ isTracking: v }),
}));

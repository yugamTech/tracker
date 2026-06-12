import { create } from 'zustand';
import type { LocationPingPayload } from '@saarthi/types';

interface FleetState {
  vehiclePositions: Record<string, LocationPingPayload>;
  updatePosition: (tripId: string, loc: LocationPingPayload) => void;
  clearPositions: () => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  vehiclePositions: {},
  updatePosition: (tripId, loc) =>
    set((s) => ({ vehiclePositions: { ...s.vehiclePositions, [tripId]: loc } })),
  clearPositions: () => set({ vehiclePositions: {} }),
}));

import { useQuery } from '@tanstack/react-query';
import { trackingApi } from './tracking.api';

export function useTripHistory(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-history', tripId],
    queryFn: () => trackingApi.getTripHistory(tripId!),
    enabled: !!tripId,
  });
}

/** Latest known position for a trip — primes the live map before socket deltas arrive. */
export function useLatestPosition(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-latest', tripId],
    queryFn: () => trackingApi.getLatest(tripId!),
    enabled: !!tripId,
  });
}

/** Active fleet snapshot for the admin map's initial load. */
export function useFleet() {
  return useQuery({ queryKey: ['fleet'], queryFn: trackingApi.getFleet });
}

export function useTripReplay(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-replay', tripId],
    queryFn: () => trackingApi.getReplay(tripId!),
    enabled: !!tripId,
  });
}

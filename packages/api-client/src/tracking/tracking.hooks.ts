import { useQuery } from '@tanstack/react-query';
import { trackingApi } from './tracking.api';

export function useTripHistory(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-history', tripId],
    queryFn: () => trackingApi.getTripHistory(tripId!),
    enabled: !!tripId,
  });
}

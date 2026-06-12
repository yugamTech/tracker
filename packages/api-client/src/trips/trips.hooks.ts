import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from './trips.api';

export const tripKeys = {
  all: ['trips'] as const,
  today: () => [...tripKeys.all, 'today'] as const,
  detail: (id: string) => [...tripKeys.all, id] as const,
};

export const useTodayTrips = () =>
  useQuery({
    queryKey: tripKeys.today(),
    queryFn: tripsApi.getTodayTrips,
  });

export const useTripById = (tripId: string) =>
  useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: () => tripsApi.getTripById(tripId),
    enabled: !!tripId,
  });

export const useStartTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripsApi.startTrip,
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useCompleteTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripsApi.completeTrip,
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useAbortTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripsApi.abortTrip,
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useCancelPickup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, studentId, reason }: { tripId: string; studentId: string; reason?: string }) =>
      tripsApi.cancelPickup(tripId, studentId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi, type TripFilters, type UpdateTripDto } from './trips.api';

export const tripKeys = {
  all: ['trips'] as const,
  today: () => [...tripKeys.all, 'today'] as const,
  byDate: (date: string) => [...tripKeys.all, 'byDate', date] as const,
  list: (filters: TripFilters) => [...tripKeys.all, 'list', filters] as const,
  dates: (from: string, to: string) => [...tripKeys.all, 'dates', from, to] as const,
  detail: (id: string) => [...tripKeys.all, id] as const,
  exceptions: (resolved?: string) => [...tripKeys.all, 'exceptions', resolved ?? 'open'] as const,
};

export const useTodayTrips = () =>
  useQuery({
    queryKey: tripKeys.today(),
    queryFn: tripsApi.getTodayTrips,
  });

/** Trips on a single calendar day (`YYYY-MM-DD`). */
export const useTripsByDate = (date: string) =>
  useQuery({
    queryKey: tripKeys.byDate(date),
    queryFn: () => tripsApi.getTripsByDate(date),
    enabled: !!date,
  });

/** Trips matching combinable filters (date / status / route / driver). */
export const useFilteredTrips = (filters: TripFilters) =>
  useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: () => tripsApi.getTrips(filters),
  });

/** Calendar-dot feed for the visible range — the days that have trips. */
export const useTripDates = (from: string, to: string) =>
  useQuery({
    queryKey: tripKeys.dates(from, to),
    queryFn: () => tripsApi.getTripDates(from, to),
    enabled: !!from && !!to,
  });

export const useTripById = (tripId: string) =>
  useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: () => tripsApi.getTripById(tripId),
    enabled: !!tripId,
  });

export const useCreateTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripsApi.createTrip,
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useUpdateTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, ...dto }: { tripId: string } & UpdateTripDto) =>
      tripsApi.updateTrip(tripId, dto),
    onSuccess: (_data, { tripId }) => {
      qc.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      qc.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
};

export const useCancelTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => tripsApi.cancelTrip(tripId),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useStartTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, reason }: { tripId: string; reason?: string }) =>
      tripsApi.startTrip(tripId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useTripStartExceptions = (resolved?: 'true' | 'all') =>
  useQuery({
    queryKey: tripKeys.exceptions(resolved),
    queryFn: () => tripsApi.listStartExceptions(resolved),
  });

export const useResolveStartException = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exceptionId: string) => tripsApi.resolveStartException(exceptionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...tripKeys.all, 'exceptions'] }),
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
    // Optimistically mark the rider CANCELLED on the trip detail so the track
    // screen reflects the skip instantly; roll back if the request fails.
    onMutate: async ({ tripId, studentId }) => {
      await qc.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = qc.getQueryData(tripKeys.detail(tripId));
      qc.setQueryData(tripKeys.detail(tripId), (old: any) =>
        old
          ? {
              ...old,
              riders: (old.riders ?? []).map((r: any) =>
                r.studentId === studentId ? { ...r, boardStatus: 'CANCELLED' } : r,
              ),
            }
          : old,
      );
      return { previous, tripId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(tripKeys.detail(ctx.tripId), ctx.previous);
    },
    // Refetch so home (today), track (detail) and trips all converge on the server truth.
    onSettled: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

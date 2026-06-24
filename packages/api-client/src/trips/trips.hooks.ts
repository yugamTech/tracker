import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi, type TripFilters, type UpdateTripDto } from './trips.api';

export const tripKeys = {
  all: ['trips'] as const,
  today: () => [...tripKeys.all, 'today'] as const,
  byDate: (date: string) => [...tripKeys.all, 'byDate', date] as const,
  list: (filters: TripFilters) => [...tripKeys.all, 'list', filters] as const,
  dates: (from: string, to: string) => [...tripKeys.all, 'dates', from, to] as const,
  history: () => [...tripKeys.all, 'history'] as const,
  detail: (id: string) => [...tripKeys.all, id] as const,
  exceptions: (resolved?: string) => [...tripKeys.all, 'exceptions', resolved ?? 'open'] as const,
  completionExceptions: (resolved?: string) =>
    [...tripKeys.all, 'completion-exceptions', resolved ?? 'open'] as const,
  overdue: () => [...tripKeys.all, 'overdue'] as const,
  lifecycleAlarms: () => [...tripKeys.all, 'lifecycle-alarms'] as const,
  trends: (days: number) => [...tripKeys.all, 'trends', days] as const,
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

/** Driver ride history + efficiency summary (past trips, scoped to the caller). */
export const useDriverHistory = () =>
  useQuery({
    queryKey: tripKeys.history(),
    queryFn: tripsApi.getDriverHistory,
  });

/** Tenant-wide daily operations trend over the last `days` days (admin Dashboard → Trends). */
export const useTripTrends = (days = 7) =>
  useQuery({
    queryKey: tripKeys.trends(days),
    queryFn: () => tripsApi.getTrends(days),
  });

export const useTripById = (tripId: string) =>
  useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: () => tripsApi.getTripById(tripId),
    enabled: !!tripId,
  });

/** Never-started alarm feed: still-SCHEDULED trips >12h past their planned start. */
export const useOverdueTrips = () =>
  useQuery({
    queryKey: tripKeys.overdue(),
    queryFn: tripsApi.getOverdueTrips,
  });

/** Lifecycle-alarm feed (PRD-02a): overdue (live) + abandoned (auto-aborted) trips. */
export const useLifecycleAlarms = () =>
  useQuery({
    queryKey: tripKeys.lifecycleAlarms(),
    queryFn: tripsApi.getLifecycleAlarms,
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

export const useTripCompletionExceptions = (resolved?: 'true' | 'all') =>
  useQuery({
    queryKey: tripKeys.completionExceptions(resolved),
    queryFn: () => tripsApi.listCompletionExceptions(resolved),
  });

export const useResolveCompletionException = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exceptionId: string) => tripsApi.resolveCompletionException(exceptionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...tripKeys.all, 'completion-exceptions'] }),
  });
};

export const useCompleteTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, reason, stoppedAtSeq }: { tripId: string; reason?: string; stoppedAtSeq?: number }) =>
      tripsApi.completeTrip(tripId, { reason, stoppedAtSeq }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

export const useAbortTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, reason }: { tripId: string; reason: string }) =>
      tripsApi.abortTrip(tripId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

/** Admin force-complete a trip the driver forgot to close (reason required). */
export const useForceCompleteTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, reason }: { tripId: string; reason: string }) =>
      tripsApi.forceCompleteTrip(tripId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
};

/** Acknowledge an overdue / auto-aborted lifecycle alarm — removes it from the feed. */
export const useAcknowledgeTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, note }: { tripId: string; note?: string }) =>
      tripsApi.acknowledgeTrip(tripId, note),
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

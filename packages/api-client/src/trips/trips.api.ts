import { apiClient } from '../axios';
import type { Trip, TripStartException, TripCompletionException } from '@saarthi/types';

/**
 * Minutes before `scheduledStart` after which a parent can no longer skip a
 * pickup. Mirrors the backend's `DEFAULT_PICKUP_CANCEL_CUTOFF_MIN` (the server
 * value is env-overridable and is NOT exposed in any trip GET, so the client
 * computes the cutoff from this default and trusts the server's error message
 * as the source of truth if a race slips through).
 */
export const PICKUP_CANCEL_CUTOFF_MINUTES = 30;

export interface PickupCancelInfo {
  /** Whether "skip pickup" should be enabled right now. */
  canCancel: boolean;
  /** Human-readable reason when `canCancel` is false (already skipped, past cutoff, started…). */
  reason?: string;
  /** The moment skipping closes (`scheduledStart − cutoff`), ISO string, or null if unknown. */
  cutoffAt: string | null;
  cutoffMinutes: number;
  /** True once the parent's rider has already been skipped for this trip. */
  alreadySkipped: boolean;
}

/**
 * Whether the parent can still skip their child's pickup, computed client-side
 * to mirror the backend gates in `TripsService.cancelPickup`: the trip must be
 * SCHEDULED, the rider must still be EXPECTED, and `now` must be at or before
 * `scheduledStart − PICKUP_CANCEL_CUTOFF_MINUTES` (scheduledStart falls back to
 * the trip date, exactly as the server does).
 */
export function pickupCancelInfo(
  trip: { status: string; scheduledStart?: string | null; date?: string } | undefined,
  rider: { boardStatus: string } | undefined,
  now: Date = new Date(),
): PickupCancelInfo {
  const cutoffMinutes = PICKUP_CANCEL_CUTOFF_MINUTES;
  const startSource = trip?.scheduledStart ?? trip?.date;
  const cutoffAt = startSource
    ? new Date(new Date(startSource).getTime() - cutoffMinutes * 60_000).toISOString()
    : null;
  const base = { cutoffAt, cutoffMinutes };

  if (rider?.boardStatus === 'CANCELLED') {
    return { ...base, canCancel: false, alreadySkipped: true, reason: 'Pickup skipped for today.' };
  }
  if (trip && trip.status !== 'SCHEDULED') {
    const underway = trip.status === 'STARTED' || trip.status === 'IN_PROGRESS';
    return {
      ...base,
      canCancel: false,
      alreadySkipped: false,
      reason: underway
        ? 'The trip has already started.'
        : `This trip is ${trip.status.toLowerCase()}.`,
    };
  }
  if (rider && rider.boardStatus !== 'EXPECTED') {
    return { ...base, canCancel: false, alreadySkipped: false, reason: 'Your child is no longer expected on this trip.' };
  }
  if (cutoffAt && now.getTime() > new Date(cutoffAt).getTime()) {
    return {
      ...base,
      canCancel: false,
      alreadySkipped: false,
      reason: `Pickup can no longer be skipped — the cutoff is ${cutoffMinutes} min before departure.`,
    };
  }
  return { ...base, canCancel: true, alreadySkipped: false };
}

export interface ScheduleTripDto {
  routeId: string;
  vehicleId: string;
  driverId: string;
  conductorId?: string;
  date: string;
  direction: 'PICKUP' | 'DROP';
  scheduledStart?: string;
}

/** Combinable, server-side trip-list filters (all optional). */
export interface TripFilters {
  date?: string;
  status?: string;
  route?: string;
  driver?: string;
}

/** Editable fields of a SCHEDULED trip — only the supplied ones change. */
export interface UpdateTripDto {
  routeId?: string;
  vehicleId?: string;
  driverId?: string;
  conductorId?: string;
  direction?: 'PICKUP' | 'DROP';
  scheduledStart?: string;
}

/**
 * A still-SCHEDULED trip that's overdue to start (>12h past its planned start),
 * as returned by the never-started alarm feed, with how overdue it is.
 */
export type OverdueTrip = Trip & {
  overdueMinutes: number;
  route?: { id: string; name: string } | null;
  driver?: { id: string; name: string } | null;
  vehicle?: { id: string; regNumber: string } | null;
};

/**
 * A started-not-completed lifecycle alarm (PRD-02a): a still-live trip that's
 * OVERDUE (Stage-1) or a trip the system auto-aborted as ABANDONED (Stage-2), as
 * returned by the lifecycle-alarm feed.
 */
export type LifecycleAlarmTrip = Trip & {
  /** OVERDUE = still live & past the soft cutoff; ABANDONED = auto-aborted. */
  lifecycleStage: 'OVERDUE' | 'ABANDONED';
  /** Whole minutes the trip has been running since it started. */
  overdueMinutes: number;
  /** Reason recorded on the auto-abort (ABANDONED only), else null. */
  abortReason: string | null;
  route?: { id: string; name: string } | null;
  driver?: { id: string; name: string } | null;
  vehicle?: { id: string; regNumber: string } | null;
};

/** A trip-start exception with its trip context, as returned by the alarm panel. */
export type TripStartExceptionWithTrip = TripStartException & {
  trip?: {
    id: string;
    direction: string;
    route?: { name: string } | null;
    vehicle?: { regNumber: string } | null;
    driver?: { name: string } | null;
  };
};

/** A trip-completion (early-end) exception with its trip context, for the alarm panel. */
export type TripCompletionExceptionWithTrip = TripCompletionException & {
  trip?: {
    id: string;
    direction: string;
    route?: { name: string } | null;
    vehicle?: { regNumber: string } | null;
    driver?: { name: string } | null;
  };
};

/** One past trip in the driver's history feed, with real computed fields. */
export interface HistoryTrip {
  id: string;
  date: string;
  scheduledStart: string | null;
  startedAt: string | null;
  completedAt: string | null;
  direction: 'PICKUP' | 'DROP';
  status: string;
  route: { id: string; name: string } | null;
  vehicle: { id: string; regNumber: string } | null;
  boarded: number;
  notBoarded: number;
  total: number;
  /** Riders expected to board (excludes cancelled pickups). */
  expectedToBoard: number;
  /** Whole minutes between startedAt and completedAt, or null. */
  durationMinutes: number | null;
  /** Whether a vehicle check was done for this trip (linked, or same vehicle that day). */
  vehicleChecked: boolean;
  /** Started within the ±1h window (no start exception); null if it never started. */
  onTime: boolean | null;
  /** Didn't reach a clean COMPLETED — still running/stuck or aborted (PRD-02a §4). */
  incomplete: boolean;
  /** Reason recorded on the abort (ABORTED trips only), else null. */
  abortReason: string | null;
}

/** Aggregated driver efficiency across their whole ride history. Rates are 0–1, or null. */
export interface DriverEfficiency {
  totalTrips: number;
  tripsCompleted: number;
  onTimeRate: number | null;
  avgBoardingRate: number | null;
}

export interface DriverHistoryResponse {
  trips: HistoryTrip[];
  summary: DriverEfficiency;
}

export const tripsApi = {
  getMyTrips: async (params?: { page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/trips', { params });
    return data.data as Trip[];
  },

  createTrip: async (dto: ScheduleTripDto) => {
    const { data } = await apiClient.post('/trips', dto);
    return data.data as Trip;
  },

  getTripById: async (tripId: string) => {
    const { data } = await apiClient.get(`/trips/${tripId}`);
    return data.data as Trip;
  },

  getTodayTrips: async () => {
    const { data } = await apiClient.get('/trips/today');
    return data.data as Trip[];
  },

  /** Driver ride history (past trips) + efficiency summary, scoped to the caller. */
  getDriverHistory: async () => {
    const { data } = await apiClient.get('/trips/history');
    return data.data as DriverHistoryResponse;
  },

  /** Trips on a single calendar day (`YYYY-MM-DD`), morning→evening. */
  getTripsByDate: async (date: string) => {
    const { data } = await apiClient.get('/trips', { params: { date } });
    return data.data as Trip[];
  },

  /** Trips matching combinable filters (date / status / route / driver). */
  getTrips: async (filters: TripFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.date) params.date = filters.date;
    if (filters.status) params.status = filters.status;
    if (filters.route) params.route = filters.route;
    if (filters.driver) params.driver = filters.driver;
    const { data } = await apiClient.get('/trips', { params });
    return data.data as Trip[];
  },

  /** Edit a SCHEDULED trip (driver/vehicle/conductor/scheduledStart/direction/route). */
  updateTrip: async (tripId: string, dto: UpdateTripDto) => {
    const { data } = await apiClient.patch(`/trips/${tripId}`, dto);
    return data.data as Trip;
  },

  /** Never-started alarm feed: trips still SCHEDULED >12h past their planned start. */
  getOverdueTrips: async () => {
    const { data } = await apiClient.get('/trips/overdue');
    return data.data as OverdueTrip[];
  },

  /** Cheap calendar-dot feed: the `YYYY-MM-DD` days in [from, to] that have trips. */
  getTripDates: async (from: string, to: string) => {
    const { data } = await apiClient.get('/trips/dates', { params: { from, to } });
    return data.data as string[];
  },

  startTrip: async (tripId: string, reason?: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/start`, reason ? { reason } : {});
    return data.data as Trip;
  },

  listStartExceptions: async (resolved?: 'true' | 'all') => {
    const { data } = await apiClient.get('/trips/exceptions', {
      params: resolved ? { resolved } : undefined,
    });
    return data.data as TripStartExceptionWithTrip[];
  },

  resolveStartException: async (exceptionId: string) => {
    const { data } = await apiClient.post(`/trips/exceptions/${exceptionId}/resolve`);
    return data.data as TripStartException;
  },

  listCompletionExceptions: async (resolved?: 'true' | 'all') => {
    const { data } = await apiClient.get('/trips/completion-exceptions', {
      params: resolved ? { resolved } : undefined,
    });
    return data.data as TripCompletionExceptionWithTrip[];
  },

  resolveCompletionException: async (exceptionId: string) => {
    const { data } = await apiClient.post(`/trips/completion-exceptions/${exceptionId}/resolve`);
    return data.data as TripCompletionException;
  },

  completeTrip: async (tripId: string, opts: { reason?: string; stoppedAtSeq?: number } = {}) => {
    const body: { reason?: string; stoppedAtSeq?: number } = {};
    if (opts.reason) body.reason = opts.reason;
    if (opts.stoppedAtSeq != null) body.stoppedAtSeq = opts.stoppedAtSeq;
    const { data } = await apiClient.post(`/trips/${tripId}/complete`, body);
    return data.data as Trip;
  },

  cancelTrip: async (tripId: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/cancel`);
    return data.data as Trip;
  },

  /** Abort a live trip with a mandatory reason (driver "end stale" / admin force-abort). */
  abortTrip: async (tripId: string, reason: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/abort`, { reason });
    return data.data as Trip;
  },

  /** Open lifecycle-alarm feed: overdue (live) + abandoned (auto-aborted) trips. */
  getLifecycleAlarms: async () => {
    const { data } = await apiClient.get('/trips/lifecycle-alarms');
    return data.data as LifecycleAlarmTrip[];
  },

  /** Admin force-complete a trip the driver ran but forgot to close (reason required). */
  forceCompleteTrip: async (tripId: string, reason: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/force-complete`, { reason });
    return data.data as Trip;
  },

  /** Acknowledge an overdue / auto-aborted alarm — removes it from the open feed. */
  acknowledgeTrip: async (tripId: string, note?: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/acknowledge`, note ? { note } : {});
    return data.data;
  },

  cancelPickup: async (tripId: string, studentId: string, reason?: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/cancel-pickup`, { studentId, reason });
    return data.data;
  },
};

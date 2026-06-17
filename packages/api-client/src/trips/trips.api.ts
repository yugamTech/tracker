import { apiClient } from '../axios';
import type { Trip, TripStartException } from '@saarthi/types';

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

  completeTrip: async (tripId: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/complete`);
    return data.data as Trip;
  },

  cancelTrip: async (tripId: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/cancel`);
    return data.data as Trip;
  },

  abortTrip: async (tripId: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/abort`);
    return data.data as Trip;
  },

  cancelPickup: async (tripId: string, studentId: string, reason?: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/cancel-pickup`, { studentId, reason });
    return data.data;
  },
};

import { apiClient } from '../axios';
import type { Trip, TripStartException } from '@saarthi/types';

export interface ScheduleTripDto {
  routeId: string;
  vehicleId: string;
  driverId: string;
  conductorId?: string;
  date: string;
  direction: 'PICKUP' | 'DROP';
  scheduledStart?: string;
}

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

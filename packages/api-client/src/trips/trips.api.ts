import { apiClient } from '../axios';
import type { Trip, Direction } from '@saarthi/types';

export interface ScheduleTripDto {
  routeId: string;
  vehicleId: string;
  driverId: string;
  conductorId?: string;
  date: string;
  direction: Direction;
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

  startTrip: async (tripId: string) => {
    const { data } = await apiClient.post(`/trips/${tripId}/start`);
    return data.data as Trip;
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

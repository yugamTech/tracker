import { apiClient } from '../axios';
import type { Trip } from '@saarthi/types';

export const tripsApi = {
  getMyTrips: async (params?: { page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/trips', { params });
    return data.data as Trip[];
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
};

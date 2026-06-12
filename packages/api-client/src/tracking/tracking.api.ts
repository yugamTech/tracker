import { apiClient } from '../axios';

export interface LocationPingPayload {
  tripId: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number;
  deviceTs: number;
  sequence: number;
}

export const trackingApi = {
  sendPing: (payload: LocationPingPayload) =>
    apiClient.post('/tracking/ping', payload).then((r) => r.data),

  sendBatch: (pings: LocationPingPayload[]) =>
    apiClient.post('/tracking/ping/batch', { pings }).then((r) => r.data),

  getTripHistory: (tripId: string) =>
    apiClient.get(`/tracking/trips/${tripId}/history`).then((r) => r.data),
};

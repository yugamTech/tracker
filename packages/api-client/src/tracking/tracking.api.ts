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

export interface LatestPosition {
  tripId: string;
  tenantId: string;
  vehicleId: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  accuracy: number;
  deviceTs: string;
  serverTs: string;
  sequence: number;
}

export interface FleetEntry {
  tripId: string;
  status: string;
  routeName: string;
  direction: string;
  vehicleReg: string | null;
  driverName: string | null;
  stops: { id: string; name: string }[];
  latest: LatestPosition | null;
}

export const trackingApi = {
  sendPing: (payload: LocationPingPayload) =>
    apiClient.post('/tracking/ping', payload).then((r) => r.data),

  sendBatch: (pings: LocationPingPayload[]) =>
    apiClient.post('/tracking/ping/batch', { pings }).then((r) => r.data),

  getLatest: (tripId: string) =>
    apiClient.get(`/tracking/${tripId}/latest`).then((r) => r.data.data as LatestPosition | null),

  getFleet: () => apiClient.get('/tracking/fleet').then((r) => r.data.data as FleetEntry[]),

  getTripHistory: (tripId: string) =>
    apiClient.get(`/tracking/trips/${tripId}/history`).then((r) => r.data.data),

  getReplay: (tripId: string) =>
    apiClient.get(`/tracking/trips/${tripId}/replay`).then((r) => r.data.data),
};

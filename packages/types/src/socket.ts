import type { LocationPing, TripStatus, RiderStatus } from './trips';
import type { AttendanceType } from './attendance';

// ─── Server → Client ──────────────────────────────────────────────────────

export interface LocationPingPayload {
  tripId: string;
  tenantId: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number;
  deviceTs: string;
  sequence: number;
}

export interface TripStatusPayload {
  tripId: string;
  tenantId: string;
  status: TripStatus;
  ts: string;
}

export interface AttendancePayload {
  tripId: string;
  studentId: string;
  tenantId: string;
  type: AttendanceType;
  ts: string;
}

export interface EtaPayload {
  tripId: string;
  stopId: string;
  stopName: string;
  etaMinutes: number;
  etaSeconds: number;
  distanceMeters: number;
  etaTs: string;
}

export interface GeofencePayload {
  tripId: string;
  stopId: string;
  stopName: string;
  event: 'APPROACHING' | 'AT_STOP' | 'DEPARTED';
  ts: string;
}

export interface AlertPayload {
  tripId: string;
  tenantId: string;
  type: 'OVERSPEED' | 'SIGNAL_LOST' | 'GEOFENCE';
  message: string;
  ts: string;
}

export interface ServerToClientEvents {
  'trip:location': (data: LocationPingPayload) => void;
  'trip:status': (data: TripStatusPayload) => void;
  'trip:attendance': (data: AttendancePayload) => void;
  'trip:eta': (data: EtaPayload) => void;
  'trip:geofence': (data: GeofencePayload) => void;
  'alert:critical': (data: AlertPayload) => void;
}

// ─── Client → Server ──────────────────────────────────────────────────────

export interface DriverPingPayload extends LocationPingPayload {
  driverMembershipId: string;
}

export interface ClientToServerEvents {
  'driver:ping': (data: DriverPingPayload) => void;
  'subscribe:trip': (tripId: string) => void;
  'unsubscribe:trip': (tripId: string) => void;
  // Fleet subscription is tenant-scoped from the JWT — no payload needed.
  'subscribe:fleet': () => void;
  'unsubscribe:fleet': () => void;
}

// Re-export for convenience
export type { LocationPing };

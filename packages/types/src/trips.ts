export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ABORTED = 'ABORTED',
}

export enum Direction {
  PICKUP = 'PICKUP',
  DROP = 'DROP',
}

export enum RiderStatus {
  EXPECTED = 'EXPECTED',
  BOARDED = 'BOARDED',
  NOT_BOARDED = 'NOT_BOARDED',
  CANCELLED = 'CANCELLED',
}

export interface Trip {
  id: string;
  tenantId: string;
  routeId: string;
  vehicleId?: string;
  date: string;
  direction: Direction;
  status: TripStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface TripRider {
  id: string;
  tripId: string;
  studentId: string;
  stopId: string;
  boardStatus: RiderStatus;
}

export interface LocationPing {
  id: string;
  tripId: string;
  tenantId: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number;
  deviceTs: string;
  serverTs: string;
  sequence: number;
}

export interface Stop {
  id: string;
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceRadius: number;
}

export interface Route {
  id: string;
  tenantId: string;
  name: string;
  direction: Direction;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface RouteStop {
  id: string;
  routeId: string;
  stopId: string;
  sequence: number;
  stop?: Stop;
}

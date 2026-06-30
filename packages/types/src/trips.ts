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

/** Where the school end sits in a trip's geometry (PICKUP → end, DROP → start). */
export type AnchorRole = 'ORIGIN' | 'DESTINATION';

/**
 * A trip's resolved "school end" (per-trip override → tenant school coords →
 * none), as attached to the trip detail payload. Null when neither is set.
 */
export interface TripAnchor {
  lat: number;
  lng: number;
  label: string | null;
  /** DESTINATION for a PICKUP (after the last stop), ORIGIN for a DROP (before the first). */
  role: AnchorRole;
}

export interface Trip {
  id: string;
  tenantId: string;
  routeId: string;
  vehicleId?: string;
  driverId?: string;
  conductorId?: string;
  /** Shift (AgeGroup) this trip serves, when scheduled shift-aware. */
  shiftId?: string | null;
  date: string;
  direction: Direction;
  scheduledStart?: string | null;
  /** Per-trip school-end override (different-destination run); null when none. */
  anchorLat?: number | null;
  anchorLng?: number | null;
  anchorLabel?: string | null;
  /** Resolved school end (trip detail payload only); null when no coords exist. */
  anchor?: TripAnchor | null;
  status: TripStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Raised when a trip starts outside the clean-start rule (2B): no DailyCheck for
// the vehicle today, or `now` outside [scheduledStart ± 1h]. The driver's reason
// note is mandatory in that case; admins resolve from the alarm panel.
export interface TripStartException {
  id: string;
  tenantId: string;
  tripId: string;
  startedAt: string;
  scheduledStart: string;
  deltaMinutes: number;
  dailyCheckDone: boolean;
  reason: string;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

// Raised when a trip is completed before its final serviceable stop (3-rule §5).
// The driver's reason note is mandatory; admins resolve from the alarm panel.
export interface TripCompletionException {
  id: string;
  tenantId: string;
  tripId: string;
  completedAt: string;
  stoppedAtSeq: number;
  totalStops: number;
  boarded: number;
  totalRiders: number;
  reason: string;
  resolvedById?: string | null;
  resolvedAt?: string | null;
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

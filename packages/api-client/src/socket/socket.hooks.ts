import { useEffect, useRef } from 'react';
import {
  getSocket,
  connectSocket,
  subscribeToTrip,
  unsubscribeFromTrip,
  subscribeToFleet,
  unsubscribeFromFleet,
  emitDriverPing,
} from './socket.client';
import type {
  LocationPingPayload,
  TripStatusPayload,
  AttendancePayload,
  EtaPayload,
  GeofencePayload,
  AlertPayload,
  DriverPingPayload,
} from '@saarthi/types';

// Socket connects to the bare host (the gateway namespace is appended in
// socket.client). Prefer an explicit socket URL, else reuse the API host — both
// are baked in at build time from the EAS profile's env.
const BASE_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface TripSocketHandlers {
  onLocation?: (data: LocationPingPayload) => void;
  onStatus?: (data: TripStatusPayload) => void;
  onEta?: (data: EtaPayload) => void;
  onAttendance?: (data: AttendancePayload) => void;
  onGeofence?: (data: GeofencePayload) => void;
  onAlert?: (data: AlertPayload) => void;
}

/**
 * Subscribe to a trip room and receive its live feed. Connects the (lazy)
 * socket on mount and tears down listeners + room membership on unmount.
 * Handlers are read from a ref so re-renders don't churn the subscription.
 */
export const useTripSocket = (tripId: string | null, handlers: TripSocketHandlers) => {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!tripId) return;
    const s = getSocket(BASE_URL);
    void connectSocket(BASE_URL);

    const onLocation = (d: LocationPingPayload) => ref.current.onLocation?.(d);
    const onStatus = (d: TripStatusPayload) => ref.current.onStatus?.(d);
    const onEta = (d: EtaPayload) => ref.current.onEta?.(d);
    const onAttendance = (d: AttendancePayload) => ref.current.onAttendance?.(d);
    const onGeofence = (d: GeofencePayload) => ref.current.onGeofence?.(d);
    const onAlert = (d: AlertPayload) => ref.current.onAlert?.(d);

    s.on('trip:location', onLocation);
    s.on('trip:status', onStatus);
    s.on('trip:eta', onEta);
    s.on('trip:attendance', onAttendance);
    s.on('trip:geofence', onGeofence);
    s.on('alert:critical', onAlert);

    const join = () => subscribeToTrip(tripId);
    join();
    s.on('connect', join); // re-join after a reconnect

    return () => {
      unsubscribeFromTrip(tripId);
      s.off('trip:location', onLocation);
      s.off('trip:status', onStatus);
      s.off('trip:eta', onEta);
      s.off('trip:attendance', onAttendance);
      s.off('trip:geofence', onGeofence);
      s.off('alert:critical', onAlert);
      s.off('connect', join);
    };
  }, [tripId]);
};

/** Admin: subscribe to the tenant fleet room and receive every active bus's feed. */
export const useFleetSocket = (
  enabled: boolean,
  handlers: { onLocation?: (d: LocationPingPayload) => void; onStatus?: (d: TripStatusPayload) => void; onAlert?: (d: AlertPayload) => void },
) => {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const s = getSocket(BASE_URL);
    void connectSocket(BASE_URL);

    const onLocation = (d: LocationPingPayload) => ref.current.onLocation?.(d);
    const onStatus = (d: TripStatusPayload) => ref.current.onStatus?.(d);
    const onAlert = (d: AlertPayload) => ref.current.onAlert?.(d);
    s.on('trip:location', onLocation);
    s.on('trip:status', onStatus);
    s.on('alert:critical', onAlert);

    const join = () => subscribeToFleet();
    join();
    s.on('connect', join);

    return () => {
      unsubscribeFromFleet();
      s.off('trip:location', onLocation);
      s.off('trip:status', onStatus);
      s.off('alert:critical', onAlert);
      s.off('connect', join);
    };
  }, [enabled]);
};

/** Imperative driver:ping emitter for the driver app's active-trip screen. */
export const useDriverPing = () => {
  useEffect(() => {
    void connectSocket(BASE_URL);
    getSocket(BASE_URL);
  }, []);
  return (payload: DriverPingPayload) => emitDriverPing(payload);
};

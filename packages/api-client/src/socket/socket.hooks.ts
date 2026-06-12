import { useEffect, useCallback } from 'react';
import { getSocket, subscribeToTrip, unsubscribeFromTrip } from './socket.client';
import type { LocationPingPayload, TripStatusPayload, AlertPayload } from '@saarthi/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const useTripSocket = (
  tripId: string | null,
  handlers: {
    onLocation?: (data: LocationPingPayload) => void;
    onStatus?: (data: TripStatusPayload) => void;
    onAlert?: (data: AlertPayload) => void;
  }
) => {
  useEffect(() => {
    if (!tripId) return;
    const s = getSocket(BASE_URL);

    if (handlers.onLocation) s.on('trip:location', handlers.onLocation);
    if (handlers.onStatus)   s.on('trip:status', handlers.onStatus);
    if (handlers.onAlert)    s.on('alert:critical', handlers.onAlert);

    subscribeToTrip(tripId);

    return () => {
      unsubscribeFromTrip(tripId);
      if (handlers.onLocation) s.off('trip:location', handlers.onLocation);
      if (handlers.onStatus)   s.off('trip:status', handlers.onStatus);
      if (handlers.onAlert)    s.off('alert:critical', handlers.onAlert);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);
};

export const useFleetSocket = (
  tenantId: string | null,
  onLocation: (data: LocationPingPayload) => void
) => {
  useEffect(() => {
    if (!tenantId) return;
    const s = getSocket(BASE_URL);
    s.on('trip:location', onLocation);
    return () => {
      s.off('trip:location', onLocation);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);
};

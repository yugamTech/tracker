import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, DriverPingPayload } from '@yaanam/types';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY } from '../axios';

export type YaanamSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: YaanamSocket | null = null;

export const getSocket = (baseURL: string): YaanamSocket => {
  if (socket) return socket;

  socket = io(`${baseURL}/tracking`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: async (cb) => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      cb({ token });
    },
  }) as YaanamSocket;

  return socket;
};

export const connectSocket = async (baseURL: string): Promise<void> => {
  const s = getSocket(baseURL);
  if (!s.connected) {
    s.connect();
  }
};

/**
 * Fully tear down the singleton socket. Call this on logout AND on any change of
 * identity (admin context-switch, parent re-login): without nulling the instance,
 * the next `getSocket` returns the SAME socket — still authenticated with the
 * previous user's token and still joined to their trip/fleet rooms, leaking the
 * old session's live feed into the new one. Removing listeners prevents stale
 * handlers from firing, and dropping the reference forces a fresh, re-authed
 * connection (the `auth` callback re-reads the current token) on next use.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToTrip = (tripId: string): void => {
  socket?.emit('subscribe:trip', tripId);
};

export const unsubscribeFromTrip = (tripId: string): void => {
  socket?.emit('unsubscribe:trip', tripId);
};

export const subscribeToFleet = (): void => {
  socket?.emit('subscribe:fleet');
};

export const unsubscribeFromFleet = (): void => {
  socket?.emit('unsubscribe:fleet');
};

/** Driver app: stream the bus position over the socket driver:ping channel. */
export const emitDriverPing = (payload: DriverPingPayload): void => {
  socket?.emit('driver:ping', payload);
};

import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, DriverPingPayload } from '@saarthi/types';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY } from '../axios';

export type SaarthiSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: SaarthiSocket | null = null;

export const getSocket = (baseURL: string): SaarthiSocket => {
  if (socket) return socket;

  socket = io(`${baseURL}/tracking`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: async (cb) => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      cb({ token });
    },
  }) as SaarthiSocket;

  return socket;
};

export const connectSocket = async (baseURL: string): Promise<void> => {
  const s = getSocket(baseURL);
  if (!s.connected) {
    s.connect();
  }
};

export const disconnectSocket = (): void => {
  if (socket?.connected) {
    socket.disconnect();
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

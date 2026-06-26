import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { resolveDevHost } from './dev-host';

export const TOKEN_KEY = 'saarthi_access_token';
export const REFRESH_KEY = 'saarthi_refresh_token';

/**
 * Called once when the session can no longer be recovered (refresh token is
 * missing, expired, or itself rejected with a 401). Apps register a handler that
 * drops auth state so the UI falls back to the login screen — the api-client
 * stays framework-agnostic and never imports a store or the router.
 */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

/** Wipe stored tokens and notify the app so it can redirect to login. */
const clearSession = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // SecureStore can throw if the keychain is unavailable — still notify the app.
  }
  onUnauthorized?.();
};

export const createApiClient = (baseURL: string) => {
  const client = axios.create({
    baseURL,
    timeout: 10_000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Attach access token to every request
  client.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Auto-refresh on 401
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = (error.config ?? {}) as typeof error.config & { _retry?: boolean };
      const status = error.response?.status;
      // A 401 on the refresh call itself means the refresh token is dead — never
      // try to refresh a refresh (that recurses forever); tear the session down.
      const isRefreshCall =
        typeof original.url === 'string' && original.url.includes('/auth/refresh');

      if (status === 401 && isRefreshCall) {
        await clearSession();
        return Promise.reject(error);
      }

      if (status === 401 && !original._retry) {
        original._retry = true;
        try {
          const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
          if (!refresh) throw new Error('No refresh token');
          const { data } = await client.post('/auth/refresh', { refreshToken: refresh });
          await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
          await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return client(original);
        } catch {
          await clearSession();
          return Promise.reject(error);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// Default instance — apps override BASE_URL via their own constants.
// resolveDevHost rewrites the host to the live Expo bundler IP in dev, so a
// changed Wi-Fi IP never breaks the connection (no .env edits needed).
export const API_BASE_URL =
  resolveDevHost(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';
export const apiClient = createApiClient(API_BASE_URL);

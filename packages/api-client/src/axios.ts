import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'saarthi_access_token';
export const REFRESH_KEY = 'saarthi_refresh_token';

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
      const original = error.config as typeof error.config & { _retry?: boolean };
      if (error.response?.status === 401 && !original._retry) {
        original._retry = true;
        try {
          const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
          if (!refresh) throw new Error('No refresh token');
          const { data } = await client.post('/auth/refresh', { refreshToken: refresh });
          await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
          await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return client(original);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(REFRESH_KEY);
          return Promise.reject(error);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// Default instance — apps override BASE_URL via their own constants
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';
export const apiClient = createApiClient(API_BASE_URL);

import { apiClient } from '../axios';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, REFRESH_KEY } from '../axios';

export interface RequestOtpDto {
  phone: string;
}

export interface VerifyOtpDto {
  phone: string;
  otp: string;
  /** Roles the calling app serves; the backend refuses a number lacking any of them. */
  allowedRoles?: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  person: {
    id: string;
    phone: string;
    name: string;
  };
  memberships: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    role: string;
  }>;
}

export const authApi = {
  requestOtp: async (dto: RequestOtpDto) => {
    const { data } = await apiClient.post('/auth/otp/request', dto);
    return data.data as { message: string };
  },

  verifyOtp: async (dto: VerifyOtpDto): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/otp/verify', dto);
    const auth = data.data as AuthResponse;
    await SecureStore.setItemAsync(TOKEN_KEY, auth.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, auth.refreshToken);
    return auth;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await apiClient.post('/auth/refresh', { refreshToken });
    return data.data as { accessToken: string; refreshToken: string };
  },

  listMemberships: async () => {
    const { data } = await apiClient.get('/auth/memberships');
    return data.data as Array<{ id: string; tenantId: string; tenantName: string; role: string }>;
  },

  switchContext: async (membershipId: string) => {
    const { data } = await apiClient.post('/auth/context/switch', { membershipId });
    const result = data.data as { accessToken: string; refreshToken: string; membership: { id: string; tenantId: string; tenantName: string; role: string } };
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken);
    return result;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

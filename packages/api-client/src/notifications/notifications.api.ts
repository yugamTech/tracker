import { apiClient } from '../axios';
import type { Notification, NotificationPreference } from '@saarthi/types';

export interface PreferenceUpdate {
  category: string;
  push?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
}

export interface RegisterDeviceTokenDto {
  token: string;
  platform: string;
}

export const notificationsApi = {
  getMyNotifications: async (page = 1) => {
    const { data } = await apiClient.get('/notifications', { params: { page } });
    return data.data as Notification[];
  },

  markRead: async (id: string) => {
    const { data } = await apiClient.patch(`/notifications/${id}/read`);
    return data.data as { success: boolean };
  },

  markAllRead: async () => {
    const { data } = await apiClient.post('/notifications/read-all');
    return data.data as { success: boolean };
  },

  getPreferences: async () => {
    const { data } = await apiClient.get('/notifications/preferences');
    return data.data as NotificationPreference[];
  },

  updatePreferences: async (updates: PreferenceUpdate[]) => {
    const { data } = await apiClient.put('/notifications/preferences', { updates });
    return data.data as NotificationPreference[];
  },

  registerDeviceToken: async (dto: RegisterDeviceTokenDto) => {
    const { data } = await apiClient.post('/notifications/device-token', dto);
    return data.data;
  },

  removeDeviceToken: async (token: string) => {
    const { data } = await apiClient.delete(`/notifications/device-token/${encodeURIComponent(token)}`);
    return data.data as { success: boolean };
  },

  sendDriverMessage: async (tripId: string, messageKey: string) => {
    const { data } = await apiClient.post('/messages/driver', { tripId, messageKey });
    return data.data;
  },

  getDriverMessages: async (tripId: string) => {
    const { data } = await apiClient.get(`/messages/driver/${tripId}`);
    return data.data as DriverMessage[];
  },
};

export interface DriverMessage {
  id: string;
  tripId: string;
  senderId: string;
  messageKey: string;
  sentAt: string;
  deliveredAt?: string;
  sender?: { name: string };
}

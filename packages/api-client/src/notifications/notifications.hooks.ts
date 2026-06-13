import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type PreferenceUpdate, type RegisterDeviceTokenDto } from './notifications.api';

export const notificationKeys = {
  all: (page?: number) => ['notifications', page ?? 1] as const,
  preferences: ['notifications', 'preferences'] as const,
  driverMessages: (tripId: string) => ['notifications', 'driver-messages', tripId] as const,
};

export const useMyNotifications = (page = 1) =>
  useQuery({
    queryKey: notificationKeys.all(page),
    queryFn: () => notificationsApi.getMyNotifications(page),
  });

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useNotificationPreferences = () =>
  useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: notificationsApi.getPreferences,
  });

export const useUpdatePreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: PreferenceUpdate[]) => notificationsApi.updatePreferences(updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.preferences }),
  });
};

export const useRegisterDeviceToken = () =>
  useMutation({
    mutationFn: (dto: RegisterDeviceTokenDto) => notificationsApi.registerDeviceToken(dto),
  });

export const useRemoveDeviceToken = () =>
  useMutation({
    mutationFn: (token: string) => notificationsApi.removeDeviceToken(token),
  });

export const useSendDriverMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, messageKey }: { tripId: string; messageKey: string }) =>
      notificationsApi.sendDriverMessage(tripId, messageKey),
    onSuccess: (_data, { tripId }) =>
      qc.invalidateQueries({ queryKey: notificationKeys.driverMessages(tripId) }),
  });
};

export const useDriverMessages = (tripId: string) =>
  useQuery({
    queryKey: notificationKeys.driverMessages(tripId),
    queryFn: () => notificationsApi.getDriverMessages(tripId),
    enabled: !!tripId,
    refetchInterval: 10_000,
  });

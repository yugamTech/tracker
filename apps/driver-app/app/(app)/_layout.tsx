import React, { useEffect } from 'react';
import { Stack, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useRegisterDeviceToken } from '@yaanam/api-client';
import { transitions } from '@yaanam/ui';
import { useAuthStore } from '../../store/auth.store';

export default function AppLayout() {
  const person = useAuthStore((s) => s.person);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { mutate: registerToken } = useRegisterDeviceToken();

  useEffect(() => {
    if (person?.id) {
      // Dev stub — replace with real Expo push token in Phase 4-prod.
      registerToken({ token: `dev-token-${person.id}`, platform: Platform.OS });
    }
  }, [person?.id]);

  // Protected group: a dropped session (hard 401, or never authenticated) falls
  // back to login. Hooks above always run; this guard returns only after them.
  if (!isAuthenticated) return <Redirect href="/(auth)/phone" />;

  return (
    <Stack screenOptions={{ headerShown: false, ...transitions.slideFromRight }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="history" />
      <Stack.Screen name="kyc" />
      <Stack.Screen name="trip/[tripId]/index" />
      <Stack.Screen name="trip/[tripId]/active" />
      <Stack.Screen name="trip/[tripId]/complete" />
      <Stack.Screen name="trip/alerts" options={transitions.modalSlideUp} />
      <Stack.Screen name="trip/attendance/[stopId]" />
      <Stack.Screen name="trip/attendance/photo" options={transitions.modalSlideUp} />
      <Stack.Screen name="vehicle-check" />
    </Stack>
  );
}

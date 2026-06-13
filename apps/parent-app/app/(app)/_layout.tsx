import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { colors } from '@saarthi/ui';
import { useRegisterDeviceToken } from '@saarthi/api-client';
import { useAuthStore } from '../../store/auth.store';

export default function AppLayout() {
  const person = useAuthStore((s) => s.person);
  const { mutate: registerToken } = useRegisterDeviceToken();

  useEffect(() => {
    if (person?.id) {
      // Dev stub — replace with real Expo push token in Phase 4-prod.
      registerToken({ token: `dev-token-${person.id}`, platform: Platform.OS });
    }
  }, [person?.id]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text> }} />
      <Tabs.Screen name="track" options={{ title: 'Track', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📍</Text> }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚌</Text> }} />
      <Tabs.Screen name="complaints" options={{ title: 'Help', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text> }} />
      <Tabs.Screen name="payments" options={{ title: 'Pay', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💳</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }} />

      {/* ── Hidden detail / flow screens — must be declared so Router knows they exist ── */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="ratings" options={{ href: null }} />
    </Tabs>
  );
}

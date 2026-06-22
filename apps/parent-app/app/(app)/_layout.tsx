import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Platform, Text } from 'react-native';
import { colors, fontSizes, fontWeights } from '@saarthi/ui';
import { useRegisterDeviceToken } from '@saarthi/api-client';
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
    <Tabs
      screenOptions={{
        headerShown: false,
        // Soft cross-fade between tabs — the same calm motion language as the
        // shared `fade` stack preset, applied at the tab level.
        animation: 'fade',
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
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold },
      }}
    >
      {/* ── Visible tabs (5) ── */}
      {/* Tab label (title) is the a11y name; the emoji glyph is decorative and hidden from screen readers. */}
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 20, color }}>🏠</Text> }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ color }) => <Text accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 20, color }}>🚌</Text> }} />
      <Tabs.Screen name="complaints" options={{ title: 'Help', tabBarIcon: ({ color }) => <Text accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 20, color }}>💬</Text> }} />
      <Tabs.Screen name="payments" options={{ title: 'Pay', tabBarIcon: ({ color }) => <Text accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 20, color }}>💳</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 20, color }}>👤</Text> }} />

      {/* ── Hidden detail / flow screens — declared so Router knows them, kept off the tab bar ── */}
      {/* Child selector: profile-switch landing, reachable from "Switch child". Tab bar hidden. */}
      <Tabs.Screen name="child-select" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Track stays reachable from home + trips, but is no longer its own tab. */}
      <Tabs.Screen name="track" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="ratings" options={{ href: null }} />
    </Tabs>
  );
}

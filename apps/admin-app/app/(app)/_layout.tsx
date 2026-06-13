import React, { useEffect } from 'react';
import { Drawer } from 'expo-router/drawer';
import { Platform, Text } from 'react-native';
import { colors, fontSizes, fontWeights } from '@saarthi/ui';
import { useRegisterDeviceToken } from '@saarthi/api-client';
import { useAuthStore } from '../../store/auth.store';

const HIDDEN: React.ComponentProps<typeof Drawer.Screen>['options'] = {
  drawerItemStyle: { display: 'none' },
};

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
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: '#7C3AED',
        headerTitleStyle: { fontWeight: fontWeights.bold as never, fontSize: fontSizes.lg },
        drawerActiveTintColor: '#7C3AED',
        drawerInactiveTintColor: colors.gray500,
        drawerLabelStyle: { fontSize: fontSizes.base, fontWeight: fontWeights.medium as never },
      }}
    >
      {/* ── Visible drawer items ── */}
      <Drawer.Screen name="dashboard/index" options={{ title: 'Dashboard', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📊</Text> }} />
      <Drawer.Screen name="dashboard/trends" options={{ title: 'Trends', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📈</Text> }} />
      <Drawer.Screen name="fleet/index" options={{ title: 'Live Fleet', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🚌</Text> }} />
      <Drawer.Screen name="fleet/exceptions" options={{ title: 'Exceptions', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚠️</Text> }} />
      <Drawer.Screen name="trips/index" options={{ title: 'Trip History', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🗓️</Text> }} />
      <Drawer.Screen name="people/index" options={{ title: 'People', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>👥</Text> }} />
      <Drawer.Screen name="routes/index" options={{ title: 'Routes', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🗺️</Text> }} />
      <Drawer.Screen name="complaints/index" options={{ title: 'Complaints', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💬</Text> }} />
      <Drawer.Screen name="complaints/kpi" options={{ title: 'Complaint KPIs', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📉</Text> }} />
      <Drawer.Screen name="payments/index" options={{ title: 'Payments', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💳</Text> }} />
      <Drawer.Screen name="payments/reconciliation" options={{ title: 'Reconciliation', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🔄</Text> }} />
      <Drawer.Screen name="settings/index" options={{ title: 'Settings', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚙️</Text> }} />

      {/* ── Hidden detail / CRUD screens ── */}
      <Drawer.Screen name="fleet/[tripId]" options={{ ...HIDDEN, title: 'Trip Monitor' }} />
      <Drawer.Screen name="trips/new" options={{ ...HIDDEN, title: 'Schedule Trip' }} />
      <Drawer.Screen name="people/students/index" options={HIDDEN} />
      <Drawer.Screen name="people/students/[id]" options={{ ...HIDDEN, title: 'Student Detail' }} />
      <Drawer.Screen name="people/students/new" options={{ ...HIDDEN, title: 'Add Student' }} />
      <Drawer.Screen name="people/staff/index" options={{ ...HIDDEN, title: 'Staff' }} />
      <Drawer.Screen name="people/staff/new" options={{ ...HIDDEN, title: 'Add Staff' }} />
      <Drawer.Screen name="people/staff/[id]" options={{ ...HIDDEN, title: 'Staff Detail' }} />
      <Drawer.Screen name="people/import/index" options={{ ...HIDDEN, title: 'Import Data' }} />
      <Drawer.Screen name="people/import/preview" options={{ ...HIDDEN, title: 'Import Preview' }} />
      <Drawer.Screen name="people/import/result" options={{ ...HIDDEN, title: 'Import Result' }} />
      <Drawer.Screen name="routes/[routeId]" options={{ ...HIDDEN, title: 'Route Detail' }} />
      <Drawer.Screen name="routes/vehicle/[vehicleId]" options={{ ...HIDDEN, title: 'Vehicle Detail' }} />
      <Drawer.Screen name="complaints/[id]" options={{ ...HIDDEN, title: 'Complaint Detail' }} />
      <Drawer.Screen name="payments/fee-plans" options={{ ...HIDDEN, title: 'Fee Plans' }} />
      <Drawer.Screen name="settings/notifications" options={{ ...HIDDEN, title: 'Notification Audit' }} />
    </Drawer>
  );
}

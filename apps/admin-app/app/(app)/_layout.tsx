import React, { useEffect } from 'react';
import { Drawer } from 'expo-router/drawer';
import { Platform, StyleSheet } from 'react-native';
import { colors } from '@saarthi/ui';
import { useRegisterDeviceToken } from '@saarthi/api-client';
import { useAuthStore } from '../../store/auth.store';
import { useResponsive } from '../../hooks/useResponsive';
import { Sidebar } from '../../components/Sidebar';
import { NavHeader } from '../../components/NavHeader';

/** Primary section screens render their own AppHeader (via AdminScreen), so the
 *  navigator header is suppressed for them. Everything else gets NavHeader. */
const SECTION = { headerShown: false } as const;

export default function AppLayout() {
  const person = useAuthStore((s) => s.person);
  const { mutate: registerToken } = useRegisterDeviceToken();
  const { isDesktop } = useResponsive();

  useEffect(() => {
    if (person?.id) {
      // Dev stub — replace with real Expo push token in Phase 4-prod.
      registerToken({ token: `dev-token-${person.id}`, platform: Platform.OS });
    }
  }, [person?.id]);

  return (
    <Drawer
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        header: (props) => <NavHeader {...props} />,
        // Always-on rail on wide screens; collapsible overlay on phones.
        drawerType: isDesktop ? 'permanent' : 'front',
        drawerStyle: {
          width: isDesktop ? 280 : 300,
          backgroundColor: colors.background,
          borderRightColor: colors.border,
          borderRightWidth: StyleSheet.hairlineWidth,
        },
        sceneStyle: { backgroundColor: colors.backgroundMuted },
        overlayColor: colors.overlay,
        swipeEdgeWidth: 64,
      }}
    >
      {/* ── Primary destinations (8) ── */}
      <Drawer.Screen name="dashboard/index" options={{ title: 'Dashboard', ...SECTION }} />
      <Drawer.Screen name="fleet/index" options={{ title: 'Live Fleet', ...SECTION }} />
      <Drawer.Screen name="trips/index" options={{ title: 'Trips', ...SECTION }} />
      <Drawer.Screen name="people/index" options={{ title: 'People', ...SECTION }} />
      <Drawer.Screen name="routes/index" options={{ title: 'Routes', ...SECTION }} />
      <Drawer.Screen name="complaints/index" options={{ title: 'Complaints', ...SECTION }} />
      <Drawer.Screen name="payments/index" options={{ title: 'Payments', ...SECTION }} />
      <Drawer.Screen name="settings/index" options={{ title: 'Settings', ...SECTION }} />

      {/* ── Secondary section screens (reached via SubNav, kept as hidden routes) ── */}
      <Drawer.Screen name="dashboard/trends" options={{ title: 'Trends', ...SECTION }} />
      <Drawer.Screen name="trips/exceptions" options={{ title: 'Exceptions', ...SECTION }} />
      <Drawer.Screen name="complaints/kpi" options={{ title: 'Complaint KPIs', ...SECTION }} />
      <Drawer.Screen name="payments/reconciliation" options={{ title: 'Reconciliation', ...SECTION }} />
      <Drawer.Screen name="payments/fee-plans" options={{ title: 'Fee Plans', ...SECTION }} />

      {/* ── Detail / CRUD screens (pushed; NavHeader supplies a back affordance) ── */}
      <Drawer.Screen name="fleet/[tripId]" options={{ title: 'Trip Monitor' }} />
      {/* Reached from Live Fleet / Dashboard; renders its own AppHeader with a back affordance. */}
      <Drawer.Screen name="fleet/exceptions" options={{ title: 'Fleet Exceptions', ...SECTION }} />
      <Drawer.Screen name="trips/new" options={{ title: 'Schedule Trip' }} />
      <Drawer.Screen name="trips/schedule-result" options={{ title: 'Scheduled' }} />
      <Drawer.Screen name="people/students/index" options={{ title: 'Students' }} />
      <Drawer.Screen name="people/students/[id]" options={{ title: 'Student Detail' }} />
      <Drawer.Screen name="people/students/new" options={{ title: 'Add Student' }} />
      <Drawer.Screen name="people/staff/index" options={{ title: 'Staff' }} />
      <Drawer.Screen name="people/staff/new" options={{ title: 'Add Staff' }} />
      <Drawer.Screen name="people/staff/[id]" options={{ title: 'Staff Detail' }} />
      <Drawer.Screen name="people/import/index" options={{ title: 'Import Data' }} />
      <Drawer.Screen name="people/import/preview" options={{ title: 'Import Preview' }} />
      <Drawer.Screen name="people/import/result" options={{ title: 'Import Result' }} />
      <Drawer.Screen name="routes/[routeId]" options={{ title: 'Route Detail' }} />
      <Drawer.Screen name="routes/vehicle/[vehicleId]" options={{ title: 'Vehicle Detail' }} />
      <Drawer.Screen name="complaints/[id]" options={{ title: 'Complaint Detail' }} />
      <Drawer.Screen name="settings/notifications" options={{ title: 'Notification Audit' }} />
    </Drawer>
  );
}

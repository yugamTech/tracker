import { Drawer } from 'expo-router/drawer';
import { colors, fontSizes, fontWeights } from '@saarthi/ui';
import { Text } from 'react-native';

export default function AppLayout() {
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
      <Drawer.Screen name="dashboard/index" options={{ title: 'Dashboard', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📊</Text> }} />
      <Drawer.Screen name="fleet/index" options={{ title: 'Live Fleet', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🚌</Text> }} />
      <Drawer.Screen name="people/index" options={{ title: 'People', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>👥</Text> }} />
      <Drawer.Screen name="routes/index" options={{ title: 'Routes', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🗺️</Text> }} />
      <Drawer.Screen name="complaints/index" options={{ title: 'Complaints', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💬</Text> }} />
      <Drawer.Screen name="payments/index" options={{ title: 'Payments', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💳</Text> }} />
      <Drawer.Screen name="settings/index" options={{ title: 'Settings', drawerIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚙️</Text> }} />
    </Drawer>
  );
}

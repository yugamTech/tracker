import { Tabs } from 'expo-router';
import { colors } from '@saarthi/ui';
import { Text } from 'react-native';

export default function AppLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text> }} />
      <Tabs.Screen name="track" options={{ title: 'Track', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📍</Text> }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚌</Text> }} />
      <Tabs.Screen name="complaints" options={{ title: 'Help', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text> }} />
      <Tabs.Screen name="payments" options={{ title: 'Pay', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💳</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }} />
    </Tabs>
  );
}

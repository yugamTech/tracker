import { Stack } from 'expo-router';
import { colors } from '@saarthi/ui';

export default function TripsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[tripId]/index" options={{ title: 'Past Rides' }} />
      <Stack.Screen name="[tripId]/replay" options={{ title: 'Ride Replay' }} />
    </Stack>
  );
}

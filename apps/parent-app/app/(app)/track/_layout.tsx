import { Stack } from 'expo-router';
import { colors } from '@saarthi/ui';

export default function TrackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="[tripId]" options={{ headerShown: false }} />
      <Stack.Screen name="trip-detail/[tripId]" options={{ title: 'Trip Detail' }} />
    </Stack>
  );
}

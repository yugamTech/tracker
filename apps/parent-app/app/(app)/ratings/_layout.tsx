import { Stack } from 'expo-router';
import { colors } from '@saarthi/ui';

export default function RatingsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' }, headerShadowVisible: false }}>
      <Stack.Screen name="ride" options={{ title: 'Rate Ride' }} />
      <Stack.Screen name="resolution/[complaintId]" options={{ title: 'Rate Resolution' }} />
    </Stack>
  );
}

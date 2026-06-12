import { Stack } from 'expo-router';
import { colors } from '@saarthi/ui';

export default function ComplaintsLayout() {
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
      <Stack.Screen name="new" options={{ title: 'Raise Issue' }} />
      <Stack.Screen name="[id]" options={{ title: 'Complaint Detail' }} />
    </Stack>
  );
}

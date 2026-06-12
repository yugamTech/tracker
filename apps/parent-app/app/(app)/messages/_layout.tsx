import { Stack } from 'expo-router';
import { colors } from '@saarthi/ui';

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' }, headerShadowVisible: false }}>
      <Stack.Screen name="driver" options={{ title: 'Message Driver' }} />
    </Stack>
  );
}

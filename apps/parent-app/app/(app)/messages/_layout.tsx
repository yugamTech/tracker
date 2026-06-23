import { Stack } from 'expo-router';
import { colors, transitions } from '@yaanam/ui';

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' }, headerShadowVisible: false, ...transitions.slideFromRight }}>
      <Stack.Screen name="driver" options={{ headerShown: false }} />
    </Stack>
  );
}

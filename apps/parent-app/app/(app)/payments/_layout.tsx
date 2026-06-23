import { Stack } from 'expo-router';
import { colors, transitions } from '@yaanam/ui';

export default function PaymentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        ...transitions.slideFromRight,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ title: 'Payment History' }} />
      <Stack.Screen name="mandate" options={{ title: 'Auto-Pay Setup' }} />
      <Stack.Screen name="pay/[invoiceId]" options={{ headerShown: false }} />
    </Stack>
  );
}

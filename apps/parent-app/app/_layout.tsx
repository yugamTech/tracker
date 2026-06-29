import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@yaanam/api-client';
import { ToastProvider, ErrorBoundary } from '@yaanam/ui';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';

// Crash/error reporting. Behind an env DSN so local/dev (no DSN) is a clean
// no-op — Sentry.init is skipped and capture calls below silently do nothing.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn });
}

export default function RootLayout() {
  // NOTE: do NOT navigate (router.replace) from here on first render — the root
  // navigator isn't mounted yet. Auth gating is done declaratively in app/index.tsx.
  return (
    <ErrorBoundary onError={(error) => Sentry.captureException(error)}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

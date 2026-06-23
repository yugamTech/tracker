import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@yaanam/api-client';
import { ToastProvider, ErrorBoundary } from '@yaanam/ui';
import { StatusBar } from 'expo-status-bar';
// Side-effect import: registers the background-location TaskManager task at app
// startup so an OS-delivered location event always finds a defined handler.
import '../services/location';

export default function RootLayout() {
  // NOTE: do NOT navigate (router.replace) from here on first render — the root
  // navigator isn't mounted yet. Auth gating is done declaratively in app/index.tsx.
  return (
    <ErrorBoundary>
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

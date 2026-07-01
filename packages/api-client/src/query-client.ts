import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutes
      gcTime: 1000 * 60 * 10,          // 10 minutes
      retry: 2,
      // Cross-client freshness: an admin watching a driver-completed trip (or a
      // parent whose driver just started the bus) gets the new status when the
      // app regains focus or the network reconnects — not stale until remount.
      // staleTime still gates these, so a screen refetches at most once per 2 min
      // of focus churn rather than on every tab switch (no runaway loops).
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

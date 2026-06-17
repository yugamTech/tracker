/**
 * Back-navigation for the parent app's nested detail screens.
 *
 * The parent app is bottom-tabs, and detail screens (track, complaint detail,
 * trip detail) are reached by a push from a list — sometimes from a *different*
 * tab (e.g. home → track). Plain `router.back()` is right when there's history
 * to pop (it returns to wherever the user came from), but on a cold entry
 * (deep link, or popped past the stack root) it can leave the user on a bare
 * tab root. So we prefer history and fall back to each screen's EXPLICIT parent
 * list — the same intent as the admin app's back handlers (see
 * `apps/admin-app/lib/nav.ts`).
 *
 * Keyed by expo-router route name (the file's route, e.g. `track/[tripId]`).
 */
import { router } from 'expo-router';

export const PARENT_ROUTE: Record<string, string> = {
  'track/[tripId]': '/(app)/trips',
  'track/trip-detail/[tripId]': '/(app)/trips',
  'trips/[tripId]/index': '/(app)/trips',
  'trips/[tripId]/replay': '/(app)/trips',
  'complaints/[id]': '/(app)/complaints',
};

/**
 * Navigate back to a screen's originating list. Pops history when available
 * (returns to the screen the user came from); otherwise navigates to the
 * screen's explicit parent list, falling back to Home for anything unmapped.
 */
export function goBackTo(routeName: string): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.navigate((PARENT_ROUTE[routeName] ?? '/(app)/home') as never);
}

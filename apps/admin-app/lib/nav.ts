/**
 * Information architecture for the admin app — the single source of truth for
 * the navigation shell (sidebar on desktop, drawer on phone).
 *
 * Exactly 8 primary destinations, in the required order:
 *   Dashboard | Live Fleet | Trips | People | Routes | Complaints | Payments | Settings
 *
 * Secondary screens live off the primary nav and are reached from their parent
 * via a SegmentedControl (see `components/SubNav`), staying as hidden routes.
 */

import { router } from 'expo-router';

export interface NavItem {
  /** Stable key + path prefix used for active-state matching. */
  key: string;
  label: string;
  icon: string;
  /** Target route for navigation. */
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SubNavSegment {
  label: string;
  /** Stable segment value (also the active key for the current screen). */
  value: string;
  /** Route this segment navigates to. */
  href: string;
}

/**
 * Section sub-navigation — a primary screen and its secondary screens, shown as
 * a SegmentedControl on both. Each secondary stays a hidden route, reachable
 * only from its parent here.
 */
export const SUBNAV: Record<string, SubNavSegment[]> = {
  dashboard: [
    { label: 'Overview', value: 'overview', href: '/(app)/dashboard' },
    { label: 'Trends', value: 'trends', href: '/(app)/dashboard/trends' },
  ],
  trips: [
    { label: 'Trips', value: 'trips', href: '/(app)/trips' },
    { label: 'Exceptions', value: 'exceptions', href: '/(app)/trips/exceptions' },
  ],
  routes: [
    { label: 'Routes', value: 'routes', href: '/(app)/routes' },
    { label: 'Emergency', value: 'emergency', href: '/(app)/routes/emergency' },
  ],
  complaints: [
    { label: 'Complaints', value: 'complaints', href: '/(app)/complaints' },
    { label: 'KPIs', value: 'kpi', href: '/(app)/complaints/kpi' },
  ],
  payments: [
    { label: 'Overview', value: 'overview', href: '/(app)/payments' },
    { label: 'Reconciliation', value: 'reconciliation', href: '/(app)/payments/reconciliation' },
    { label: 'Fee Plans', value: 'fee-plans', href: '/(app)/payments/fee-plans' },
  ],
};

/** Grouped for the sidebar; order across groups is the canonical primary order. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '◴', href: '/(app)/dashboard' },
      { key: 'fleet', label: 'Live Fleet', icon: '⬢', href: '/(app)/fleet' },
      { key: 'trips', label: 'Trips', icon: '◆', href: '/(app)/trips' },
    ],
  },
  {
    title: 'Management',
    items: [
      { key: 'people', label: 'People', icon: '◖', href: '/(app)/people' },
      { key: 'routes', label: 'Routes', icon: '⬣', href: '/(app)/routes' },
    ],
  },
  {
    title: 'Service',
    items: [
      { key: 'complaints', label: 'Complaints', icon: '◈', href: '/(app)/complaints' },
      { key: 'payments', label: 'Payments', icon: '▣', href: '/(app)/payments' },
    ],
  },
  {
    title: 'System',
    items: [{ key: 'settings', label: 'Settings', icon: '⚙', href: '/(app)/settings' }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * "Section" screens belong to the primary nav (a primary screen or one of its
 * SegmentedControl secondaries). They render their own AppHeader via
 * `AdminScreen` and surface a menu button on phone. Everything else (detail &
 * CRUD screens) is reached by a push and gets a back affordance from `NavHeader`.
 *
 * Keyed by expo-router route name (the `name` prop on each Drawer.Screen).
 */
export const SECTION_ROUTES = new Set<string>([
  'dashboard/index',
  'dashboard/trends',
  'fleet/index',
  'trips/index',
  'trips/exceptions',
  'people/index',
  'routes/index',
  'routes/emergency',
  'complaints/index',
  'complaints/kpi',
  'payments/index',
  'payments/reconciliation',
  'payments/fee-plans',
  'settings/index',
]);

/**
 * Which primary nav key a pathname belongs to (for sidebar active state).
 * `usePathname()` strips group segments, so paths look like `/people/students`.
 */
export function activeKeyForPath(pathname: string): string | null {
  return (
    NAV_ITEMS.find((i) => pathname === `/${i.key}` || pathname.startsWith(`/${i.key}/`))?.key ?? null
  );
}

/**
 * Explicit parent list for every detail / sub / CRUD screen — keyed by the
 * expo-router route name (the `name` on its `Drawer.Screen`).
 *
 * Back must land on the list a screen logically belongs to, NOT on `router.back()`:
 * on a Drawer the list and its detail are *siblings*, so the history stack is
 * whatever the user happened to visit before (very often the Dashboard). Mapping
 * each screen to its parent here makes "back" deterministic from any entry point.
 */
export const PARENT_ROUTE: Record<string, string> = {
  // Trips & fleet — a trip/fleet detail belongs to the Trips list.
  'fleet/[tripId]': '/(app)/trips',
  'fleet/exceptions': '/(app)/fleet',
  'trips/new': '/(app)/trips',
  'trips/schedule-result': '/(app)/trips',
  // People — student/staff detail & CRUD all belong to the People list.
  'people/students/index': '/(app)/people',
  'people/students/[id]': '/(app)/people',
  'people/students/new': '/(app)/people',
  'people/staff/index': '/(app)/people',
  'people/staff/[id]': '/(app)/people',
  'people/staff/new': '/(app)/people',
  'people/import/index': '/(app)/people',
  'people/import/preview': '/(app)/people/import',
  'people/import/result': '/(app)/people/import',
  // Routes & vehicles — both belong to the Routes list.
  'routes/[routeId]': '/(app)/routes',
  'routes/vehicle/[vehicleId]': '/(app)/routes',
  'routes/emergency': '/(app)/routes',
  // Complaints
  'complaints/[id]': '/(app)/complaints',
  // Settings
  'settings/notifications': '/(app)/settings',
  'settings/profile': '/(app)/settings',
  'settings/school': '/(app)/settings',
  'settings/bell-timings': '/(app)/settings',
  'settings/alert-numbers': '/(app)/settings',
  'settings/feature-flags': '/(app)/settings',
  'settings/privacy': '/(app)/settings',
};

/**
 * Navigate back to a screen's EXPLICIT parent list. Pass the expo-router route
 * name (e.g. `'routes/[routeId]'`). Falls back to history, then the dashboard,
 * for any screen not in the map. Centralizes the back affordance for NavHeader
 * and any screen with its own back/done button.
 */
export function goBackTo(routeName: string): void {
  const parent = PARENT_ROUTE[routeName];
  if (parent) {
    router.navigate(parent as never);
  } else if (router.canGoBack()) {
    router.back();
  } else {
    router.navigate('/(app)/dashboard' as never);
  }
}

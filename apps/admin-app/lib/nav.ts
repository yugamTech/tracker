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

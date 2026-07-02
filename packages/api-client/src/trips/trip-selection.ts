/**
 * Pure helpers for the parent trip experience:
 *  - pickTripRider: derive WHICH child/rider a trip detail shows — keyed to the
 *    opened trip's own riders ∩ the parent's guarded students, NOT the global
 *    "active child". This is the fix for the stale-child bug: opening a trip must
 *    show that trip's child, even if the active-child selection has since changed.
 *  - sortParentTrips: deterministic ordering for the home feed — the live ride
 *    first, then upcoming (soonest first), then finished (most-recent first).
 *    Never "the first element of an unsorted array".
 */

export interface RiderLike {
  studentId: string;
}

/**
 * Choose the rider a trip detail should display.
 *
 * The candidate set is the trip's own riders intersected with the parent's
 * guarded students (the server already scopes this, but we re-intersect so the
 * client can never show a child the parent doesn't guard). `preferredStudentId`
 * (e.g. the currently-viewed child) is only ever honoured when that child is
 * ALREADY a rider on this trip — so it can act as a tiebreak for a sibling trip
 * without ever letting stale shared state select a child who isn't on the trip.
 * Returns null when the parent guards none of the trip's riders.
 */
export function pickTripRider<R extends RiderLike>(
  riders: R[] | null | undefined,
  guardedStudentIds: ReadonlySet<string> | readonly string[],
  preferredStudentId?: string | null,
): R | null {
  const guarded = Array.isArray(guardedStudentIds)
    ? new Set(guardedStudentIds)
    : (guardedStudentIds as ReadonlySet<string>);
  const candidates = (riders ?? []).filter((r) => guarded.has(r.studentId));
  if (candidates.length === 0) return null;
  if (preferredStudentId) {
    const preferred = candidates.find((r) => r.studentId === preferredStudentId);
    if (preferred) return preferred;
  }
  return candidates[0];
}

export interface TripOrderLike {
  status?: string | null;
  scheduledStart?: string | null;
  date?: string | null;
  completedAt?: string | null;
}

/** 0 = live (running), 1 = upcoming (scheduled), 2 = finished/terminal or unknown. */
function tripTier(t: TripOrderLike): 0 | 1 | 2 {
  const s = (t.status ?? '').toUpperCase();
  if (s === 'STARTED' || s === 'IN_PROGRESS') return 0;
  if (s === 'SCHEDULED') return 1;
  return 2;
}

const ms = (v?: string | null): number => {
  if (!v) return NaN;
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? NaN : n;
};

/** Planned departure for ordering upcoming/live trips. */
const startMs = (t: TripOrderLike): number => {
  const n = ms(t.scheduledStart);
  return Number.isNaN(n) ? ms(t.date) : n;
};
/** Effective end for ordering finished trips (most-recent first). */
const endMs = (t: TripOrderLike): number => {
  const c = ms(t.completedAt);
  return Number.isNaN(c) ? startMs(t) : c;
};

/**
 * Total order for the parent home feed. Live trips float to the top, then
 * upcoming trips soonest-first, then finished trips most-recent-first. Ties and
 * missing timestamps resolve deterministically (unknown times sort last within
 * their tier), so the "hero" is a pure function of the data — never array order.
 */
export function compareParentTrips(a: TripOrderLike, b: TripOrderLike): number {
  const ta = tripTier(a);
  const tb = tripTier(b);
  if (ta !== tb) return ta - tb;

  if (ta === 2) {
    // Finished: most recent first. NaN (unknown) sorts last.
    const ea = endMs(a);
    const eb = endMs(b);
    if (Number.isNaN(ea) && Number.isNaN(eb)) return 0;
    if (Number.isNaN(ea)) return 1;
    if (Number.isNaN(eb)) return -1;
    return eb - ea;
  }

  // Live / upcoming: soonest first. NaN (unknown) sorts last.
  const sa = startMs(a);
  const sb = startMs(b);
  if (Number.isNaN(sa) && Number.isNaN(sb)) return 0;
  if (Number.isNaN(sa)) return 1;
  if (Number.isNaN(sb)) return -1;
  return sa - sb;
}

/** Non-mutating sort of a parent's trips into the home-feed priority order. */
export function sortParentTrips<T extends TripOrderLike>(trips: T[]): T[] {
  return [...trips].sort(compareParentTrips);
}

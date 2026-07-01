import { formatTripTime } from '../daily-checks/daily-checks.window';

/**
 * THE single source of truth for the per-child trip status label a parent sees.
 *
 * CORE PRINCIPLE: the label is a pure function of BOTH `trip.status` AND the
 * child's boarding state — never of `boardStatus` alone. A finished trip must
 * ALWAYS read as terminal (e.g. "Reached school") and NEVER as a live label
 * ("On the bus") even if the rider row is still BOARDED. Keep this the only place
 * that maps (direction × trip.status × boardStatus) → copy, and use it everywhere
 * the parent sees status (home, trips list, track) so the three can never drift.
 */

export type TripLabelDirection = 'PICKUP' | 'DROP';

/**
 * Coarse state behind the label, so a screen can pick a Badge colour without
 * re-deriving anything. `enroute` = live & the child hasn't boarded/alighted yet;
 * `onboard` = live & aboard; `completed`/`alighted` are terminal outcomes.
 */
export type TripLabelState =
  | 'scheduled'
  | 'enroute'
  | 'onboard'
  | 'not_boarded'
  | 'skipped'
  | 'alighted'
  | 'completed'
  | 'cancelled'
  | 'aborted'
  | 'unknown';

export interface TripLabelInput {
  /** The trip's direction. Anything other than 'DROP' is treated as a pickup. */
  direction?: TripLabelDirection | string | null;
  /** The trip's lifecycle status (TripStatus). */
  status?: string | null;
  /** THIS child's rider board status (RiderStatus), or null when unknown. */
  boardStatus?: string | null;
  /** Planned departure (drives the "· not started" scheduled labels). */
  scheduledStart?: string | null;
  /** When the trip finished (drives "Reached school · {time}"). */
  completedAt?: string | null;
  /** This child's ALIGHTED attendance event time — a drop has happened when set. */
  alightedAt?: string | null;
  /** This child's stop name, when the payload carries it. */
  stopName?: string | null;
}

export interface TripLabel {
  label: string;
  state: TripLabelState;
}

/** Semantic Badge variant per state (kept UI-agnostic — screens cast to BadgeVariant). */
export const TRIP_LABEL_VARIANT: Record<TripLabelState, string> = {
  scheduled: 'warning',
  enroute: 'active',
  onboard: 'boarded',
  not_boarded: 'not_boarded',
  skipped: 'cancelled',
  alighted: 'success',
  completed: 'success',
  cancelled: 'cancelled',
  aborted: 'error',
  unknown: 'default',
};

const isLive = (status: string) => status === 'STARTED' || status === 'IN_PROGRESS';

/**
 * Map (direction × trip.status × boardStatus) to the exact copy + state a parent
 * sees. Degrades gracefully when the payload lacks a stop name or a timestamp
 * (list payloads carry less than the trip-detail payload).
 */
export function tripStatusLabel(input: TripLabelInput): TripLabel {
  const direction: TripLabelDirection = input.direction === 'DROP' ? 'DROP' : 'PICKUP';
  const status = (input.status ?? '').toUpperCase();
  const board = input.boardStatus ?? null;
  const stop = input.stopName?.trim() || null;
  const at = (v?: string | null) => formatTripTime(v);

  // ── Terminal trip states first. Once a trip is CANCELLED/ABORTED/COMPLETED we
  //    must never fall through to a live label (the whole point of the bug fix).

  if (status === 'CANCELLED') {
    return { label: direction === 'PICKUP' ? 'Pickup cancelled' : 'Drop cancelled', state: 'cancelled' };
  }
  if (status === 'ABORTED') {
    return { label: 'Trip stopped early', state: 'aborted' };
  }

  // A child whose pickup was skipped reads "skipped" whether the trip later runs
  // or not — but a cancelled/aborted whole trip (above) wins over it.
  if (board === 'CANCELLED') {
    return { label: 'Pickup skipped', state: 'skipped' };
  }

  if (status === 'COMPLETED') {
    if (direction === 'PICKUP') {
      if (board === 'BOARDED') {
        const t = at(input.completedAt);
        return { label: t ? `Reached school · ${t}` : 'Reached school', state: 'completed' };
      }
      // NOT_BOARDED, or still EXPECTED at completion → the child never boarded.
      return { label: 'Did not board', state: 'not_boarded' };
    }
    // DROP completed.
    if (board === 'NOT_BOARDED') {
      return { label: 'Did not board', state: 'not_boarded' };
    }
    if (input.alightedAt) {
      const t = at(input.alightedAt);
      return {
        label: stop ? `Dropped at ${stop}${t ? ` · ${t}` : ''}` : t ? `Dropped off · ${t}` : 'Dropped off',
        state: 'alighted',
      };
    }
    return { label: stop ? `Reached ${stop}` : 'Reached drop-off', state: 'completed' };
  }

  if (status === 'SCHEDULED') {
    const t = at(input.scheduledStart);
    if (direction === 'PICKUP') {
      return { label: t ? `Pickup ${t} · not started` : 'Pickup · not started', state: 'scheduled' };
    }
    return { label: t ? `Drop ${t} · not started` : 'Drop · not started', state: 'scheduled' };
  }

  // ── Live trip (STARTED / IN_PROGRESS). Anything unrecognised falls through to
  //    an honest "unknown" rather than a misleading live label.
  if (isLive(status)) {
    if (direction === 'PICKUP') {
      if (board === 'BOARDED') return { label: 'On the bus', state: 'onboard' };
      if (board === 'NOT_BOARDED') {
        return { label: stop ? `Did not board at ${stop}` : 'Did not board', state: 'not_boarded' };
      }
      return { label: stop ? `Bus on the way · ETA to ${stop}` : 'Bus on the way', state: 'enroute' };
    }
    // DROP live.
    if (input.alightedAt) {
      const t = at(input.alightedAt);
      return {
        label: stop ? `Dropped at ${stop}${t ? ` · ${t}` : ''}` : t ? `Dropped off · ${t}` : 'Dropped off',
        state: 'alighted',
      };
    }
    if (board === 'BOARDED') return { label: 'On the bus · heading home', state: 'onboard' };
    if (board === 'NOT_BOARDED') return { label: 'Did not board', state: 'not_boarded' };
    return { label: stop ? `On the way · ETA to ${stop}` : 'On the way', state: 'enroute' };
  }

  return { label: direction === 'PICKUP' ? 'Pickup' : 'Drop', state: 'unknown' };
}

/** Convenience: the Badge variant string for a label's state. */
export function tripLabelVariant(state: TripLabelState): string {
  return TRIP_LABEL_VARIANT[state] ?? 'default';
}

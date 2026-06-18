/**
 * Vehicle-check timing window, computed client-side to mirror the backend gate in
 * `DailyChecksService.create`: a check may only be submitted within
 * `CHECK_WINDOW_HOURS` before a trip's scheduled start (not the day before).
 * `scheduledStart` falls back to the trip `date`, exactly as the server does.
 */
export const CHECK_WINDOW_HOURS = 2;

export interface CheckWindowInfo {
  /** Whether a check may be submitted right now. */
  canSubmit: boolean;
  /** The moment the window opens (`scheduledStart − CHECK_WINDOW_HOURS`), or null if unknown. */
  opensAt: Date | null;
  /** Human-readable reason when `canSubmit` is false. */
  reason?: string;
}

/** Format an ISO/Date moment as IST `Fri, 20 Jun · 07:15 AM`. */
export function formatTripWhen(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${time}`;
}

/** Just the IST clock time, e.g. `07:15 AM`. */
export function formatTripTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Whether the vehicle check for a trip can be submitted now. Window opens at
 * `scheduledStart − CHECK_WINDOW_HOURS` and stays open through the trip.
 */
export function checkWindowInfo(
  trip: { scheduledStart?: string | null; date?: string } | undefined,
  now: Date = new Date(),
): CheckWindowInfo {
  const startSource = trip?.scheduledStart ?? trip?.date;
  if (!startSource) {
    // No scheduled time to gate against — allow (server stays authoritative).
    return { canSubmit: true, opensAt: null };
  }
  const start = new Date(startSource);
  const opensAt = new Date(start.getTime() - CHECK_WINDOW_HOURS * 60 * 60_000);
  if (now.getTime() < opensAt.getTime()) {
    return {
      canSubmit: false,
      opensAt,
      reason: `Available from ${formatTripTime(opensAt)}`,
    };
  }
  return { canSubmit: true, opensAt };
}

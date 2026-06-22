import type { DriverPingPayload } from '@saarthi/types';

// expo-location + expo-task-manager need the native runtime. In Expo Go the
// foreground watch works but background updates do not, and in any build the
// native module may simply be missing. Load them defensively — exactly like the
// MapLibre fallback in packages/ui/src/components/LiveBusMap.tsx — so an absent
// module degrades to "no live GPS" instead of crashing the trip screen.
let Location: any = null;
let TaskManager: any = null;
let nativeAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Location = require('expo-location');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TaskManager = require('expo-task-manager');
  nativeAvailable = !!Location && !!TaskManager;
} catch {
  // Native location module not linked (e.g. Expo Go without a dev build) — the
  // app keeps working, just without live position broadcast.
}

/** The one background task name for this app — reused across every trip. */
export const BACKGROUND_LOCATION_TASK = 'saarthi-driver-location';

// Cadence mirrors the old simulation (a fix ~every 2.5–3s, or ~15 m of travel)
// so the backend speed / ETA / geofence services see the same update rate they
// were tuned against.
const TIME_INTERVAL_MS = 3000;
const DISTANCE_INTERVAL_M = 15;

export type BroadcastMode = 'background' | 'foreground';
export type BroadcastResult =
  | { status: 'started'; mode: BroadcastMode }
  | { status: 'denied' } //   foreground permission refused by the driver
  | { status: 'unavailable' }; // native module missing (Expo Go without the build)

export interface BroadcastContext {
  tripId: string;
  tenantId: string;
  driverMembershipId: string;
  /** The exact driver:ping emit path the app already uses (api-client emitDriverPing). */
  emit: (payload: DriverPingPayload) => void;
}

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number;
}

// ── Module-scoped broadcast state ──────────────────────────────────────────
// Shared by the foreground watch AND the background task handler — both run in
// the same JS context while the app is alive. Cleared on stop() so a stray late
// callback after teardown is a harmless no-op and can never leak into the next
// trip's broadcast.
let ctx: BroadcastContext | null = null;
let sequence = 0;
let onFixCb: ((fix: Fix) => void) | null = null;
let foregroundSub: { remove: () => void } | null = null;

/** Turn one native fix into the gateway-compatible driver:ping payload and emit it. */
function pushFix(loc: any): void {
  const c = loc?.coords;
  if (!ctx || !c) return; // no active trip (e.g. cold background relaunch) → ignore safely
  const payload: DriverPingPayload = {
    tripId: ctx.tripId,
    tenantId: ctx.tenantId,
    driverMembershipId: ctx.driverMembershipId,
    lat: c.latitude,
    lng: c.longitude,
    // DTO requires accuracy >= 0; some platforms report null/-1 → clamp to 0.
    accuracy: typeof c.accuracy === 'number' && c.accuracy >= 0 ? c.accuracy : 0,
    // expo reports m/s; -1 / null means "unknown" → omit (DTO speed is optional).
    speed: typeof c.speed === 'number' && c.speed >= 0 ? c.speed : undefined,
    deviceTs: new Date(loc.timestamp ?? Date.now()).toISOString(),
    sequence: sequence++,
  };
  ctx.emit(payload);
  onFixCb?.({ lat: payload.lat, lng: payload.lng, accuracy: payload.accuracy, speed: payload.speed });
}

// Register the background task as soon as this module loads (the root layout
// imports it) so an OS-delivered location event always finds a handler. Guarded
// because defineTask is unavailable in Expo Go and re-defining on fast refresh
// would otherwise throw.
if (TaskManager) {
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }: any) => {
      if (error || !data) return;
      const locations = (data.locations ?? []) as any[];
      for (const loc of locations) pushFix(loc);
    });
  } catch {
    // Already defined or task manager unavailable — safe to ignore.
  }
}

/**
 * Foreground-permission pre-check — the integrity gate before a trip may start.
 * Resolves the current foreground-location permission, requesting it once if the
 * driver hasn't decided yet, WITHOUT opening any location stream. A trip cannot
 * legitimately begin without this, so parents can always see the bus and
 * attendance is verified at each stop.
 *
 * `granted: false` means HARD-BLOCK the start; `canAskAgain` tells the caller
 * whether to re-request in-app (true) or deep-link to Settings (false).
 *
 * Same graceful try/catch as startBroadcast: if there is no native location
 * module at all (a build without expo-location, or Expo Go stripped of it) there
 * is no OS permission layer to enforce, so we do NOT block — `granted: true` lets
 * the trip start in a degraded, GPS-less mode (startBroadcast then reports
 * `unavailable`). In a real build the module is always present, so this branch
 * never runs and `granted` always reflects the genuine permission decision.
 */
export async function ensureForegroundPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  if (!nativeAvailable || !Location) return { granted: true, canAskAgain: false };
  try {
    // Read the current status first so we never pop the OS dialog when the driver
    // has already decided (granted, or permanently denied).
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return { granted: true, canAskAgain: current.canAskAgain ?? false };
    if (current.canAskAgain === false) return { granted: false, canAskAgain: false };
    // Undecided and still askable → request once (no stream is started).
    const res = await Location.requestForegroundPermissionsAsync();
    return { granted: !!res.granted, canAskAgain: res.canAskAgain ?? false };
  } catch {
    // Request threw (unsupported surface / module glitch) — don't dead-end the
    // driver; report not-granted-but-askable so the caller offers a retry.
    return { granted: false, canAskAgain: true };
  }
}

async function tryStartBackground(): Promise<boolean> {
  try {
    // Only ask for the sensitive "Always" permission when a trip is actually
    // live — keeps the Play Store prominent-disclosure surface minimal.
    const { granted } = await Location.requestBackgroundPermissionsAsync();
    if (!granted) return false;
    // Clean up a task possibly orphaned by a crashed prior session.
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: TIME_INTERVAL_MS,
      distanceInterval: DISTANCE_INTERVAL_M,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Android requires a foreground-service notification to keep GPS alive.
      foregroundService: {
        notificationTitle: 'Yaanam is sharing your bus location',
        notificationBody: 'Parents and the school can see the bus while your trip is live.',
        notificationColor: '#4F46E5', // brand primary (Indigo 600)
      },
    });
    return true;
  } catch {
    // Expo Go / no background entitlement → caller falls back to a foreground watch.
    return false;
  }
}

/**
 * Begin broadcasting the device's REAL position on driver:ping. Always tears
 * down any prior broadcast first so a previous trip can never leak into this
 * one. Prefers a background-capable foreground-service stream (keeps pinging
 * when the phone locks mid-trip); falls back to a plain foreground watch when
 * background isn't granted/available (including Expo Go, where foreground works
 * but background does not).
 */
export async function startBroadcast(
  context: BroadcastContext,
  handlers: { onFix?: (fix: Fix) => void } = {},
): Promise<BroadcastResult> {
  await stopBroadcast(); // never run two broadcasts at once

  if (!nativeAvailable) return { status: 'unavailable' };

  // Foreground permission is mandatory for any location read at all.
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { status: 'denied' };
  } catch {
    return { status: 'unavailable' };
  }

  ctx = context;
  onFixCb = handlers.onFix ?? null;
  // Seed the monotonic per-trip sequence from wall-clock seconds, like the old
  // loop, so a resumed/restarted broadcast never collides with an earlier
  // (tripId, sequence) the server already stored.
  sequence = Math.floor(Date.now() / 1000);

  // Background-capable updates deliver in BOTH foreground and background, so a
  // single source drives the whole trip when it's available.
  if (await tryStartBackground()) return { status: 'started', mode: 'background' };

  // Otherwise a foreground-only watch (still works in Expo Go).
  try {
    foregroundSub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: TIME_INTERVAL_MS,
        distanceInterval: DISTANCE_INTERVAL_M,
      },
      pushFix,
    );
    return { status: 'started', mode: 'foreground' };
  } catch {
    ctx = null;
    onFixCb = null;
    return { status: 'unavailable' };
  }
}

/** Stop broadcasting and release every location resource. Safe to call twice. */
export async function stopBroadcast(): Promise<void> {
  ctx = null;
  onFixCb = null;
  if (foregroundSub) {
    try {
      foregroundSub.remove();
    } catch {
      // Subscription already gone.
    }
    foregroundSub = null;
  }
  if (nativeAvailable && Location) {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch {
      // Task manager unavailable or task not running — nothing to stop.
    }
  }
}

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies, radius, letterSpacing,
  StatusDot, Button, AnimatedPressable, ScreenContainer, AppHeader, Stagger, useToast,
} from '@yaanam/ui';
import { useTripById, useStartTrip, useCompleteTrip, useAbortTrip, useDriverPing, useRoster } from '@yaanam/api-client';
import type { RosterRider } from '@yaanam/api-client';
import { useAuthStore } from '../../../../store/auth.store';
import {
  startBroadcast, stopBroadcast, ensureForegroundPermission, type BroadcastResult,
} from '../../../../services/location';

const ARRIVAL_METERS = 40; // within this of the current stop, the bus has "reached" it
// A GPS stream can be "up" yet deliver no usable fix (cold start, tunnel, garage,
// signal loss). Treat the position as stale — and surface "Waiting for GPS" — after
// a grace period with no fix, distinct from genuine permission denial.
const COLD_START_MS = 12000; // no first fix within this of starting = waiting for GPS
const STALE_FIX_MS = 15000; // no fix for this long after a valid start = signal gap

const toRad = (d: number) => (d * Math.PI) / 180;
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** A stop is serviced once every non-cancelled rider on it is marked (boarded/absent). */
function stopDone(riders: RosterRider[]): boolean {
  const active = riders.filter((r) => r.boardStatus !== 'CANCELLED');
  if (active.length === 0) return true; // nothing to do here
  return active.every((r) => r.boardStatus === 'BOARDED' || r.boardStatus === 'NOT_BOARDED');
}

function boardedOf(riders: RosterRider[]) {
  const active = riders.filter((r) => r.boardStatus !== 'CANCELLED');
  return { boarded: active.filter((r) => r.boardStatus === 'BOARDED').length, total: active.length };
}

export default function ActiveTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTripById(tripId);
  const { data: rosterData } = useRoster(tripId);
  const startTrip = useStartTrip();
  const completeTrip = useCompleteTrip();
  const abortTrip = useAbortTrip();
  const sendPing = useDriverPing();
  const membership = useAuthStore((s) => s.activeMembership);
  const toast = useToast();

  const [broadcasting, setBroadcasting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pingsSent, setPingsSent] = useState(0);
  // Outcome of starting the real-GPS broadcast: which stream is live, or why not.
  // 'idle' before start; 'foreground'/'background' once a real fix stream runs.
  const [locStatus, setLocStatus] =
    useState<'idle' | 'foreground' | 'background' | 'denied' | 'unavailable'>('idle');
  // Whether the bus has physically reached the current stop yet — gates marking.
  const [arrivedAtCurrent, setArrivedAtCurrent] = useState(false);
  // Explicit, logged "mark without GPS" escape hatch for a genuine no-signal
  // outage. Unlocks marking for the CURRENT stop only (reset when it advances).
  const [overrideUnlocked, setOverrideUnlocked] = useState(false);
  const [showGpsOverride, setShowGpsOverride] = useState(false);
  // Foreground-permission gate: when starting is hard-blocked for missing location
  // permission, this drives the recoverable explanation (re-request / Settings).
  const [permBlock, setPermBlock] = useState<{ canAskAgain: boolean } | null>(null);
  // Trip-start governance: when a clean start is blocked, the server explains why
  // and the driver must add a reason note to start anyway.
  const [blockedWhy, setBlockedWhy] = useState<string | null>(null);
  const [reasonNote, setReasonNote] = useState('');
  // Completion verification + early-completion reason.
  const [showConfirm, setShowConfirm] = useState(false);
  const [completeReason, setCompleteReason] = useState('');
  // Another trip is already under way (PRD-02a Part E): identifies the live trip so
  // the driver can Resume it — and, if it's already stale (Stage-1 overdue), end it
  // — instead of being stranded with an unactionable error.
  const [liveTripBlock, setLiveTripBlock] = useState<{ tripId: string; overdue: boolean } | null>(null);
  const [showStaleAbort, setShowStaleAbort] = useState(false);
  const [staleReason, setStaleReason] = useState('');

  // Geo for each roster stop comes from the trip's route definition. Memoised on
  // `trip` so it isn't rebuilt on the per-second elapsed tick / every GPS fix.
  const stopGeo = useMemo<Record<string, { lat: number; lng: number }>>(() => {
    const geo: Record<string, { lat: number; lng: number }> = {};
    for (const rs of (trip as any)?.route?.stops ?? []) {
      geo[rs.stop.id] = { lat: rs.stop.lat, lng: rs.stop.lng };
    }
    return geo;
  }, [trip]);

  // Stops in ROUTE SEQUENCE — the only order they may be serviced in. Pulled from
  // the roster (server-ordered) so per-stop counts and sequence agree. Memoised on
  // the roster so the 1s elapsed-timer re-render doesn't re-derive trip state.
  const stops = useMemo(
    () =>
      (rosterData?.stops ?? []).map((s) => ({
        id: s.stopId,
        name: s.stopName,
        riders: s.riders,
        lat: stopGeo[s.stopId]?.lat ?? 0,
        lng: stopGeo[s.stopId]?.lng ?? 0,
      })),
    [rosterData, stopGeo],
  );

  // CURRENT STOP is derived, never manually chosen: the first stop in route order
  // that isn't fully serviced. This enforces strict sequence — earlier stops must
  // be done before a later one becomes current.
  const { currentIdx, allStopsDone, currentStop } = useMemo(() => {
    const idx = stops.findIndex((s) => !stopDone(s.riders));
    const ci = idx === -1 ? Math.max(0, stops.length - 1) : idx;
    return {
      currentIdx: ci,
      allStopsDone: stops.length > 0 && stops.every((s) => stopDone(s.riders)),
      currentStop: stops[ci],
    };
  }, [stops]);

  // Overall + per-stop progress (real counts from the roster).
  const summary = rosterData?.summary;
  const currentCounts = useMemo(
    () => (currentStop ? boardedOf(currentStop.riders) : { boarded: 0, total: 0 }),
    [currentStop],
  );

  // Live driving state read by the (async) location callback, kept in refs so it
  // always sees the freshest values without restarting the GPS stream.
  const currentRef = useRef(0);
  currentRef.current = currentIdx;
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  // sendPing is recreated each render; a ref keeps the emit path stable so the
  // broadcast doesn't churn on every re-render.
  const sendPingRef = useRef(sendPing);
  sendPingRef.current = sendPing;
  // GPS-freshness tracking (refs, so the async fix callback writes them without
  // re-rendering): when the last real fix arrived, and when this broadcast began.
  const lastFixRef = useRef<number | null>(null);
  const broadcastStartedAtRef = useRef<number | null>(null);

  // Resume: a trip already in flight should broadcast on mount without re-calling
  // startTrip (which would error STARTED→STARTED).
  useEffect(() => {
    const status = (trip as any)?.status;
    if ((status === 'STARTED' || status === 'IN_PROGRESS') && !broadcasting) {
      setBroadcasting(true);
    }
  }, [(trip as any)?.status]);

  // The current stop changed (advanced) — reset both the "reached" gate and any
  // no-signal override so the new stop must be reached (or re-confirmed) afresh.
  useEffect(() => {
    setArrivedAtCurrent(false);
    setOverrideUnlocked(false);
  }, [currentStop?.id]);

  // Elapsed timer once broadcasting.
  useEffect(() => {
    if (!broadcasting) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [broadcasting]);

  // Start the device's REAL location stream and feed each fix into the same
  // driver:ping emit path. Arrival at the current stop is derived from the real
  // fix (within ARRIVAL_METERS), which gates attendance marking exactly as the
  // old simulation did. Kept in a callback so the denial banner can retry it.
  const beginBroadcast = useCallback(async (): Promise<BroadcastResult | undefined> => {
    if (!membership) return;
    const res = await startBroadcast(
      {
        tripId,
        tenantId: membership.tenantId,
        driverMembershipId: membership.membershipId,
        emit: (payload) => sendPingRef.current(payload),
      },
      {
        onFix: (fix) => {
          lastFixRef.current = Date.now(); // GPS is delivering — clears "Waiting for GPS"
          setPingsSent((n) => n + 1);
          const tgt = stopsRef.current[currentRef.current];
          if (tgt && haversine(fix, tgt) <= ARRIVAL_METERS) setArrivedAtCurrent(true);
        },
      },
    );
    setLocStatus(res.status === 'started' ? res.mode : res.status);
    if (res.status === 'denied') {
      toast.error('Allow location so parents can see the live bus.', 'Location needed');
    }
    return res;
  }, [membership, tripId]);

  // Broadcast only while the trip is live; tear the GPS stream down the moment it
  // stops (complete/cancel/unmount) so a finished trip can't leak pings.
  useEffect(() => {
    if (!broadcasting) return;
    broadcastStartedAtRef.current = Date.now();
    lastFixRef.current = null; // no fix yet on this (re)start — start the grace clock
    void beginBroadcast();
    return () => {
      setLocStatus('idle');
      void stopBroadcast();
    };
  }, [broadcasting, beginBroadcast]);

  const errMsg = (e: any): string => e?.response?.data?.error?.message ?? e?.message ?? '';
  const errCode = (e: any): string => e?.response?.data?.error?.code ?? '';

  const doStartTrip = () => {
    startTrip.mutate(
      { tripId },
      {
        onSuccess: () => setBroadcasting(true),
        onError: (e: any) => {
          const code = errCode(e);
          if (code === 'TRIP_ALREADY_LIVE') {
            // Another trip is live — surface it so the driver can Resume or end it,
            // instead of a dead-end error.
            const err = e?.response?.data?.error;
            if (err?.liveTripId) {
              setLiveTripBlock({ tripId: err.liveTripId, overdue: !!err.liveTripOverdue });
            } else {
              toast.error(errMsg(e), 'Finish your current trip first');
            }
          } else if (code === 'TRIP_START_BLOCKED') {
            // Blocked: show why + open the "start anyway, add reason" path.
            setBlockedWhy(errMsg(e) || 'This trip cannot start cleanly.');
          } else if (errMsg(e).includes('STARTED')) {
            setBroadcasting(true); // already started — broadcast anyway.
          } else {
            toast.error(errMsg(e) || 'Try again', 'Could not start trip');
          }
        },
      },
    );
  };

  // Integrity gate: a trip may only start with foreground location permission — so
  // parents can see the bus and attendance is verified at each stop. Permission is
  // pre-checked WITHOUT opening a stream; denial hard-blocks the start (recoverable
  // via the permission modal). A granted-but-no-fix-yet state never reaches here.
  const onStart = async () => {
    const perm = await ensureForegroundPermission();
    if (!perm.granted) {
      setPermBlock({ canAskAgain: perm.canAskAgain });
      return;
    }
    doStartTrip();
  };

  // Recover from a blocked start: re-request in-app while still askable, otherwise
  // deep-link to Settings. Never dead-ends — always offers the next step.
  const onPermAction = async () => {
    if (permBlock?.canAskAgain === false) {
      Linking.openSettings().catch(() => {});
      setPermBlock(null);
      return;
    }
    const perm = await ensureForegroundPermission();
    if (perm.granted) {
      setPermBlock(null);
      doStartTrip();
    } else {
      setPermBlock({ canAskAgain: perm.canAskAgain });
    }
  };

  // Explicit, logged escape hatch for a genuine no-signal outage (long GPS gap /
  // no fix). Only offered when GPS can't confirm arrival, so it never reopens the
  // "skip arrival" hole while GPS is healthy. Unlocks marking for this stop only.
  const onConfirmGpsOverride = () => {
    console.warn(
      `[trip ${tripId}] attendance marked WITHOUT GPS at stop ` +
        `${currentStop?.id ?? '?'} (${currentStop?.name ?? '?'}) — driver confirmed no signal`,
    );
    setOverrideUnlocked(true);
    setShowGpsOverride(false);
    toast.warning('Marking without GPS — recorded.', 'No signal');
  };

  // Reached only after onStart already passed the location-permission gate (this
  // path opens on the server's TRIP_START_BLOCKED response), so no re-check needed.
  const onStartWithReason = () => {
    const note = reasonNote.trim();
    if (!note) return;
    startTrip.mutate(
      { tripId, reason: note },
      {
        onSuccess: () => {
          setBlockedWhy(null);
          setReasonNote('');
          setBroadcasting(true);
        },
        onError: (e: any) => toast.error(errMsg(e) || 'Try again', 'Could not start trip'),
      },
    );
  };

  // §6 — open the verification popup. §5 — early completion needs a reason.
  const onCompletePress = () => {
    setCompleteReason('');
    setShowConfirm(true);
  };

  const onConfirmComplete = () => {
    const early = !allStopsDone;
    const reason = completeReason.trim();
    if (early && !reason) return; // reason mandatory when completing early
    completeTrip.mutate(
      {
        tripId,
        // 1-based sequence of the last stop reached. When every stop is done we're
        // at the final stop; otherwise we stop at the current (unfinished) one.
        stoppedAtSeq: allStopsDone ? stops.length : currentIdx + 1,
        reason: early ? reason : undefined,
      },
      {
        onSuccess: () => {
          // Only stop broadcasting once the trip is confirmed complete; on
          // failure the trip stays active so the driver can retry.
          setBroadcasting(false);
          setShowConfirm(false);
          router.replace(`/(app)/trip/${tripId}/complete` as never);
        },
        onError: (e: any) => {
          setShowConfirm(false);
          if (errCode(e) === 'TRIP_COMPLETION_WINDOW_EXPIRED') {
            // Too old to self-complete — route the driver to the right outcome
            // rather than a generic failure (PRD-02a Part E).
            toast.error(
              errMsg(e) || 'This trip is too old to complete — it needs admin review.',
              'Needs admin review',
            );
          } else {
            toast.error(errMsg(e) || 'Try again', 'Could not complete trip');
          }
        },
      },
    );
  };

  // End a stale (overdue) live trip with a reason, then let the driver start the
  // intended one. Reached only from the "a trip is already running" block.
  const onConfirmStaleAbort = () => {
    const reason = staleReason.trim();
    if (!reason || !liveTripBlock) return;
    abortTrip.mutate(
      { tripId: liveTripBlock.tripId, reason },
      {
        onSuccess: () => {
          setShowStaleAbort(false);
          setLiveTripBlock(null);
          setStaleReason('');
          toast.success('Stale trip ended. You can start this one now.', 'Done');
        },
        onError: (e: any) => toast.error(errMsg(e) || 'Try again', 'Could not end the trip'),
      },
    );
  };

  const onNavigate = () => {
    if (!currentStop) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => toast.error('Could not open Google Maps.'));
  };

  // A real GPS stream is live (foreground or background).
  const gpsActive = locStatus === 'foreground' || locStatus === 'background';
  // Is GPS actually delivering fixes? The stream can be "up" yet have no usable
  // position — cold start, a tunnel/garage, or signal loss after a valid start.
  // Treat it as stale after a grace period with no fix. Recomputed each second by
  // the elapsed-timer re-render.
  const now = Date.now();
  const gpsStale =
    broadcasting &&
    (lastFixRef.current != null
      ? now - lastFixRef.current > STALE_FIX_MS
      : (broadcastStartedAtRef.current != null ? now - broadcastStartedAtRef.current : 0) > COLD_START_MS);
  // "Waiting for GPS": the stream is up but no recent fix is flowing.
  const waitingForGps = broadcasting && gpsActive && gpsStale;

  // Marking gate (integrity): permission is now guaranteed before a trip can
  // start, so a missing fix is a transient signal gap — NOT denial, and must not
  // auto-unlock marking the way denial used to. Allow marking once the bus has
  // actually reached the stop; for a genuine no-signal outage, don't strand the
  // driver — require an explicit, logged override instead of a silent bypass.
  const canMark = arrivedAtCurrent || overrideUnlocked;
  // The override is offered only when GPS genuinely can't confirm arrival, so a
  // healthy stream still forces a real arrival (the integrity hole stays closed).
  const canOverrideGps = broadcasting && !allStopsDone && !canMark && (!gpsActive || gpsStale);

  const onMarkAttendance = () => {
    if (!currentStop || !canMark) return;
    router.push(`/(app)/trip/attendance/${currentStop.id}?tripId=${tripId}` as never);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const routeName = (trip as any)?.route?.name ?? 'Route';

  return (
    <ScreenContainer bg={colors.backgroundMuted}>
      <AppHeader
        title={routeName}
        subtitle={broadcasting ? `Stop ${Math.min(currentIdx + 1, stops.length)} of ${stops.length || '—'}` : 'Not started'}
        onBack={() => router.replace('/(app)/home' as never)}
        right={
          <AnimatedPressable
            onPress={() => router.push(`/(app)/trip/alerts?tripId=${tripId}` as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Trip alerts"
          >
            <Text style={styles.alertsLink}>Alerts</Text>
          </AnimatedPressable>
        }
      />

      {/* Live status strip */}
      <View style={styles.statusBar}>
        <View style={styles.liveRow}>
          <StatusDot variant={broadcasting ? 'live' : 'offline'} size={10} />
          <Text style={[styles.liveText, broadcasting && styles.liveTextOn]}>
            {broadcasting ? 'BROADCASTING LIVE' : 'NOT BROADCASTING'}
          </Text>
        </View>
        <Text style={styles.statusMeta}>
          <Text style={styles.timer}>{fmt(elapsed)}</Text>
          {broadcasting ? `  ·  ${pingsSent} updates` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Live-location health: surface a recoverable notice if real GPS isn't
            flowing, so the driver knows the bus map won't update — and can fix it. */}
        {broadcasting && locStatus === 'denied' && (
          <AnimatedPressable onPress={() => void beginBroadcast()} accessibilityRole="button">
            <View style={[styles.locBanner, styles.locBannerWarn]}>
              <Text style={styles.locBannerText}>
                Location is off — parents can't see the bus. Tap to enable.
              </Text>
            </View>
          </AnimatedPressable>
        )}
        {broadcasting && locStatus === 'unavailable' && (
          <View style={[styles.locBanner, styles.locBannerMuted]}>
            <Text style={styles.locBannerText}>
              Live location needs a dev/EAS build — running without GPS.
            </Text>
          </View>
        )}
        {waitingForGps && (
          <View style={[styles.locBanner, styles.locBannerMuted]}>
            <Text style={styles.locBannerText}>
              Waiting for GPS… the bus map may not update until the signal returns.
            </Text>
          </View>
        )}

        {/* Overall progress */}
        {broadcasting && summary && (
          <View style={styles.progressBar}>
            <Text style={styles.progressText}>
              Stop {Math.min(currentIdx + 1, stops.length)} of {stops.length}
            </Text>
            <Text style={styles.progressMeta}>
              {summary.boarded} boarded · {summary.total} riders
            </Text>
          </View>
        )}

        {/* Current target stop — the one thing to focus on right now. */}
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>
            {allStopsDone ? 'FINAL STOP' : 'CURRENT STOP'}
          </Text>
          <Text style={styles.currentName}>{currentStop?.name ?? '—'}</Text>
          <Text style={styles.currentMeta}>
            {currentStop
              ? `${currentCounts.boarded}/${currentCounts.total} boarded`
              : 'Roster loading…'}
          </Text>
          {broadcasting && gpsActive && !gpsStale && !arrivedAtCurrent && !allStopsDone && (
            <Text style={styles.currentHint}>Driving to this stop…</Text>
          )}

          <Button
            title="Navigate"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={onNavigate}
            style={{ marginTop: spacing[4] }}
          />
        </View>

        {broadcasting && !allStopsDone && (
          <>
            <Button
              title={
                canMark
                  ? `Mark attendance — ${currentStop?.name ?? ''}`
                  : 'Reach the stop to mark attendance'
              }
              size="lg"
              fullWidth
              disabled={!canMark}
              onPress={onMarkAttendance}
            />
            {canOverrideGps && (
              <Button
                title="Mark without GPS — no signal"
                variant="outline"
                size="lg"
                fullWidth
                onPress={() => setShowGpsOverride(true)}
              />
            )}
          </>
        )}

        {/* READ-ONLY progress list: ✓ done / current / upcoming. No manual jumps. */}
        <View style={styles.allStops}>
          <View style={styles.allStopsHeader}>
            <Text style={styles.allStopsTitle}>Route progress ({stops.length} stops)</Text>
          </View>

          <Stagger interval={40} maxStagger={6}>
          {stops.map((s, i) => {
            const done = stopDone(s.riders);
            const isCurrent = i === currentIdx && !allStopsDone;
            const { boarded, total } = boardedOf(s.riders);
            const state = done ? 'done' : isCurrent ? 'current' : 'upcoming';
            return (
              <View key={s.id} style={[styles.stopRow, isCurrent && styles.stopRowActive]}>
                <View
                  style={[
                    styles.stopNumber,
                    state === 'done' && styles.stopNumberDone,
                    state === 'current' && styles.stopNumberActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stopNum,
                      (state === 'done' || state === 'current') && styles.stopNumActive,
                    ]}
                  >
                    {state === 'done' ? '✓' : i + 1}
                  </Text>
                </View>
                <View style={styles.stopInfo}>
                  <Text
                    style={[styles.stopName, isCurrent && styles.stopNameActive]}
                    numberOfLines={1}
                  >
                    {s.name}
                  </Text>
                  <Text style={styles.stopRiders}>
                    {total === 0 ? 'No riders' : `${boarded}/${total} boarded`}
                  </Text>
                </View>
                {state === 'current' && <Text style={styles.currentTag}>Current</Text>}
                {state === 'upcoming' && <Text style={styles.upcomingTag}>Upcoming</Text>}
              </View>
            );
          })}
          </Stagger>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!broadcasting && (
          <Button title="Start Trip" onPress={onStart} fullWidth size="lg" loading={startTrip.isPending} />
        )}
        {/* §1 — Complete only appears once the trip is under way. */}
        {broadcasting && (
          <Button
            title={allStopsDone ? 'Complete Trip' : 'Complete Trip Early'}
            variant={allStopsDone ? 'primary' : 'outline'}
            onPress={onCompletePress}
            fullWidth
            size="lg"
            loading={completeTrip.isPending}
          />
        )}
      </View>

      {/* Off-protocol start: explain why and require a reason note to start anyway. */}
      <Modal visible={blockedWhy !== null} transparent animationType="fade" onRequestClose={() => setBlockedWhy(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Can't start cleanly</Text>
            <Text style={styles.modalWhy}>{blockedWhy}</Text>
            <Text style={styles.modalLabel}>Reason to start anyway *</Text>
            <TextInput
              style={styles.modalInput}
              value={reasonNote}
              onChangeText={setReasonNote}
              placeholder="e.g. Daily check done on paper; running late due to traffic"
              placeholderTextColor={colors.gray400}
              multiline
            />
            <Button
              title="Start anyway"
              onPress={onStartWithReason}
              fullWidth
              disabled={!reasonNote.trim()}
              loading={startTrip.isPending}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => { setBlockedWhy(null); setReasonNote(''); }}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>

      {/* §6 — verification popup before completing. §5 — early needs a reason. */}
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {allStopsDone ? 'Complete this trip?' : 'Complete early?'}
            </Text>

            <View style={styles.confirmStats}>
              <View style={styles.confirmStatRow}>
                <Text style={styles.confirmStatLabel}>Boarded</Text>
                <Text style={styles.confirmStatValue}>
                  {summary?.boarded ?? 0} / {summary?.total ?? 0}
                </Text>
              </View>
              <View style={styles.confirmStatRow}>
                <Text style={styles.confirmStatLabel}>Stops serviced</Text>
                <Text style={styles.confirmStatValue}>
                  {allStopsDone ? stops.length : currentIdx} / {stops.length}
                </Text>
              </View>
              {!allStopsDone && (
                <View style={styles.confirmStatRow}>
                  <Text style={styles.confirmStatLabel}>Stops remaining</Text>
                  <Text style={[styles.confirmStatValue, styles.confirmStatWarn]}>
                    {stops.length - currentIdx}
                  </Text>
                </View>
              )}
            </View>

            {!allStopsDone && (
              <>
                <Text style={styles.modalWhy}>
                  You haven't reached the final stop. This will notify the admin.
                </Text>
                <Text style={styles.modalLabel}>Reason for completing early *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={completeReason}
                  onChangeText={setCompleteReason}
                  placeholder="e.g. Vehicle breakdown; remaining riders absent"
                  placeholderTextColor={colors.gray400}
                  multiline
                />
              </>
            )}

            <Button
              title={allStopsDone ? 'Complete Trip' : 'Complete Early'}
              onPress={onConfirmComplete}
              fullWidth
              disabled={!allStopsDone && !completeReason.trim()}
              loading={completeTrip.isPending}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setShowConfirm(false)}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>

      {/* Integrity gate: location permission is required to start a trip. Recoverable —
          re-request in-app, or open Settings if the OS won't prompt again. */}
      <Modal visible={permBlock !== null} transparent animationType="fade" onRequestClose={() => setPermBlock(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Location access required</Text>
            <Text style={styles.modalWhy}>
              Location access is required to run a trip so parents can see the bus and attendance
              is verified at each stop.
              {permBlock?.canAskAgain === false
                ? ' Enable location for Yaanam in Settings, then start the trip again.'
                : ''}
            </Text>
            <Button
              title={permBlock?.canAskAgain === false ? 'Open Settings' : 'Allow location'}
              onPress={onPermAction}
              fullWidth
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setPermBlock(null)}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>

      {/* No-signal override: explicit, logged confirm to mark without GPS verification.
          Only reachable when GPS can't confirm arrival (see canOverrideGps). */}
      <Modal visible={showGpsOverride} transparent animationType="fade" onRequestClose={() => setShowGpsOverride(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark without GPS?</Text>
            <Text style={styles.modalWhy}>
              There's no GPS signal to confirm the bus has reached {currentStop?.name ?? 'this stop'}.
              Only do this if you're actually at the stop — this action is recorded.
            </Text>
            <Button title="Mark without GPS" onPress={onConfirmGpsOverride} fullWidth />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setShowGpsOverride(false)}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>

      {/* A trip is already under way (PRD-02a Part E): never a dead-end — Resume it,
          or (if it's stale) end it, before starting this one. */}
      <Modal visible={liveTripBlock !== null} transparent animationType="fade" onRequestClose={() => setLiveTripBlock(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>A trip is already under way</Text>
            <Text style={styles.modalWhy}>
              You have another trip running. Resume it to continue
              {liveTripBlock?.overdue ? ' — or, since it looks stale, end it' : ''} before starting this one.
            </Text>
            <Button
              title="Resume that trip"
              onPress={() => {
                const id = liveTripBlock?.tripId;
                setLiveTripBlock(null);
                if (id) router.replace(`/(app)/trip/${id}/active` as never);
              }}
              fullWidth
            />
            {liveTripBlock?.overdue && (
              <Button
                title="This looks stale — end it"
                variant="outline"
                onPress={() => { setStaleReason(''); setShowStaleAbort(true); }}
                fullWidth
              />
            )}
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setLiveTripBlock(null)}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>

      {/* End a stale live trip with a mandatory reason (abort). */}
      <Modal visible={showStaleAbort} transparent animationType="fade" onRequestClose={() => setShowStaleAbort(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End the stale trip?</Text>
            <Text style={styles.modalWhy}>
              This aborts the trip that's still running. Affected parents and you will be notified.
            </Text>
            <Text style={styles.modalLabel}>Reason *</Text>
            <TextInput
              style={styles.modalInput}
              value={staleReason}
              onChangeText={setStaleReason}
              placeholder="e.g. Forgot to complete an earlier trip; ended it"
              placeholderTextColor={colors.gray400}
              multiline
            />
            <Button
              title="End trip"
              onPress={onConfirmStaleAbort}
              fullWidth
              disabled={!staleReason.trim()}
              loading={abortTrip.isPending}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setShowStaleAbort(false)}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  alertsLink: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  liveText: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide },
  liveTextOn: { color: colors.success },
  statusMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  timer: { fontFamily: fontFamilies.mono, color: colors.textPrimary, fontWeight: fontWeights.medium },

  body: { padding: spacing[4], gap: spacing[3] },

  locBanner: {
    borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
  },
  locBannerWarn: { backgroundColor: colors.errorBg, borderColor: colors.error },
  locBannerMuted: { backgroundColor: colors.gray100, borderColor: colors.border },
  locBannerText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },

  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.background, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  progressText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  progressMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },

  currentCard: {
    backgroundColor: colors.primary, borderRadius: radius['2xl'], padding: spacing[5],
  },
  currentLabel: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.75)', fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wider },
  currentName: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.white, marginTop: spacing[1], letterSpacing: letterSpacing.tight },
  currentMeta: { fontSize: fontSizes.base, color: 'rgba(255,255,255,0.9)', marginTop: spacing[1], fontWeight: fontWeights.medium },
  currentHint: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: spacing[1], fontStyle: 'italic' },

  allStops: {
    backgroundColor: colors.background, borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
  },
  allStopsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4],
  },
  allStopsTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle,
  },
  stopRowActive: { backgroundColor: colors.primaryBg },
  stopNumber: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  stopNumberActive: { backgroundColor: colors.primary },
  stopNumberDone: { backgroundColor: colors.success },
  stopNum: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.bold },
  stopNumActive: { color: colors.white },
  stopInfo: { flex: 1 },
  stopName: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  stopNameActive: { fontWeight: fontWeights.bold },
  stopRiders: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  currentTag: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide },
  upcomingTag: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.medium },

  footer: {
    padding: spacing[4], gap: spacing[3], backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },

  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing[5] },
  modalCard: { backgroundColor: colors.background, borderRadius: radius['2xl'], padding: spacing[5], gap: spacing[3] },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  modalWhy: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  modalLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  modalInput: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minHeight: 72, textAlignVertical: 'top',
  },

  confirmStats: { gap: spacing[2], paddingVertical: spacing[1] },
  confirmStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmStatLabel: { fontSize: fontSizes.base, color: colors.textSecondary },
  confirmStatValue: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  confirmStatWarn: { color: colors.error },
});

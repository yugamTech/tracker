import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, TextInput, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies, radius, letterSpacing,
  StatusDot, Button, AnimatedPressable, ScreenContainer, AppHeader, Stagger,
} from '@saarthi/ui';
import { useTripById, useStartTrip, useCompleteTrip, useDriverPing, useRoster } from '@saarthi/api-client';
import type { RosterRider } from '@saarthi/api-client';
import { useAuthStore } from '../../../../store/auth.store';

const PING_INTERVAL_MS = 2500;
const STEP_METERS = 20; // ~30 km/h at the ping interval
const ARRIVAL_METERS = 40; // within this of the current stop, the bus has "reached" it

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
  const sendPing = useDriverPing();
  const membership = useAuthStore((s) => s.activeMembership);

  const [broadcasting, setBroadcasting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pingsSent, setPingsSent] = useState(0);
  // Whether the bus has physically reached the current stop yet — gates marking.
  const [arrivedAtCurrent, setArrivedAtCurrent] = useState(false);
  // Trip-start governance: when a clean start is blocked, the server explains why
  // and the driver must add a reason note to start anyway.
  const [blockedWhy, setBlockedWhy] = useState<string | null>(null);
  const [reasonNote, setReasonNote] = useState('');
  // Completion verification + early-completion reason.
  const [showConfirm, setShowConfirm] = useState(false);
  const [completeReason, setCompleteReason] = useState('');

  // Stops in ROUTE SEQUENCE — the only order they may be serviced in. Pulled from
  // the roster (server-ordered) so per-stop counts and sequence agree.
  const ridersByStop: Record<string, RosterRider[]> = {};
  for (const s of rosterData?.stops ?? []) ridersByStop[s.stopId] = s.riders;

  // Geo for each roster stop comes from the trip's route definition.
  const stopGeo: Record<string, { lat: number; lng: number }> = {};
  for (const rs of (trip as any)?.route?.stops ?? []) {
    stopGeo[rs.stop.id] = { lat: rs.stop.lat, lng: rs.stop.lng };
  }

  const stops = (rosterData?.stops ?? []).map((s) => ({
    id: s.stopId,
    name: s.stopName,
    riders: s.riders,
    lat: stopGeo[s.stopId]?.lat ?? 0,
    lng: stopGeo[s.stopId]?.lng ?? 0,
  }));

  // CURRENT STOP is derived, never manually chosen: the first stop in route order
  // that isn't fully serviced. This enforces strict sequence — earlier stops must
  // be done before a later one becomes current.
  const currentIdx = (() => {
    const idx = stops.findIndex((s) => !stopDone(s.riders));
    return idx === -1 ? Math.max(0, stops.length - 1) : idx;
  })();
  const allStopsDone = stops.length > 0 && stops.every((s) => stopDone(s.riders));
  const currentStop = stops[currentIdx];
  const isLastStop = currentIdx >= stops.length - 1;

  // Overall + per-stop progress (real counts from the roster).
  const summary = rosterData?.summary;
  const currentCounts = currentStop ? boardedOf(currentStop.riders) : { boarded: 0, total: 0 };

  // Mutable driving state kept in refs so the ping interval reads fresh values.
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const seqRef = useRef(Math.floor(Date.now() / 1000));
  const currentRef = useRef(0);
  currentRef.current = currentIdx;

  useEffect(() => {
    if (stops.length && !posRef.current) posRef.current = { lat: stops[0].lat, lng: stops[0].lng };
  }, [stops.length]);

  // Resume: a trip already in flight should broadcast on mount without re-calling
  // startTrip (which would error STARTED→STARTED).
  useEffect(() => {
    const status = (trip as any)?.status;
    if ((status === 'STARTED' || status === 'IN_PROGRESS') && !broadcasting) {
      setBroadcasting(true);
    }
  }, [(trip as any)?.status]);

  // The current stop changed (advanced) — reset the "reached" gate for the new one.
  useEffect(() => {
    setArrivedAtCurrent(false);
  }, [currentStop?.id]);

  // Elapsed timer once broadcasting.
  useEffect(() => {
    if (!broadcasting) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [broadcasting]);

  // The live broadcast loop: step toward the current stop and emit driver:ping.
  // It parks on arrival — once within ARRIVAL_METERS the stop is "reached" and the
  // driver may mark attendance. Marking advances the derived current stop.
  useEffect(() => {
    if (!broadcasting || !membership || stops.length < 1) return;
    const timer = setInterval(() => {
      const cur = posRef.current;
      const tgt = stops[currentRef.current] ?? stops[stops.length - 1];
      if (!cur || !tgt) return;

      const dist = haversine(cur, tgt);
      let next: { lat: number; lng: number };
      if (dist <= STEP_METERS) {
        next = { lat: tgt.lat, lng: tgt.lng };
      } else {
        const f = STEP_METERS / dist;
        next = { lat: cur.lat + (tgt.lat - cur.lat) * f, lng: cur.lng + (tgt.lng - cur.lng) * f };
      }
      posRef.current = next;
      if (haversine(next, tgt) <= ARRIVAL_METERS) setArrivedAtCurrent(true);

      sendPing({
        tripId,
        tenantId: membership.tenantId,
        driverMembershipId: membership.membershipId,
        lat: next.lat,
        lng: next.lng,
        accuracy: 5,
        speed: STEP_METERS / (PING_INTERVAL_MS / 1000),
        deviceTs: new Date().toISOString(),
        sequence: seqRef.current++,
      });
      setPingsSent((n) => n + 1);
    }, PING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [broadcasting, membership, stops.length, tripId, sendPing]);

  const errMsg = (e: any): string => e?.response?.data?.error?.message ?? e?.message ?? '';
  const errCode = (e: any): string => e?.response?.data?.error?.code ?? '';

  const onStart = () => {
    startTrip.mutate(
      { tripId },
      {
        onSuccess: () => setBroadcasting(true),
        onError: (e: any) => {
          const code = errCode(e);
          if (code === 'TRIP_ALREADY_LIVE') {
            // Another trip is live — can't start a second one.
            Alert.alert('Finish your current trip first', errMsg(e));
          } else if (code === 'TRIP_START_BLOCKED') {
            // Blocked: show why + open the "start anyway, add reason" path.
            setBlockedWhy(errMsg(e) || 'This trip cannot start cleanly.');
          } else if (errMsg(e).includes('STARTED')) {
            setBroadcasting(true); // already started — broadcast anyway.
          } else {
            Alert.alert('Could not start trip', errMsg(e) || 'Try again');
          }
        },
      },
    );
  };

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
        onError: (e: any) => Alert.alert('Could not start trip', errMsg(e) || 'Try again'),
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
    setBroadcasting(false);
    completeTrip.mutate(
      {
        tripId,
        // 1-based sequence of the last stop reached. When every stop is done we're
        // at the final stop; otherwise we stop at the current (unfinished) one.
        stoppedAtSeq: allStopsDone ? stops.length : currentIdx + 1,
        reason: early ? reason : undefined,
      },
      {
        onSettled: () => {
          setShowConfirm(false);
          router.replace(`/(app)/trip/${tripId}/complete` as never);
        },
      },
    );
  };

  const onNavigate = () => {
    if (!currentStop) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Google Maps.'));
  };

  const onMarkAttendance = () => {
    if (!currentStop || !arrivedAtCurrent) return;
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
          {broadcasting && !arrivedAtCurrent && !allStopsDone && (
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
          <Button
            title={
              arrivedAtCurrent
                ? `Mark attendance — ${currentStop?.name ?? ''}`
                : 'Reach the stop to mark attendance'
            }
            size="lg"
            fullWidth
            disabled={!arrivedAtCurrent}
            onPress={onMarkAttendance}
          />
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

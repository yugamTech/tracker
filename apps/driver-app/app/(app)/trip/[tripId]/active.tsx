import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, TextInput, Linking } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies, radius, letterSpacing,
  StatusDot, Button, AnimatedPressable, ScreenContainer, AppHeader,
} from '@saarthi/ui';
import { useTripById, useStartTrip, useCompleteTrip, useDriverPing, useRoster } from '@saarthi/api-client';
import { useAuthStore } from '../../../../store/auth.store';

const PING_INTERVAL_MS = 2500;
const STEP_METERS = 20; // ~30 km/h at the ping interval

const toRad = (d: number) => (d * Math.PI) / 180;
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
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
  // The stop the driver is currently servicing. The guided flow walks this
  // forward one stop at a time as attendance is marked; the GPS broadcast heads
  // toward it. Manual jumps (All stops) can also move it.
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAllStops, setShowAllStops] = useState(false);
  // Trip-start governance: when a clean start is blocked, the server explains why
  // and the driver must add a reason note to start anyway.
  const [blockedWhy, setBlockedWhy] = useState<string | null>(null);
  const [reasonNote, setReasonNote] = useState('');

  const stops: { id: string; name: string; lat: number; lng: number }[] =
    (trip as any)?.route?.stops?.map((rs: any) => ({
      id: rs.stop.id,
      name: rs.stop.name,
      lat: rs.stop.lat,
      lng: rs.stop.lng,
    })) ?? [];

  const riderCountByStop: Record<string, number> = {};
  for (const s of rosterData?.stops ?? []) riderCountByStop[s.stopId] = s.riders.length;

  // Mutable driving state kept in refs so the ping interval reads fresh values.
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const seqRef = useRef(Math.floor(Date.now() / 1000));
  const currentRef = useRef(0);
  currentRef.current = currentIdx;

  useEffect(() => {
    if (stops.length && !posRef.current) posRef.current = { lat: stops[0].lat, lng: stops[0].lng };
  }, [stops.length]);

  // FUNCTION FIX 1 — Resume: a trip already in flight should broadcast on mount
  // without re-calling startTrip (which would error STARTED→STARTED).
  useEffect(() => {
    const status = (trip as any)?.status;
    if ((status === 'STARTED' || status === 'IN_PROGRESS') && !broadcasting) {
      setBroadcasting(true);
    }
  }, [(trip as any)?.status]);

  // FUNCTION FIX 2 — advance to the next stop automatically when the driver
  // returns from the attendance screen.
  const pendingAdvanceRef = useRef<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (pendingAdvanceRef.current !== null) {
        const from = pendingAdvanceRef.current;
        pendingAdvanceRef.current = null;
        setCurrentIdx((i) => Math.min(Math.max(i, from + 1), Math.max(0, stops.length - 1)));
      }
    }, [stops.length]),
  );

  // Elapsed timer once broadcasting.
  useEffect(() => {
    if (!broadcasting) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [broadcasting]);

  // The live broadcast loop: step toward the current stop and emit driver:ping.
  // It parks on arrival — the driver decides when to move on by marking
  // attendance, which advances `currentIdx`.
  useEffect(() => {
    if (!broadcasting || !membership || stops.length < 2) return;
    const timer = setInterval(() => {
      const cur = posRef.current;
      const tgt = stops[currentRef.current] ?? stops[stops.length - 1];
      if (!cur) return;

      const dist = haversine(cur, tgt);
      let next: { lat: number; lng: number };
      if (dist <= STEP_METERS) {
        next = { lat: tgt.lat, lng: tgt.lng };
      } else {
        const f = STEP_METERS / dist;
        next = { lat: cur.lat + (tgt.lat - cur.lat) * f, lng: cur.lng + (tgt.lng - cur.lng) * f };
      }
      posRef.current = next;

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
          if (errCode(e) === 'TRIP_START_BLOCKED') {
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

  const onComplete = () => {
    setBroadcasting(false);
    completeTrip.mutate(tripId, {
      onSettled: () => router.replace(`/(app)/trip/${tripId}/complete` as never),
    });
  };

  const onNavigate = () => {
    if (!currentStop) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Google Maps.'));
  };

  const onMarkAttendance = () => {
    if (!currentStop) return;
    // Remember where we were so re-focusing this screen advances to the next stop.
    pendingAdvanceRef.current = currentIdx;
    router.push(`/(app)/trip/attendance/${currentStop.id}?tripId=${tripId}` as never);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const currentStop = stops[currentIdx] ?? stops[stops.length - 1];
  const currentRiders = currentStop ? riderCountByStop[currentStop.id] : undefined;
  const routeName = (trip as any)?.route?.name ?? 'Route';
  const isLastStop = currentIdx >= stops.length - 1;

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
        {/* Current target stop — the one thing to focus on right now. */}
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>CURRENT STOP</Text>
          <Text style={styles.currentName}>{currentStop?.name ?? '—'}</Text>
          <Text style={styles.currentMeta}>
            {currentRiders != null ? `${currentRiders} rider${currentRiders !== 1 ? 's' : ''}` : 'Roster loading…'}
          </Text>

          <Button
            title="Navigate"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={onNavigate}
            style={{ marginTop: spacing[4] }}
          />
        </View>

        {broadcasting && (
          <Button
            title={isLastStop ? 'Mark attendance' : 'Mark attendance →'}
            size="lg"
            fullWidth
            onPress={onMarkAttendance}
          />
        )}

        {/* Collapsed "All stops" for manual jumps. */}
        <View style={styles.allStops}>
          <AnimatedPressable
            onPress={() => setShowAllStops((v) => !v)}
            scaleTo={0.99}
            style={styles.allStopsHeader}
            accessibilityRole="button"
          >
            <Text style={styles.allStopsTitle}>All stops ({stops.length})</Text>
            <Text style={styles.allStopsChevron}>{showAllStops ? '⌄' : '›'}</Text>
          </AnimatedPressable>

          {showAllStops &&
            stops.map((s, i) => {
              const active = i === currentIdx;
              const count = riderCountByStop[s.id];
              return (
                <AnimatedPressable
                  key={s.id}
                  scaleTo={0.99}
                  onPress={() => { setCurrentIdx(i); setShowAllStops(false); }}
                  style={[styles.stopRow, active && styles.stopRowActive]}
                >
                  <View style={[styles.stopNumber, active && styles.stopNumberActive]}>
                    <Text style={[styles.stopNum, active && styles.stopNumActive]}>{i + 1}</Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={[styles.stopName, active && styles.stopNameActive]} numberOfLines={1}>{s.name}</Text>
                    {count != null && (
                      <Text style={styles.stopRiders}>{count} rider{count !== 1 ? 's' : ''}</Text>
                    )}
                  </View>
                  {active && <Text style={styles.currentTag}>Current</Text>}
                </AnimatedPressable>
              );
            })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!broadcasting && (
          <Button title="Start Trip" onPress={onStart} fullWidth size="lg" loading={startTrip.isPending} />
        )}
        <Button
          title="Complete Trip"
          variant="outline"
          onPress={onComplete}
          fullWidth
          size="lg"
          loading={completeTrip.isPending}
        />
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

  currentCard: {
    backgroundColor: colors.primary, borderRadius: radius['2xl'], padding: spacing[5],
  },
  currentLabel: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.75)', fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wider },
  currentName: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.white, marginTop: spacing[1], letterSpacing: letterSpacing.tight },
  currentMeta: { fontSize: fontSizes.base, color: 'rgba(255,255,255,0.9)', marginTop: spacing[1], fontWeight: fontWeights.medium },

  allStops: {
    backgroundColor: colors.background, borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
  },
  allStopsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4],
  },
  allStopsTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  allStopsChevron: { fontSize: fontSizes.xl, color: colors.textMuted, fontWeight: fontWeights.medium },
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
  stopNum: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.bold },
  stopNumActive: { color: colors.white },
  stopInfo: { flex: 1 },
  stopName: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  stopNameActive: { fontWeight: fontWeights.bold },
  stopRiders: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  currentTag: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide },

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
});

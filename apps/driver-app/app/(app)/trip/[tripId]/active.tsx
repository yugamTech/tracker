import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, fontFamilies, radius, StatusDot, Button } from '@saarthi/ui';
import { useTripById, useStartTrip, useCompleteTrip, useDriverPing } from '@saarthi/api-client';
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
  const startTrip = useStartTrip();
  const completeTrip = useCompleteTrip();
  const sendPing = useDriverPing();
  const membership = useAuthStore((s) => s.activeMembership);

  const [broadcasting, setBroadcasting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pingsSent, setPingsSent] = useState(0);
  const [targetIdx, setTargetIdx] = useState(1);
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

  // Mutable driving state kept in refs so the ping interval reads fresh values.
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const seqRef = useRef(Math.floor(Date.now() / 1000));
  const targetRef = useRef(1);
  targetRef.current = targetIdx;

  useEffect(() => {
    if (stops.length && !posRef.current) posRef.current = { lat: stops[0].lat, lng: stops[0].lng };
  }, [stops.length]);

  // Elapsed timer once broadcasting.
  useEffect(() => {
    if (!broadcasting) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [broadcasting]);

  // The live broadcast loop: step toward the next stop and emit driver:ping.
  useEffect(() => {
    if (!broadcasting || !membership || stops.length < 2) return;
    const timer = setInterval(() => {
      const cur = posRef.current;
      const tgt = stops[targetRef.current] ?? stops[stops.length - 1];
      if (!cur) return;

      const dist = haversine(cur, tgt);
      let next: { lat: number; lng: number };
      if (dist <= STEP_METERS) {
        next = { lat: tgt.lat, lng: tgt.lng };
        if (targetRef.current < stops.length - 1) setTargetIdx((i) => i + 1);
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

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const nextStop = stops[targetIdx] ?? stops[stops.length - 1];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.liveRow}>
          <StatusDot variant={broadcasting ? 'live' : 'offline'} size={10} />
          <Text style={styles.liveText}>{broadcasting ? 'BROADCASTING' : 'NOT STARTED'}</Text>
        </View>
        <Text style={styles.timer}>⏱ {fmt(elapsed)}</Text>
        <View style={styles.signalBadge}>
          <Text style={styles.signalText}>📡 {pingsSent} pings</Text>
        </View>
      </View>

      <View style={styles.currentStop}>
        <Text style={styles.stopLabel}>NEXT STOP</Text>
        <Text style={styles.stopName}>{nextStop?.name ?? '—'}</Text>
        <Text style={styles.stopMeta}>
          Stop {Math.min(targetIdx + 1, stops.length)} of {stops.length || '—'} ·{' '}
          {(trip as any)?.route?.name ?? 'Route'}
        </Text>
      </View>

      <View style={styles.mapArea}>
        <Text style={{ fontSize: 56 }}>{broadcasting ? '🛰️' : '🗺️'}</Text>
        <Text style={styles.mapText}>{broadcasting ? 'GPS Active' : 'GPS Idle'}</Text>
        <Text style={styles.mapSub}>
          {broadcasting
            ? `Streaming via driver:ping every ${PING_INTERVAL_MS / 1000}s`
            : 'Start the trip to begin broadcasting'}
        </Text>
        {posRef.current && broadcasting && (
          <Text style={styles.mapSub}>
            {posRef.current.lat.toFixed(4)}, {posRef.current.lng.toFixed(4)}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {!broadcasting ? (
          <Button title="▶ Start Trip" onPress={onStart} fullWidth size="lg" loading={startTrip.isPending} />
        ) : (
          <View style={styles.markSection}>
            <View style={styles.markHeader}>
              <Text style={styles.markLabel}>MARK ATTENDANCE — tap a stop</Text>
              <TouchableOpacity
                style={styles.alertsBtn}
                onPress={() => router.push(`/(app)/trip/alerts?tripId=${tripId}` as never)}
              >
                <Text style={{ fontSize: 18 }}>🔔</Text>
                <Text style={styles.alertsBtnText}>Alerts</Text>
              </TouchableOpacity>
            </View>
            {/* Every stop is reachable (incl. the first), not just the live target. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopChips}>
              {stops.map((s, i) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.stopChip, i === targetIdx && styles.stopChipActive]}
                  onPress={() => router.push(`/(app)/trip/attendance/${s.id}?tripId=${tripId}` as never)}
                >
                  <Text
                    style={[styles.stopChipText, i === targetIdx && styles.stopChipTextActive]}
                    numberOfLines={1}
                  >
                    {i + 1}. {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <Button
          title="Complete Trip"
          variant="outline"
          onPress={onComplete}
          fullWidth
          loading={completeTrip.isPending}
        />
      </View>

      {/* Off-protocol start: explain why and require a reason note to start anyway. */}
      <Modal visible={blockedWhy !== null} transparent animationType="fade" onRequestClose={() => setBlockedWhy(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚠️ Can't start cleanly</Text>
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
              variant="outline"
              onPress={() => { setBlockedWhy(null); setReasonNote(''); }}
              fullWidth
              style={{ marginTop: spacing[2] }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray900 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[5] },
  modalCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  modalWhy: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  modalLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  modalInput: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border, minHeight: 72, textAlignVertical: 'top',
  },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], backgroundColor: '#1a1a2e',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  liveText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold, letterSpacing: 1 },
  timer: { fontSize: fontSizes.sm, color: colors.white, fontFamily: fontFamilies.mono },
  signalBadge: { backgroundColor: '#16213e', paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.md },
  signalText: { fontSize: fontSizes.xs, color: colors.success },
  currentStop: { backgroundColor: '#0EA5E9', padding: spacing[5] },
  stopLabel: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.7)', fontWeight: fontWeights.bold, letterSpacing: 1 },
  stopName: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.white, marginTop: 4 },
  stopMeta: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: spacing[1] },
  mapArea: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16213e', gap: spacing[2] },
  mapText: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.white },
  mapSub: { fontSize: fontSizes.sm, color: colors.gray400 },
  actions: { padding: spacing[4], gap: spacing[3], backgroundColor: '#1a1a2e' },
  markSection: { gap: spacing[2] },
  markHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  markLabel: { fontSize: fontSizes.xs, color: colors.gray300, fontWeight: fontWeights.bold, letterSpacing: 1 },
  stopChips: { gap: spacing[2], paddingVertical: spacing[1] },
  stopChip: {
    backgroundColor: '#16213e', borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: colors.gray600, maxWidth: 180,
  },
  stopChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  stopChipText: { fontSize: fontSizes.sm, color: colors.gray200, fontWeight: fontWeights.medium },
  stopChipTextActive: { color: colors.white, fontWeight: fontWeights.bold },
  alertsBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: '#16213e', borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: colors.gray600,
  },
  alertsBtnText: { fontSize: fontSizes.xs, color: colors.gray300 },
});

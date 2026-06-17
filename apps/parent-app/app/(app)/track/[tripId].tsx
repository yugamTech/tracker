import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius,
  StatusDot, Card, MockBusMap, AppHeader, AnimatedPressable,
} from '@saarthi/ui';
import {
  useTripById,
  useLatestPosition,
  useTripSocket,
  useMyStudents,
  useCancelPickup,
} from '@saarthi/api-client';

export default function TrackScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading } = useTripById(tripId);
  const { data: primed } = useLatestPosition(tripId);
  const { data: myStudents } = useMyStudents();
  const cancelPickup = useCancelPickup();

  const [pos, setPos] = useState<{ lat: number; lng: number; speed: number | null } | null>(null);
  const [eta, setEta] = useState<{ stopName: string; minutes: number } | null>(null);
  const [departed, setDeparted] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);

  // Prime from the REST latest snapshot before socket deltas arrive.
  const latest = pos ?? (primed ? { lat: primed.lat, lng: primed.lng, speed: primed.speed } : null);

  useTripSocket(tripId, {
    onLocation: (d) => {
      setPos({ lat: d.lat, lng: d.lng, speed: d.speed ?? null });
      setLive(true);
    },
    onEta: (d) => setEta({ stopName: d.stopName, minutes: d.etaMinutes }),
    onGeofence: (d) => {
      if (d.event === 'DEPARTED') setDeparted((s) => new Set(s).add(d.stopId));
    },
  });

  const routeStops: { id: string; name: string }[] =
    (trip as any)?.route?.stops?.map((rs: any) => ({ id: rs.stop.id, name: rs.stop.name })) ?? [];
  const totalStops = routeStops.length || 1;
  const doneCount = routeStops.filter((s) => departed.has(s.id)).length;

  // The parent's own child still expected on this trip (cancel-pickup target).
  const myIds = new Set((myStudents ?? []).map((s: any) => s.id));
  const cancellable = ((trip as any)?.riders ?? []).find(
    (r: any) => myIds.has(r.studentId) && r.boardStatus === 'EXPECTED',
  );

  const onCancelPickup = () => {
    if (!cancellable) return;
    Alert.alert('Cancel pickup?', `Skip ${cancellable.student?.name ?? 'your child'} for this trip?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: () =>
          cancelPickup.mutate(
            { tripId, studentId: cancellable.studentId, reason: 'Cancelled by parent' },
            {
              onSuccess: () => Alert.alert('Pickup cancelled', 'The driver roster has been updated.'),
              onError: (e: any) => Alert.alert('Could not cancel', e?.message ?? 'Try again'),
            },
          ),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        title="Live tracking"
        subtitle={(trip as any)?.route?.name}
        onBack={() => router.back()}
        right={
          <View style={[styles.livePill, !live && styles.livePillIdle]}>
            <StatusDot variant={live ? 'live' : 'offline'} size={7} />
            <Text style={[styles.liveText, !live && styles.liveTextIdle]}>{live ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
        }
      />

      <View style={styles.mapPlaceholder}>
        {isLoading && !latest ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <MockBusMap
            stops={routeStops.map((s) => ({ id: s.id, name: s.name }))}
            currentIdx={Math.max(0, routeStops.findIndex((s) => !departed.has(s.id)))}
            live={live}
            routeName={(trip as any)?.route?.name}
            height={200}
          />
        )}
      </View>

      <View style={styles.sheet}>
        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaLabel}>Next Stop</Text>
            <Text style={styles.etaStop}>{eta?.stopName ?? '—'}</Text>
          </View>
          <View style={styles.etaBox}>
            <Text style={styles.etaNumber}>{eta?.minutes ?? '–'}</Text>
            <Text style={styles.etaUnit}>min</Text>
          </View>
        </View>

        <View style={styles.progress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(doneCount / totalStops) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {doneCount} of {totalStops} stops passed
          </Text>
        </View>

        <Card style={styles.driverCard} shadow="none">
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={{ fontSize: 20 }}>🧑‍✈️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {(trip as any)?.driver?.name ?? 'Driver not assigned'}
              </Text>
              <Text style={styles.driverSub}>
                Bus {(trip as any)?.vehicle?.regNumber ?? '—'}  ·  {(trip as any)?.route?.name ?? ''}
              </Text>
              {(trip as any)?.driver?.phone && (
                <Text style={styles.driverPhone}>📞 {(trip as any).driver.phone}</Text>
              )}
            </View>
            <AnimatedPressable
              style={styles.callBtn}
              scaleTo={0.92}
              onPress={() => router.push(`/(app)/messages/driver?tripId=${tripId}` as never)}
              accessibilityRole="button"
              accessibilityLabel="Message driver"
            >
              <Text style={{ fontSize: 16 }}>💬</Text>
              <Text style={styles.callText}>Message</Text>
            </AnimatedPressable>
          </View>
        </Card>

        {cancellable && (
          <AnimatedPressable
            style={[styles.cancelBtn, cancelPickup.isPending && styles.cancelBtnDisabled]}
            scaleTo={0.98}
            onPress={onCancelPickup}
            disabled={cancelPickup.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cancel pickup for today"
          >
            <Text style={styles.cancelText}>
              {cancelPickup.isPending ? 'Cancelling…' : '✕  Cancel pickup for today'}
            </Text>
          </AnimatedPressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  livePillIdle: { backgroundColor: colors.gray100 },
  liveText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold },
  liveTextIdle: { color: colors.textMuted },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: spacing[5],
    gap: spacing[4],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etaLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  etaStop: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: 2 },
  etaBox: { alignItems: 'center', backgroundColor: '#EEF2FF', padding: spacing[3], borderRadius: radius.lg },
  etaNumber: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  etaUnit: { fontSize: fontSizes.xs, color: colors.primary },
  progress: { gap: spacing[2] },
  progressBar: { height: 6, backgroundColor: colors.gray100, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: radius.full },
  progressText: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'right' },
  driverCard: { backgroundColor: colors.gray50 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  driverSub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  driverPhone: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  callBtn: { alignItems: 'center', gap: 2 },
  callText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.medium },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.background,
  },
  cancelBtnDisabled: { opacity: 0.5 },
  cancelText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.semibold },
});

import React, { useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing, radius,
  StatusDot, Card, Badge, Button, Divider, Skeleton, EmptyState,
  LiveBusMap, AppHeader, AnimatedPressable, useToast,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import {
  useTripById,
  useLatestPosition,
  useTripSocket,
  useMyStudents,
  useCancelPickup,
  pickupCancelInfo,
  resolvePhotoUrl,
} from '@yaanam/api-client';
import { useChildStore } from '../../../store/child.store';
import { goBackTo } from '../../../lib/nav';

/** Arrival-alarm severity, ranked so the banner only ever escalates. */
const ALARM_RANK = { none: 0, arriving5: 1, arriving1: 2, arrived: 3 } as const;
type AlarmLevel = keyof typeof ALARM_RANK;

function fmtTime(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const BOARD_RESULT: Record<string, { label: string; variant: BadgeVariant }> = {
  BOARDED: { label: 'Boarded', variant: 'boarded' },
  NOT_BOARDED: { label: 'Not boarded', variant: 'not_boarded' },
  CANCELLED: { label: 'Pickup skipped', variant: 'cancelled' },
  EXPECTED: { label: 'No boarding record', variant: 'default' },
};

const DONE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'cancelled' },
  ABORTED: { label: 'Aborted', variant: 'error' },
};

export default function TrackScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, isError } = useTripById(tripId);
  const { data: primed } = useLatestPosition(tripId);
  const { data: myStudents } = useMyStudents();
  const activeChildId = useChildStore((s) => s.activeChildId);
  const cancelPickup = useCancelPickup();
  const toast = useToast();

  const [pos, setPos] = useState<{ lat: number; lng: number; speed: number | null } | null>(null);
  const [eta, setEta] = useState<{ stopName: string; minutes: number } | null>(null);
  const [liveDeparted, setLiveDeparted] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const [alarm, setAlarm] = useState<AlarmLevel>('none');
  const [alarmDismissed, setAlarmDismissed] = useState<AlarmLevel>('none');

  const t = trip as any;
  const status: string | undefined = trip?.status;
  const isScheduled = status === 'SCHEDULED';
  const isLive = status === 'STARTED' || status === 'IN_PROGRESS';
  const isDone = status === 'COMPLETED' || status === 'CANCELLED' || status === 'ABORTED';

  // The parent's rider on this trip — prefer the actively-selected child.
  // Memoised on [trip, myStudents, activeChildId] so a location/ETA ping (which
  // calls setState and re-renders) doesn't re-run these Array.find scans.
  const myIds = useMemo(() => new Set((myStudents ?? []).map((s) => s.id)), [myStudents]);
  const { myRider, child, childStopId, childStopName } = useMemo(() => {
    const rs: any[] = (trip as any)?.riders ?? [];
    const mine =
      rs.find((r) => r.studentId === activeChildId && myIds.has(r.studentId)) ??
      rs.find((r) => myIds.has(r.studentId));
    const c = (myStudents ?? []).find((s) => s.id === mine?.studentId);
    return {
      myRider: mine,
      child: c,
      childStopId: (mine?.stopId ?? mine?.stop?.id) as string | undefined,
      childStopName: (mine?.stop?.name ?? c?.stop?.name) as string | undefined,
    };
  }, [trip, myStudents, activeChildId, myIds]);

  // The child's own boarding event (the API is guardian-scoped, so attendanceEvents
  // only ever carries this family's children). Latest BOARDED event wins.
  const myBoarding = useMemo(() => {
    const events: any[] = t?.attendanceEvents ?? [];
    return [...events]
      .filter((e) => e.studentId === myRider?.studentId && e.type === 'BOARDED')
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
  }, [t, myRider]);

  // Ordered route stops + progress. Departed stops are primed from the trip's
  // historical geofence events (so a reload keeps progress) and merged with
  // live DEPARTED deltas from the socket.
  const routeStops: { id: string; name: string; lat?: number; lng?: number }[] = useMemo(
    () => (t?.route?.stops ?? []).map((rs: any) => ({ id: rs.stop.id, name: rs.stop.name, lat: rs.stop.lat, lng: rs.stop.lng })),
    [t],
  );
  // Stops that carry coordinates — the live map needs lat/lng.
  const mapStops = useMemo(
    () => routeStops.filter((s): s is { id: string; name: string; lat: number; lng: number } => s.lat != null && s.lng != null),
    [routeStops],
  );
  const baseDeparted = useMemo(
    () =>
      new Set<string>(
        (t?.geofenceEvents ?? [])
          .filter((e: any) => e.event === 'DEPARTED')
          .map((e: any) => e.stopId),
      ),
    [t],
  );
  const departed = useMemo(() => new Set<string>([...baseDeparted, ...liveDeparted]), [baseDeparted, liveDeparted]);
  const totalStops = routeStops.length || 1;
  const doneCount = routeStops.filter((s) => departed.has(s.id)).length;
  const currentIdx = Math.max(0, routeStops.findIndex((s) => !departed.has(s.id)));

  const raiseAlarm = (next: AlarmLevel) =>
    setAlarm((prev) => (ALARM_RANK[next] > ALARM_RANK[prev] ? next : prev));

  useTripSocket(tripId, {
    onLocation: (d) => {
      setPos({ lat: d.lat, lng: d.lng, speed: d.speed ?? null });
      setLive(true);
    },
    onEta: (d) => {
      setEta({ stopName: d.stopName, minutes: d.etaMinutes });
      // Mirror the backend's arrival-alarm thresholds, keyed to the child's stop.
      if (!childStopId || d.stopId === childStopId) {
        if (d.etaMinutes <= 1) raiseAlarm('arriving1');
        else if (d.etaMinutes <= 5) raiseAlarm('arriving5');
      }
    },
    onGeofence: (d) => {
      if (d.event === 'DEPARTED') setLiveDeparted((s) => new Set(s).add(d.stopId));
      if (d.event === 'AT_STOP' && (!childStopId || d.stopId === childStopId)) raiseAlarm('arrived');
    },
  });

  // Prime the map from the REST latest snapshot before socket deltas arrive.
  const latest = pos ?? (primed ? { lat: primed.lat, lng: primed.lng, speed: primed.speed } : null);

  const skip = pickupCancelInfo(trip, myRider);

  const onSkipPickup = () => {
    if (!myRider || !skip.canCancel) return;
    const name = child?.name ?? myRider.student?.name ?? 'your child';
    Alert.alert('Skip pickup today?', `${name} will be skipped for this trip. The driver roster updates immediately.`, [
      { text: 'Keep pickup', style: 'cancel' },
      {
        text: 'Skip today',
        style: 'destructive',
        onPress: () =>
          cancelPickup.mutate(
            { tripId, studentId: myRider.studentId, reason: 'Skipped by parent' },
            {
              onSuccess: () => toast.success('The driver roster has been updated.', 'Pickup skipped'),
              onError: (e: any) =>
                toast.error(e?.response?.data?.message ?? e?.message ?? 'Please try again.', 'Could not skip pickup'),
            },
          ),
      },
    ]);
  };

  const routeName: string | undefined = t?.route?.name;
  const directionLabel = trip?.direction === 'DROP' ? 'Drop-off' : 'Pickup';

  // ── Header right slot: state-specific ────────────────────────────────────
  const headerRight = isLive ? (
    <View style={[styles.livePill, !live && styles.livePillIdle]}>
      <StatusDot variant={live ? 'live' : 'offline'} size={7} />
      <Text style={[styles.liveText, !live && styles.liveTextIdle]}>{live ? 'LIVE' : 'OFFLINE'}</Text>
    </View>
  ) : isScheduled ? (
    <Badge label="Scheduled" variant="warning" size="sm" />
  ) : isDone && status ? (
    <Badge label={DONE_BADGE[status]?.label ?? status} variant={DONE_BADGE[status]?.variant ?? 'default'} size="sm" />
  ) : undefined;

  // ── Driver card (shared by scheduled + live + done) ───────────────────────
  // Curated, server-built driver projection — only { name, photoUrl, phone }.
  const driver = t?.driver as { name: string; photoUrl?: string | null; phone?: string | null } | null | undefined;
  const driverCard = (
    <Card style={styles.driverCard} shadow="none">
      <View style={styles.driverRow}>
        <View style={styles.driverAvatar}>
          {driver?.photoUrl ? (
            <Image source={{ uri: resolvePhotoUrl(driver.photoUrl) }} style={styles.driverAvatarImg} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 20 }}>🧑‍✈️</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driver?.name ?? 'Driver not assigned'}</Text>
          <Text style={styles.driverSub}>
            Bus {t?.vehicle?.regNumber ?? '—'}
            {routeName ? `  ·  ${routeName}` : ''}
          </Text>
        </View>
        {driver?.phone ? (
          <AnimatedPressable
            style={styles.msgBtn}
            scaleTo={0.92}
            onPress={() => Linking.openURL(`tel:${driver.phone}`)}
            accessibilityRole="button"
            accessibilityLabel="Call driver"
          >
            <Text style={{ fontSize: 16 }}>📞</Text>
            <Text style={styles.msgText}>Call</Text>
          </AnimatedPressable>
        ) : null}
        <AnimatedPressable
          style={styles.msgBtn}
          scaleTo={0.92}
          onPress={() => router.push(`/(app)/messages/driver?tripId=${tripId}` as never)}
          accessibilityRole="button"
          accessibilityLabel="Message driver"
        >
          <Text style={{ fontSize: 16 }}>💬</Text>
          <Text style={styles.msgText}>Message</Text>
        </AnimatedPressable>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        title={isLive ? 'Live tracking' : isDone ? 'Trip summary' : directionLabel}
        subtitle={routeName}
        onBack={() => goBackTo('track/[tripId]')}
        right={headerRight}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <Skeleton width="100%" height={200} radius="xl" />
          <Skeleton width="60%" height={22} style={{ marginTop: spacing[5] }} />
          <Skeleton width="100%" height={64} radius="lg" style={{ marginTop: spacing[4] }} />
        </View>
      ) : isError || !trip ? (
        <EmptyState
          icon={<Text style={{ fontSize: 40 }}>🚌</Text>}
          title="Trip not found"
          description="This trip could not be loaded. Pull back and try again."
        />
      ) : isLive ? (
        /* ─── LIVE: map + alarm + ETA + progress + driver ─── */
        <>
          <View style={styles.mapWrap}>
            <LiveBusMap
              stops={mapStops}
              busLat={latest?.lat}
              busLng={latest?.lng}
              schoolLat={t?.anchor?.lat}
              schoolLng={t?.anchor?.lng}
              schoolLabel={t?.anchor?.label}
              schoolRole={t?.anchor?.role}
              routeName={routeName}
              height={220}
            />
          </View>

          <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.sheet}>
              {alarm !== 'none' && ALARM_RANK[alarm] > ALARM_RANK[alarmDismissed] && (
                <AlarmBanner level={alarm} stopName={childStopName ?? eta?.stopName} onDismiss={() => setAlarmDismissed(alarm)} />
              )}

              <View style={styles.etaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.etaLabel}>NEXT STOP</Text>
                  <Text style={styles.etaStop} numberOfLines={1}>
                    {eta?.stopName ?? routeStops[currentIdx]?.name ?? '—'}
                  </Text>
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
                <Text style={styles.progressText}>{doneCount} of {totalStops} stops passed</Text>
              </View>

              {myBoarding ? (
                <BoardingCard
                  childName={child?.name ?? myRider?.student?.name}
                  photoUrl={myBoarding.photoUrl}
                  ts={myBoarding.ts}
                />
              ) : null}

              {driverCard}
            </View>
          </ScrollView>
        </>
      ) : isScheduled ? (
        /* ─── SCHEDULED: pre-trip, no live map ─── */
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.preTripCard} shadow="md">
            <Text style={styles.preLabel}>{directionLabel.toUpperCase()} STARTS AT</Text>
            <Text style={styles.preTime}>
              {fmtTime(trip.scheduledStart) ??
                (trip?.direction === 'DROP' ? child?.ageGroup?.dropTime : child?.ageGroup?.pickupTime) ??
                '—'}
            </Text>
            <View style={styles.preHint}>
              <Text style={styles.preHintText}>🛰  Live tracking opens when the bus starts.</Text>
            </View>

            <Divider spacingY={4} />

            <View style={styles.rows}>
              {routeName ? (
                <View style={styles.row}><Text style={styles.rowLabel}>🛣  Route</Text><Text style={styles.rowValue} numberOfLines={1}>{routeName}</Text></View>
              ) : null}
              {childStopName ? (
                <View style={styles.row}><Text style={styles.rowLabel}>📍  Stop</Text><Text style={styles.rowValue} numberOfLines={1}>{childStopName}</Text></View>
              ) : null}
              {child?.name ? (
                <View style={styles.row}><Text style={styles.rowLabel}>👤  Child</Text><Text style={styles.rowValue} numberOfLines={1}>{child.name}</Text></View>
              ) : null}
            </View>
          </Card>

          {/* Skip-pickup, gated on the cutoff (mirrors the backend rule). */}
          {myRider ? (
            skip.alreadySkipped ? (
              <Card style={styles.skippedCard} shadow="none">
                <Text style={styles.skippedTitle}>✓  Pickup skipped for today</Text>
                <Text style={styles.skippedSub}>The driver roster has been updated. Your child won't be picked up on this trip.</Text>
              </Card>
            ) : skip.canCancel ? (
              <View style={styles.skipWrap}>
                <Button
                  title={cancelPickup.isPending ? 'Skipping…' : 'Skip pickup today'}
                  variant="outline"
                  size="lg"
                  fullWidth
                  loading={cancelPickup.isPending}
                  onPress={onSkipPickup}
                />
                {fmtTime(skip.cutoffAt) ? (
                  <Text style={styles.skipHint}>You can skip until {fmtTime(skip.cutoffAt)}.</Text>
                ) : null}
              </View>
            ) : skip.isDrop ? (
              // A drop is never skippable — no "Skip pickup" control (pickups only),
              // just the explanation that the child still needs to get home.
              <View style={styles.skipWrap}>
                <Text style={styles.skipHintMuted}>{skip.reason}</Text>
              </View>
            ) : (
              <View style={styles.skipWrap}>
                <Button title="Skip pickup today" variant="outline" size="lg" fullWidth disabled onPress={() => {}} />
                <Text style={styles.skipHintMuted}>{skip.reason}</Text>
              </View>
            )
          ) : null}

          {driverCard}
        </ScrollView>
      ) : (
        /* ─── DONE: read-only summary ─── */
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.preTripCard} shadow="md">
            <View style={styles.summaryTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryRoute} numberOfLines={1}>{routeName ?? trip.routeId}</Text>
                <Text style={styles.summarySub}>{directionLabel}</Text>
              </View>
              {status ? (
                <Badge label={DONE_BADGE[status]?.label ?? status} variant={DONE_BADGE[status]?.variant ?? 'default'} size="sm" />
              ) : null}
            </View>

            <Divider spacingY={4} />

            <View style={styles.rows}>
              {child?.name ? (
                <View style={styles.row}><Text style={styles.rowLabel}>👤  Child</Text><Text style={styles.rowValue} numberOfLines={1}>{child.name}</Text></View>
              ) : null}
              {childStopName ? (
                <View style={styles.row}><Text style={styles.rowLabel}>📍  Stop</Text><Text style={styles.rowValue} numberOfLines={1}>{childStopName}</Text></View>
              ) : null}
              {myRider ? (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>🎒  Boarding</Text>
                  <Badge
                    label={BOARD_RESULT[myRider.boardStatus]?.label ?? myRider.boardStatus}
                    variant={BOARD_RESULT[myRider.boardStatus]?.variant ?? 'default'}
                    size="sm"
                  />
                </View>
              ) : null}
            </View>
          </Card>

          {myBoarding ? (
            <BoardingCard
              childName={child?.name ?? myRider?.student?.name}
              photoUrl={myBoarding.photoUrl}
              ts={myBoarding.ts}
            />
          ) : null}

          {driverCard}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** In-app mirror of the backend arrival pushes (~5 min / ~1 min / arrived). */
function AlarmBanner({ level, stopName, onDismiss }: { level: AlarmLevel; stopName?: string; onDismiss: () => void }) {
  const stop = stopName ?? 'your stop';
  const config =
    level === 'arrived'
      ? { icon: '🏁', title: 'Bus has arrived', body: `The bus has arrived at ${stop}.`, bg: colors.successBg, fg: colors.successDark }
      : level === 'arriving1'
      ? { icon: '⏱', title: 'Bus is ~1 min away', body: `About a minute from ${stop}. Please be ready.`, bg: colors.warningBg, fg: colors.warningDark }
      : { icon: '🚌', title: 'Bus is ~5 min away', body: `The bus is about 5 minutes from ${stop}.`, bg: colors.infoBg, fg: colors.info };

  return (
    <View style={[styles.banner, { backgroundColor: config.bg }]}>
      <Text style={styles.bannerIcon}>{config.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerTitle, { color: config.fg }]}>{config.title}</Text>
        <Text style={[styles.bannerBody, { color: config.fg }]}>{config.body}</Text>
      </View>
      <AnimatedPressable onPress={onDismiss} scaleTo={0.9} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss alert">
        <Text style={[styles.bannerClose, { color: config.fg }]}>✕</Text>
      </AnimatedPressable>
    </View>
  );
}

/**
 * The child's boarding confirmation — driver-captured photo (if any) + the time
 * they boarded. Only ever rendered for the parent's own child (the API never
 * sends another family's attendance event to this screen).
 */
function BoardingCard({ childName, photoUrl, ts }: { childName?: string; photoUrl?: string | null; ts?: string }) {
  const time = fmtTime(ts);
  const name = childName ?? 'Your child';
  return (
    <Card style={styles.boardingCard} shadow="none">
      <View style={styles.boardingRow}>
        {photoUrl ? (
          <Image source={{ uri: resolvePhotoUrl(photoUrl) }} style={styles.boardingPhoto} resizeMode="cover" />
        ) : (
          <View style={[styles.boardingPhoto, styles.boardingPhotoEmpty]}>
            <Text style={{ fontSize: 22 }}>🎒</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.boardingTitle}>✓ {name} boarded</Text>
          <Text style={styles.boardingSub}>
            {time ? `Boarded at ${time}` : 'Boarding confirmed by the driver'}
          </Text>
          {photoUrl ? <Text style={styles.boardingHint}>Photo taken by the driver</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },

  boardingCard: { backgroundColor: colors.successBg },
  boardingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  boardingPhoto: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.gray100 },
  boardingPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  boardingTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.successDark },
  boardingSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  boardingHint: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },

  loadingWrap: { padding: spacing[4] },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },

  // Live pill (header)
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.successBg, paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.full,
  },
  livePillIdle: { backgroundColor: colors.gray100 },
  liveText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold },
  liveTextIdle: { color: colors.textMuted },

  // Live view
  mapWrap: { padding: spacing[4], paddingBottom: 0 },
  sheetScroll: { paddingBottom: spacing[8] },
  sheet: { padding: spacing[4], gap: spacing[4] },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  etaLabel: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.semibold, letterSpacing: letterSpacing.wider },
  etaStop: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: 2 },
  etaBox: { alignItems: 'center', backgroundColor: colors.primaryBg, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg },
  etaNumber: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  etaUnit: { fontSize: fontSizes.xs, color: colors.primary },
  progress: { gap: spacing[2] },
  progressBar: { height: 6, backgroundColor: colors.gray100, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: radius.full },
  progressText: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'right' },

  // Arrival banner
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg },
  bannerIcon: { fontSize: 22 },
  bannerTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold },
  bannerBody: { fontSize: fontSizes.xs, marginTop: 1 },
  bannerClose: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, paddingHorizontal: spacing[1] },

  // Pre-trip / summary card
  preTripCard: { gap: spacing[1] },
  preLabel: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.semibold, letterSpacing: letterSpacing.wider },
  preTime: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  preHint: { marginTop: spacing[2], flexDirection: 'row' },
  preHintText: { fontSize: fontSizes.sm, color: colors.textSecondary },

  rows: { gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  rowLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  rowValue: { flex: 1, textAlign: 'right', fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },

  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  summaryRoute: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  summarySub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },

  // Skip pickup
  skipWrap: { gap: spacing[2] },
  skipHint: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },
  skipHintMuted: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
  skippedCard: { backgroundColor: colors.gray50, gap: spacing[1] },
  skippedTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  skippedSub: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },

  // Driver card
  driverCard: { backgroundColor: colors.gray50 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  driverAvatarImg: { width: 44, height: 44 },
  driverName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  driverSub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  msgBtn: { alignItems: 'center', gap: 2 },
  msgText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.medium },
});

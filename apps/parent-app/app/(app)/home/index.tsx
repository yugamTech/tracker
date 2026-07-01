import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing, radius,
  Card, Badge, Avatar, Skeleton, EmptyState, AnimatedPressable, Button, SlideIn, useToast,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useAuthStore } from '../../../store/auth.store';
import { useChildStore } from '../../../store/child.store';
import {
  useMyStudents, useTodayTrips, useCancelPickup, pickupCancelInfo,
  tripStatusLabel, tripLabelVariant,
} from '@yaanam/api-client';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtTime(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function HomeScreen() {
  const person = useAuthStore((s) => s.person);
  const activeChildId = useChildStore((s) => s.activeChildId);
  const setActiveChild = useChildStore((s) => s.setActiveChild);
  const { data: students, isLoading, refetch, isRefetching } = useMyStudents();
  const { data: todayTrips } = useTodayTrips();
  const cancelPickup = useCancelPickup();
  const toast = useToast();

  const multiple = (students?.length ?? 0) > 1;
  const activeChild =
    students?.find((s) => s.id === activeChildId) ??
    (students?.length === 1 ? students[0] : undefined);

  // Multi-child accounts with no (valid) selection bounce to the picker.
  useEffect(() => {
    if (isLoading || !students) return;
    if (students.length > 1 && !students.some((s) => s.id === activeChildId)) {
      router.replace('/(app)/child-select' as never);
    } else if (students.length === 1 && activeChildId !== students[0].id) {
      setActiveChild(students[0].id);
    }
  }, [isLoading, students, activeChildId, setActiveChild]);

  // ALL of the active child's trips today (pickup + drop), the active ride first,
  // then chronological — the Uber "active ride is the hero" layout. Each card
  // derives its label from the CORE helper, so a completed trip reads terminal.
  const childTrips = (todayTrips ?? []).filter((t) => t.routeId === activeChild?.routeId);
  const timeOf = (t: { scheduledStart?: string | null; date?: string }) =>
    new Date(t.scheduledStart ?? t.date ?? 0).getTime();
  const isLiveTrip = (t: { status: string }) => t.status === 'STARTED' || t.status === 'IN_PROGRESS';
  const sortedTrips = [...childTrips].sort((a, b) => {
    const la = isLiveTrip(a) ? 0 : 1;
    const lb = isLiveTrip(b) ? 0 : 1;
    if (la !== lb) return la - lb; // live floats to the top
    return timeOf(a) - timeOf(b); // otherwise morning → evening
  });

  const onSkipPickup = (tripId: string) => {
    if (!activeChild) return;
    Alert.alert('Skip pickup today?', `${activeChild.name} will be skipped for this trip. The driver roster updates immediately.`, [
      { text: 'Keep pickup', style: 'cancel' },
      {
        text: 'Skip today',
        style: 'destructive',
        onPress: () =>
          cancelPickup.mutate(
            { tripId, studentId: activeChild.id, reason: 'Skipped by parent' },
            {
              onSuccess: () => toast.success('The driver roster has been updated.', 'Pickup skipped'),
              onError: (e: any) =>
                toast.error(e?.response?.data?.message ?? e?.message ?? 'Please try again.', 'Could not skip pickup'),
            },
          ),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{greeting()} 👋</Text>
            <Text style={styles.name} numberOfLines={1}>{person?.name ?? 'Parent'}</Text>
          </View>
          <AnimatedPressable
            onPress={() => router.push('/(app)/notifications' as never)}
            scaleTo={0.92}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </AnimatedPressable>
        </View>

        {/* Switch-child pill (only when more than one) */}
        {multiple && activeChild && (
          <AnimatedPressable
            onPress={() => router.push('/(app)/child-select' as never)}
            scaleTo={0.98}
            style={styles.switchPill}
            accessibilityRole="button"
            accessibilityLabel="Switch child"
          >
            <Avatar name={activeChild.name} size={24} />
            <Text style={styles.switchName} numberOfLines={1}>{activeChild.name}</Text>
            <Text style={styles.switchAction}>Switch ⇄</Text>
          </AnimatedPressable>
        )}

        {isLoading ? (
          <Card style={styles.heroCard} shadow="sm">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <Skeleton width={40} height={40} circle />
              <View style={{ flex: 1, gap: spacing[2] }}>
                <Skeleton width="50%" height={18} />
                <Skeleton width="35%" height={13} />
              </View>
            </View>
            <Skeleton width="100%" height={1} style={{ marginVertical: spacing[4] }} />
            <Skeleton width="100%" height={44} radius="lg" />
          </Card>
        ) : !students || students.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<Text style={{ fontSize: 40 }}>👶</Text>}
              title="No children linked"
              description="No students are linked to your account yet. Contact your school to get set up."
            />
          </View>
        ) : activeChild ? (
          <>
            {/* Active child + all of today's trips (active one is the hero) */}
            <View style={styles.childRow}>
              <Avatar name={activeChild.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.childName} numberOfLines={1}>{activeChild.name}</Text>
                {activeChild.route?.name ? <Text style={styles.childSub} numberOfLines={1}>{activeChild.route.name}</Text> : null}
              </View>
            </View>
            <Text style={styles.sectionTitle}>TODAY</Text>

            {sortedTrips.length === 0 ? (
              <Card style={styles.heroCard} shadow="sm">
                <View style={styles.noTripRow}>
                  <Text style={{ fontSize: 22 }}>🗓️</Text>
                  <Text style={styles.noTripText}>No trips scheduled for {activeChild.name} today.</Text>
                </View>
              </Card>
            ) : (
              sortedTrips.map((trip, idx) => {
                const t = trip as any;
                const myRider = t.riders?.find((r: any) => r.studentId === activeChild.id);
                const live = isLiveTrip(trip);
                const done = trip.status === 'COMPLETED' || trip.status === 'CANCELLED' || trip.status === 'ABORTED';
                const notBoarded = myRider?.boardStatus === 'NOT_BOARDED';
                const skipped = myRider?.boardStatus === 'CANCELLED';
                const dirLabel = trip.direction === 'DROP' ? 'Drop-off' : 'Pickup';
                const planned = fmtTime(t.scheduledStart);
                const label = tripStatusLabel({
                  direction: trip.direction,
                  status: trip.status,
                  boardStatus: myRider?.boardStatus,
                  scheduledStart: t.scheduledStart,
                  completedAt: t.completedAt,
                  stopName: t.stop?.name ?? activeChild.stop?.name ?? null,
                });
                const skipInfo = pickupCancelInfo(trip, myRider);
                return (
                  <SlideIn key={trip.id} delay={Math.min(idx, 6) * 60}>
                    <AnimatedPressable
                      onPress={() => router.push(`/(app)/track/${trip.id}` as never)}
                      scaleTo={0.985}
                    >
                      <Card style={[styles.tripCard, live && styles.tripCardLive]} shadow={live ? 'md' : 'sm'}>
                        {/* Exception banner — clear + colored */}
                        {notBoarded ? (
                          <View style={[styles.banner, styles.bannerError]}>
                            <Text style={styles.bannerErrorText}>⚠️  {activeChild.name} did not board this {dirLabel.toLowerCase()}</Text>
                          </View>
                        ) : skipped ? (
                          <View style={[styles.banner, styles.bannerMuted]}>
                            <Text style={styles.bannerMutedText}>Pickup skipped for today</Text>
                          </View>
                        ) : null}

                        <View style={styles.tripHead}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.tripDirRow}>
                              {live ? <View style={styles.liveDot} /> : null}
                              <Text style={styles.tripDir}>{dirLabel}</Text>
                              {planned ? <Text style={styles.tripTime}>· {planned}</Text> : null}
                            </View>
                            <Badge
                              label={label.label}
                              variant={tripLabelVariant(label.state) as BadgeVariant}
                              size="sm"
                            />
                          </View>
                        </View>

                        {live ? (
                          <Button
                            title="Track live →"
                            variant="primary"
                            size="lg"
                            fullWidth
                            onPress={() => router.push(`/(app)/track/${trip.id}` as never)}
                            style={{ marginTop: spacing[3] }}
                          />
                        ) : !done ? (
                          <Button
                            title={`View ${dirLabel.toLowerCase()} →`}
                            variant="outline"
                            size="md"
                            fullWidth
                            onPress={() => router.push(`/(app)/track/${trip.id}` as never)}
                            style={{ marginTop: spacing[3] }}
                          />
                        ) : null}

                        {/* Skip pickup — only before a scheduled pickup, gated on the cutoff. */}
                        {trip.status === 'SCHEDULED' && myRider && !skipped ? (
                          skipInfo.canCancel ? (
                            <Button
                              title={cancelPickup.isPending ? 'Skipping…' : 'Skip pickup today'}
                              variant="ghost"
                              size="md"
                              fullWidth
                              loading={cancelPickup.isPending}
                              onPress={() => onSkipPickup(trip.id)}
                              style={{ marginTop: spacing[1] }}
                            />
                          ) : skipInfo.isDrop ? null : (
                            <Text style={styles.skipClosedNote}>{skipInfo.reason}</Text>
                          )
                        ) : null}
                      </Card>
                    </AnimatedPressable>
                  </SlideIn>
                );
              })
            )}
          </>
        ) : null}

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <SlideIn delay={80}>
          <View style={styles.quickActions}>
            {[
              { icon: '🚌', label: 'Trips', onPress: () => router.push('/(app)/trips' as never) },
              { icon: '💬', label: 'Raise Issue', onPress: () => router.push('/(app)/complaints/new' as never) },
              { icon: '💳', label: 'Pay Fees', onPress: () => router.push('/(app)/payments' as never) },
              { icon: '👤', label: 'Profile', onPress: () => router.push('/(app)/profile' as never) },
            ].map((a) => (
              <AnimatedPressable key={a.label} onPress={a.onPress} scaleTo={0.95} style={styles.quickAction}>
                <Text style={{ fontSize: 26 }}>{a.icon}</Text>
                <Text style={styles.quickLabel}>{a.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </SlideIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  scroll: { paddingBottom: spacing[8] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
  },
  headerText: { flex: 1, marginRight: spacing[3] },
  greeting: { fontSize: fontSizes.sm, color: colors.textSecondary },
  name: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  switchPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[1],
    paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    backgroundColor: colors.primaryBg, borderRadius: radius.full,
  },
  switchName: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primaryDark },
  switchAction: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.primary, letterSpacing: letterSpacing.wide },
  sectionTitle: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted,
    letterSpacing: letterSpacing.wider, marginHorizontal: spacing[5],
    marginTop: spacing[5], marginBottom: spacing[3],
  },
  heroCard: { marginHorizontal: spacing[4] },
  childRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    marginHorizontal: spacing[5], marginTop: spacing[2],
  },
  childName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  childSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  noTripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  noTripText: { flex: 1, fontSize: fontSizes.sm, color: colors.textSecondary },
  // Trip cards — the active ride is the hero (accented + primary CTA).
  tripCard: { marginHorizontal: spacing[4], marginBottom: spacing[3], gap: spacing[1] },
  tripCardLive: { borderWidth: 1.5, borderColor: colors.primary },
  tripHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  tripDirRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  tripDir: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  tripTime: { fontSize: fontSizes.sm, color: colors.textSecondary },
  banner: { borderRadius: radius.lg, paddingVertical: spacing[2], paddingHorizontal: spacing[3], marginBottom: spacing[2] },
  bannerError: { backgroundColor: colors.errorBg },
  bannerErrorText: { fontSize: fontSizes.sm, color: colors.errorDark, fontWeight: fontWeights.semibold },
  bannerMuted: { backgroundColor: colors.gray100 },
  bannerMutedText: { fontSize: fontSizes.sm, color: colors.gray600, fontWeight: fontWeights.medium },
  skipClosedNote: { marginTop: spacing[3], fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
  emptyWrap: { minHeight: 320 },
  quickActions: { flexDirection: 'row', marginHorizontal: spacing[4], gap: spacing[3] },
  quickAction: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.xl,
    paddingVertical: spacing[4], paddingHorizontal: spacing[2], alignItems: 'center', gap: spacing[2],
    borderWidth: 1, borderColor: colors.border,
  },
  quickLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: fontWeights.medium, textAlign: 'center' },
});

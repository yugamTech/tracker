import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing, radius,
  Card, Badge, Avatar, Skeleton, EmptyState, AnimatedPressable, Button, Divider,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';
import { useChildStore } from '../../../store/child.store';
import { useMyStudents, useTodayTrips, useCancelPickup, pickupCancelInfo } from '@saarthi/api-client';

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

  // The relevant trip for this child today: a live one wins, else a scheduled one.
  const childTrips = (todayTrips ?? []).filter((t) => t.routeId === activeChild?.routeId);
  const liveTrip = childTrips.find((t) => t.status === 'STARTED' || t.status === 'IN_PROGRESS');
  const scheduledTrip = childTrips.find((t) => t.status === 'SCHEDULED');
  const activeTrip = liveTrip ?? scheduledTrip ?? childTrips[0];
  const phase: 'live' | 'scheduled' | 'done' | 'none' = liveTrip
    ? 'live'
    : scheduledTrip
    ? 'scheduled'
    : activeTrip
    ? 'done'
    : 'none';

  const myRider = (activeTrip as any)?.riders?.find((r: any) => r.studentId === activeChild?.id);
  const skip = pickupCancelInfo(activeTrip, myRider);

  const startsAt =
    fmtTime((activeTrip as any)?.scheduledStart) ??
    (activeTrip?.direction === 'DROP' ? activeChild?.ageGroup?.dropTime : activeChild?.ageGroup?.pickupTime) ??
    null;

  const heroBadge: { label: string; variant: BadgeVariant } =
    phase === 'live'
      ? { label: 'Live ●', variant: 'active' }
      : skip.alreadySkipped
      ? { label: 'Skipped today', variant: 'cancelled' }
      : phase === 'scheduled'
      ? { label: 'Scheduled', variant: 'warning' }
      : phase === 'done'
      ? { label: 'Trip ended', variant: 'inactive' }
      : { label: 'No trip', variant: 'inactive' };

  const primaryTitle =
    phase === 'live' ? 'Track live →' : phase === 'scheduled' ? 'View pickup →' : phase === 'done' ? 'View summary →' : 'View trips';

  const onPrimary = () => {
    if (activeTrip) router.push(`/(app)/track/${activeTrip.id}` as never);
    else router.push('/(app)/trips' as never);
  };

  const onSkipPickup = () => {
    if (!activeTrip || !activeChild || !skip.canCancel) return;
    Alert.alert('Skip pickup today?', `${activeChild.name} will be skipped for this trip. The driver roster updates immediately.`, [
      { text: 'Keep pickup', style: 'cancel' },
      {
        text: 'Skip today',
        style: 'destructive',
        onPress: () =>
          cancelPickup.mutate(
            { tripId: activeTrip.id, studentId: activeChild.id, reason: 'Skipped by parent' },
            {
              onSuccess: () => Alert.alert('Pickup skipped', 'The driver roster has been updated.'),
              onError: (e: any) =>
                Alert.alert('Could not skip pickup', e?.response?.data?.message ?? e?.message ?? 'Please try again.'),
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
            <View style={styles.heroTop}>
              <Skeleton width={48} height={48} circle />
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
            {/* Active child hero */}
            <Text style={styles.sectionTitle}>TODAY</Text>
            <Card style={styles.heroCard} shadow="md">
              <View style={styles.heroTop}>
                <Avatar name={activeChild.name} size={48} />
                <View style={styles.heroInfo}>
                  <Text style={styles.heroName} numberOfLines={1}>{activeChild.name}</Text>
                  {activeChild.regId ? <Text style={styles.heroSub}>{activeChild.regId}</Text> : null}
                </View>
                <Badge label={heroBadge.label} variant={heroBadge.variant} size="sm" />
              </View>

              <Divider spacingY={4} />

              <View style={styles.rows}>
                {phase === 'scheduled' && startsAt ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>🕐  {activeTrip?.direction === 'DROP' ? 'Drop-off' : 'Pickup'} at</Text>
                    <Text style={styles.rowValue}>{startsAt}</Text>
                  </View>
                ) : null}
                {activeChild.route?.name ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>🛣  Route</Text>
                    <Text style={styles.rowValue} numberOfLines={1}>{activeChild.route.name}</Text>
                  </View>
                ) : null}
                {activeChild.stop?.name ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>📍  Stop</Text>
                    <Text style={styles.rowValue} numberOfLines={1}>{activeChild.stop.name}</Text>
                  </View>
                ) : null}
              </View>

              <Button
                title={primaryTitle}
                variant={phase === 'live' ? 'primary' : 'outline'}
                size="lg"
                fullWidth
                onPress={onPrimary}
                style={{ marginTop: spacing[4] }}
              />

              {/* Skip pickup — only before a scheduled trip, gated on the cutoff. */}
              {phase === 'scheduled' && myRider ? (
                skip.alreadySkipped ? (
                  <Text style={styles.skippedNote}>✓  Pickup skipped for today</Text>
                ) : skip.canCancel ? (
                  <Button
                    title={cancelPickup.isPending ? 'Skipping…' : 'Skip pickup today'}
                    variant="ghost"
                    size="md"
                    fullWidth
                    loading={cancelPickup.isPending}
                    onPress={onSkipPickup}
                    style={{ marginTop: spacing[1] }}
                  />
                ) : (
                  <Text style={styles.skipClosedNote}>{skip.reason}</Text>
                )
              ) : null}
            </Card>
          </>
        ) : null}

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
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
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroInfo: { flex: 1 },
  heroName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  heroSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  rows: { gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  rowLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  rowValue: { flex: 1, textAlign: 'right', fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  skippedNote: { marginTop: spacing[3], fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium, textAlign: 'center' },
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

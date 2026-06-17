import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius, letterSpacing,
  Card, Badge, Avatar, Skeleton, EmptyState, AnimatedPressable, Button,
} from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { useTodayTrips } from '@saarthi/api-client';
import type { BadgeVariant } from '@saarthi/ui';

const LIVE = ['STARTED', 'IN_PROGRESS'];

function tripStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'IN_PROGRESS': case 'STARTED': return 'info';
    case 'SCHEDULED': return 'warning';
    case 'CANCELLED': return 'cancelled';
    case 'ABORTED': return 'error';
    default: return 'default';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'In progress';
    case 'STARTED': return 'Started';
    case 'SCHEDULED': return 'Scheduled';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    case 'ABORTED': return 'Aborted';
    default: return status;
  }
}

export default function DriverHomeScreen() {
  const person = useAuthStore((s) => s.person);
  const firstName = person?.name?.split(' ')[0] ?? 'Driver';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  const { data: trips, isLoading, isError } = useTodayTrips();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting} numberOfLines={1}>Hello, {firstName}</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <View style={styles.headerActions}>
          <AnimatedPressable
            onPress={() => router.push('/(app)/vehicle-check' as never)}
            style={styles.checkBtn}
            accessibilityRole="button"
            accessibilityLabel="Vehicle check"
          >
            <Text style={styles.checkLabel}>Vehicle check</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => router.push('/(app)/profile' as never)}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Avatar name={person?.name ?? 'Driver'} size={40} />
          </AnimatedPressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.skeletonCard}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="40%" height={13} style={{ marginTop: spacing[3] }} />
              <Skeleton width="100%" height={48} radius="lg" style={{ marginTop: spacing[4] }} />
            </Card>
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          title="Could not load trips"
          description="Check your connection and try again"
        />
      ) : (
        <FlatList
          data={trips ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              TODAY'S TRIPS · {trips?.length ?? 0}
            </Text>
          }
          ListEmptyComponent={
            <EmptyState title="No trips today" description="You have no assigned trips for today" />
          }
          renderItem={({ item }) => {
            const t = item as any;
            const live = LIVE.includes(item.status);
            const done = item.status === 'COMPLETED';
            const routeName = t?.route?.name ?? item.routeId;
            return (
              <Card style={styles.card} shadow="sm">
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.route} numberOfLines={1}>{routeName}</Text>
                    <Text style={styles.meta}>
                      {item.direction === 'PICKUP' ? 'Pickup' : 'Drop'}
                      {t?.scheduledTime ? ` · ${t.scheduledTime}` : ''}
                    </Text>
                  </View>
                  <Badge label={statusLabel(item.status)} variant={tripStatusVariant(item.status)} size="sm" />
                </View>

                {t?.riderCount != null && (
                  <View style={styles.riderRow}>
                    <Text style={styles.riderCount}>{t.riderCount} riders</Text>
                  </View>
                )}

                {!done && (
                  <Button
                    title={live ? 'Resume trip' : 'View trip'}
                    variant={live ? 'primary' : 'outline'}
                    size="lg"
                    fullWidth
                    onPress={() =>
                      router.push(
                        (live
                          ? `/(app)/trip/${item.id}/active`
                          : `/(app)/trip/${item.id}`) as never,
                      )
                    }
                    style={{ marginTop: spacing[4] }}
                  />
                )}
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerText: { flex: 1, marginRight: spacing[3] },
  greeting: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  date: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  checkBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, backgroundColor: colors.primaryBg,
  },
  checkLabel: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  sectionTitle: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted,
    letterSpacing: letterSpacing.wider, marginBottom: spacing[3],
  },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  skeletonCard: { gap: 0 },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] },
  cardTitleWrap: { flex: 1 },
  route: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 4 },
  riderRow: { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  riderCount: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
});

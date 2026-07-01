import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius, letterSpacing,
  Card, Badge, Skeleton, EmptyState, AppHeader, ScreenContainer, SegmentedControl,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useDriverHistory, useFilteredTrips, formatTripWhen } from '@yaanam/api-client';
import type { HistoryTrip, DriverEfficiency } from '@yaanam/api-client';
import type { Trip } from '@yaanam/types';

type HistoryFilter = 'upcoming' | 'past';
const FILTER_SEGMENTS: { label: string; value: HistoryFilter }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
];

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

/** A 0–1 rate as a whole-number percent, or an em-dash when there's no data. */
function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function EfficiencySummary({ summary }: { summary: DriverEfficiency }) {
  const stats: { label: string; value: string }[] = [
    { label: 'Trips completed', value: String(summary.tripsCompleted) },
    { label: 'On-time start', value: pct(summary.onTimeRate) },
    { label: 'Avg boarding', value: pct(summary.avgBoardingRate) },
    { label: 'Total trips', value: String(summary.totalTrips) },
  ];
  return (
    <View style={styles.summaryWrap}>
      <Text style={styles.summaryTitle}>YOUR EFFICIENCY</Text>
      <View style={styles.summaryGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Rich past-trip card: boarding, duration, on-time and vehicle-check outcome. */
function PastTripCard({ item }: { item: HistoryTrip }) {
  const routeName = item.route?.name ?? 'Route';
  const when = formatTripWhen(item.scheduledStart ?? item.date);
  return (
    <Card style={styles.card} shadow="sm">
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.route} numberOfLines={1}>{routeName}</Text>
          <Text style={styles.meta}>{item.direction === 'PICKUP' ? 'Pickup' : 'Drop'}</Text>
          {!!when && <Text style={styles.when}>{when}</Text>}
        </View>
        <Badge label={statusLabel(item.status)} variant={tripStatusVariant(item.status)} size="sm" />
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.boarded}/{item.expectedToBoard}</Text>
          <Text style={styles.statLabel}>Boarded</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {item.durationMinutes != null ? `${item.durationMinutes} min` : '—'}
          </Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {item.onTime == null ? '—' : item.onTime ? 'On time' : 'Off-protocol'}
          </Text>
          <Text style={styles.statLabel}>Start</Text>
        </View>
      </View>

      <View style={styles.checkRow}>
        <Badge
          label={item.vehicleChecked ? '✓ Checked' : '⚠ No check'}
          variant={item.vehicleChecked ? 'success' : 'warning'}
          size="sm"
        />
      </View>
    </Card>
  );
}

/** Upcoming (scheduled) trip card — no boarding/duration stats yet, tappable. */
function UpcomingTripCard({ item }: { item: Trip }) {
  const routeName = (item as any).route?.name ?? 'Route';
  const when = formatTripWhen(item.scheduledStart ?? item.date);
  const riderCount = (item as any).riders?.length ?? 0;
  return (
    <Card style={styles.card} shadow="sm">
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.route} numberOfLines={1}>{routeName}</Text>
          <Text style={styles.meta}>{item.direction === 'PICKUP' ? 'Pickup' : 'Drop'} · {riderCount} rider{riderCount === 1 ? '' : 's'}</Text>
          {!!when && <Text style={styles.when}>{when}</Text>}
        </View>
        <Badge label={statusLabel(item.status)} variant={tripStatusVariant(item.status)} size="sm" />
      </View>
    </Card>
  );
}

export default function DriverHistoryScreen() {
  const [filter, setFilter] = useState<HistoryFilter>('upcoming');

  const history = useDriverHistory();
  // Backend AND-scopes GET /trips to the caller, so a driver only gets their own
  // scheduled (upcoming) trips — no extra driver filter needed.
  const upcoming = useFilteredTrips({ status: 'SCHEDULED' });

  const active = filter === 'past' ? history : upcoming;
  const pastTrips = history.data?.trips ?? [];
  const upcomingTrips = upcoming.data ?? [];

  const header = (
    <SegmentedControl
      segments={FILTER_SEGMENTS}
      value={filter}
      onChange={setFilter}
      style={styles.filter}
    />
  );

  return (
    <ScreenContainer bg={colors.backgroundMuted}>
      <AppHeader title="My Trips" subtitle="History & efficiency" onBack={() => router.back()} />
      <View style={styles.filterWrap}>{header}</View>

      {active.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.skeletonCard}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="40%" height={13} style={{ marginTop: spacing[3] }} />
              <Skeleton width="100%" height={32} radius="lg" style={{ marginTop: spacing[4] }} />
            </Card>
          ))}
        </View>
      ) : active.isError ? (
        <EmptyState title="Could not load trips" description="Check your connection and try again" />
      ) : filter === 'past' ? (
        <FlatList
          data={pastTrips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={history.refetch} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              {history.data?.summary && <EfficiencySummary summary={history.data.summary} />}
              <Text style={styles.sectionTitle}>PAST TRIPS · {pastTrips.length}</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState title="No past trips yet" description="Completed trips will show up here" />
          }
          renderItem={({ item }: { item: HistoryTrip }) => <PastTripCard item={item} />}
        />
      ) : (
        <FlatList
          data={upcomingTrips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={upcoming.isRefetching} onRefresh={upcoming.refetch} tintColor={colors.primary} />}
          ListHeaderComponent={<Text style={styles.sectionTitle}>UPCOMING · {upcomingTrips.length}</Text>}
          ListEmptyComponent={
            <EmptyState title="No upcoming trips" description="Scheduled trips assigned to you will show up here" />
          }
          renderItem={({ item }: { item: Trip }) => <UpcomingTripCard item={item} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  skeletonCard: { gap: 0 },
  filterWrap: { paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  filter: {},

  summaryWrap: {
    backgroundColor: colors.background, borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: spacing[4], marginBottom: spacing[4],
  },
  summaryTitle: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.textMuted,
    letterSpacing: letterSpacing.wider, marginBottom: spacing[3],
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  summaryItem: {
    flexBasis: '47%', flexGrow: 1, padding: spacing[3], borderRadius: radius.lg,
    backgroundColor: colors.primaryBg, alignItems: 'center', gap: spacing[1],
  },
  summaryValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  summaryLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },

  sectionTitle: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted,
    letterSpacing: letterSpacing.wider, marginBottom: spacing[3],
  },

  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] },
  cardTitleWrap: { flex: 1 },
  route: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 4 },
  when: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.semibold, marginTop: 2 },

  statRow: {
    flexDirection: 'row', marginTop: spacing[3], paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },

  checkRow: { marginTop: spacing[3], flexDirection: 'row' },
});

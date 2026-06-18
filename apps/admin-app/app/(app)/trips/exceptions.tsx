import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import {
  useTripStartExceptions, useResolveStartException, useOverdueTrips,
  useTripCompletionExceptions, useResolveCompletionException,
} from '@saarthi/api-client';
import type { TripStartExceptionWithTrip, TripCompletionExceptionWithTrip, OverdueTrip } from '@saarthi/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

type FilterKey = 'open' | 'all';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'all', label: 'All' },
];

function offsetLabel(deltaMinutes: number): string {
  if (deltaMinutes === 0) return 'on time';
  const mins = Math.abs(deltaMinutes);
  return `${mins} min ${deltaMinutes < 0 ? 'early' : 'late'}`;
}

function overdueLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** A still-SCHEDULED trip overdue to start (>12h). Tap to review (start / cancel) on the monitor. */
function OverdueCard({ item }: { item: OverdueTrip }) {
  const start = item.scheduledStart ?? item.date;
  return (
    <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/fleet/${item.id}` as never)}>
      <Card shadow="sm" style={[styles.card, { borderLeftColor: colors.warning }]}>
        <View style={styles.cardTop}>
          <Text style={styles.route} numberOfLines={1}>{item.route?.name ?? 'Route'} · {item.direction}</Text>
          <Badge label="Never started" variant="warning" size="sm" />
        </View>
        <Text style={styles.meta}>{item.driver?.name ?? '—'} · {item.vehicle?.regNumber ?? '—'}</Text>
        <View style={styles.flags}>
          <Text style={styles.flag}>⏱ Overdue by {overdueLabel(item.overdueMinutes)}</Text>
        </View>
        <Text style={styles.times}>Scheduled {start ? new Date(start).toLocaleString() : '—'}</Text>
      </Card>
    </AnimatedPressable>
  );
}

/** An early trip-completion (driver ended before the final stop). Mark resolved here. */
function CompletionExceptionCard({
  item,
  onResolve,
  resolving,
}: {
  item: TripCompletionExceptionWithTrip;
  onResolve: (item: TripCompletionExceptionWithTrip) => void;
  resolving: boolean;
}) {
  const resolved = !!item.resolvedAt;
  const routeName = item.trip?.route?.name ?? 'Route';
  const driverName = item.trip?.driver?.name ?? '—';
  const vehicleReg = item.trip?.vehicle?.regNumber ?? '—';
  return (
    <Card shadow="sm" style={[styles.card, { borderLeftColor: resolved ? colors.gray300 : colors.error }]}>
      <View style={styles.cardTop}>
        <Text style={styles.route} numberOfLines={1}>{routeName} · {item.trip?.direction ?? ''}</Text>
        <Badge label={resolved ? 'Resolved' : 'Open'} variant={resolved ? 'cancelled' : 'error'} size="sm" />
      </View>
      <Text style={styles.meta}>{driverName} · {vehicleReg}</Text>

      <View style={styles.flags}>
        <Text style={styles.flag}>🛑 Ended at stop {item.stoppedAtSeq} of {item.totalStops}</Text>
        <Text style={styles.flag}>🧒 {item.boarded}/{item.totalRiders} boarded</Text>
      </View>

      <Text style={styles.reasonLabel}>DRIVER'S REASON</Text>
      <Text style={styles.reason}>{item.reason}</Text>

      <Text style={styles.times}>Ended {new Date(item.completedAt).toLocaleString()}</Text>

      {resolved ? (
        <Text style={styles.resolvedNote}>
          Resolved {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ''}
        </Text>
      ) : (
        <Button title="Mark Resolved" onPress={() => onResolve(item)} loading={resolving} fullWidth style={styles.resolveBtn} />
      )}
    </Card>
  );
}

export default function TripStartAlarmsScreen() {
  const [filter, setFilter] = useState<FilterKey>('open');
  const { data, isLoading, isError } = useTripStartExceptions(filter === 'all' ? 'all' : undefined);
  const { data: overdue = [] } = useOverdueTrips();
  const { data: completionExceptions = [] } = useTripCompletionExceptions(filter === 'all' ? 'all' : undefined);
  const resolve = useResolveStartException();
  const resolveCompletion = useResolveCompletionException();
  const { gridColumns } = useResponsive();

  const onResolveCompletion = (item: TripCompletionExceptionWithTrip) => {
    Alert.alert('Resolve alarm', 'Mark this early-completion exception as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () =>
          resolveCompletion.mutate(item.id, {
            onError: (e: any) => Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to resolve'),
          }),
      },
    ]);
  };

  // "Never started" alarms (computed on read): SCHEDULED trips >12h overdue. Shown
  // as a section above the start-exception list so both alarm kinds share one panel.
  const overdueSection = overdue.length > 0 ? (
    <View style={styles.overdueSection}>
      <Text style={styles.sectionHeading}>Never started · {overdue.length}</Text>
      <Text style={styles.sectionSub}>Still scheduled more than 12h after departure. Tap to start or cancel.</Text>
      <View style={styles.overdueList}>
        {overdue.map((t) => <OverdueCard key={t.id} item={t} />)}
      </View>
    </View>
  ) : null;

  // Early-completion alarms: trips the driver ended before the final stop, with a reason.
  const completionSection = completionExceptions.length > 0 ? (
    <View style={styles.overdueSection}>
      <Text style={styles.sectionHeading}>Ended early · {completionExceptions.length}</Text>
      <Text style={styles.sectionSub}>Trips completed before the final stop. Review the driver's reason.</Text>
      <View style={styles.overdueList}>
        {completionExceptions.map((e) => (
          <CompletionExceptionCard
            key={e.id}
            item={e}
            onResolve={onResolveCompletion}
            resolving={resolveCompletion.isPending && resolveCompletion.variables === e.id}
          />
        ))}
      </View>
    </View>
  ) : null;

  // Both computed/early sections stack above the start-exception list in one panel.
  const headerSections = (
    <>
      {overdueSection}
      {completionSection}
    </>
  );

  const onResolve = (item: TripStartExceptionWithTrip) => {
    Alert.alert('Resolve alarm', 'Mark this trip-start exception as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () =>
          resolve.mutate(item.id, {
            onError: (e: any) => Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to resolve'),
          }),
      },
    ]);
  };

  return (
    <AdminScreen
      title="Trips"
      subtitle="Trip alarms"
      subnav={<SubNav segments={SUBNAV.trips} value="exceptions" />}
    >
      <View style={styles.root}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>

        {isError ? (
          <EmptyState title="Could not load alarms" description="Check your connection and try again." />
        ) : isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="35%" height={13} style={{ marginTop: 10 }} />
                <Skeleton width="90%" height={13} style={{ marginTop: 12 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={data ?? []}
            columns={gridColumns}
            keyExtractor={(e) => e.id}
            ListHeaderComponent={headerSections}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>✅</Text>}
                  title={filter === 'open' ? 'No off-protocol starts' : 'No start exceptions'}
                  description="Trips that start off-protocol will appear here."
                />
              </View>
            }
            renderItem={(item) => {
              const resolved = !!item.resolvedAt;
              const routeName = item.trip?.route?.name ?? 'Route';
              const driverName = item.trip?.driver?.name ?? '—';
              const vehicleReg = item.trip?.vehicle?.regNumber ?? '—';
              return (
                <Card shadow="sm" style={[styles.card, { borderLeftColor: resolved ? colors.gray300 : colors.error }]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.route} numberOfLines={1}>{routeName} · {item.trip?.direction ?? ''}</Text>
                    <Badge label={resolved ? 'Resolved' : 'Open'} variant={resolved ? 'cancelled' : 'error'} size="sm" />
                  </View>
                  <Text style={styles.meta}>{driverName} · {vehicleReg}</Text>

                  <View style={styles.flags}>
                    {!item.dailyCheckDone ? <Text style={styles.flag}>⚠️ No daily check</Text> : null}
                    <Text style={styles.flag}>⏱ {offsetLabel(item.deltaMinutes)}</Text>
                  </View>

                  <Text style={styles.reasonLabel}>DRIVER'S REASON</Text>
                  <Text style={styles.reason}>{item.reason}</Text>

                  <Text style={styles.times}>
                    Scheduled {new Date(item.scheduledStart).toLocaleString()} · Started {new Date(item.startedAt).toLocaleString()}
                  </Text>

                  {resolved ? (
                    <Text style={styles.resolvedNote}>
                      Resolved {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ''}
                    </Text>
                  ) : (
                    <Button
                      title="Mark Resolved"
                      onPress={() => onResolve(item)}
                      loading={resolve.isPending && resolve.variables === item.id}
                      fullWidth
                      style={styles.resolveBtn}
                    />
                  )}
                </Card>
              );
            }}
          />
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  overdueSection: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[2] },
  sectionHeading: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  sectionSub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  overdueList: { gap: spacing[3], marginTop: spacing[1] },

  card: { gap: spacing[1], borderLeftWidth: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  route: { flex: 1, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] },
  flag: { fontSize: fontSizes.xs, color: colors.warningDark, fontWeight: fontWeights.medium },
  reasonLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2], fontWeight: fontWeights.semibold },
  reason: { fontSize: fontSizes.sm, color: colors.textPrimary },
  times: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[1] },
  resolvedNote: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing[1], fontStyle: 'italic' },
  resolveBtn: { marginTop: spacing[2] },
});

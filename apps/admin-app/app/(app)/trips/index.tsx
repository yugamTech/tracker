import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useTripsByDate, useTripDates } from '@saarthi/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { MonthCalendar, ymdKey, startOfMonth, endOfMonth, addMonths, formatDayLabel } from '../../../components/Calendar';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

function tripStatus(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'COMPLETED': return { label: 'Completed', variant: 'success' };
    case 'ABORTED': return { label: 'Aborted', variant: 'error' };
    case 'IN_PROGRESS': case 'STARTED': return { label: 'In progress', variant: 'info' };
    case 'CANCELLED': return { label: 'Cancelled', variant: 'cancelled' };
    default: return { label: 'Scheduled', variant: 'warning' };
  }
}

function TripCard({ item }: { item: any }) {
  const routeName: string = item?.route?.name ?? item.routeId;
  const vehicleReg: string = item?.vehicle?.regNumber ?? item.vehicleId ?? '—';
  const driverName: string = item?.driver?.name ?? '—';
  const boarded: number = item?.boardedCount ?? 0;
  const total: number = item?.riderCount ?? (Array.isArray(item?.riders) ? item.riders.length : 0);
  const s = tripStatus(item.status);
  const time = item.scheduledStart ?? item.date;
  const timeLabel = time
    ? new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/fleet/${item.id}` as never)}>
      <Card shadow="sm" style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.route} numberOfLines={1}>{routeName}</Text>
          <Badge label={s.label} variant={s.variant} size="sm" />
        </View>
        <View style={styles.subRow}>
          <Text style={styles.direction}>{item.direction === 'PICKUP' ? 'Pickup' : 'Drop'}</Text>
          {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Driver</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{driverName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Bus</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{vehicleReg}</Text>
          </View>
          {total > 0 ? (
            <View style={styles.metaItemRight}>
              <Text style={styles.metaLabel}>Boarded</Text>
              <Text style={styles.boarding}>{boarded}/{total}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </AnimatedPressable>
  );
}

export default function TripScheduleScreen() {
  const { isDesktop } = useResponsive();

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = ymdKey(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);

  // Calendar spans the current month + the next one (the schedulable window).
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => addMonths(today, 1), [today]);
  const rangeFrom = ymdKey(minMonth);
  const rangeTo = ymdKey(endOfMonth(maxMonth));

  const { data: markedDates } = useTripDates(rangeFrom, rangeTo);
  const marked = useMemo(() => new Set(markedDates ?? []), [markedDates]);

  const { data: trips, isLoading, isError } = useTripsByDate(selectedKey);
  const dayTrips = trips ?? [];

  const selectedSet = useMemo(() => new Set([selectedKey]), [selectedKey]);

  const calendar = (
    <Card shadow="sm" style={styles.calCard}>
      <MonthCalendar
        selected={selectedSet}
        onSelectDay={setSelectedKey}
        marked={marked}
        minMonth={minMonth}
        maxMonth={maxMonth}
        todayKey={todayKey}
      />
      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>Has trips</Text>
      </View>
    </Card>
  );

  const dayHeader = (
    <View style={styles.dayHeader}>
      <Text style={styles.dayHeaderTitle}>
        {selectedKey === todayKey ? 'Today' : formatDayLabel(selectedKey)}
      </Text>
      <Text style={styles.dayHeaderCount}>
        {isLoading || isError ? '' : `${dayTrips.length} trip${dayTrips.length === 1 ? '' : 's'}`}
      </Text>
    </View>
  );

  const list = (
    <View style={styles.listWrap}>
      {dayHeader}
      {isError ? (
        <EmptyState title="Could not load trips" description="Check your connection and try again." />
      ) : isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" style={styles.skeletonCard}>
              <Skeleton width="60%" height={17} />
              <Skeleton width="40%" height={13} style={{ marginTop: 10 }} />
              <Skeleton width="30%" height={13} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : dayTrips.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Text style={{ fontSize: 40 }}>🗓️</Text>}
            title="No trips scheduled"
            description={selectedKey === todayKey
              ? 'Nothing is scheduled for today.'
              : `Nothing is scheduled for ${formatDayLabel(selectedKey)}.`}
          />
        </View>
      ) : (
        <View style={styles.cardList}>
          {dayTrips.map((t) => <TripCard key={t.id} item={t} />)}
        </View>
      )}
    </View>
  );

  return (
    <AdminScreen
      title="Trips"
      subnav={<SubNav segments={SUBNAV.trips} value="trips" />}
      headerRight={<HeaderAction label="+ Schedule" onPress={() => router.push('/(app)/trips/new' as never)} />}
    >
      {isDesktop ? (
        <View style={styles.splitRoot}>
          <View style={styles.calCol}>{calendar}</View>
          <ScrollView style={styles.listCol} contentContainerStyle={styles.listColContent} showsVerticalScrollIndicator={false}>
            {list}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.phoneContent} showsVerticalScrollIndicator={false}>
          {calendar}
          {list}
        </ScrollView>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  // Desktop split
  splitRoot: { flex: 1, flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  calCol: { width: 380 },
  listCol: { flex: 1 },
  listColContent: { paddingBottom: spacing[6] },

  // Phone stack
  phoneContent: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[6] },

  calCard: { gap: spacing[3] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
  legendDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.primary },
  legendText: { fontSize: fontSizes.xs, color: colors.textMuted, letterSpacing: letterSpacing.wide },

  listWrap: { gap: spacing[3] },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  dayHeaderTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  dayHeaderCount: { fontSize: fontSizes.sm, color: colors.textMuted },

  cardList: { gap: spacing[3] },
  skeletonWrap: { gap: spacing[3] },
  skeletonCard: {},
  emptyWrap: { minHeight: 280, justifyContent: 'center' },

  card: { gap: spacing[1] },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  route: { flex: 1, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary },
  time: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4], marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
  metaItem: { gap: 2 },
  metaItemRight: { gap: 2, marginLeft: 'auto', alignItems: 'flex-end' },
  metaLabel: { fontSize: fontSizes.xs, color: colors.textMuted, letterSpacing: letterSpacing.wide },
  metaValue: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  boarding: { fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
});

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useFilteredTrips, useTripDates, useRoutes, useMembers } from '@saarthi/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import {
  MonthCalendar, ymdKey, startOfMonth, endOfMonth, addMonths, addDaysKey, weekKeys,
  formatDayLabel, formatMonthLabel,
} from '../../../components/Calendar';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Quick status filter groups. Several map to multiple raw statuses (Live =
 * STARTED + IN_PROGRESS, Closed = CANCELLED + ABORTED), which the single-value
 * `?status=` query can't express — so grouping is applied client-side over the
 * day's (small) trip list. `statuses: null` = no status filter ("All").
 */
const STATUS_GROUPS = [
  { key: 'ALL', label: 'All', statuses: null },
  { key: 'SCHEDULED', label: 'Scheduled', statuses: ['SCHEDULED'] },
  { key: 'LIVE', label: 'Live', statuses: ['STARTED', 'IN_PROGRESS'] },
  { key: 'COMPLETED', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'CLOSED', label: 'Closed', statuses: ['CANCELLED', 'ABORTED'] },
] as const;

type StatusGroupKey = typeof STATUS_GROUPS[number]['key'];

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

/** Compact, always-visible week row — the collapsed calendar state. */
function WeekStrip({
  selectedKey, marked, onSelectDay, todayKey, minKey, maxKey,
}: {
  selectedKey: string;
  marked: Set<string>;
  onSelectDay: (key: string) => void;
  todayKey: string;
  minKey: string;
  maxKey: string;
}) {
  const days = useMemo(() => weekKeys(selectedKey), [selectedKey]);
  const canPrev = selectedKey > minKey;
  const canNext = selectedKey < maxKey;
  const shift = (delta: number) => {
    let next = addDaysKey(selectedKey, delta);
    if (next < minKey) next = minKey;
    if (next > maxKey) next = maxKey;
    onSelectDay(next);
  };

  return (
    <View style={styles.weekStrip}>
      <WeekArrow glyph="‹" disabled={!canPrev} onPress={() => shift(-7)} />
      <View style={styles.weekDays}>
        {days.map((k) => {
          const [yy, mm, d] = k.split('-').map(Number);
          const weekday = WEEKDAY_LETTERS[new Date(yy, mm - 1, d).getDay()];
          const selected = k === selectedKey;
          const isToday = k === todayKey;
          const isMarked = marked.has(k);
          const disabled = k < minKey || k > maxKey;
          return (
            <AnimatedPressable
              key={k}
              scaleTo={disabled ? 1 : 0.92}
              disabled={disabled}
              onPress={() => onSelectDay(k)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={[styles.weekCell, isToday && !selected && styles.weekCellToday, selected && styles.weekCellSelected]}
            >
              <Text style={[styles.weekDow, selected && styles.weekTextSelected]}>{weekday}</Text>
              <Text style={[styles.weekDate, disabled && styles.weekTextDisabled, selected && styles.weekTextSelected]}>{d}</Text>
              <View style={[styles.weekDot, isMarked && !selected && styles.weekDotVisible, isMarked && selected && styles.weekDotOnSelected]} />
            </AnimatedPressable>
          );
        })}
      </View>
      <WeekArrow glyph="›" disabled={!canNext} onPress={() => shift(7)} />
    </View>
  );
}

function WeekArrow({ glyph, disabled, onPress }: { glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      scaleTo={disabled ? 1 : 0.9}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.weekArrow, disabled && styles.weekArrowDisabled]}
    >
      <Text style={[styles.weekArrowGlyph, disabled && styles.weekArrowGlyphDisabled]}>{glyph}</Text>
    </AnimatedPressable>
  );
}

export default function TripScheduleScreen() {
  const { isDesktop } = useResponsive();

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = ymdKey(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);

  // Calendar collapsed by default on phone; the desktop split has a column for it.
  const [calOpen, setCalOpen] = useState(false);
  // The month the expanded calendar is showing — drives the trip-dot fetch range.
  const [visibleMonthKey, setVisibleMonthKey] = useState(() => ymdKey(startOfMonth(today)));

  // Quick status group (All / Scheduled / Live / Completed / Closed) — always
  // visible. Route + driver live in the collapsible panel below.
  const [statusGroup, setStatusGroup] = useState<StatusGroupKey>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [driverId, setDriverId] = useState('');

  // Viewing is unbounded — any past or future date is browsable. The week strip
  // navigates within a wide window; the month grid roams via its own picker.
  const viewMinKey = useMemo(() => ymdKey(addMonths(today, -12 * 5)), [today]);
  const viewMaxKey = useMemo(() => ymdKey(addMonths(today, 12 * 5)), [today]);

  // Trip dots are fetched for the month currently in view (expanded grid) or the
  // selected day's month (collapsed strip), padded a week each side for spill-over
  // rows — so dots follow navigation without fetching years of dates at once.
  const dotAnchor = useMemo(() => {
    const src = isDesktop || calOpen ? visibleMonthKey : selectedKey;
    const [y, m, d] = src.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [isDesktop, calOpen, visibleMonthKey, selectedKey]);
  const rangeFrom = useMemo(() => addDaysKey(ymdKey(startOfMonth(dotAnchor)), -7), [dotAnchor]);
  const rangeTo = useMemo(() => addDaysKey(ymdKey(endOfMonth(dotAnchor)), 7), [dotAnchor]);

  const { data: markedDates } = useTripDates(rangeFrom, rangeTo);
  const marked = useMemo(() => new Set(markedDates ?? []), [markedDates]);

  const { data: routes = [] } = useRoutes();
  const { data: drivers = [] } = useMembers('DRIVER');

  // Status grouping is applied client-side (groups can span several raw statuses);
  // route/driver/date stay server-side so the query only ever narrows the result.
  const { data: trips, isLoading, isError } = useFilteredTrips({
    date: selectedKey,
    route: routeId || undefined,
    driver: driverId || undefined,
  });
  const activeGroup = STATUS_GROUPS.find((g) => g.key === statusGroup) ?? STATUS_GROUPS[0];
  const dayTrips = useMemo(() => {
    const all = trips ?? [];
    if (!activeGroup.statuses) return all;
    const set = new Set<string>(activeGroup.statuses);
    return all.filter((t) => set.has(t.status));
  }, [trips, activeGroup]);

  const selectedSet = useMemo(() => new Set([selectedKey]), [selectedKey]);
  // Panel badge counts only the panel's own filters (route + driver); the status
  // group has its own always-visible chip row.
  const activeFilterCount = (routeId ? 1 : 0) + (driverId ? 1 : 0);
  const anyFilterActive = activeFilterCount > 0 || statusGroup !== 'ALL';
  const clearFilters = () => { setRouteId(''); setDriverId(''); };
  const resetAll = () => { setStatusGroup('ALL'); setRouteId(''); setDriverId(''); };

  // Always-visible quick status row — the primary status control.
  const statusQuickRow = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickRow}
    >
      {STATUS_GROUPS.map((g) => (
        <Chip
          key={g.key}
          label={g.label}
          selected={statusGroup === g.key}
          onPress={() => setStatusGroup(g.key)}
          size="sm"
        />
      ))}
    </ScrollView>
  );

  const filterPanel = showFilters ? (
    <Card shadow="sm" style={styles.filterCard}>
      <View style={styles.filterHead}>
        <Text style={styles.filterHeadTitle}>Filters</Text>
        {activeFilterCount > 0 ? (
          <AnimatedPressable scaleTo={0.94} onPress={clearFilters}>
            <Text style={styles.clearText}>Clear all</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <ChipFilterRow
        label="Route"
        options={['ALL', ...routes.map((r) => r.id)]}
        labelFor={(o) => (o === 'ALL' ? 'All' : routes.find((r) => r.id === o)?.name ?? o)}
        value={routeId}
        onChange={setRouteId}
      />
      <ChipFilterRow
        label="Driver"
        options={['ALL', ...drivers.map((m) => m.personId)]}
        labelFor={(o) => (o === 'ALL' ? 'All' : drivers.find((m) => m.personId === o)?.person.name ?? o)}
        value={driverId}
        onChange={setDriverId}
      />

      {/* Collapse without re-tapping the header "Filters" button. */}
      <Button title="Done" variant="secondary" onPress={() => setShowFilters(false)} fullWidth style={styles.filterDone} />
    </Card>
  ) : null;

  const calendarExpanded = isDesktop || calOpen;
  const calendar = (
    <Card shadow="sm" style={styles.calCard}>
      {/* On phone, a header carries the collapse toggle (plus the month label when
          collapsed — the week strip has none). Expanded, the month grid supplies
          its own tappable month/year header, so the left slot stays empty. */}
      {!isDesktop ? (
        <View style={styles.calHead}>
          {calOpen ? <View /> : <Text style={styles.calMonth}>{formatMonthLabel(selectedKey)}</Text>}
          <AnimatedPressable scaleTo={0.94} onPress={() => setCalOpen((o) => !o)} accessibilityRole="button">
            <Text style={styles.calToggle}>{calOpen ? 'Collapse ▴' : 'Month ▾'}</Text>
          </AnimatedPressable>
        </View>
      ) : null}

      {calendarExpanded ? (
        <MonthCalendar
          selected={selectedSet}
          onSelectDay={setSelectedKey}
          marked={marked}
          todayKey={todayKey}
          initialMonthKey={selectedKey}
          onVisibleMonthChange={setVisibleMonthKey}
        />
      ) : (
        <WeekStrip
          selectedKey={selectedKey}
          marked={marked}
          onSelectDay={setSelectedKey}
          todayKey={todayKey}
          minKey={viewMinKey}
          maxKey={viewMaxKey}
        />
      )}

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
        <EmptyState
          icon={<Text style={{ fontSize: 40 }}>⚠️</Text>}
          title="Could not load trips"
          description="Check your connection and try again."
        />
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
            title={anyFilterActive ? 'No trips match' : 'No trips scheduled'}
            description={anyFilterActive
              ? 'Try clearing or adjusting the filters.'
              : selectedKey === todayKey
                ? 'Nothing is scheduled for today.'
                : `Nothing is scheduled for ${formatDayLabel(selectedKey)}.`}
            action={anyFilterActive
              ? <Button title="Clear filters" variant="secondary" onPress={resetAll} />
              : <Button title="Schedule a trip" onPress={() => router.push('/(app)/trips/new' as never)} />}
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
      headerRight={
        <View style={styles.headerActions}>
          <HeaderAction
            // Collapsed: surface the active route/driver filter count. Expanded: plain.
            label={!showFilters && activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
            tone={activeFilterCount > 0 ? 'primary' : 'subtle'}
            onPress={() => setShowFilters((v) => !v)}
          />
          <HeaderAction label="+ Schedule" onPress={() => router.push('/(app)/trips/new' as never)} />
        </View>
      }
    >
      {isDesktop ? (
        <View style={styles.splitRoot}>
          <View style={styles.calCol}>
            {calendar}
            {filterPanel}
          </View>
          <ScrollView style={styles.listCol} contentContainerStyle={styles.listColContent} showsVerticalScrollIndicator={false}>
            {statusQuickRow}
            {list}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.phoneContent} showsVerticalScrollIndicator={false}>
          {calendar}
          {filterPanel}
          {statusQuickRow}
          {list}
        </ScrollView>
      )}
    </AdminScreen>
  );
}

/** A labelled, horizontally-scrolling row of filter chips. */
function ChipFilterRow({
  label, options, labelFor, value, onChange,
}: {
  label: string;
  options: string[];
  labelFor: (option: string) => string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((o) => {
          const val = o === 'ALL' ? '' : o;
          return (
            <Chip key={o} label={labelFor(o)} selected={value === val} onPress={() => onChange(val)} size="sm" />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop split
  splitRoot: { flex: 1, flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  calCol: { width: 380, gap: spacing[4] },
  listCol: { flex: 1 },
  listColContent: { paddingBottom: spacing[6] },

  // Phone stack
  phoneContent: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[6] },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },

  calCard: { gap: spacing[3] },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calMonth: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  calToggle: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
  legendDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.primary },
  legendText: { fontSize: fontSizes.xs, color: colors.textMuted, letterSpacing: letterSpacing.wide },

  // Week strip (collapsed calendar)
  weekStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  weekDays: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: spacing[1] },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.md, gap: 2 },
  weekCellToday: { borderWidth: 1, borderColor: colors.primary },
  weekCellSelected: { backgroundColor: colors.primary },
  weekDow: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.semibold },
  weekDate: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  weekTextDisabled: { color: colors.textMuted, opacity: 0.5 },
  weekTextSelected: { color: colors.textInverse },
  weekDot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: 'transparent' },
  weekDotVisible: { backgroundColor: colors.primary },
  weekDotOnSelected: { backgroundColor: colors.textInverse },
  weekArrow: {
    width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  weekArrowDisabled: { borderColor: colors.borderSubtle, backgroundColor: 'transparent' },
  weekArrowGlyph: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  weekArrowGlyphDisabled: { color: colors.textMuted },

  // Quick status row (always visible, above the day list)
  quickRow: { gap: spacing[2], paddingVertical: spacing[1] },

  // Filters
  filterCard: { gap: spacing[1] },
  filterDone: { marginTop: spacing[2] },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  filterHeadTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.textPrimary },
  clearText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.semibold },
  filterSection: { gap: spacing[1] },
  filterLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, letterSpacing: letterSpacing.wide, marginTop: spacing[2] },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },

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

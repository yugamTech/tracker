import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, Chip, Skeleton, EmptyState, AnimatedPressable, Stagger, Icon, IconSplat,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useFilteredTrips, useTripDates, useRoutes, useMembers } from '@yaanam/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import {
  MonthCalendar, ymdKey, startOfMonth, endOfMonth, addMonths, addDaysKey, weekKeys,
  formatDayLabel, formatMonthLabel,
} from '../../../components/Calendar';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';
import { ActionButton } from '../../../components/forms';

const HUE = colors.trip;
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
      <Card shadow="sm" radius={18} style={styles.card}>
        <View style={styles.cardTop}>
          <IconSplat shape="b2" splatColor={colors.tripBg} spot="trip" size={32} />
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

  const [calOpen, setCalOpen] = useState(false);
  const [visibleMonthKey, setVisibleMonthKey] = useState(() => ymdKey(startOfMonth(today)));

  const [statusGroup, setStatusGroup] = useState<StatusGroupKey>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [driverId, setDriverId] = useState('');

  const viewMinKey = useMemo(() => ymdKey(addMonths(today, -12 * 5)), [today]);
  const viewMaxKey = useMemo(() => ymdKey(addMonths(today, 12 * 5)), [today]);

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
  const activeFilterCount = (routeId ? 1 : 0) + (driverId ? 1 : 0);
  const anyFilterActive = activeFilterCount > 0 || statusGroup !== 'ALL';
  const clearFilters = () => { setRouteId(''); setDriverId(''); };
  const resetAll = () => { setStatusGroup('ALL'); setRouteId(''); setDriverId(''); };

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
    <Card shadow="sm" radius={18} style={styles.filterCard}>
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

      <ActionButton title="Done" tone="outline" hue={HUE} onPress={() => setShowFilters(false)} fullWidth style={styles.filterDone} />
    </Card>
  ) : null;

  const calendarExpanded = isDesktop || calOpen;
  const calendar = (
    <Card shadow="sm" radius={18} style={styles.calCard}>
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
          icon={<View style={styles.errorIcon}><Icon name="alert" size={36} color={colors.crit} /></View>}
          title="Could not load trips"
          description="Check your connection and try again."
        />
      ) : isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" radius={18} style={styles.skeletonCard}>
              <Skeleton width="60%" height={17} />
              <Skeleton width="40%" height={13} style={{ marginTop: 10 }} />
              <Skeleton width="30%" height={13} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : dayTrips.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<IconSplat shape="b3" splatColor={colors.tripBg} spot="trip" size={64} />}
            title={anyFilterActive ? 'No trips match' : 'No trips scheduled'}
            description={anyFilterActive
              ? 'Try clearing or adjusting the filters.'
              : selectedKey === todayKey
                ? 'Nothing is scheduled for today.'
                : `Nothing is scheduled for ${formatDayLabel(selectedKey)}.`}
            action={anyFilterActive
              ? <ActionButton title="Clear filters" tone="outline" hue={HUE} onPress={resetAll} />
              : <ActionButton title="Schedule a trip" hue={HUE} onPress={() => router.push('/(app)/trips/new' as never)} />}
          />
        </View>
      ) : (
        <View style={styles.cardList}>
          <Stagger>
            {dayTrips.map((t) => <TripCard key={t.id} item={t} />)}
          </Stagger>
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
  splitRoot: { flex: 1, flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  calCol: { width: 380, gap: spacing[4] },
  listCol: { flex: 1 },
  listColContent: { paddingBottom: spacing[6] },

  phoneContent: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[6] },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },

  calCard: { gap: spacing[3] },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calMonth: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink, letterSpacing: -0.3 },
  calToggle: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: HUE },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  legendDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: HUE },
  legendText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },

  weekStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  weekDays: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: spacing[1] },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: 10, gap: 2 },
  weekCellToday: { borderWidth: 1, borderColor: HUE },
  weekCellSelected: { backgroundColor: HUE },
  weekDow: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, fontWeight: fontWeights.semibold },
  weekDate: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.ink },
  weekTextDisabled: { color: colors.ink3, opacity: 0.5 },
  weekTextSelected: { color: colors.white },
  weekDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: 'transparent' },
  weekDotVisible: { backgroundColor: HUE },
  weekDotOnSelected: { backgroundColor: colors.white },
  weekArrow: {
    width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.ground,
  },
  weekArrowDisabled: { borderColor: colors.hairline, backgroundColor: 'transparent' },
  weekArrowGlyph: { fontFamily: fontFamilies.display, fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.ink },
  weekArrowGlyphDisabled: { color: colors.ink3 },

  quickRow: { gap: spacing[2], paddingVertical: spacing[1] },

  filterCard: { gap: spacing[1] },
  filterDone: { marginTop: spacing[2] },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  filterHeadTitle: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  clearText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.crit, fontWeight: fontWeights.semibold },
  filterSection: { gap: spacing[1] },
  filterLabel: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink3, letterSpacing: 0.7, marginTop: spacing[2] },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },

  listWrap: { gap: spacing[3] },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  dayHeaderTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  dayHeaderCount: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink3 },

  cardList: { gap: spacing[3] },
  skeletonWrap: { gap: spacing[3] },
  skeletonCard: {},
  emptyWrap: { minHeight: 280, justifyContent: 'center' },
  errorIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.critBg, alignItems: 'center', justifyContent: 'center' },

  card: { gap: spacing[1] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  route: { flex: 1, fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink, letterSpacing: -0.3 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  direction: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },
  time: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4], marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  metaItem: { gap: 2 },
  metaItemRight: { gap: 2, marginLeft: 'auto', alignItems: 'flex-end' },
  metaLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, letterSpacing: 0.5 },
  metaValue: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.ink },
  boarding: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Chip, Skeleton, EmptyState, AnimatedPressable, Sheet, Button,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useAllComplaints, useRoutes, useMembers } from '@yaanam/api-client';
import type { ComplaintFilters } from '@yaanam/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { GridList } from '../../../components/widgets';
import { MonthCalendar, ymdKey, addDaysKey, formatDayLabel } from '../../../components/Calendar';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const STATUS_V: Record<string, BadgeVariant> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success',
  PARENT_RATING: 'success', REOPENED: 'error', CLOSED: 'default',
};
const STATUS_OPTIONS = ['ALL', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED'];
const CATEGORY_OPTIONS = ['ALL', 'TIMING', 'BEHAVIOUR', 'SAFETY', 'VEHICLE', 'ROUTE', 'OTHER'];

export default function AdminComplaintsScreen() {
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [routeId, setRouteId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { gridColumns } = useResponsive();

  const filters: ComplaintFilters = {
    ...(status && { status }),
    ...(category && { category }),
    ...(routeId && { routeId }),
    ...(driverId && { driverId }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };

  const { data: complaints = [], isLoading } = useAllComplaints(filters);
  const { data: routes = [] } = useRoutes();
  const { data: drivers = [] } = useMembers('DRIVER');

  const activeFilterCount = [status, category, routeId, driverId, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => {
    setStatus(''); setCategory(''); setRouteId(''); setDriverId(''); setDateFrom(''); setDateTo('');
  };

  return (
    <AdminScreen
      title="Complaints"
      subtitle={isLoading ? undefined : `${complaints.length} complaint${complaints.length === 1 ? '' : 's'}`}
      subnav={<SubNav segments={SUBNAV.complaints} value="complaints" />}
      headerRight={
        <HeaderAction
          label={activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
          tone={activeFilterCount > 0 ? 'primary' : 'subtle'}
          onPress={() => setShowFilters((v) => !v)}
        />
      }
    >
      <View style={styles.root}>
        {showFilters ? (
          <View style={styles.filterWrap}>
            <Card shadow="sm" style={styles.filterCard}>
              <View style={styles.filterHead}>
                <Text style={styles.filterHeadTitle}>Filters</Text>
                {activeFilterCount > 0 ? (
                  <AnimatedPressable scaleTo={0.94} onPress={clearFilters}>
                    <Text style={styles.clearText}>Clear all</Text>
                  </AnimatedPressable>
                ) : null}
              </View>

              <ChipFilter label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} pretty />
              <ChipFilter label="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
              <ChipFilter
                label="Route"
                options={['ALL', ...(routes as any[]).map((r) => r.id)]}
                labels={{ ALL: 'All', ...Object.fromEntries((routes as any[]).map((r) => [r.id, r.name])) }}
                value={routeId}
                onChange={setRouteId}
              />
              <ChipFilter
                label="Driver"
                options={['ALL', ...(drivers as any[]).map((d) => d.personId ?? d.id)]}
                labels={{ ALL: 'All', ...Object.fromEntries((drivers as any[]).map((d) => [d.personId ?? d.id, d.person?.name ?? d.name ?? 'Driver'])) }}
                value={driverId}
                onChange={setDriverId}
              />

              <Text style={styles.filterLabel}>DATE RANGE</Text>
              <DateRangeFilter
                from={dateFrom}
                to={dateTo}
                onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
              />
            </Card>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="45%" height={15} />
                <Skeleton width="100%" height={13} style={{ marginTop: 12 }} />
                <Skeleton width="70%" height={13} style={{ marginTop: 6 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={complaints}
            columns={gridColumns}
            keyExtractor={(c) => c.id}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>💬</Text>}
                  title="No complaints match"
                  description={activeFilterCount > 0 ? 'Try clearing or adjusting your filters.' : 'New complaints from parents will appear here.'}
                />
              </View>
            }
            renderItem={(item) => {
              const trip = (item as any).trip;
              const route = trip?.route;
              return (
                <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/complaints/${item.id}` as never)}>
                  <Card shadow="sm" style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
                      <Badge label={item.status.replace('_', ' ')} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
                    </View>
                    <Text style={styles.desc} numberOfLines={2}>{item.description ?? '—'}</Text>
                    {(item as any).raiser?.name ? (
                      <Text style={styles.raiser} numberOfLines={1}>🙋 Raised by {(item as any).raiser.name}</Text>
                    ) : null}
                    {route ? (
                      <Text style={styles.routeTag} numberOfLines={1}>🛣️ {route.name} · {trip.direction === 'PICKUP' ? 'Pickup' : 'Drop'}</Text>
                    ) : null}
                    <View style={styles.footer}>
                      <Text style={styles.student} numberOfLines={1}>
                        {(item as any).student?.name ? `👤 ${(item as any).student.name}` : ' '}
                      </Text>
                      <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </Card>
                </AnimatedPressable>
              );
            }}
          />
        )}
      </View>
    </AdminScreen>
  );
}

function ChipFilter({
  label, options, labels, value, onChange, pretty,
}: {
  label: string;
  options: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
  pretty?: boolean;
}) {
  const display = (o: string) =>
    labels?.[o] ?? (pretty ? o.replace('_', ' ') : o.charAt(0) + o.slice(1).toLowerCase());
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((o) => {
          const val = o === 'ALL' ? '' : o;
          return (
            <Chip key={o} label={display(o)} selected={value === val} onPress={() => onChange(val)} size="sm" />
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Date-range filter backed by the shared MonthCalendar — only real calendar days
 * can be picked, so the queue can never be filtered by a malformed string. Tap to
 * set the start, tap again to set the end (an earlier second tap re-anchors the
 * start); "Clear" resets to no range. Emits `YYYY-MM-DD` keys (or '') upward.
 */
function DateRangeFilter({
  from, to, onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const todayKey = ymdKey(new Date());

  // Highlight every day in [from, to] (inclusive). String compare is safe on
  // zero-padded YYYY-MM-DD keys, so no Date math is needed.
  const selected = new Set<string>();
  if (from) {
    if (to) {
      let k = from;
      while (k <= to) { selected.add(k); k = addDaysKey(k, 1); }
    } else {
      selected.add(from);
    }
  }

  const handleSelectDay = (key: string) => {
    // No start, or a complete range already → begin a fresh range.
    if (!from || (from && to)) { onChange(key, ''); return; }
    // Start set, end open: extend forward, or re-anchor if the tap is earlier.
    if (key >= from) onChange(from, key);
    else onChange(key, '');
  };

  const label = from
    ? to && to !== from
      ? `${formatDayLabel(from)} → ${formatDayLabel(to)}`
      : formatDayLabel(from)
    : 'Any dates';

  return (
    <>
      <AnimatedPressable scaleTo={0.98} onPress={() => setOpen(true)} style={styles.dateField}>
        <Text style={[styles.dateFieldText, !from && styles.dateFieldPlaceholder]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.dateFieldIcon}>📅</Text>
      </AnimatedPressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Filter by date">
        <MonthCalendar
          selected={selected}
          onSelectDay={handleSelectDay}
          todayKey={todayKey}
        />
        <Text style={styles.dateHint}>
          {from && !to ? 'Tap another day to set the end of the range.' : 'Tap a day to start a range.'}
        </Text>
        <View style={styles.dateActions}>
          <View style={styles.dateActionBtn}>
            <Button
              title="Clear"
              variant="secondary"
              onPress={() => { onChange('', ''); }}
              disabled={!from && !to}
              fullWidth
            />
          </View>
          <View style={styles.dateActionBtn}>
            <Button title="Done" onPress={() => setOpen(false)} fullWidth />
          </View>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterWrap: { padding: spacing[4], paddingBottom: 0 },
  filterCard: { gap: spacing[1] },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  filterHeadTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.textPrimary },
  clearText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.semibold },
  filterSection: { gap: spacing[1] },
  filterLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, letterSpacing: letterSpacing.wide, marginTop: spacing[2] },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },
  dateField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2],
    marginTop: spacing[1], backgroundColor: colors.backgroundMuted, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  dateFieldText: { flex: 1, fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  dateFieldPlaceholder: { color: colors.textMuted, fontWeight: fontWeights.normal },
  dateFieldIcon: { fontSize: fontSizes.base },
  dateHint: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2], textAlign: 'center' },
  dateActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  dateActionBtn: { flex: 1 },

  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 300, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[2] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  category: { flex: 1, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  raiser: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: fontWeights.medium },
  routeTag: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.medium },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[1] },
  student: { flex: 1, fontSize: fontSizes.xs, color: colors.textMuted },
  date: { fontSize: fontSizes.xs, color: colors.textMuted },
});

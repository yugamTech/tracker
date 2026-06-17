import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Chip, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useAllComplaints, useRoutes, useMembers } from '@saarthi/api-client';
import type { ComplaintFilters } from '@saarthi/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const STATUS_V: Record<string, BadgeVariant> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'default',
};
const STATUS_OPTIONS = ['ALL', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
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

              <Text style={styles.filterLabel}>DATE RANGE (YYYY-MM-DD)</Text>
              <View style={styles.dateRow}>
                <TextInput style={styles.dateInput} value={dateFrom} onChangeText={setDateFrom} placeholder="From" placeholderTextColor={colors.textMuted} />
                <Text style={{ color: colors.textMuted }}>–</Text>
                <TextInput style={styles.dateInput} value={dateTo} onChangeText={setDateTo} placeholder="To" placeholderTextColor={colors.textMuted} />
              </View>
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  dateInput: {
    flex: 1, backgroundColor: colors.backgroundMuted, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontSize: fontSizes.sm, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },

  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 300, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[2] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  category: { flex: 1, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  routeTag: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.medium },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[1] },
  student: { flex: 1, fontSize: fontSizes.xs, color: colors.textMuted },
  date: { fontSize: fontSizes.xs, color: colors.textMuted },
});

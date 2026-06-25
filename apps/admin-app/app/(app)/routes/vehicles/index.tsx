import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable,
} from '@yaanam/ui';
import { useVehicles } from '@yaanam/api-client';
import { AdminScreen, HeaderAction } from '../../../../components/AdminScreen';
import { SubNav } from '../../../../components/SubNav';
import { GridList } from '../../../../components/widgets';
import { useResponsive } from '../../../../hooks/useResponsive';
import { SUBNAV } from '../../../../lib/nav';

/** Status filter chips — `''` = all (deactivated vehicles set status INACTIVE). */
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
] as const;

const STATUS_VARIANT: Record<string, 'active' | 'inactive' | 'warning'> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'warning',
};

/**
 * Fleet list — every bus/van with its seat capacity. Tap a vehicle to edit it
 * (or set/change its capacity), or add a new one. A vehicle's capacity is what
 * drives per-route seat enforcement, so this is where the fleet is defined.
 */
export default function VehiclesScreen() {
  const { data: vehicles, isLoading } = useVehicles();
  const { gridColumns } = useResponsive();
  const [statusFilter, setStatusFilter] = useState('');
  const list = (vehicles ?? []).filter((v) => !statusFilter || v.status === statusFilter);

  return (
    <AdminScreen
      title="Routes"
      subtitle={isLoading ? undefined : `${list.length} vehicle${list.length === 1 ? '' : 's'}`}
      headerRight={<HeaderAction label="+ Add Bus" onPress={() => router.push('/(app)/routes/vehicle/new' as never)} />}
      subnav={<SubNav segments={SUBNAV.routes} value="vehicles" />}
    >
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" style={styles.skeletonCard}>
              <Skeleton width="50%" height={18} />
              <Skeleton width="100%" height={40} style={{ marginTop: 16 }} />
            </Card>
          ))}
        </View>
      ) : (
        <View style={styles.root}>
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((f) => (
              <Chip
                key={f.label}
                label={f.label}
                selected={statusFilter === f.value}
                onPress={() => setStatusFilter(f.value)}
                size="sm"
              />
            ))}
          </View>
          <GridList
            data={list}
            columns={gridColumns}
            keyExtractor={(v) => v.id}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>🚍</Text>}
                  title={statusFilter ? 'No vehicles match' : 'No vehicles yet'}
                  description={statusFilter
                    ? 'Try a different status filter.'
                    : 'Add your buses and vans here. A vehicle’s seat capacity is what limits how many students a route can carry.'}
                  action={statusFilter
                    ? <Button title="Show all" variant="secondary" onPress={() => setStatusFilter('')} />
                    : <Button title="Add Bus" onPress={() => router.push('/(app)/routes/vehicle/new' as never)} />}
                />
              </View>
            }
            renderItem={(item) => (
              <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/routes/vehicle/${item.id}` as never)}>
                <Card shadow="sm" style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.regNumber} numberOfLines={1}>{item.regNumber}</Text>
                    <Badge label={item.status} variant={STATUS_VARIANT[item.status] ?? 'inactive'} size="sm" />
                  </View>
                  <View style={styles.metrics}>
                    <Metric value={item.capacity} label="Seats" />
                    <View style={styles.metricDivider} />
                    <Metric value={item.type ?? 'BUS'} label="Type" small />
                    <View style={styles.metricDivider} />
                    <Metric value={item.assignments?.length ?? 0} label="Crew" />
                  </View>
                </Card>
              </AnimatedPressable>
            )}
          />
        </View>
      )}
    </AdminScreen>
  );
}

function Metric({ value, label, small }: { value: string | number; label: string; small?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, small && styles.metricValueSmall]} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[3] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  regNumber: { flex: 1, fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  metrics: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundMuted, borderRadius: radius.lg,
    paddingVertical: spacing[3],
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: spacing[1] },
  metricValue: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.primary },
  metricValueSmall: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.textPrimary },
  metricLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
});

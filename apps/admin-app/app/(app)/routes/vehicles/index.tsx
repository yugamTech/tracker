import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable, IconSplat,
} from '@yaanam/ui';
import { useVehicles } from '@yaanam/api-client';
import { AdminScreen } from '../../../../components/AdminScreen';
import { SubNav } from '../../../../components/SubNav';
import { GridList } from '../../../../components/widgets';
import { AddButton } from '../../../../components/forms';
import { useResponsive } from '../../../../hooks/useResponsive';
import { SUBNAV } from '../../../../lib/nav';

const HUE = colors.route;

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
      headerRight={<AddButton label="Add bus" hue={HUE} onPress={() => router.push('/(app)/routes/vehicle/new' as never)} />}
      subnav={<SubNav segments={SUBNAV.routes} value="vehicles" />}
    >
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" radius={22} style={styles.skeletonCard}>
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
                  icon={<IconSplat shape="b2" splatColor={colors.fleetBg} spot="bus" size={64} />}
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
                <Card shadow="sm" radius={22} style={styles.card}>
                  <View style={styles.cardTop}>
                    <IconSplat shape="b2" splatColor={colors.fleetBg} spot="bus" size={42} />
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] + 2 },
  regNumber: { flex: 1, fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  metrics: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.ground, borderRadius: 16,
    paddingVertical: spacing[3],
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.hairline, marginVertical: spacing[1] },
  metricValue: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: HUE },
  metricValueSmall: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.ink },
  metricLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink2 },
});

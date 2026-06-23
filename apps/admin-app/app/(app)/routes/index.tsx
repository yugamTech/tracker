import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable,
} from '@yaanam/ui';
import { useRoutes } from '@yaanam/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';

/** Status filter chips — `''` = all (deactivated routes set status INACTIVE). */
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

export default function RoutesScreen() {
  const { data: routes, isLoading } = useRoutes();
  const { gridColumns } = useResponsive();
  const [statusFilter, setStatusFilter] = useState('');
  const list = (routes ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <AdminScreen
      title="Routes"
      subtitle={isLoading ? undefined : `${list.length} route${list.length === 1 ? '' : 's'}`}
      headerRight={<HeaderAction label="+ Add Route" onPress={() => router.push('/(app)/routes/new' as never)} />}
    >
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" style={styles.skeletonCard}>
              <Skeleton width="50%" height={18} />
              <Skeleton width="100%" height={48} style={{ marginTop: 16 }} />
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
            keyExtractor={(r) => r.id}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>🗺️</Text>}
                  title={statusFilter ? 'No routes match' : 'No routes configured'}
                  description={statusFilter ? 'Try a different status filter.' : 'Create your first route to start scheduling trips.'}
                  action={statusFilter
                    ? <Button title="Show all" variant="secondary" onPress={() => setStatusFilter('')} />
                    : <Button title="Add Route" onPress={() => router.push('/(app)/routes/new' as never)} />}
                />
              </View>
            }
            renderItem={(item) => {
              const noStops = (item.stops?.length ?? 0) === 0;
              const noRiders = (item.eligibleRiderCount ?? 0) === 0;
              return (
                <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/routes/${item.id}` as never)}>
                  <Card shadow="sm" style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
                      <Badge label={item.status} variant={item.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
                    </View>
                    <View style={styles.metrics}>
                      <Metric value={item.stops?.length ?? 0} label="Stops" />
                      <View style={styles.metricDivider} />
                      <Metric value={item.eligibleRiderCount ?? 0} label="Riders" />
                      <View style={styles.metricDivider} />
                      <Metric value={item.direction} label="Direction" small />
                    </View>
                    {item.stops?.length > 0 ? (
                      <Text style={styles.stops} numberOfLines={2}>
                        📍 {item.stops.map((rs: any) => rs.stop.name).join('  →  ')}
                      </Text>
                    ) : null}
                    {/* Empty-route guard: a route with no stops or no stop-pinned active
                        riders can't be scheduled — flag it so the admin can fix it. */}
                    {noStops || noRiders ? (
                      <View style={styles.warnRow}>
                        <Text style={styles.warnText}>
                          {noStops
                            ? '⚠ No stops — add stops before scheduling'
                            : '⚠ No riders — assign students to a stop on this route'}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                </AnimatedPressable>
              );
            }}
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
  filterRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[3] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  routeName: { flex: 1, fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
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
  stops: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  warnRow: {
    backgroundColor: colors.warningBg, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  warnText: { fontSize: fontSizes.xs, color: colors.warningDark, fontWeight: fontWeights.semibold },
});

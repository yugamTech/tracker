import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable, IconSplat, Icon,
} from '@yaanam/ui';
import { useRoutes } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { GridList } from '../../../components/widgets';
import { AddButton } from '../../../components/forms';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const HUE = colors.route;

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
      headerRight={<AddButton label="Add route" hue={HUE} onPress={() => router.push('/(app)/routes/new' as never)} />}
      subnav={<SubNav segments={SUBNAV.routes} value="routes" />}
    >
      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm" radius={22} style={styles.skeletonCard}>
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
                  icon={<IconSplat shape="b2" splatColor={colors.routeBg} spot="route" size={64} />}
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
              const seatsUsed = item.seatsUsed ?? 0;
              const capacityFull = item.capacity != null && seatsUsed >= item.capacity;
              return (
                <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/routes/${item.id}` as never)}>
                  <Card shadow="sm" radius={22} style={styles.card}>
                    <View style={styles.cardTop}>
                      <IconSplat shape="b2" splatColor={colors.routeBg} spot="route" size={42} />
                      <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
                      <Badge label={item.status} variant={item.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
                    </View>
                    <View style={styles.metrics}>
                      <Metric value={item.stops?.length ?? 0} label="Stops" />
                      <View style={styles.metricDivider} />
                      <Metric value={item.eligibleRiderCount ?? 0} label="Riders" />
                    </View>
                    {item.stops?.length > 0 ? (
                      <View style={styles.line}>
                        <Icon name="pin" size={14} color={HUE} />
                        <Text style={styles.lineText} numberOfLines={2}>
                          {item.stops.map((rs: any) => rs.stop.name).join('  →  ')}
                        </Text>
                      </View>
                    ) : null}
                    {/* Seat capacity: assigned active students vs the designated bus. */}
                    <View style={styles.line}>
                      <Icon name="bus" size={14} color={capacityFull ? colors.warningDark : colors.ink3} />
                      <Text style={[styles.seatLine, capacityFull && styles.seatLineFull]} numberOfLines={1}>
                        {item.vehicle
                          ? `${item.vehicle.regNumber} · ${seatsUsed}/${item.capacity} seats${capacityFull ? ' · FULL' : ''}`
                          : `No bus assigned · ${seatsUsed} assigned`}
                      </Text>
                    </View>
                    {/* Empty-route guard: a route with no stops or no stop-pinned active
                        riders can't be scheduled — flag it so the admin can fix it. */}
                    {noStops || noRiders ? (
                      <View style={styles.warnRow}>
                        <Icon name="alert" size={14} color={colors.warningDark} />
                        <Text style={styles.warnText}>
                          {noStops
                            ? 'No stops — add stops before scheduling'
                            : 'No riders — assign students to a stop on this route'}
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] + 2 },
  routeName: { flex: 1, fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
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
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lineText: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 20 },
  seatLine: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },
  seatLineFull: { color: colors.warningDark, fontWeight: fontWeights.bold },
  warnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.warnBg, borderRadius: 13,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  warnText: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: '#92400E', fontWeight: fontWeights.semibold },
});

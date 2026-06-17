import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useTodayTrips } from '@saarthi/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { SearchField } from '../../../components/SearchField';
import { GridList } from '../../../components/widgets';
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

export default function TripHistoryScreen() {
  const [search, setSearch] = useState('');
  const { data: trips, isLoading, isError } = useTodayTrips();
  const { gridColumns } = useResponsive();

  const filtered = (trips ?? []).filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const routeName: string = (t as any)?.route?.name ?? t.routeId;
    const vehicleReg: string = (t as any)?.vehicle?.regNumber ?? t.vehicleId ?? '';
    const driverName: string = (t as any)?.driver?.name ?? '';
    return (
      routeName.toLowerCase().includes(q) ||
      vehicleReg.toLowerCase().includes(q) ||
      driverName.toLowerCase().includes(q)
    );
  });

  return (
    <AdminScreen
      title="Trips"
      subtitle={!isLoading && !isError ? `${filtered.length} today` : undefined}
      subnav={<SubNav segments={SUBNAV.trips} value="trips" />}
      headerRight={<HeaderAction label="+ Schedule" onPress={() => router.push('/(app)/trips/new' as never)} />}
    >
      <View style={styles.root}>
        <View style={styles.searchRow}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search route, driver, or bus…" />
        </View>

        {isError ? (
          <EmptyState title="Could not load trips" description="Check your connection and try again." />
        ) : isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="60%" height={17} />
                <Skeleton width="40%" height={13} style={{ marginTop: 10 }} />
                <Skeleton width="30%" height={13} style={{ marginTop: 8 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={filtered}
            columns={gridColumns}
            keyExtractor={(t) => t.id}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>🗓️</Text>}
                  title={search ? 'No trips match' : 'No trips today'}
                  description={search ? 'Try a different search term.' : 'No trips are scheduled for today.'}
                />
              </View>
            }
            renderItem={(item) => {
              const t = item as any;
              const routeName: string = t?.route?.name ?? item.routeId;
              const vehicleReg: string = t?.vehicle?.regNumber ?? item.vehicleId ?? '—';
              const driverName: string = t?.driver?.name ?? '—';
              const boarded: number = t?.boardedCount ?? 0;
              const total: number = t?.riderCount ?? 0;
              const s = tripStatus(item.status);
              return (
                <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/fleet/${item.id}` as never)}>
                  <Card shadow="sm" style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.route} numberOfLines={1}>{routeName}</Text>
                      <Badge label={s.label} variant={s.variant} size="sm" />
                    </View>
                    <Text style={styles.direction}>{item.direction === 'PICKUP' ? 'Pickup' : 'Drop'}</Text>
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
            }}
          />
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 300, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[1] },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  route: { flex: 1, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4], marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
  metaItem: { gap: 2 },
  metaItemRight: { gap: 2, marginLeft: 'auto', alignItems: 'flex-end' },
  metaLabel: { fontSize: fontSizes.xs, color: colors.textMuted, letterSpacing: letterSpacing.wide },
  metaValue: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  boarding: { fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
});

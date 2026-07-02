import React from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing,
  AppHeader, Card, Badge, Skeleton, EmptyState, AnimatedPressable, SlideIn,
} from '@yaanam/ui';
import { useTodayTrips, useMyStudents, tripStatusLabel, tripLabelVariant } from '@yaanam/api-client';
import type { BadgeVariant } from '@yaanam/ui';

export default function TripsScreen() {
  const { data: trips, isLoading, isError, refetch, isRefetching } = useTodayTrips();
  const { data: students } = useMyStudents();
  const count = trips?.length ?? 0;
  const myIds = new Set((students ?? []).map((s) => s.id));
  const nameById = new Map((students ?? []).map((s) => [s.id, s.name] as const));
  const firstName = (id: string) => (nameById.get(id) ?? 'Your child').split(' ')[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Trips" subtitle={!isLoading && !isError ? `${count} today` : undefined} />

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm">
              <Skeleton width="55%" height={18} />
              <Skeleton width="30%" height={13} style={{ marginTop: spacing[2] }} />
            </Card>
          ))}
        </View>
      ) : isError ? (
        <EmptyState title="Could not load trips" description="Check your connection and try again" />
      ) : (
        <FlatList
          data={trips ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<Text style={{ fontSize: 40 }}>🚌</Text>}
                title="No trips today"
                description="No trips are scheduled for today"
              />
            </View>
          }
          renderItem={({ item, index }) => {
            const trip = item as any;
            const routeName = trip?.route?.name ?? item.routeId;
            const completed = item.status === 'COMPLETED';
            const myRiders = (trip?.riders ?? []).filter((r: any) => myIds.has(r.studentId));
            // Per-child status via the CORE helper — a pure function of trip.status
            // AND boardStatus, so a completed trip reads terminal (never "On the bus").
            const childLabels: { id: string; name: string; label: string; variant: BadgeVariant }[] = myRiders.map((r: any) => {
              const l = tripStatusLabel({
                direction: item.direction,
                status: item.status,
                boardStatus: r.boardStatus,
                scheduledStart: trip.scheduledStart,
                completedAt: trip.completedAt,
                stopName: r.stop?.name ?? null,
              });
              return { id: r.studentId, name: firstName(r.studentId), label: l.label, variant: tripLabelVariant(l.state) as BadgeVariant };
            });
            // Fall back to a pure trip-status label if the family has no rider mapped.
            const fallback = tripStatusLabel({ direction: item.direction, status: item.status, scheduledStart: trip.scheduledStart, completedAt: trip.completedAt });
            const rows = childLabels.length ? childLabels : [{ id: item.id, name: '', label: fallback.label, variant: tripLabelVariant(fallback.state) as BadgeVariant }];
            return (
              <SlideIn delay={Math.min(index, 8) * 45}>
              <AnimatedPressable
                onPress={() => router.push(`/(app)/trips/${item.id}` as never)}
                scaleTo={0.985}
              >
                <Card shadow="sm">
                  <View style={styles.cardRow}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.route} numberOfLines={1}>{routeName}</Text>
                      <Text style={styles.direction}>
                        {item.direction === 'PICKUP' ? 'Pickup' : 'Drop'}
                      </Text>
                    </View>
                    <View style={styles.badgeCol}>
                      {rows.map((c) => (
                        <View key={c.id} style={styles.badgeRow}>
                          {rows.length > 1 && c.name ? <Text style={styles.childName}>{c.name}</Text> : null}
                          <Badge label={c.label} variant={c.variant} size="sm" />
                        </View>
                      ))}
                    </View>
                  </View>

                  {completed && (
                    <AnimatedPressable
                      onPress={() => router.push(`/(app)/ratings/ride?tripId=${item.id}` as never)}
                      scaleTo={0.94}
                      style={styles.rateBtn}
                    >
                      <Text style={styles.rateBtnText}>★  Rate this ride</Text>
                    </AnimatedPressable>
                  )}
                </Card>
              </AnimatedPressable>
              </SlideIn>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] },
  cardInfo: { flex: 1 },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  badgeCol: { alignItems: 'flex-end', gap: spacing[1], maxWidth: '55%' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 1 },
  childName: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.medium },
  rateBtn: {
    alignSelf: 'flex-start', marginTop: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: 9999, backgroundColor: colors.warningBg,
  },
  rateBtnText: { fontSize: fontSizes.xs, color: colors.warningDark, fontWeight: fontWeights.semibold },
  emptyWrap: { flex: 1, minHeight: 360 },
});

import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing, radius,
  AppHeader, Card, Badge, Skeleton, EmptyState, AnimatedPressable, SlideIn,
} from '@saarthi/ui';
import { useTodayTrips, useMyStudents } from '@saarthi/api-client';
import type { BadgeVariant } from '@saarthi/ui';

function tripStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'IN_PROGRESS': case 'STARTED': return 'info';
    case 'SCHEDULED': return 'warning';
    case 'CANCELLED': return 'cancelled';
    case 'ABORTED': return 'error';
    default: return 'default';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'In progress';
    case 'STARTED': return 'Started';
    case 'SCHEDULED': return 'Scheduled';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    case 'ABORTED': return 'Aborted';
    default: return status;
  }
}

export default function TripsScreen() {
  const { data: trips, isLoading, isError } = useTodayTrips();
  const { data: students } = useMyStudents();
  const count = trips?.length ?? 0;
  const myIds = new Set((students ?? []).map((s) => s.id));

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
            const routeName = (item as any)?.route?.name ?? item.routeId;
            const completed = item.status === 'COMPLETED';
            const skipped = ((item as any)?.riders ?? []).some(
              (r: any) => myIds.has(r.studentId) && r.boardStatus === 'CANCELLED',
            );
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
                      <View style={styles.subRow}>
                        <Text style={styles.direction}>
                          {item.direction === 'PICKUP' ? 'Pickup' : 'Drop'}
                        </Text>
                        {skipped && <Text style={styles.skippedChip}>Pickup skipped</Text>}
                      </View>
                    </View>
                    <Badge label={statusLabel(item.status)} variant={tripStatusVariant(item.status)} size="sm" />
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
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  cardInfo: { flex: 1 },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary },
  skippedChip: {
    fontSize: fontSizes.xs, color: colors.gray500, fontWeight: fontWeights.semibold,
    backgroundColor: colors.gray100, paddingHorizontal: spacing[2], paddingVertical: 1, borderRadius: radius.full, overflow: 'hidden',
  },
  rateBtn: {
    alignSelf: 'flex-start', marginTop: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: 9999, backgroundColor: colors.warningBg,
  },
  rateBtnText: { fontSize: fontSizes.xs, color: colors.warningDark, fontWeight: fontWeights.semibold },
  emptyWrap: { flex: 1, minHeight: 360 },
});

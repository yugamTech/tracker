import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius, letterSpacing,
  AppHeader, Button, Skeleton, EmptyState, SectionHeader, ScreenContainer,
} from '@saarthi/ui';
import { useTripById } from '@saarthi/api-client';

export default function TripPreScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, isError } = useTripById(tripId);

  if (isLoading) {
    return (
      <ScreenContainer bg={colors.backgroundMuted}>
        <AppHeader title="Pre-Trip Check" onBack={() => router.back()} />
        <View style={styles.summary}>
          <Skeleton width="55%" height={22} radius="md" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <Skeleton width="40%" height={14} radius="md" style={{ marginTop: spacing[2], backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.stopRow}>
              <Skeleton width={32} height={32} circle />
              <Skeleton width="60%" height={16} />
            </View>
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !trip) {
    return (
      <ScreenContainer bg={colors.backgroundMuted}>
        <AppHeader title="Pre-Trip Check" onBack={() => router.back()} />
        <EmptyState title="Trip not found" description="Could not load trip details" />
      </ScreenContainer>
    );
  }

  const t = trip as any;
  const routeName: string = t?.route?.name ?? trip.routeId;
  const stops: Array<{ id: string; name: string; sequence: number; riderCount: number }> =
    (t?.route?.stops ?? [])
      .sort((a: any, b: any) => a.sequence - b.sequence)
      .map((rs: any) => ({
        id: rs.stop?.id ?? rs.stopId,
        name: rs.stop?.name ?? rs.stopId,
        sequence: rs.sequence,
        riderCount: (t?.riders ?? []).filter((r: any) => r.stopId === (rs.stop?.id ?? rs.stopId)).length,
      }));
  const totalRiders = (t?.riders ?? []).length;

  return (
    <ScreenContainer bg={colors.backgroundMuted}>
      <AppHeader title="Pre-Trip Check" onBack={() => router.back()} />

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{routeName}</Text>
        <Text style={styles.summaryMeta}>
          {trip.direction} · {stops.length} stop{stops.length !== 1 ? 's' : ''} · {totalRiders} rider{totalRiders !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={stops}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<SectionHeader title="Stop order" style={styles.sectionHeader} />}
        ListEmptyComponent={
          <View style={styles.noStops}>
            <Text style={styles.noStopsText}>No stops found for this route</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.stopRow}>
            <View style={styles.stopNumber}>
              <Text style={styles.stopNum}>{item.sequence}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{item.name}</Text>
              <Text style={styles.stopRiders}>{item.riderCount} rider{item.riderCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Button
          title="Start Trip"
          onPress={() => router.replace(`/(app)/trip/${tripId}/active` as never)}
          fullWidth
          size="lg"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summary: { padding: spacing[5], backgroundColor: colors.primary },
  summaryTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.white, letterSpacing: letterSpacing.tight },
  summaryMeta: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.85)', marginTop: spacing[1] },
  sectionHeader: { paddingHorizontal: 0, paddingTop: spacing[2] },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[2], flexGrow: 1 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.background, padding: spacing[4], borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  stopNumber: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  stopNum: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.bold },
  stopInfo: { flex: 1 },
  stopName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  stopRiders: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  noStops: { padding: spacing[6], alignItems: 'center' },
  noStopsText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  footer: {
    padding: spacing[5], backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});

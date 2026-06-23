import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Badge, LoadingSpinner, EmptyState, AppHeader } from '@yaanam/ui';
import { useTripById } from '@yaanam/api-client';
import type { BadgeVariant } from '@yaanam/ui';
import { goBackTo } from '../../../../lib/nav';

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

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, isError } = useTripById(tripId);
  const back = () => goBackTo('trips/[tripId]/index');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title="Trip detail" onBack={back} />
        <LoadingSpinner fullScreen />
      </SafeAreaView>
    );
  }

  if (isError || !trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title="Trip detail" onBack={back} />
        <EmptyState title="Trip not found" description="This trip could not be loaded" />
      </SafeAreaView>
    );
  }

  const t = trip as any;
  const routeName: string = t?.route?.name ?? trip.routeId;
  const vehicleReg: string = t?.vehicle?.regNumber ?? trip.vehicleId ?? '—';
  const stops: Array<{ id: string; name: string; sequence: number; riderCount: number }> =
    (t?.route?.stops ?? []).map((rs: any) => ({
      id: rs.stop?.id ?? rs.stopId,
      name: rs.stop?.name ?? rs.stopId,
      sequence: rs.sequence,
      riderCount: (t?.riders ?? []).filter((r: any) => r.stopId === (rs.stop?.id ?? rs.stopId)).length,
    }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Trip detail" subtitle={routeName} onBack={back} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerRoute}>{routeName}</Text>
          <View style={styles.bannerMeta}>
            <Text style={styles.bannerMetaText}>{trip.direction}</Text>
            <Text style={styles.bannerMetaText}>·</Text>
            <Text style={styles.bannerMetaText}>{vehicleReg}</Text>
          </View>
          <View style={styles.bannerBadge}>
            <Badge label={trip.status} variant={tripStatusVariant(trip.status)} size="sm" />
          </View>
        </View>

        {/* Stop timeline */}
        <Text style={styles.sectionLabel}>Stop Sequence</Text>
        {stops.length === 0 ? (
          <View style={styles.noStops}>
            <Text style={styles.noStopsText}>No stop data available</Text>
          </View>
        ) : (
          stops.map((stop, idx) => (
            <View key={stop.id} style={styles.stopRow}>
              <View style={styles.stopNumber}>
                <Text style={styles.stopNum}>{stop.sequence}</Text>
              </View>
              <View style={styles.stopConnector}>
                {idx < stops.length - 1 && <View style={styles.connectorLine} />}
              </View>
              <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{stop.name}</Text>
                {stop.riderCount > 0 && (
                  <Text style={styles.riderCount}>👥 {stop.riderCount} riders</Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* Replay button */}
        <TouchableOpacity
          style={styles.replayBtn}
          onPress={() => router.push(`/(app)/trips/${tripId}/replay` as never)}
        >
          <Text style={styles.replayBtnText}>▶ View Replay</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  banner: { backgroundColor: colors.primary, padding: spacing[5] },
  bannerRoute: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.white },
  bannerMeta: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  bannerMetaText: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.85)' },
  bannerBadge: { marginTop: spacing[2], alignSelf: 'flex-start' },
  sectionLabel: {
    fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
    color: colors.textSecondary, margin: spacing[4],
  },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: spacing[4], marginBottom: spacing[2] },
  stopNumber: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  stopNum: { fontSize: fontSizes.sm, color: colors.white, fontWeight: fontWeights.bold },
  stopConnector: { width: 2, position: 'absolute', top: 32, left: 15, bottom: -10 },
  connectorLine: { flex: 1, width: 2, backgroundColor: colors.border },
  stopInfo: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing[3], marginLeft: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  stopName: { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.textPrimary },
  riderCount: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  noStops: { margin: spacing[4], padding: spacing[4], backgroundColor: colors.white, borderRadius: radius.lg, alignItems: 'center' },
  noStopsText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  replayBtn: {
    margin: spacing[5], padding: spacing[4], backgroundColor: colors.white,
    borderRadius: radius.xl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  replayBtnText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
});

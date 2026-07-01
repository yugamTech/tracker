import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Badge, LoadingSpinner, EmptyState, AppHeader } from '@yaanam/ui';
import { useTripById, useBusConditionPhotos } from '@yaanam/api-client';
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
  // Bus-condition photos for this trip's vehicle — guardian + 30-day scoped server-side.
  const { data: busPhotos } = useBusConditionPhotos(tripId);
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
  // Curated, server-built driver projection — only { name, photoUrl, phone }.
  const driver = t?.driver as { name: string; photoUrl?: string | null; phone?: string | null } | null | undefined;
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

        {/* Your driver — curated, privacy-scoped projection */}
        {driver ? (
          <>
            <Text style={styles.sectionLabel}>Your Driver</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                {driver.photoUrl ? (
                  <Image source={{ uri: driver.photoUrl }} style={styles.driverAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 22 }}>🧑‍✈️</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <Text style={styles.driverSub}>{vehicleReg}</Text>
              </View>
              {driver.phone ? (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                  accessibilityRole="button"
                  accessibilityLabel="Call driver"
                >
                  <Text style={styles.callBtnText}>📞 Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Bus condition — driver's recent pre-trip photos (read-only, last 30 days) */}
        {busPhotos && busPhotos.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Bus Condition</Text>
            <View style={styles.busPhotoWrap}>
              {busPhotos.flatMap((c) =>
                c.photoUrls.map((url) => (
                  <Image key={url} source={{ uri: url }} style={styles.busPhoto} resizeMode="cover" />
                )),
              )}
            </View>
          </>
        ) : null}

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
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    marginHorizontal: spacing[4], padding: spacing[3],
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  driverAvatarImg: { width: 48, height: 48 },
  driverName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  driverSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  callBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: colors.primaryBg, borderRadius: radius.full,
  },
  callBtnText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  busPhotoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginHorizontal: spacing[4] },
  busPhoto: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.gray100 },
  noStops: { margin: spacing[4], padding: spacing[4], backgroundColor: colors.white, borderRadius: radius.lg, alignItems: 'center' },
  noStopsText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  replayBtn: {
    margin: spacing[5], padding: spacing[4], backgroundColor: colors.white,
    borderRadius: radius.xl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  replayBtnText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.semibold },
});

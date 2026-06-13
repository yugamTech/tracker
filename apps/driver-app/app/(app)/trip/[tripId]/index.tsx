import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useTripById } from '@saarthi/api-client';

export default function TripPreScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, isError } = useTripById(tripId);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pre-Trip Check</Text>
          <View style={{ width: 40 }} />
        </View>
        <LoadingSpinner fullScreen />
      </SafeAreaView>
    );
  }

  if (isError || !trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pre-Trip Check</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState title="Trip not found" description="Could not load trip details" />
      </SafeAreaView>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pre-Trip Check</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{routeName}</Text>
        <Text style={styles.summaryMeta}>
          {trip.direction} · {stops.length} stop{stops.length !== 1 ? 's' : ''} · {totalRiders} rider{totalRiders !== 1 ? 's' : ''}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Stop Order</Text>
      <FlatList
        data={stops}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
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
              <Text style={styles.stopRiders}>👥 {item.riderCount} riders</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Button
          title="🚀 Start Trip"
          onPress={() => router.replace(`/(app)/trip/${tripId}/active` as never)}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium },
  headerTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  summary: { padding: spacing[5], backgroundColor: '#0EA5E9' },
  summaryTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.white },
  summaryMeta: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: spacing[1] },
  sectionLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary, margin: spacing[4] },
  list: { paddingHorizontal: spacing[4], gap: spacing[2] },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.white, padding: spacing[4], borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  stopNumber: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center',
  },
  stopNum: { fontSize: fontSizes.sm, color: colors.white, fontWeight: fontWeights.bold },
  stopInfo: { flex: 1 },
  stopName: { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.textPrimary },
  stopRiders: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  noStops: { padding: spacing[6], alignItems: 'center' },
  noStopsText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  footer: { padding: spacing[5] },
});

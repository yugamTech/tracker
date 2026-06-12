import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, StatusDot, Card } from '@saarthi/ui';

// Mock live trip data
const MOCK_TRIP = {
  id: 'trip-today-001',
  busNumber: 'HR26-DL-9900',
  driverName: 'Ramesh Kumar',
  driverPhone: '+919999000002',
  currentStop: 'DLF Phase 2',
  nextStop: 'Sector 18 Gate',
  etaMinutes: 8,
  totalStops: 6,
  currentStopIndex: 4,
  lat: 28.5678,
  lng: 77.3234,
  speed: 32,
};

export default function TrackScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={styles.livePill}>
          <StatusDot variant="live" size={8} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>Live Map</Text>
        <Text style={styles.mapSub}>
          Bus at {MOCK_TRIP.lat.toFixed(4)}, {MOCK_TRIP.lng.toFixed(4)}
        </Text>
        <Text style={styles.mapSub}>Speed: {MOCK_TRIP.speed} km/h</Text>
      </View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        {/* ETA */}
        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaLabel}>Next Stop</Text>
            <Text style={styles.etaStop}>{MOCK_TRIP.nextStop}</Text>
          </View>
          <View style={styles.etaBox}>
            <Text style={styles.etaNumber}>{MOCK_TRIP.etaMinutes}</Text>
            <Text style={styles.etaUnit}>min</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progress}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(MOCK_TRIP.currentStopIndex / MOCK_TRIP.totalStops) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Stop {MOCK_TRIP.currentStopIndex} of {MOCK_TRIP.totalStops}
          </Text>
        </View>

        {/* Driver info */}
        <Card style={styles.driverCard} shadow="none">
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={{ fontSize: 20 }}>👨‍✈️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{MOCK_TRIP.driverName}</Text>
              <Text style={styles.driverSub}>Bus {MOCK_TRIP.busNumber}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={() => router.push(`/(app)/messages/driver?tripId=${tripId}` as never)}>
              <Text style={{ fontSize: 16 }}>💬</Text>
              <Text style={styles.callText}>Message</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {},
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  headerTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  liveText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    gap: spacing[2],
  },
  mapIcon: { fontSize: 56 },
  mapText: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.primary },
  mapSub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: spacing[5],
    gap: spacing[4],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etaLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  etaStop: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: 2 },
  etaBox: { alignItems: 'center', backgroundColor: '#EEF2FF', padding: spacing[3], borderRadius: radius.lg },
  etaNumber: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  etaUnit: { fontSize: fontSizes.xs, color: colors.primary },
  progress: { gap: spacing[2] },
  progressBar: { height: 6, backgroundColor: colors.gray100, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: radius.full },
  progressText: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'right' },
  driverCard: { backgroundColor: colors.gray50 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center',
  },
  driverName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  driverSub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  callBtn: { alignItems: 'center', gap: 2 },
  callText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.medium },
});

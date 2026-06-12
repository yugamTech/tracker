import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button } from '@saarthi/ui';

const MOCK_STOPS = [
  { id: 'stop-001', name: 'Sector 18 Gate', sequence: 1, riderCount: 8, arrived: false },
  { id: 'stop-002', name: 'DLF Phase 2', sequence: 2, riderCount: 7, arrived: false },
  { id: 'stop-003', name: 'Vatika City', sequence: 3, riderCount: 5, arrived: false },
  { id: 'stop-004', name: 'School Gate', sequence: 4, riderCount: 0, arrived: false },
];

export default function TripPreScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

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
        <Text style={styles.summaryTitle}>Route A — Sector 18</Text>
        <Text style={styles.summaryMeta}>PICKUP · {MOCK_STOPS.length} stops · 22 riders</Text>
      </View>

      <Text style={styles.sectionLabel}>Stop Order</Text>
      <FlatList
        data={MOCK_STOPS}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
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
  footer: { padding: spacing[5] },
});

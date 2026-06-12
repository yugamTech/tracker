import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, fontFamilies, radius, StatusDot, Button } from '@saarthi/ui';

const MOCK_STOPS = [
  { id: 's1', name: 'Sector 18 Gate', riderCount: 8, done: true },
  { id: 's2', name: 'DLF Phase 2', riderCount: 7, done: false },
  { id: 's3', name: 'Vatika City', riderCount: 5, done: false },
  { id: 's4', name: 'School Gate', riderCount: 0, done: false },
];

export default function ActiveTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [currentStopIdx, setCurrentStopIdx] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const currentStop = MOCK_STOPS[currentStopIdx];

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.liveRow}>
          <StatusDot variant="live" size={10} />
          <Text style={styles.liveText}>TRIP ACTIVE</Text>
        </View>
        <Text style={styles.timer}>⏱ {formatElapsed(elapsed)}</Text>
        <View style={styles.signalBadge}>
          <Text style={styles.signalText}>📶 Strong</Text>
        </View>
      </View>

      {/* Current stop */}
      <View style={styles.currentStop}>
        <Text style={styles.stopLabel}>NEXT STOP</Text>
        <Text style={styles.stopName}>{currentStop?.name}</Text>
        <Text style={styles.stopMeta}>
          Stop {currentStopIdx + 1} of {MOCK_STOPS.length} · {currentStop?.riderCount} riders
        </Text>
      </View>

      {/* Mock map */}
      <View style={styles.mapArea}>
        <Text style={{ fontSize: 56 }}>🗺️</Text>
        <Text style={styles.mapText}>GPS Active</Text>
        <Text style={styles.mapSub}>Location broadcasting every 5s</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <View style={styles.actionsTop}>
          <Button
            title={`✓ Stop ${currentStopIdx + 1} Done`}
            onPress={() => {
              if (currentStopIdx < MOCK_STOPS.length - 1) setCurrentStopIdx((i) => i + 1);
              else router.replace(`/(app)/trip/${tripId}/complete` as never);
            }}
            fullWidth
            size="lg"
            style={{ flex: 1 }}
          />
          <TouchableOpacity style={styles.alertsBtn} onPress={() => router.push(`/(app)/trip/alerts?tripId=${tripId}` as never)}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            <Text style={styles.alertsBtnText}>Alerts</Text>
          </TouchableOpacity>
        </View>
        <Button
          title="Complete Trip"
          variant="outline"
          onPress={() => router.replace(`/(app)/trip/${tripId}/complete` as never)}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray900 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], backgroundColor: '#1a1a2e',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  liveText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold, letterSpacing: 1 },
  timer: { fontSize: fontSizes.sm, color: colors.white, fontFamily: fontFamilies.mono },
  signalBadge: { backgroundColor: '#16213e', paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.md },
  signalText: { fontSize: fontSizes.xs, color: colors.success },
  currentStop: { backgroundColor: '#0EA5E9', padding: spacing[5] },
  stopLabel: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.7)', fontWeight: fontWeights.bold, letterSpacing: 1 },
  stopName: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.white, marginTop: 4 },
  stopMeta: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: spacing[1] },
  mapArea: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16213e', gap: spacing[2] },
  mapText: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.white },
  mapSub: { fontSize: fontSizes.sm, color: colors.gray400 },
  actions: { padding: spacing[4], gap: spacing[3], backgroundColor: '#1a1a2e' },
  actionsTop: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  alertsBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: '#16213e', borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: colors.gray600,
  },
  alertsBtnText: { fontSize: fontSizes.xs, color: colors.gray300 },
});

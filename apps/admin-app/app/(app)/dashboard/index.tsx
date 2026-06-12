import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Card, StatusDot } from '@saarthi/ui';

const MOCK_KPIS = [
  { label: 'Active Trips', value: '3', icon: '🚌', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Total Riders', value: '66', icon: '👥', color: '#0EA5E9', bg: '#E0F2FE' },
  { label: 'Boarded', value: '58', icon: '✅', color: '#10B981', bg: '#D1FAE5' },
  { label: 'Absent', value: '8', icon: '❌', color: '#EF4444', bg: '#FEE2E2' },
  { label: 'Open Issues', value: '2', icon: '⚠️', color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Collection %', value: '87%', icon: '💰', color: '#7C3AED', bg: '#EDE9FE' },
];

const MOCK_EXCEPTIONS = [
  { id: 'e1', type: 'SIGNAL_LOST', message: 'Bus HR26-DL-9900 signal lost for 3 min', time: '07:32 AM', severity: 'high' },
  { id: 'e2', type: 'NOT_BOARDED', message: 'Arjun Sharma not boarded at Sector 18', time: '07:18 AM', severity: 'medium' },
];

const MOCK_TRIPS = [
  { id: 't1', route: 'Route A', bus: 'HR26-DL-9900', driver: 'Ramesh Kumar', status: 'IN_PROGRESS', riders: '22/22' },
  { id: 't2', route: 'Route B', bus: 'HR26-DL-9901', driver: 'Suresh Yadav', status: 'STARTED', riders: '18/20' },
  { id: 't3', route: 'Route C', bus: 'HR26-DL-9902', driver: 'Mohan Das', status: 'SCHEDULED', riders: '0/25' },
];

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: colors.success,
  STARTED: '#0EA5E9',
  SCHEDULED: colors.gray400,
  COMPLETED: colors.gray400,
};

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        {MOCK_KPIS.map((kpi) => (
          <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: kpi.bg }]}>
            <Text style={{ fontSize: 28 }}>{kpi.icon}</Text>
            <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      {/* Exceptions */}
      {MOCK_EXCEPTIONS.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Active Exceptions</Text>
          {MOCK_EXCEPTIONS.map((ex) => (
            <View
              key={ex.id}
              style={[styles.exceptionCard, { borderLeftColor: ex.severity === 'high' ? colors.error : colors.warning }]}
            >
              <View style={styles.exRow}>
                <Text style={styles.exMsg}>{ex.message}</Text>
                <Text style={styles.exTime}>{ex.time}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Live Fleet */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚌 Fleet Status</Text>
        {MOCK_TRIPS.map((trip) => (
          <Card key={trip.id} style={styles.tripCard}>
            <View style={styles.tripRow}>
              <View>
                <Text style={styles.tripRoute}>{trip.route}</Text>
                <Text style={styles.tripDriver}>Driver: {trip.driver}</Text>
                <Text style={styles.tripBus}>{trip.bus}</Text>
              </View>
              <View style={styles.tripRight}>
                <View style={styles.statusRow}>
                  <StatusDot variant={trip.status === 'IN_PROGRESS' ? 'live' : trip.status === 'STARTED' ? 'live' : 'idle'} />
                  <Text style={[styles.tripStatus, { color: STATUS_COLORS[trip.status] ?? colors.gray400 }]}>
                    {trip.status.replace('_', ' ')}
                  </Text>
                </View>
                <Text style={styles.riderCount}>{trip.riders}</Text>
                <Text style={styles.riderLabel}>riders</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing[3], gap: spacing[3] },
  kpiCard: {
    width: '30%', flex: 1, minWidth: '28%',
    padding: spacing[4], borderRadius: radius.xl,
    alignItems: 'center', gap: spacing[1],
  },
  kpiValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold },
  kpiLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },
  section: { padding: spacing[4], gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  exceptionCard: {
    backgroundColor: colors.white, padding: spacing[4],
    borderRadius: radius.lg, borderLeftWidth: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exMsg: { flex: 1, fontSize: fontSizes.sm, color: colors.textPrimary, lineHeight: 20 },
  exTime: { fontSize: fontSizes.xs, color: colors.textMuted, marginLeft: spacing[2] },
  tripCard: { marginBottom: 0 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripRoute: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  tripDriver: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  tripBus: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 1 },
  tripRight: { alignItems: 'flex-end', gap: spacing[1] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  tripStatus: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold },
  riderCount: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  riderLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
});

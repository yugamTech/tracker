import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Card, StatusDot, LoadingSpinner } from '@saarthi/ui';
import { useFleet } from '@saarthi/api-client';
import type { FleetEntry } from '@saarthi/api-client';

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: colors.success,
  STARTED: '#0EA5E9',
  SCHEDULED: colors.gray400,
  COMPLETED: colors.gray400,
  SIGNAL_LOST: colors.error,
};

export default function DashboardScreen() {
  const { data: fleet, isLoading } = useFleet();

  const activeFleet = (fleet ?? []).filter(
    (f) => f.status === 'STARTED' || f.status === 'IN_PROGRESS',
  );
  const signalLostFleet = (fleet ?? []).filter((f) => f.status === 'SIGNAL_LOST');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Live KPI row */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: '#EEF2FF' }]}>
          <Text style={{ fontSize: 28 }}>🚌</Text>
          <Text style={[styles.kpiValue, { color: '#4F46E5' }]}>
            {isLoading ? '…' : activeFleet.length}
          </Text>
          <Text style={styles.kpiLabel}>Active Trips</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#FEE2E2' }]}>
          <Text style={{ fontSize: 28 }}>⚠️</Text>
          <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
            {isLoading ? '…' : signalLostFleet.length}
          </Text>
          <Text style={styles.kpiLabel}>Signal Lost</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#F5F3FF' }]}>
          <Text style={{ fontSize: 28 }}>📊</Text>
          <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>—</Text>
          <Text style={styles.kpiLabel}>Analytics soon</Text>
        </View>
      </View>

      {/* Analytics placeholder */}
      <View style={styles.analyticsPlaceholder}>
        <Text style={styles.analyticsIcon}>📈</Text>
        <Text style={styles.analyticsTitle}>Analytics coming soon</Text>
        <Text style={styles.analyticsSub}>
          Boarding %, collection %, and KPI trends will be available in Phase 6
        </Text>
      </View>

      {/* Signal lost exceptions */}
      {!isLoading && signalLostFleet.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Signal Lost</Text>
          {signalLostFleet.map((f) => (
            <View
              key={f.tripId}
              style={[styles.exceptionCard, { borderLeftColor: colors.error }]}
            >
              <View style={styles.exRow}>
                <Text style={styles.exMsg}>
                  {f.vehicleReg ?? 'Bus'} — {f.routeName} signal lost
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Live Fleet */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚌 Fleet Status</Text>
        {isLoading && <LoadingSpinner />}
        {!isLoading && (fleet ?? []).length === 0 && (
          <View style={styles.emptyFleet}>
            <Text style={styles.emptyFleetText}>No active trips right now</Text>
          </View>
        )}
        {(fleet ?? []).map((f: FleetEntry) => (
          <Card key={f.tripId} style={styles.tripCard}>
            <View style={styles.tripRow}>
              <View>
                <Text style={styles.tripRoute}>{f.routeName}</Text>
                <Text style={styles.tripBus}>{f.vehicleReg ?? '—'}</Text>
                <Text style={styles.tripDirection}>{f.direction}</Text>
              </View>
              <View style={styles.tripRight}>
                <View style={styles.statusRow}>
                  <StatusDot
                    variant={
                      f.status === 'IN_PROGRESS' || f.status === 'STARTED'
                        ? 'live'
                        : f.status === 'SIGNAL_LOST'
                        ? 'offline'
                        : 'idle'
                    }
                  />
                  <Text
                    style={[
                      styles.tripStatus,
                      { color: STATUS_COLORS[f.status] ?? colors.gray400 },
                    ]}
                  >
                    {f.status.replace('_', ' ')}
                  </Text>
                </View>
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
  kpiGrid: { flexDirection: 'row', padding: spacing[3], gap: spacing[3] },
  kpiCard: {
    flex: 1, padding: spacing[4], borderRadius: radius.xl,
    alignItems: 'center', gap: spacing[1],
  },
  kpiValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold },
  kpiLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },
  analyticsPlaceholder: {
    margin: spacing[4], padding: spacing[5], backgroundColor: colors.white,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', gap: spacing[2],
  },
  analyticsIcon: { fontSize: 36 },
  analyticsTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  analyticsSub: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  section: { padding: spacing[4], gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  exceptionCard: {
    backgroundColor: colors.white, padding: spacing[4],
    borderRadius: radius.lg, borderLeftWidth: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exMsg: { flex: 1, fontSize: fontSizes.sm, color: colors.textPrimary, lineHeight: 20 },
  tripCard: { marginBottom: 0 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripRoute: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  tripBus: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 1 },
  tripDirection: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  tripRight: { alignItems: 'flex-end', gap: spacing[1] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  tripStatus: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold },
  emptyFleet: { padding: spacing[4], alignItems: 'center' },
  emptyFleetText: { fontSize: fontSizes.sm, color: colors.textSecondary },
});

import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius, Card, Badge, LoadingSpinner, EmptyState, MockBusMap,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useTripById, useRoster } from '@saarthi/api-client';
import type { RosterGuardian } from '@saarthi/api-client';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: colors.success,
  ABORTED: colors.error,
  IN_PROGRESS: '#0EA5E9',
  STARTED: '#0EA5E9',
  SCHEDULED: colors.gray400,
  CANCELLED: colors.gray400,
};

function boardVariant(status: string): BadgeVariant {
  switch (status) {
    case 'BOARDED': return 'boarded';
    case 'NOT_BOARDED': return 'not_boarded';
    case 'CANCELLED': return 'cancelled';
    default: return 'expected';
  }
}

function GuardianRow({ g }: { g: RosterGuardian }) {
  return (
    <TouchableOpacity
      style={styles.guardianRow}
      onPress={() => Linking.openURL(`tel:${g.phone}`)}
      activeOpacity={0.7}
    >
      <View style={styles.guardianInfo}>
        <Text style={styles.guardianName}>
          {g.name} {g.isPrimary ? '· primary' : ''}
        </Text>
        <Text style={styles.guardianPhone}>{g.phone}</Text>
      </View>
      <View style={styles.callBtn}>
        <Text style={styles.callBtnText}>📞 Call</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TripMonitorScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTripById(tripId);
  const { data: roster, isLoading, isError, refetch, isRefetching } = useRoster(tripId);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isError || !roster) {
    return <EmptyState title="Could not load trip" description="Check your connection and try again" />;
  }

  const t = trip as any;
  const routeName: string = t?.route?.name ?? roster.tripId;
  const driverName: string = t?.driver?.name ?? '—';
  const conductorName: string | undefined = t?.conductor?.name;
  const vehicleReg: string = t?.vehicle?.regNumber ?? '—';
  const status: string = t?.status ?? '';

  // Flatten riders to surface not-boarded exceptions across all stops.
  const allRiders = roster.stops.flatMap((s) => s.riders.map((r) => ({ ...r, stopName: s.stopName })));
  const notBoarded = allRiders.filter((r) => r.boardStatus === 'NOT_BOARDED');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Mock live map — shown when trip is started/in-progress */}
      {(status === 'STARTED' || status === 'IN_PROGRESS') && (
        <MockBusMap
          stops={((t?.route?.stops ?? []) as any[]).map((rs: any) => ({ id: rs.stop?.id ?? rs.id, name: rs.stop?.name ?? rs.name }))}
          live={true}
          routeName={routeName}
          height={180}
        />
      )}

      {/* Header */}
      <Card style={styles.section}>
        <View style={styles.headerTop}>
          <Text style={styles.routeName}>{routeName}{t?.direction ? ` · ${t.direction}` : ''}</Text>
          {!!status && (
            <Text style={[styles.status, { color: STATUS_COLORS[status] ?? colors.gray400 }]}>{status}</Text>
          )}
        </View>
        <Text style={styles.headerMeta}>🧑‍✈️ {driverName}{conductorName ? `   ·   🧑‍🔧 ${conductorName}` : ''}</Text>
        <Text style={styles.headerMeta}>🚌 {vehicleReg}</Text>
      </Card>

      {/* Summary */}
      <Card style={styles.summaryCard}>
        <Stat label="Total" value={roster.summary.total} />
        <Stat label="Boarded" value={roster.summary.boarded} color={colors.success} />
        <Stat label="Not boarded" value={roster.summary.notBoarded} color={colors.error} />
        <Stat label="Expected" value={roster.summary.expected} color={colors.gray500} />
      </Card>

      {/* Exceptions */}
      {notBoarded.length > 0 && (
        <Card style={[styles.section, styles.exceptionCard]}>
          <Text style={styles.exceptionTitle}>⚠️ Not boarded ({notBoarded.length})</Text>
          {notBoarded.map((r) => (
            <View key={r.studentId} style={styles.exceptionRow}>
              <Text style={styles.exceptionName}>{r.studentName}</Text>
              <Text style={styles.exceptionStop}>{r.stopName}</Text>
              {r.guardians.map((g, i) => <GuardianRow key={`${r.studentId}-${i}`} g={g} />)}
            </View>
          ))}
        </Card>
      )}

      {/* Per-stop roster */}
      {roster.stops.length === 0 && (
        <EmptyState title="No riders" description="This trip has no roster yet" />
      )}
      {roster.stops.map((stop) => (
        <Card key={stop.stopId} style={styles.section}>
          <Text style={styles.stopName}>📍 {stop.stopName} · {stop.riders.length} rider{stop.riders.length !== 1 ? 's' : ''}</Text>
          {stop.riders.map((r) => (
            <View key={r.studentId} style={styles.riderBlock}>
              <View style={styles.riderRow}>
                <Text style={styles.riderName}>{r.studentName}</Text>
                <Badge label={r.boardStatus.replace('_', ' ')} variant={boardVariant(r.boardStatus)} size="sm" />
              </View>
              {r.guardians.length === 0 ? (
                <Text style={styles.noGuardian}>No guardian contact on file</Text>
              ) : (
                r.guardians.map((g, i) => <GuardianRow key={`${r.studentId}-${i}`} g={g} />)
              )}
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[3] },
  section: { gap: spacing[2] },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, flex: 1 },
  status: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  headerMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing[4] },
  stat: { alignItems: 'center', gap: spacing[1] },
  statValue: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  statLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  exceptionCard: { borderWidth: 1, borderColor: colors.error, backgroundColor: '#FEF2F2' },
  exceptionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.error },
  exceptionRow: { gap: spacing[1], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: '#FECACA' },
  exceptionName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  exceptionStop: { fontSize: fontSizes.xs, color: colors.textSecondary },
  stopName: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing[1] },
  riderBlock: { gap: spacing[1], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border },
  riderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riderName: { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.textPrimary, flex: 1 },
  noGuardian: { fontSize: fontSizes.xs, color: colors.textMuted, fontStyle: 'italic' },
  guardianRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.gray50, borderRadius: radius.lg, padding: spacing[2], marginTop: spacing[1],
  },
  guardianInfo: { flex: 1 },
  guardianName: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  guardianPhone: { fontSize: fontSizes.xs, color: colors.textSecondary },
  callBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, backgroundColor: colors.primary },
  callBtnText: { fontSize: fontSizes.xs, color: colors.white, fontWeight: fontWeights.semibold },
});

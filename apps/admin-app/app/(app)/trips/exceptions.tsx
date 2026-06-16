import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Button, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useTripStartExceptions, useResolveStartException } from '@saarthi/api-client';
import type { TripStartExceptionWithTrip } from '@saarthi/api-client';

type FilterKey = 'open' | 'all';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'all', label: 'All' },
];

/** Human "how far off" from the scheduled start. */
function offsetLabel(deltaMinutes: number): string {
  if (deltaMinutes === 0) return 'on time';
  const mins = Math.abs(deltaMinutes);
  return `${mins} min ${deltaMinutes < 0 ? 'early' : 'late'}`;
}

export default function TripStartAlarmsScreen() {
  const [filter, setFilter] = useState<FilterKey>('open');
  const { data, isLoading, isError } = useTripStartExceptions(filter === 'all' ? 'all' : undefined);
  const resolve = useResolveStartException();

  const onResolve = (item: TripStartExceptionWithTrip) => {
    Alert.alert('Resolve alarm', 'Mark this trip-start exception as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () =>
          resolve.mutate(item.id, {
            onError: (e: any) => Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to resolve'),
          }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trip-Start Alarms</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && <LoadingSpinner fullScreen />}
      {isError && <EmptyState title="Could not load alarms" description="Check your connection and try again" />}

      {!isLoading && !isError && (
        <FlatList
          data={data ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={filter === 'open' ? 'No open alarms' : 'No alarms'}
              description="Trips that start off-protocol will appear here."
            />
          }
          renderItem={({ item }) => {
            const resolved = !!item.resolvedAt;
            const routeName = item.trip?.route?.name ?? 'Route';
            const driverName = item.trip?.driver?.name ?? '—';
            const vehicleReg = item.trip?.vehicle?.regNumber ?? '—';
            return (
              <Card style={[styles.card, resolved ? styles.cardResolved : styles.cardOpen]}>
                <View style={styles.cardTop}>
                  <Text style={styles.route}>{routeName} · {item.trip?.direction ?? ''}</Text>
                  <Text style={[styles.badge, resolved ? styles.badgeResolved : styles.badgeOpen]}>
                    {resolved ? 'RESOLVED' : 'OPEN'}
                  </Text>
                </View>
                <Text style={styles.meta}>{driverName} · {vehicleReg}</Text>

                <View style={styles.flags}>
                  {!item.dailyCheckDone && <Text style={styles.flag}>⚠️ No daily check</Text>}
                  <Text style={styles.flag}>⏱ {offsetLabel(item.deltaMinutes)}</Text>
                </View>

                <Text style={styles.reasonLabel}>Driver's reason</Text>
                <Text style={styles.reason}>{item.reason}</Text>

                <Text style={styles.times}>
                  Scheduled {new Date(item.scheduledStart).toLocaleString()} · Started{' '}
                  {new Date(item.startedAt).toLocaleString()}
                </Text>

                {resolved ? (
                  <Text style={styles.resolvedNote}>
                    Resolved {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ''}
                  </Text>
                ) : (
                  <Button
                    title="Mark Resolved"
                    onPress={() => onResolve(item)}
                    loading={resolve.isPending && resolve.variables === item.id}
                    fullWidth
                    style={styles.resolveBtn}
                  />
                )}
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#7C3AED', fontWeight: fontWeights.medium, width: 40 },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  filterRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[2] },
  filterPill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  filterPillActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  filterTextActive: { color: colors.white, fontWeight: fontWeights.semibold },
  list: { paddingHorizontal: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: { gap: spacing[1], borderLeftWidth: 4 },
  cardOpen: { borderLeftColor: '#EF4444' },
  cardResolved: { borderLeftColor: colors.gray400, opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  badge: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  badgeOpen: { color: '#DC2626' },
  badgeResolved: { color: colors.textMuted },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] },
  flag: { fontSize: fontSizes.xs, color: '#B45309', fontWeight: fontWeights.medium },
  reasonLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2], fontWeight: fontWeights.medium },
  reason: { fontSize: fontSizes.sm, color: colors.textPrimary },
  times: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[1] },
  resolvedNote: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing[1], fontStyle: 'italic' },
  resolveBtn: { marginTop: spacing[2] },
});

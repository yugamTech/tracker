import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Button, Skeleton } from '@yaanam/ui';
import { useTripById, useRoster } from '@yaanam/api-client';

/** Whole minutes between two ISO timestamps, or null if either is missing. */
function durationMinutes(startedAt?: string | null, completedAt?: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60_000);
}

export default function TripCompleteScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading: tripLoading } = useTripById(tripId);
  const { data: roster, isLoading: rosterLoading } = useRoster(tripId);

  const loading = tripLoading || rosterLoading;
  const summary = roster?.summary;
  const mins = durationMinutes((trip as any)?.startedAt, (trip as any)?.completedAt);

  // Real stats for this trip — no placeholders.
  const stats: { label: string; value: string }[] = [
    { label: 'Total Riders', value: summary ? String(summary.total) : '—' },
    { label: 'Boarded', value: summary ? String(summary.boarded) : '—' },
    {
      label: 'Not Boarded',
      // Anyone never marked (still EXPECTED) counts as not boarded for the recap.
      value: summary ? String(summary.notBoarded + summary.expected) : '—',
    },
    { label: 'Duration', value: mins != null ? `${mins} min` : '—' },
  ];

  const allCovered = summary ? summary.boarded + summary.notBoarded + summary.cancelled >= summary.total : false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Trip Complete!</Text>
        <Text style={styles.subtitle}>
          {allCovered ? 'Great job. All riders accounted for.' : 'Trip ended. Recap below.'}
        </Text>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statItem}>
              {loading ? (
                <Skeleton width={48} height={28} />
              ) : (
                <Text style={styles.statValue}>{s.value}</Text>
              )}
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Button
          title="Back to Home"
          onPress={() => router.replace('/(app)/home')}
          fullWidth
          size="lg"
          style={{ marginTop: spacing[6] }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[4] },
  emoji: { fontSize: 72 },
  title: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center', marginTop: spacing[4] },
  statItem: {
    width: '44%', padding: spacing[4], borderRadius: 16,
    backgroundColor: colors.gray50, alignItems: 'center', gap: spacing[1],
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  statLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
});

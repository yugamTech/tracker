import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Button, Card, Badge } from '@yaanam/ui';
import { useScheduleResultStore } from '../../../store/schedule.store';
import { formatDayLabel } from '../../../components/Calendar';

/**
 * Terminal screen for a "+ Schedule" batch. The scheduler form navigates here
 * (via `router.replace`) with the per-day tally so it itself stays a clean,
 * reusable form. Reached directly with no results (e.g. a deep link), it bounces
 * back to Trips.
 */
export default function ScheduleResultScreen() {
  const results = useScheduleResultStore((s) => s.results);
  const reset = useScheduleResultStore((s) => s.reset);

  useEffect(() => {
    if (results.length === 0) router.replace('/(app)/trips' as never);
  }, [results.length]);

  if (results.length === 0) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const allOk = failed === 0;

  return (
    <View style={styles.container}>
      <Card style={styles.hero}>
        <Text style={styles.icon}>{allOk ? '✅' : '⚠️'}</Text>
        <Text style={styles.title}>{allOk ? 'Trips scheduled' : 'Scheduling finished'}</Text>
        <Text style={styles.sub}>{ok} scheduled{failed ? ` · ${failed} failed` : ''}</Text>
      </Card>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {results.map((r) => (
          <View key={r.key} style={styles.row}>
            <Text style={styles.day}>{formatDayLabel(r.key)}</Text>
            {r.ok
              ? <Badge label="Scheduled" variant="success" size="sm" />
              : <Badge label={r.message ?? 'Failed'} variant="error" size="sm" />}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Schedule more"
          variant="secondary"
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/trips/new' as never); }}
        />
        <Button
          title="Done"
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/trips' as never); }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50, padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingVertical: spacing[6], gap: spacing[1] },
  icon: { fontSize: 44 },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  sub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  list: { flex: 1 },
  listContent: { gap: spacing[2], paddingBottom: spacing[2] },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2],
    backgroundColor: colors.white, borderRadius: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  day: { fontSize: fontSizes.sm, color: colors.textPrimary, flex: 1 },
  footer: { gap: spacing[2] },
});

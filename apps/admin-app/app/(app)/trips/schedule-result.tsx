import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, IconSplat, Icon,
} from '@yaanam/ui';
import { useScheduleResultStore } from '../../../store/schedule.store';
import { formatDayLabel } from '../../../components/Calendar';
import { ActionButton } from '../../../components/forms';

const HUE = colors.trip;

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
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const allOk = failed === 0;

  return (
    <View style={styles.container}>
      <Card shadow="sm" radius={22} style={styles.hero}>
        <IconSplat
          shape={allOk ? 'b3' : 'b4'}
          splatColor={allOk ? colors.okBg : colors.warnBg}
          spot="trip"
          size={64}
        />
        <View style={styles.heroText}>
          <Text style={styles.title}>{allOk ? 'Trips scheduled' : 'Scheduling finished'}</Text>
          <Text style={styles.sub}>
            {ok} scheduled{failed ? (
              <Text style={styles.subFail}> · {failed} failed</Text>
            ) : null}
          </Text>
        </View>
        {allOk ? <Icon name="checkc" size={22} color={colors.ok} /> : <Icon name="alert" size={22} color={colors.warningDark} />}
      </Card>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {results.map((r) => (
          <View key={r.key} style={[styles.row, r.ok ? styles.rowOk : styles.rowFail]}>
            <View style={styles.dayRow}>
              <Icon name={r.ok ? 'checkc' : 'alert'} size={15} color={r.ok ? colors.ok : colors.crit} />
              <Text style={styles.day}>{formatDayLabel(r.key)}</Text>
            </View>
            <Badge
              label={r.ok ? 'Scheduled' : (r.message ?? 'Failed')}
              variant={r.ok ? 'success' : 'error'}
              size="sm"
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton
          title="Schedule more"
          tone="outline"
          hue={HUE}
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/trips/new' as never); }}
        />
        <ActionButton
          title="Done"
          hue={HUE}
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/trips' as never); }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground, padding: spacing[4], gap: spacing[3] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
  heroText: { flex: 1 },
  title: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  subFail: { color: colors.crit, fontWeight: fontWeights.bold },

  list: { flex: 1 },
  listContent: { gap: spacing[2], paddingBottom: spacing[2] },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2],
    borderRadius: 16, paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    backgroundColor: colors.white,
  },
  rowOk: { backgroundColor: colors.okBg },
  rowFail: { backgroundColor: colors.critBg },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  day: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, color: colors.ink, fontWeight: fontWeights.bold },

  footer: { gap: spacing[2] },
});

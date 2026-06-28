import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, fontFamilies, Card, Icon, IconSplat } from '@yaanam/ui';
import { useImportStore } from '../../../../store/import.store';
import { ActionButton } from '../../../../components/forms';

const HUE = colors.people;

export default function ImportResultScreen() {
  const { result } = useImportStore();
  const reset = useImportStore((s) => s.reset);

  useEffect(() => {
    if (!result) router.replace('/(app)/people/import' as never);
  }, [result]);

  if (!result) {
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }

  const ok = result.status === 'COMMITTED';

  return (
    <View style={styles.container}>
      <Card shadow="sm" radius={22} style={styles.hero}>
        <IconSplat
          shape={ok ? 'b1' : 'b4'}
          splatColor={ok ? colors.peopleBg : colors.warnBg}
          spot="users"
          size={64}
        />
        <View style={styles.heroText}>
          <Text style={styles.title}>{ok ? 'Import complete' : 'Import failed'}</Text>
          <Text style={styles.sub}>Batch {result.batchId?.slice(0, 8) ?? '—'}</Text>
        </View>
        <Icon name={ok ? 'checkc' : 'alert'} size={22} color={ok ? colors.ok : colors.warningDark} />
      </Card>

      <View style={styles.summaryRow}>
        <Stat label="Created" value={result.createdCount} color={colors.ok} />
        <Stat label="Updated" value={result.updatedCount} color={HUE} />
        <Stat label="Skipped" value={result.errorCount} color={result.errorCount ? colors.crit : colors.ink3} />
      </View>

      {result.errorCount > 0 ? (
        <Text style={styles.note}>
          {result.errorCount} row(s) had errors and were skipped. Fix them in your sheet and
          re-upload — already-imported rows will update, not duplicate.
        </Text>
      ) : null}

      <View style={styles.footer}>
        <ActionButton
          title="Import more"
          tone="outline"
          hue={HUE}
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/people/import' as never); }}
        />
        <ActionButton
          title="Done"
          hue={HUE}
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/people' as never); }}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card shadow="sm" radius={18} style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground, padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
  heroText: { flex: 1 },
  title: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: spacing[3] },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing[3] },
  statValue: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold },
  statLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink2, marginTop: 2 },
  note: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 18 },
  footer: { gap: spacing[2], marginTop: 'auto' },
});

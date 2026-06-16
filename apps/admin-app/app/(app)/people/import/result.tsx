import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Button, Card } from '@saarthi/ui';
import { useImportStore } from '../../../../store/import.store';

export default function ImportResultScreen() {
  const { result } = useImportStore();
  const reset = useImportStore((s) => s.reset);

  useEffect(() => {
    if (!result) router.replace('/(app)/people/import' as never);
  }, [result]);

  if (!result) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  const ok = result.status === 'COMMITTED';

  return (
    <View style={styles.container}>
      <Card style={styles.hero}>
        <Text style={styles.icon}>{ok ? '✅' : '⚠️'}</Text>
        <Text style={styles.title}>{ok ? 'Import complete' : 'Import failed'}</Text>
        <Text style={styles.sub}>Batch {result.batchId?.slice(0, 8) ?? '—'}</Text>
      </Card>

      <View style={styles.summaryRow}>
        <Stat label="Created" value={result.createdCount} color={colors.success} />
        <Stat label="Updated" value={result.updatedCount} color={colors.primary} />
        <Stat label="Skipped" value={result.errorCount} color={result.errorCount ? colors.error : colors.textSecondary} />
      </View>

      {result.errorCount > 0 && (
        <Text style={styles.note}>
          {result.errorCount} row(s) had errors and were skipped. Fix them in your sheet and
          re-upload — already-imported rows will update, not duplicate.
        </Text>
      )}

      <View style={styles.footer}>
        <Button
          title="Import more"
          variant="secondary"
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/people/import' as never); }}
        />
        <Button
          title="Done"
          fullWidth
          onPress={() => { reset(); router.replace('/(app)/people' as never); }}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50, padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingVertical: spacing[6], gap: spacing[1] },
  icon: { fontSize: 44 },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  sub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  summaryRow: { flexDirection: 'row', gap: spacing[3] },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing[3] },
  statValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold },
  statLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  note: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  footer: { gap: spacing[2], marginTop: 'auto' },
});

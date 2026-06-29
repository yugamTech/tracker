import React, { useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, fontFamilies, Card, AnimatedPressable, useToast } from '@yaanam/ui';
import { useCommitImport } from '@yaanam/api-client';
import { useImportStore } from '../../../../store/import.store';
import { downloadErrorReport } from '../../../../lib/import-files';
import { goBackTo } from '../../../../lib/nav';
import { ActionButton } from '../../../../components/forms';

const HUE = colors.people;

export default function ImportPreviewScreen() {
  const { type, file, validation } = useImportStore();
  const setImport = useImportStore((s) => s.set);
  const commit = useCommitImport();
  const toast = useToast();

  useEffect(() => {
    if (!validation || !type || !file) router.replace('/(app)/people/import' as never);
  }, [validation, type, file]);

  if (!validation || !type || !file) {
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }

  const errorCount = validation.errors.length;
  const hasErrors = errorCount > 0;

  const onConfirm = () => {
    commit.mutate(
      { type, file },
      {
        onSuccess: (result) => {
          setImport({ result });
          router.replace('/(app)/people/import/result' as never);
        },
        onError: (e: any) =>
          toast.error(e?.response?.data?.message ?? 'The batch was rolled back — nothing was saved.', 'Import failed'),
      },
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Stat label="To create" value={validation.willCreate} color={colors.ok} />
        <Stat label="To update" value={validation.willUpdate} color={HUE} />
        <Stat label="Errors" value={errorCount} color={hasErrors ? colors.crit : colors.ink3} />
      </View>

      <Text style={styles.note}>
        {validation.totalRows} data row(s) read.
        {hasErrors
          ? ` ${errorCount} row(s) have problems and will be SKIPPED. Fix them and re-upload to import everything.`
          : ' Everything looks good.'}
      </Text>

      {hasErrors ? (
        <View style={styles.errorHeader}>
          <Text style={styles.errorHeaderText}>Row errors</Text>
          <AnimatedPressable scaleTo={0.94} onPress={() => downloadErrorReport(type, validation.errors)}>
            <Text style={styles.downloadLink}>Download report (CSV)</Text>
          </AnimatedPressable>
        </View>
      ) : null}

      <FlatList
        data={validation.errors}
        keyExtractor={(e, i) => `${e.row}-${e.field}-${i}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No validation errors</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card radius={14} style={styles.errCard}>
            <Text style={styles.errRow}>Row {item.row} · {item.field}</Text>
            <Text style={styles.errMsg}>{item.message}</Text>
          </Card>
        )}
      />

      <View style={styles.footer}>
        <ActionButton
          title={validation.willCreate + validation.willUpdate > 0
            ? `Confirm & import ${validation.willCreate + validation.willUpdate} row(s)`
            : 'Nothing to import'}
          hue={HUE}
          onPress={onConfirm}
          loading={commit.isPending}
          disabled={validation.willCreate + validation.willUpdate === 0}
          fullWidth
        />
        <ActionButton
          title="Back"
          tone="outline"
          hue={HUE}
          onPress={() => goBackTo('people/import/preview')}
          fullWidth
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
  container: { flex: 1, backgroundColor: colors.ground, padding: spacing[4], gap: spacing[3] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing[3] },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing[3] },
  statValue: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold },
  statLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink2, marginTop: 2 },
  note: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 18 },
  errorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorHeaderText: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  downloadLink: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: HUE, fontWeight: fontWeights.medium },
  list: { gap: spacing[2], paddingBottom: spacing[4] },
  errCard: { gap: 2, borderLeftWidth: 3, borderLeftColor: colors.crit },
  errRow: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.ink2 },
  errMsg: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink },
  empty: { alignItems: 'center', padding: spacing[6] },
  emptyText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.base, color: colors.ink2 },
  footer: { gap: spacing[2] },
});

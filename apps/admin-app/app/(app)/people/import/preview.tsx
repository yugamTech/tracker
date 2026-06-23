import React, { useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, useToast } from '@yaanam/ui';
import { useCommitImport } from '@yaanam/api-client';
import { useImportStore } from '../../../../store/import.store';
import { downloadErrorReport } from '../../../../lib/import-files';
import { goBackTo } from '../../../../lib/nav';

export default function ImportPreviewScreen() {
  const { type, file, validation } = useImportStore();
  const setImport = useImportStore((s) => s.set);
  const commit = useCommitImport();
  const toast = useToast();

  // Reached directly without a validation in flight — bounce back.
  useEffect(() => {
    if (!validation || !type || !file) router.replace('/(app)/people/import' as never);
  }, [validation, type, file]);

  if (!validation || !type || !file) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
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
        <Stat label="To create" value={validation.willCreate} tone="create" />
        <Stat label="To update" value={validation.willUpdate} tone="update" />
        <Stat label="Errors" value={errorCount} tone={hasErrors ? 'error' : 'ok'} />
      </View>

      <Text style={styles.note}>
        {validation.totalRows} data row(s) read.
        {hasErrors
          ? ` ${errorCount} row(s) have problems and will be SKIPPED. Fix them and re-upload to import everything.`
          : ' Everything looks good.'}
      </Text>

      {hasErrors && (
        <View style={styles.errorHeader}>
          <Text style={styles.errorHeaderText}>Row errors</Text>
          <TouchableOpacity onPress={() => downloadErrorReport(type, validation.errors)}>
            <Text style={styles.downloadLink}>Download report (CSV)</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={validation.errors}
        keyExtractor={(e, i) => `${e.row}-${e.field}-${i}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No validation errors 🎉</Text></View>
        }
        renderItem={({ item }) => (
          <Card style={styles.errCard}>
            <Text style={styles.errRow}>Row {item.row} · {item.field}</Text>
            <Text style={styles.errMsg}>{item.message}</Text>
          </Card>
        )}
      />

      <View style={styles.footer}>
        <Button
          title={validation.willCreate + validation.willUpdate > 0 ? `Confirm & import ${validation.willCreate + validation.willUpdate} row(s)` : 'Nothing to import'}
          onPress={onConfirm}
          loading={commit.isPending}
          disabled={validation.willCreate + validation.willUpdate === 0}
          fullWidth
        />
        <Button title="Back" variant="ghost" onPress={() => goBackTo('people/import/preview')} fullWidth />
      </View>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'create' | 'update' | 'error' | 'ok' }) {
  const color =
    tone === 'create' ? colors.success
    : tone === 'update' ? colors.primary
    : tone === 'error' ? (colors.error)
    : colors.textSecondary;
  return (
    <Card style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50, padding: spacing[4], gap: spacing[3] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing[3] },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing[3] },
  statValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold },
  statLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  note: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  errorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorHeaderText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  downloadLink: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  list: { gap: spacing[2], paddingBottom: spacing[4] },
  errCard: { gap: 2, borderLeftWidth: 3, borderLeftColor: colors.error },
  errRow: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  errMsg: { fontSize: fontSizes.sm, color: colors.textPrimary },
  empty: { alignItems: 'center', padding: spacing[6] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
  footer: { gap: spacing[2] },
});

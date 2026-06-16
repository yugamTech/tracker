import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card } from '@saarthi/ui';
import {
  useImportTemplates, useValidateImport, type ImportEntityType, type PickedFile,
} from '@saarthi/api-client';
import { downloadTemplate, pickSpreadsheet } from '../../../../lib/import-files';
import { useImportStore } from '../../../../store/import.store';

export default function ImportScreen() {
  const { data: templates = [], isLoading } = useImportTemplates();
  const validate = useValidateImport();
  const setImport = useImportStore((s) => s.set);
  const reset = useImportStore((s) => s.reset);

  const [type, setType] = useState<ImportEntityType | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [downloading, setDownloading] = useState(false);

  const selected = templates.find((t) => t.type === type);

  const onDownload = async () => {
    if (!type) return;
    setDownloading(true);
    try {
      await downloadTemplate(type);
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Could not download the template');
    } finally {
      setDownloading(false);
    }
  };

  const onPick = async () => {
    try {
      const picked = await pickSpreadsheet();
      if (picked) setFile(picked);
    } catch (e: any) {
      Alert.alert('Could not open file', e?.message ?? 'File picker error');
    }
  };

  const onValidate = () => {
    if (!type || !file) return;
    validate.mutate(
      { type, file },
      {
        onSuccess: (validation) => {
          reset();
          setImport({ type, file, validation });
          router.push('/(app)/people/import/preview' as never);
        },
        onError: (e: any) =>
          Alert.alert('Validation failed', e?.response?.data?.message ?? 'Could not validate the file'),
      },
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>1 · What are you importing?</Text>
        <View style={styles.chipRow}>
          {templates.map((t) => (
            <TouchableOpacity
              key={t.type}
              style={[styles.chip, type === t.type && styles.chipActive]}
              onPress={() => { setType(t.type); setFile(null); }}
            >
              <Text style={[styles.chipText, type === t.type && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selected && <Text style={styles.hint}>{selected.description}</Text>}
      </Card>

      {selected && (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>2 · Download the template</Text>
            <Text style={styles.hint}>
              Columns marked * are required. Fill data from row 3 onward, then upload it back.
            </Text>
            <View style={styles.colList}>
              {selected.columns.map((c) => (
                <Text key={c.key} style={styles.colItem}>
                  • <Text style={styles.colKey}>{c.key}{c.required ? ' *' : ''}</Text> — {c.hint}
                </Text>
              ))}
            </View>
            <Button title="Download .xlsx template" variant="secondary" onPress={onDownload} loading={downloading} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>3 · Upload your filled file</Text>
            <Button title={file ? 'Choose a different file' : 'Choose file'} variant="secondary" onPress={onPick} />
            {file && <Text style={styles.fileName}>📄 {file.name}</Text>}
          </Card>

          <Button
            title="Validate (preview)"
            onPress={onValidate}
            loading={validate.isPending}
            disabled={!file}
            fullWidth
            style={styles.cta}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.white },
  colList: { gap: spacing[1] },
  colItem: { fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 18 },
  colKey: { fontWeight: fontWeights.semibold, color: colors.textSecondary },
  fileName: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  cta: { marginTop: spacing[2] },
});

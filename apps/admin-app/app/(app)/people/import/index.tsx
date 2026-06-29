import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, fontFamilies, Icon, useToast } from '@yaanam/ui';
import {
  useImportTemplates, useValidateImport, type ImportEntityType, type PickedFile,
} from '@yaanam/api-client';
import { downloadTemplate, pickSpreadsheet } from '../../../../lib/import-files';
import { useImportStore } from '../../../../store/import.store';
import { GroupCard, PillPicker, ActionButton } from '../../../../components/forms';

const HUE = colors.people;
const HUE_BG = colors.peopleBg;

export default function ImportScreen() {
  const { data: templates = [], isLoading } = useImportTemplates();
  const validate = useValidateImport();
  const toast = useToast();
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
      toast.error(e?.message ?? 'Could not download the template', 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const onPick = async () => {
    try {
      const picked = await pickSpreadsheet();
      if (picked) setFile(picked);
    } catch (e: any) {
      toast.error(e?.message ?? 'File picker error', 'Could not open file');
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
          toast.error(e?.response?.data?.message ?? 'Could not validate the file', 'Validation failed'),
      },
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }

  const typeOptions = templates.map((t) => ({ label: t.label, value: t.type }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GroupCard title="1 · What are you importing?" icon="users" hue={HUE}>
        {templates.length === 0
          ? <Text style={styles.hint}>No import templates available.</Text>
          : <PillPicker
              hue={HUE}
              value={type ?? ''}
              onChange={(v) => { setType(v as ImportEntityType); setFile(null); }}
              options={typeOptions}
            />}
        {selected ? <Text style={styles.hint}>{selected.description}</Text> : null}
      </GroupCard>

      {selected ? (
        <>
          <GroupCard title="2 · Download the template" icon="card" hue={HUE}>
            <Text style={styles.hint}>
              Columns marked * are required. Fill data from row 3 onward, then upload it back.
            </Text>
            <View style={styles.colList}>
              {selected.columns.map((c) => (
                <Text key={c.key} style={styles.colItem}>
                  <Text style={styles.colKey}>{c.key}{c.required ? ' *' : ''}</Text>
                  {' — '}{c.hint}
                </Text>
              ))}
            </View>
            <ActionButton
              title="Download .xlsx template"
              tone="outline"
              hue={HUE}
              icon="card"
              onPress={onDownload}
              loading={downloading}
              fullWidth
            />
          </GroupCard>

          <GroupCard title="3 · Upload your filled file" icon="plus" hue={HUE}>
            <ActionButton
              title={file ? 'Choose a different file' : 'Choose file'}
              tone="outline"
              hue={HUE}
              onPress={onPick}
              fullWidth
            />
            {file ? (
              <View style={styles.fileRow}>
                <View style={[styles.fileIcon, { backgroundColor: HUE_BG }]}>
                  <Icon name="check" size={14} color={HUE} />
                </View>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              </View>
            ) : null}
          </GroupCard>

          <ActionButton
            title="Validate (preview)"
            hue={HUE}
            onPress={onValidate}
            loading={validate.isPending}
            disabled={!file}
            fullWidth
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 18 },
  colList: { gap: spacing[1] },
  colItem: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.ink3, lineHeight: 18 },
  colKey: { fontFamily: fontFamilies.bodySemibold, fontWeight: fontWeights.semibold, color: colors.ink2 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  fileIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fileName: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink, fontWeight: fontWeights.medium },
});

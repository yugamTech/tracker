import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights,
  Card, Button, TextField, EmptyState, AnimatedPressable, useToast,
} from '@yaanam/ui';
import type { BellTiming } from '@yaanam/api-client';
import { useMyTenant, useUpdateMyTenant } from '@yaanam/api-client';
import { isValidTime, newRowId } from '../../../lib/settings';

/**
 * Bell Timings — the school's default daily schedule (e.g. first bell, assembly,
 * dismissal). A simple editable list persisted on the tenant (bellTimings JSON);
 * a reference schedule today, wired into trip auto-scheduling in a later phase.
 */
export default function BellTimingsScreen() {
  const { data: tenant, isLoading } = useMyTenant();
  const updateTenant = useUpdateMyTenant();
  const toast = useToast();

  const [rows, setRows] = useState<BellTiming[]>([]);

  useEffect(() => {
    if (tenant) setRows(tenant.bellTimings ?? []);
  }, [tenant]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!tenant) {
    return <View style={styles.loader}><Text style={styles.errorText}>Could not load your school</Text></View>;
  }

  const addRow = () => setRows((r) => [...r, { id: newRowId('bell'), label: '', time: '' }]);
  const removeRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));
  const patchRow = (id: string, patch: Partial<BellTiming>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const handleSave = () => {
    const cleaned = rows.map((r) => ({ ...r, label: r.label.trim(), time: r.time.trim() }));
    if (cleaned.some((r) => !r.label || !r.time)) {
      toast.error('Every bell needs a name and a time'); return;
    }
    const bad = cleaned.find((r) => !isValidTime(r.time));
    if (bad) { toast.error(`“${bad.time}” isn’t a valid 24-hour time (HH:MM)`); return; }
    // Persist sorted by time so the schedule always reads top-to-bottom.
    const sorted = [...cleaned].sort((a, b) => a.time.localeCompare(b.time));
    updateTenant.mutate(
      { bellTimings: sorted },
      {
        onSuccess: () => { toast.success('Bell timings saved'); router.back(); },
        onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to save'),
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Define your school’s default bell schedule. Times use a 24-hour clock (HH:MM).</Text>

      {rows.length === 0 ? (
        <Card shadow="sm" style={styles.emptyCard}>
          <EmptyState
            icon={<Text style={{ fontSize: 34 }}>⏰</Text>}
            title="No bells yet"
            description="Add your first bell time below."
          />
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} shadow="sm" style={styles.rowCard}>
            <View style={styles.rowTop}>
              <View style={styles.labelField}>
                <TextField
                  label="Name"
                  value={row.label}
                  onChangeText={(t) => patchRow(row.id, { label: t })}
                  placeholder="e.g. Morning assembly"
                  autoCapitalize="sentences"
                />
              </View>
              <View style={styles.timeField}>
                <TextField
                  label="Time"
                  value={row.time}
                  onChangeText={(t) => patchRow(row.id, { time: t })}
                  placeholder="08:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  error={row.time && !isValidTime(row.time) ? 'HH:MM' : undefined}
                />
              </View>
            </View>
            <AnimatedPressable scaleTo={0.96} onPress={() => removeRow(row.id)} style={styles.remove}>
              <Text style={styles.removeText}>Remove</Text>
            </AnimatedPressable>
          </Card>
        ))
      )}

      <Button title="+ Add bell" variant="outline" onPress={addRow} fullWidth />
      <Button title="Save bell timings" onPress={handleSave} loading={updateTenant.isPending} fullWidth style={styles.saveBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSizes.base, color: colors.error },

  intro: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  emptyCard: { paddingVertical: spacing[4] },

  rowCard: { gap: spacing[2] },
  rowTop: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  labelField: { flex: 1 },
  timeField: { width: 110 },
  remove: { alignSelf: 'flex-end', paddingVertical: spacing[1], paddingHorizontal: spacing[2], borderRadius: radius.md },
  removeText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.semibold },

  saveBtn: { marginTop: spacing[1] },
});

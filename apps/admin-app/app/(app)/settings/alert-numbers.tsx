import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights,
  Card, Button, TextField, EmptyState, AnimatedPressable, useToast,
} from '@yaanam/ui';
import type { AlertNumber } from '@yaanam/api-client';
import { useMyTenant, useUpdateMyTenant } from '@yaanam/api-client';
import { isValidPhone, newRowId } from '../../../lib/settings';

/**
 * Alert Numbers — the school's emergency / escalation contacts (e.g. principal,
 * transport head, local police). A simple editable list persisted on the tenant
 * (alertNumbers JSON); surfaced to staff and parents in the emergency flows.
 */
export default function AlertNumbersScreen() {
  const { data: tenant, isLoading } = useMyTenant();
  const updateTenant = useUpdateMyTenant();
  const toast = useToast();

  const [rows, setRows] = useState<AlertNumber[]>([]);

  useEffect(() => {
    if (tenant) setRows(tenant.alertNumbers ?? []);
  }, [tenant]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!tenant) {
    return <View style={styles.loader}><Text style={styles.errorText}>Could not load your school</Text></View>;
  }

  const addRow = () => setRows((r) => [...r, { id: newRowId('alert'), label: '', phone: '' }]);
  const removeRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));
  const patchRow = (id: string, patch: Partial<AlertNumber>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const handleSave = () => {
    const cleaned = rows.map((r) => ({ ...r, label: r.label.trim(), phone: r.phone.trim() }));
    if (cleaned.some((r) => !r.label || !r.phone)) {
      toast.error('Every contact needs a name and a number'); return;
    }
    const bad = cleaned.find((r) => !isValidPhone(r.phone));
    if (bad) { toast.error(`“${bad.phone}” doesn’t look like a valid phone number`); return; }
    updateTenant.mutate(
      { alertNumbers: cleaned },
      {
        onSuccess: () => { toast.success('Alert numbers saved'); router.back(); },
        onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to save'),
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Emergency contacts staff can call when something goes wrong on a route.</Text>

      {rows.length === 0 ? (
        <Card shadow="sm" style={styles.emptyCard}>
          <EmptyState
            icon={<Text style={{ fontSize: 34 }}>🚨</Text>}
            title="No alert numbers yet"
            description="Add your first emergency contact below."
          />
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} shadow="sm" style={styles.rowCard}>
            <TextField
              label="Contact name / role"
              value={row.label}
              onChangeText={(t) => patchRow(row.id, { label: t })}
              placeholder="e.g. Transport head"
              autoCapitalize="words"
            />
            <TextField
              label="Phone"
              value={row.phone}
              onChangeText={(t) => patchRow(row.id, { phone: t })}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              error={row.phone && !isValidPhone(row.phone) ? 'Enter a valid number' : undefined}
            />
            <AnimatedPressable scaleTo={0.96} onPress={() => removeRow(row.id)} style={styles.remove}>
              <Text style={styles.removeText}>Remove</Text>
            </AnimatedPressable>
          </Card>
        ))
      )}

      <Button title="+ Add contact" variant="outline" onPress={addRow} fullWidth />
      <Button title="Save alert numbers" onPress={handleSave} loading={updateTenant.isPending} fullWidth style={styles.saveBtn} />
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
  remove: { alignSelf: 'flex-end', paddingVertical: spacing[1], paddingHorizontal: spacing[2], borderRadius: radius.md },
  removeText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.semibold },

  saveBtn: { marginTop: spacing[1] },
});

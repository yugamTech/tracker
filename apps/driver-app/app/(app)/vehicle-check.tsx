import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button } from '@saarthi/ui';
import { useTodayTrips, useSubmitDailyCheck } from '@saarthi/api-client';

const CHECKS = [
  { id: 'tyres', label: 'Tyres inflated properly', icon: '🛞' },
  { id: 'lights', label: 'All lights functional', icon: '💡' },
  { id: 'brakes', label: 'Brakes working', icon: '🔴' },
  { id: 'firstaid', label: 'First aid kit present', icon: '🧰' },
  { id: 'horn', label: 'Horn working', icon: '📯' },
  { id: 'mirrors', label: 'Mirrors adjusted', icon: '🪟' },
];

export default function VehicleCheckScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');

  // The driver's assigned vehicle for today comes from their (scoped) trips.
  const { data: trips } = useTodayTrips();
  const submitCheck = useSubmitDailyCheck();

  const tripWithVehicle = (trips ?? []).find((t) => !!t.vehicleId);
  const vehicleId = tripWithVehicle?.vehicleId;
  const tripId = tripWithVehicle?.id;

  const toggle = (id: string) => setChecked((s) => ({ ...s, [id]: !s[id] }));
  const allDone = CHECKS.every((c) => checked[c.id]);

  const handleSubmit = () => {
    if (!allDone) { Alert.alert('Complete all checks first'); return; }
    if (!vehicleId) {
      Alert.alert('No vehicle assigned', 'You have no trip with an assigned vehicle today, so this check can’t be linked to a bus.');
      return;
    }
    // Persist the full checklist result (every item true/false), not just toggles.
    const items = CHECKS.reduce<Record<string, boolean>>((acc, c) => {
      acc[c.id] = !!checked[c.id];
      return acc;
    }, {});

    submitCheck.mutate(
      { vehicleId, tripId, items, note: note.trim() || undefined },
      {
        onSuccess: () => Alert.alert('Check Complete', 'Vehicle check submitted.', [{ text: 'OK', onPress: () => router.back() }]),
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to submit check'),
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Vehicle Check</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Complete daily pre-trip checklist</Text>
        {CHECKS.map((c) => (
          <TouchableOpacity key={c.id} style={styles.checkItem} onPress={() => toggle(c.id)} activeOpacity={0.8}>
            <Text style={{ fontSize: 28 }}>{c.icon}</Text>
            <Text style={styles.checkLabel}>{c.label}</Text>
            <View style={[styles.checkbox, checked[c.id] && styles.checkboxChecked]}>
              {checked[c.id] && <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Anything to flag? e.g. low tyre pressure on rear-left"
          placeholderTextColor={colors.gray400}
          multiline
        />

        {!vehicleId && (
          <Text style={styles.warn}>No trip with an assigned vehicle today — submit will be disabled.</Text>
        )}

        <Button
          title={allDone ? '✅ Submit Check' : `${Object.values(checked).filter(Boolean).length}/${CHECKS.length} Done`}
          onPress={handleSubmit}
          loading={submitCheck.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing[4] }}
          disabled={!allDone || !vehicleId}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  content: { padding: spacing[5], gap: spacing[3] },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing[2] },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  checkLabel: { flex: 1, fontSize: fontSizes.base, color: colors.textPrimary },
  checkbox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary, marginTop: spacing[2] },
  noteInput: {
    backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing[3], fontSize: fontSizes.base, color: colors.textPrimary, minHeight: 64, textAlignVertical: 'top',
  },
  warn: { fontSize: fontSizes.xs, color: colors.error, marginTop: spacing[1] },
});

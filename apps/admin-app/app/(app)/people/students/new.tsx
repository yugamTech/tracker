import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card } from '@saarthi/ui';
import { useCreateStudent, useAgeGroups, useRoutes, useStops } from '@saarthi/api-client';

export default function NewStudentScreen() {
  const [name, setName] = useState('');
  const [regId, setRegId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');

  const { data: ageGroups = [], isLoading: agLoading } = useAgeGroups();
  const { data: routes = [], isLoading: routesLoading } = useRoutes();
  const { data: stops = [], isLoading: stopsLoading } = useStops();
  const createStudent = useCreateStudent();

  const routeStops = stopId || routeId
    ? stops.filter((s) => {
        if (!routeId) return true;
        const route = routes.find((r) => r.id === routeId);
        return route?.stops?.some((rs: any) => rs.stop.id === s.id) ?? true;
      })
    : stops;

  const isLoading = agLoading || routesLoading || stopsLoading;

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Validation', 'Student name is required'); return; }
    if (!ageGroupId) { Alert.alert('Validation', 'Please select an age group'); return; }
    createStudent.mutate(
      { name: name.trim(), regId: regId.trim() || undefined, ageGroupId, routeId: routeId || undefined, stopId: stopId || undefined },
      {
        onSuccess: () => { Alert.alert('Success', 'Student added'); router.back(); },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to create student'),
      },
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Info</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Arjun Sharma"
          placeholderTextColor={colors.gray400}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Roll / Reg ID</Text>
        <TextInput
          style={styles.input}
          value={regId}
          onChangeText={setRegId}
          placeholder="Optional"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Age Group *</Text>
        <View style={styles.chipRow}>
          {ageGroups.map((ag) => (
            <TouchableOpacity
              key={ag.id}
              style={[styles.chip, ageGroupId === ag.id && styles.chipActive]}
              onPress={() => setAgeGroupId(ag.id)}
            >
              <Text style={[styles.chipText, ageGroupId === ag.id && styles.chipTextActive]}>
                {ag.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Route Assignment</Text>

        <Text style={styles.label}>Route</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !routeId && styles.chipActive]}
            onPress={() => { setRouteId(''); setStopId(''); }}
          >
            <Text style={[styles.chipText, !routeId && styles.chipTextActive]}>None</Text>
          </TouchableOpacity>
          {routes.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, routeId === r.id && styles.chipActive]}
              onPress={() => { setRouteId(r.id); setStopId(''); }}
            >
              <Text style={[styles.chipText, routeId === r.id && styles.chipTextActive]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {routeId && (
          <>
            <Text style={styles.label}>Boarding Stop</Text>
            <View style={styles.chipRow}>
              {routeStops.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, stopId === s.id && styles.chipActive]}
                  onPress={() => setStopId(s.id)}
                >
                  <Text style={[styles.chipText, stopId === s.id && styles.chipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </Card>

      <Button
        title="Add Student"
        onPress={handleSave}
        loading={createStudent.isPending}
        fullWidth
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing[1] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  input: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.white },
  saveBtn: { marginTop: spacing[2] },
});

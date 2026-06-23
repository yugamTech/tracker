import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, useToast } from '@yaanam/ui';
import { useCreateStudent, useAgeGroups, useRoutes, useStops } from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';

export default function NewStudentScreen() {
  const [name, setName] = useState('');
  const [regId, setRegId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  const { data: ageGroups = [], isLoading: agLoading } = useAgeGroups();
  const { data: routes = [], isLoading: routesLoading } = useRoutes();
  const { data: stops = [], isLoading: stopsLoading } = useStops();
  const createStudent = useCreateStudent();
  const toast = useToast();

  // Stops on the selected route; fall back to ALL tenant stops when the route has
  // none attached yet, so a boarding stop can always be picked.
  const routeStops = (() => {
    if (!routeId) return stops;
    const route = routes.find((r) => r.id === routeId);
    const onRoute = stops.filter((s) => route?.stops?.some((rs: any) => rs.stop.id === s.id));
    return onRoute.length ? onRoute : stops;
  })();

  const isLoading = agLoading || routesLoading || stopsLoading;

  const handleSave = () => {
    if (!name.trim()) { toast.error('Student name is required'); return; }
    if (!ageGroupId) { toast.error('Please select an age group'); return; }
    const phoneDigits = parentPhone.replace(/\D/g, '');
    if (phoneDigits && phoneDigits.length !== 10) {
      toast.error("Parent's mobile number must be 10 digits");
      return;
    }
    createStudent.mutate(
      {
        name: name.trim(),
        regId: regId.trim() || undefined,
        ageGroupId,
        routeId: routeId || undefined,
        stopId: stopId || undefined,
        parentName: parentName.trim() || undefined,
        parentPhone: phoneDigits || undefined,
      },
      {
        onSuccess: () => { toast.success('Student added'); goBackTo('people/students/new'); },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create student'),
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

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Parent / Guardian</Text>
        <Text style={styles.hint}>
          The parent logs in with this mobile number and sees this child. Leave blank
          to add the parent later.
        </Text>

        <Text style={styles.label}>Parent Name</Text>
        <TextInput
          style={styles.input}
          value={parentName}
          onChangeText={setParentName}
          placeholder="e.g. Priya Sharma"
          placeholderTextColor={colors.gray400}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Parent Mobile</Text>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixText}>+91</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={parentPhone}
            onChangeText={setParentPhone}
            placeholder="98765 43210"
            placeholderTextColor={colors.gray400}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
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
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  phoneRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  phonePrefix: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  phonePrefixText: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  phoneInput: { flex: 1 },
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

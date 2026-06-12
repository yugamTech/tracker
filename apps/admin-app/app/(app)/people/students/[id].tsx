import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, Avatar, Badge } from '@saarthi/ui';
import { useStudentById, useUpdateStudent, useAgeGroups, useRoutes, useStops } from '@saarthi/api-client';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: student, isLoading } = useStudentById(id);
  const { data: ageGroups = [] } = useAgeGroups();
  const { data: routes = [] } = useRoutes();
  const { data: stops = [] } = useStops();
  const updateStudent = useUpdateStudent();

  const [name, setName] = useState('');
  const [regId, setRegId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setRegId(student.regId ?? '');
      setAgeGroupId(student.ageGroupId ?? '');
      setRouteId(student.routeId ?? '');
      setStopId(student.stopId ?? '');
    }
  }, [student]);

  const routeStops = routeId
    ? stops.filter((s) => {
        const route = routes.find((r) => r.id === routeId);
        return route?.stops?.some((rs: any) => rs.stop.id === s.id) ?? true;
      })
    : stops;

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    updateStudent.mutate(
      { id, name: name.trim(), regId: regId.trim() || undefined, ageGroupId, routeId: routeId || undefined, stopId: stopId || undefined },
      {
        onSuccess: () => { Alert.alert('Saved', 'Student updated'); setEditing(false); },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Update failed'),
      },
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!student) {
    return <View style={styles.loader}><Text style={styles.errorText}>Student not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header card */}
      <Card style={styles.header}>
        <Avatar name={student.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{student.name}</Text>
          {student.regId && <Text style={styles.headerMeta}>{student.regId}</Text>}
          <Badge label={student.status} variant={student.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
        </View>
        <TouchableOpacity onPress={() => setEditing((e) => !e)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
        </TouchableOpacity>
      </Card>

      {/* Info / Edit */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          value={name}
          onChangeText={setName}
          editable={editing}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Roll / Reg ID</Text>
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          value={regId}
          onChangeText={setRegId}
          editable={editing}
          placeholder="Optional"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Age Group</Text>
        {editing ? (
          <View style={styles.chipRow}>
            {ageGroups.map((ag) => (
              <TouchableOpacity
                key={ag.id}
                style={[styles.chip, ageGroupId === ag.id && styles.chipActive]}
                onPress={() => setAgeGroupId(ag.id)}
              >
                <Text style={[styles.chipText, ageGroupId === ag.id && styles.chipTextActive]}>{ag.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.valueText}>{ageGroups.find((a) => a.id === ageGroupId)?.name ?? '—'}</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Route Assignment</Text>

        <Text style={styles.label}>Route</Text>
        {editing ? (
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
                <Text style={[styles.chipText, routeId === r.id && styles.chipTextActive]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.valueText}>{routes.find((r) => r.id === routeId)?.name ?? '—'}</Text>
        )}

        {(editing && routeId) && (
          <>
            <Text style={styles.label}>Boarding Stop</Text>
            <View style={styles.chipRow}>
              {routeStops.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, stopId === s.id && styles.chipActive]}
                  onPress={() => setStopId(s.id)}
                >
                  <Text style={[styles.chipText, stopId === s.id && styles.chipTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {!editing && (
          <Text style={styles.valueText}>
            {stops.find((s) => s.id === stopId)?.name ?? '—'}
          </Text>
        )}
      </Card>

      {editing && (
        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={updateStudent.isPending}
          fullWidth
          style={styles.saveBtn}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSizes.base, color: colors.error },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, gap: spacing[1] },
  headerName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  headerMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  editBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary },
  editBtnText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing[1] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  input: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  inputDisabled: { backgroundColor: colors.gray50, color: colors.gray500 },
  valueText: { fontSize: fontSizes.base, color: colors.textPrimary, paddingVertical: spacing[1] },
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

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, Avatar, Badge, useToast } from '@yaanam/ui';
import {
  useStudentById, useUpdateStudent, useDeactivateStudent, useReactivateStudent, useAgeGroups, useRoutes, useStops,
} from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: student, isLoading } = useStudentById(id);
  const { data: ageGroups = [] } = useAgeGroups();
  const { data: routes = [] } = useRoutes();
  const { data: stops = [] } = useStops();
  const updateStudent = useUpdateStudent();
  const deactivateStudent = useDeactivateStudent();
  const reactivateStudent = useReactivateStudent();
  const toast = useToast();

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

  // Stops on the selected route. If the route has none attached yet, fall back to
  // ALL tenant stops so a boarding stop can still be assigned (otherwise the picker
  // would be empty and the student could never get a stop).
  const routeStops = (() => {
    if (!routeId) return stops;
    const route = routes.find((r) => r.id === routeId);
    const onRoute = stops.filter((s) => route?.stops?.some((rs: any) => rs.stop.id === s.id));
    return onRoute.length ? onRoute : stops;
  })();

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    updateStudent.mutate(
      { id, name: name.trim(), regId: regId.trim() || undefined, ageGroupId, routeId: routeId || undefined, stopId: stopId || undefined },
      {
        onSuccess: () => { toast.success('Student updated'); setEditing(false); },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
      },
    );
  };

  const handleReactivate = () => {
    if (!student) return;
    Alert.alert(
      'Reactivate student',
      `${student.name} will be marked active and become eligible for new trip rosters again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: () =>
            reactivateStudent.mutate(id, {
              onSuccess: () => { toast.success('Student reactivated'); goBackTo('people/students/[id]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reactivate'),
            }),
        },
      ],
    );
  };

  const handleDeactivate = () => {
    if (!student) return;
    Alert.alert(
      'Deactivate student',
      `${student.name} will be marked inactive and dropped from new trip rosters. The record is kept (not deleted) and can be reactivated later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () =>
            deactivateStudent.mutate(id, {
              onSuccess: () => { toast.success('Student deactivated'); goBackTo('people/students/[id]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate'),
            }),
        },
      ],
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

      {/* Linked parents / guardians — tap to open the parent profile. */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Parents / Guardians ({student.guardianships?.length ?? 0})</Text>
        {!student.guardianships?.length ? (
          <Text style={styles.hint}>No parent linked. Add one from the parent's profile or when creating the student.</Text>
        ) : (
          student.guardianships.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.guardianRow}
              onPress={() => router.push(`/(app)/people/parents/${g.person.id}` as never)}
              activeOpacity={0.8}
            >
              <Avatar name={g.person.name} size={40} />
              <View style={styles.guardianInfo}>
                <Text style={styles.guardianName}>{g.person.name}</Text>
                <Text style={styles.guardianMeta}>
                  {g.relation}{g.person.phone ? ` · ${g.person.phone}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
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

      {/* Deactivate / Reactivate — soft delete only (never a hard delete). */}
      {student.status === 'ACTIVE' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.hint}>
            Deactivating drops the student from new trip rosters but preserves the record (audit / DPDP).
          </Text>
          <Button
            title="Deactivate Student"
            variant="danger"
            onPress={handleDeactivate}
            loading={deactivateStudent.isPending}
            fullWidth
          />
        </Card>
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Reactivate</Text>
          <Text style={styles.hint}>
            This student is deactivated. Reactivating returns them to the active roster.
          </Text>
          <Button
            title="Reactivate Student"
            onPress={handleReactivate}
            loading={reactivateStudent.isPending}
            fullWidth
          />
        </Card>
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
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
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
  guardianRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: colors.border,
  },
  guardianInfo: { flex: 1 },
  guardianName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  guardianMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: fontSizes.lg, color: colors.textMuted },
});

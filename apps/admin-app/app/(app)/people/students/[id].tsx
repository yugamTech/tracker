import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Badge, AnimatedPressable, Icon, useToast,
} from '@yaanam/ui';
import {
  useStudentById, useUpdateStudent, useDeactivateStudent, useReactivateStudent, useDeleteStudent, useAgeGroups, useRoutes, useStops,
} from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';
import { GroupCard, Field, FormInput, PillPicker, ActionButton, ReadValue, SeatMeter } from '../../../../components/forms';

const HUE = colors.people;

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: student, isLoading } = useStudentById(id);
  const { data: ageGroups = [] } = useAgeGroups();
  const { data: routes = [] } = useRoutes();
  const { data: stops = [] } = useStops();
  const updateStudent = useUpdateStudent();
  const deactivateStudent = useDeactivateStudent();
  const reactivateStudent = useReactivateStudent();
  const deleteStudent = useDeleteStudent();
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

  // Seat-capacity guard (fleet-integrity §1): only a MOVE onto a different route can
  // overfill — staying on the current route (the student already holds a seat) never
  // does. The backend hard-blocks regardless; this is the friendly pre-check.
  const selectedRoute = routes.find((r) => r.id === routeId);
  const movingToNewRoute = !!routeId && routeId !== student?.routeId;
  const wouldOverfill =
    !!selectedRoute &&
    selectedRoute.capacity != null &&
    movingToNewRoute &&
    (selectedRoute.seatsUsed ?? 0) >= selectedRoute.capacity;

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (wouldOverfill) {
      toast.error(`Route bus is full (${selectedRoute!.seatsUsed ?? 0}/${selectedRoute!.capacity})`);
      return;
    }
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

  const handleHardDelete = () => {
    if (!student) return;
    Alert.alert(
      'Delete student permanently',
      `${student.name} will be permanently deleted along with their parent links. This cannot be undone. Use “Deactivate” instead if you only want to remove them from rosters.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () =>
            deleteStudent.mutate(id, {
              onSuccess: () => { toast.success('Student deleted'); goBackTo('people/students/[id]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
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
    return <View style={styles.loader}><ActivityIndicator color={colors.people} /></View>;
  }

  if (!student) {
    return <View style={styles.loader}><Text style={styles.errorText}>Student not found</Text></View>;
  }

  const routeOptions = [
    { label: 'None', value: '' },
    ...routes.map((r) => {
      const full = r.capacity != null && (r.seatsUsed ?? 0) >= r.capacity && r.id !== student.routeId;
      return {
        label: `${r.name}${r.capacity != null ? ` · ${r.seatsUsed ?? 0}/${r.capacity}${full ? ' FULL' : ''}` : ''}`,
        value: r.id,
        disabled: full,
      };
    }),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Profile header */}
      <Card shadow="sm" radius={22} style={styles.header}>
        <Avatar name={student.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{student.name}</Text>
          {student.regId ? <Text style={styles.headerMeta}>{student.regId}</Text> : null}
          <Badge label={student.status} variant={student.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
        </View>
        <AnimatedPressable onPress={() => setEditing((e) => !e)} style={styles.editBtn} accessibilityRole="button">
          <Icon name={editing ? 'x' : 'edit'} size={14} color={HUE} />
          <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
        </AnimatedPressable>
      </Card>

      {/* Linked parents / guardians — tap to open the parent profile. */}
      <GroupCard title={`Parents / Guardians (${student.guardianships?.length ?? 0})`} icon="users" hue={HUE}>
        {!student.guardianships?.length ? (
          <Text style={styles.hint}>No parent linked. Add one from the parent's profile or when creating the student.</Text>
        ) : (
          student.guardianships.map((g, i) => (
            <AnimatedPressable
              key={g.id}
              scaleTo={0.99}
              style={[styles.guardianRow, i > 0 && styles.rowBorder]}
              onPress={() => router.push(`/(app)/people/parents/${g.person.id}` as never)}
              accessibilityRole="button"
            >
              <Avatar name={g.person.name} size={40} />
              <View style={styles.guardianInfo}>
                <Text style={styles.guardianName} numberOfLines={1}>{g.person.name}</Text>
                <Text style={styles.guardianMeta} numberOfLines={1}>
                  {g.relation}{g.person.phone ? ` · ${g.person.phone}` : ''}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.ink3} />
            </AnimatedPressable>
          ))
        )}
      </GroupCard>

      {/* Details */}
      <GroupCard title="Details" icon="users" hue={HUE}>
        <Field label="Full name">
          {editing
            ? <FormInput hue={HUE} value={name} onChangeText={setName} autoCapitalize="words" />
            : <ReadValue value={name} />}
        </Field>
        <Field label="Roll / Reg ID">
          {editing
            ? <FormInput hue={HUE} value={regId} onChangeText={setRegId} placeholder="Optional" autoCapitalize="characters" />
            : <ReadValue value={regId} />}
        </Field>
        <Field label="Age group">
          {editing
            ? <PillPicker hue={HUE} value={ageGroupId} onChange={setAgeGroupId} options={ageGroups.map((ag) => ({ label: ag.name, value: ag.id }))} />
            : <ReadValue value={ageGroups.find((a) => a.id === ageGroupId)?.name} />}
        </Field>
      </GroupCard>

      {/* Route assignment */}
      <GroupCard title="Route assignment" icon="route" hue={colors.route}>
        <Field label="Route">
          {editing
            ? <PillPicker hue={colors.route} value={routeId} onChange={(v) => { setRouteId(v); setStopId(''); }} options={routeOptions} />
            : <ReadValue value={routes.find((r) => r.id === routeId)?.name} />}
        </Field>

        {editing && routeId ? (
          <SeatMeter used={selectedRoute?.seatsUsed ?? 0} capacity={selectedRoute?.capacity} hue={colors.route} />
        ) : null}

        {editing && wouldOverfill ? (
          <View style={styles.capacityWarn}>
            <Icon name="alert" size={16} color={colors.warningDark} />
            <Text style={styles.capacityWarnText}>
              Route bus is full ({selectedRoute!.seatsUsed ?? 0}/{selectedRoute!.capacity}). Pick another route or
              assign a bigger bus before moving this student here.
            </Text>
          </View>
        ) : null}

        {editing && routeId ? (
          <Field label="Boarding stop">
            <PillPicker hue={colors.route} value={stopId} onChange={setStopId} options={routeStops.map((s) => ({ label: s.name, value: s.id }))} />
          </Field>
        ) : null}
        {!editing ? (
          <Field label="Boarding stop">
            <ReadValue value={stops.find((s) => s.id === stopId)?.name} />
          </Field>
        ) : null}
      </GroupCard>

      {editing ? (
        <ActionButton title="Save changes" hue={HUE} onPress={handleSave} loading={updateStudent.isPending} disabled={wouldOverfill} fullWidth />
      ) : null}

      {/* Deactivate / Reactivate — soft delete only (never a hard delete). */}
      {student.status === 'ACTIVE' ? (
        <GroupCard title="Danger zone" icon="alert" hue={colors.crit}>
          <Text style={styles.hint}>
            Deactivating drops the student from new trip rosters but preserves the record (audit / DPDP).
          </Text>
          <ActionButton title="Deactivate student" tone="danger" onPress={handleDeactivate} loading={deactivateStudent.isPending} fullWidth />
        </GroupCard>
      ) : (
        <GroupCard title="Reactivate" icon="checkc" hue={colors.ok}>
          <Text style={styles.hint}>
            This student is deactivated. Reactivating returns them to the active roster.
          </Text>
          <ActionButton title="Reactivate student" hue={colors.ok} onPress={handleReactivate} loading={reactivateStudent.isPending} fullWidth />
        </GroupCard>
      )}

      {/* Permanent hard-delete — shown only when the record has no operational
          history (DPDP erasure of a wrongly-added student); else we explain why. */}
      <GroupCard title="Delete permanently" icon="trash" hue={colors.crit}>
        {student.deletable?.canDelete ? (
          <>
            <Text style={styles.hint}>
              This student has no trip history, so they can be permanently erased. This cannot be undone — prefer “Deactivate” unless you’re removing a record added by mistake.
            </Text>
            <ActionButton title="Delete student permanently" tone="danger" icon="trash" onPress={handleHardDelete} loading={deleteStudent.isPending} fullWidth />
          </>
        ) : (
          <Text style={styles.hint}>
            {student.deletable?.reason ?? 'This student has trip history — deactivate instead of deleting.'}
          </Text>
        )}
      </GroupCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, color: colors.ink2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, minWidth: 0, gap: spacing[1], alignItems: 'flex-start' },
  headerName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  headerMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: colors.peopleBg, backgroundColor: colors.peopleBg, alignSelf: 'flex-start' },
  editBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: colors.people },

  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },

  guardianRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  guardianInfo: { flex: 1, minWidth: 0 },
  guardianName: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  guardianMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },

  capacityWarn: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.warnBg, borderRadius: 13, padding: 11,
  },
  capacityWarnText: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: 12.5, color: '#92400E', lineHeight: 17 },
});

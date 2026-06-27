import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, fontFamilies, useToast, Icon } from '@yaanam/ui';
import { useCreateStudent, useAgeGroups, useRoutes, useStops } from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';
import {
  SectionLabel, Field, FormInput, PhoneInput, PillPicker, SeatMeter, ActionButton,
} from '../../../../components/forms';

const PEOPLE = colors.people;
const ROUTE = colors.route;

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

  // Seat-capacity guard (fleet-integrity §1): a new student is created ACTIVE, so
  // assigning them to a route whose designated bus is full is blocked here (and
  // hard-blocked on the backend).
  const selectedRoute = routes.find((r) => r.id === routeId);
  const routeFull =
    !!selectedRoute && selectedRoute.capacity != null && (selectedRoute.seatsUsed ?? 0) >= selectedRoute.capacity;

  const handleSave = () => {
    if (!name.trim()) { toast.error('Student name is required'); return; }
    if (!ageGroupId) { toast.error('Please select an age group'); return; }
    if (routeFull) {
      toast.error(`Route bus is full (${selectedRoute!.seatsUsed ?? 0}/${selectedRoute!.capacity})`);
      return;
    }
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
    return <View style={styles.loader}><ActivityIndicator color={colors.people} /></View>;
  }

  const routeOptions = [
    { label: 'None', value: '' },
    ...routes.map((r) => {
      const full = r.capacity != null && (r.seatsUsed ?? 0) >= r.capacity;
      return {
        label: `${r.name}${r.capacity != null ? ` · ${r.seatsUsed ?? 0}/${r.capacity}${full ? ' FULL' : ''}` : ''}`,
        value: r.id,
        disabled: full,
      };
    }),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Child */}
      <SectionLabel spot="users" hue={PEOPLE}>Child</SectionLabel>
      <Field label="Full name" required>
        <FormInput hue={PEOPLE} value={name} onChangeText={setName} placeholder="e.g. Arjun Sharma" autoCapitalize="words" />
      </Field>
      <Field label="Roll / Reg ID">
        <FormInput hue={PEOPLE} value={regId} onChangeText={setRegId} placeholder="Optional" autoCapitalize="characters" />
      </Field>
      <Field label="Age group" required>
        <PillPicker hue={PEOPLE} value={ageGroupId} onChange={setAgeGroupId} options={ageGroups.map((ag) => ({ label: ag.name, value: ag.id }))} />
      </Field>

      {/* Route & stop */}
      <SectionLabel spot="route" hue={ROUTE} style={styles.gap}>Route &amp; stop</SectionLabel>
      <Field label="Route">
        <PillPicker hue={ROUTE} value={routeId} onChange={(v) => { setRouteId(v); setStopId(''); }} options={routeOptions} />
        {routeId ? <SeatMeter used={selectedRoute?.seatsUsed ?? 0} capacity={selectedRoute?.capacity} hue={ROUTE} /> : null}
        {routeFull ? (
          <View style={styles.warn}>
            <Icon name="alert" size={16} color={colors.warningDark} />
            <Text style={styles.warnText}>
              Route bus is full ({selectedRoute!.seatsUsed ?? 0}/{selectedRoute!.capacity}). Pick another route or
              assign a bigger bus before adding a student here.
            </Text>
          </View>
        ) : null}
      </Field>
      {routeId ? (
        <Field label="Boarding stop">
          <PillPicker hue={ROUTE} value={stopId} onChange={setStopId} options={routeStops.map((s) => ({ label: s.name, value: s.id }))} />
        </Field>
      ) : null}

      {/* Parent / guardian */}
      <SectionLabel spot="users" hue={PEOPLE} style={styles.gap}>Parent / Guardian</SectionLabel>
      <Text style={styles.hint}>
        The parent logs in with this mobile number and sees this child. Leave blank to add the parent later.
      </Text>
      <Field label="Parent name">
        <FormInput hue={PEOPLE} value={parentName} onChangeText={setParentName} placeholder="e.g. Priya Sharma" autoCapitalize="words" />
      </Field>
      <Field label="Parent mobile">
        <PhoneInput hue={PEOPLE} value={parentPhone} onChangeText={setParentPhone} />
      </Field>

      <ActionButton title="Add student" hue={PEOPLE} onPress={handleSave} loading={createStudent.isPending} disabled={routeFull} fullWidth style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gap: { marginTop: spacing[2] },
  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: 12.5, color: colors.ink3, lineHeight: 17, marginTop: -spacing[2] },
  warn: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.warnBg, borderRadius: 13, padding: 11, marginTop: 4,
  },
  warnText: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: 12.5, color: '#92400E', lineHeight: 17 },
  submit: { marginTop: spacing[2] },
});

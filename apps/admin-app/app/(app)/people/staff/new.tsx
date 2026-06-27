import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, fontFamilies, useToast } from '@yaanam/ui';
import { useCreateMember, useRoutes } from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';
import {
  SectionLabel, Field, FormInput, PhoneInput, PillPicker, ActionButton,
} from '../../../../components/forms';

const PEOPLE = colors.people;
const ROUTE = colors.route;

/** Roles an admin may provision here (PRD-01 FR-13). Mirrors the backend STAFF_ROLES. */
const ROLES = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'TRANSPORT_MANAGER', label: 'Transport Manager' },
] as const;

export default function NewStaffScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>('DRIVER');
  const [email, setEmail] = useState('');
  const [routeId, setRouteId] = useState('');

  const createMember = useCreateMember();
  const { data: routes = [] } = useRoutes();
  const toast = useToast();

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      toast.error('Mobile number must be 10 digits');
      return;
    }
    if (!role) { toast.error('Please select a role'); return; }

    createMember.mutate(
      {
        name: name.trim(),
        phone: phoneDigits,
        role,
        email: email.trim() || undefined,
        routeId: routeId || undefined,
      },
      {
        onSuccess: () => { toast.success('Staff member added'); goBackTo('people/staff/new'); },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add staff member'),
      },
    );
  };

  const routeOptions = [
    { label: 'None', value: '' },
    ...routes.map((r) => ({ label: r.name, value: r.id })),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Staff details */}
      <SectionLabel spot="users" hue={PEOPLE}>Staff details</SectionLabel>
      <Field label="Full name" required>
        <FormInput hue={PEOPLE} value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" autoCapitalize="words" />
      </Field>
      <Field label="Mobile" required hint="The staff member logs in with this number (OTP). It must match exactly.">
        <PhoneInput hue={PEOPLE} value={phone} onChangeText={setPhone} />
      </Field>
      <Field label="Email">
        <FormInput hue={PEOPLE} value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
      </Field>

      {/* Role */}
      <SectionLabel spot="users" hue={PEOPLE} style={styles.gap}>Role</SectionLabel>
      <Field>
        <PillPicker hue={PEOPLE} value={role} onChange={setRole} options={ROLES.map((r) => ({ label: r.label, value: r.value }))} />
      </Field>

      {/* Route assignment */}
      <SectionLabel spot="route" hue={ROUTE} style={styles.gap}>Route assignment</SectionLabel>
      <Text style={styles.hint}>
        Mark this staff member — typically a teacher — as riding a route so we know who's aboard in an
        emergency. The bus is the one assigned to the route.
      </Text>
      <Field>
        <PillPicker hue={ROUTE} value={routeId} onChange={setRouteId} options={routeOptions} />
      </Field>

      <ActionButton title="Add staff" hue={PEOPLE} onPress={handleSave} loading={createMember.isPending} fullWidth style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4] },
  gap: { marginTop: spacing[2] },
  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: 12.5, color: colors.ink3, lineHeight: 17, marginTop: -spacing[2] },
  submit: { marginTop: spacing[2] },
});

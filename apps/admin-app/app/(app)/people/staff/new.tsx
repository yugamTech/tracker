import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, useToast } from '@yaanam/ui';
import { useCreateMember, useRoutes } from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Staff Details</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ramesh Kumar"
          placeholderTextColor={colors.gray400}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Mobile *</Text>
        <Text style={styles.hint}>
          The staff member logs in with this number (OTP). It must match exactly.
        </Text>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixText}>+91</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={phone}
            onChangeText={setPhone}
            placeholder="98765 43210"
            placeholderTextColor={colors.gray400}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Optional"
          placeholderTextColor={colors.gray400}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Role *</Text>
        <View style={styles.chipRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.chip, role === r.value && styles.chipActive]}
              onPress={() => setRole(r.value)}
            >
              <Text style={[styles.chipText, role === r.value && styles.chipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Route Assignment</Text>
        <Text style={styles.hint}>
          Mark this staff member — typically a teacher — as riding a route so we know
          who's aboard in an emergency. The bus is the one assigned to the route.
        </Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !routeId && styles.chipActive]}
            onPress={() => setRouteId('')}
          >
            <Text style={[styles.chipText, !routeId && styles.chipTextActive]}>None</Text>
          </TouchableOpacity>
          {routes.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, routeId === r.id && styles.chipActive]}
              onPress={() => setRouteId(r.id)}
            >
              <Text style={[styles.chipText, routeId === r.id && styles.chipTextActive]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Button
        title="Add Staff"
        onPress={handleSave}
        loading={createMember.isPending}
        fullWidth
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing[1] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18, marginTop: -spacing[1] },
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

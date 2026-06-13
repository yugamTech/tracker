import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card } from '@saarthi/ui';
import { useCreateMember } from '@saarthi/api-client';

/** Roles an admin may provision here (PRD-01 FR-13). Mirrors the backend STAFF_ROLES. */
const ROLES = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'TRANSPORT_MANAGER', label: 'Transport Manager' },
] as const;

export default function NewStaffScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>('DRIVER');
  const [email, setEmail] = useState('');

  const createMember = useCreateMember();

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      Alert.alert('Validation', 'Mobile number must be 10 digits');
      return;
    }
    if (!role) { Alert.alert('Validation', 'Please select a role'); return; }

    createMember.mutate(
      {
        name: name.trim(),
        phone: phoneDigits,
        role,
        email: email.trim() || undefined,
      },
      {
        onSuccess: () => { Alert.alert('Success', 'Staff member added'); router.back(); },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to add staff member'),
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

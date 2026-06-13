import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Avatar, Badge, Button } from '@saarthi/ui';
import { useMemberById, useUpdateMember, useDeactivateMember } from '@saarthi/api-client';

/** Roles an admin may assign here (PRD-01 FR-13). Mirrors the backend STAFF_ROLES. */
const ROLES = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'TRANSPORT_MANAGER', label: 'Transport Manager' },
] as const;

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: member, isLoading } = useMemberById(id);
  const updateMember = useUpdateMember();
  const deactivateMember = useDeactivateMember();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');

  // Hydrate the form once the member loads.
  useEffect(() => {
    if (member) {
      setName(member.person.name);
      setEmail(member.person.email ?? '');
      setRole(member.role);
    }
  }, [member]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!member) {
    return <View style={styles.loader}><Text style={styles.errorText}>Staff member not found</Text></View>;
  }

  const isActive = member.status === 'ACTIVE';

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    updateMember.mutate(
      { id, name: name.trim(), email: email.trim() || undefined, role },
      {
        onSuccess: () => Alert.alert('Saved', 'Staff member updated'),
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update'),
      },
    );
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate staff member',
      `${member.person.name} will lose access to this school. Their account is kept (not deleted) and can be re-added later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () =>
            deactivateMember.mutate(id, {
              onSuccess: () => { Alert.alert('Done', 'Staff member deactivated'); router.back(); },
              onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to deactivate'),
            }),
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Profile card */}
      <Card style={styles.header}>
        <Avatar name={member.person.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{member.person.name}</Text>
          <Text style={styles.headerPhone}>{member.person.phone}</Text>
          <Badge
            label={isActive ? member.role : `${member.role} · DEACTIVATED`}
            variant={isActive ? 'active' : 'inactive'}
            size="sm"
          />
        </View>
      </Card>

      {/* Edit form */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Details</Text>
        <Text style={styles.hint}>
          Name &amp; email belong to the person's global identity (shared across schools).
          Phone is the login key and can't be changed here.
        </Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.gray400}
          autoCapitalize="words"
        />

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

        <Text style={styles.label}>Role</Text>
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

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={updateMember.isPending}
          fullWidth
          style={styles.saveBtn}
        />
      </Card>

      {/* Deactivate */}
      {isActive && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.hint}>
            Deactivating revokes access at this school but preserves the record (audit / DPDP).
          </Text>
          <Button
            title="Deactivate Staff Member"
            variant="danger"
            onPress={handleDeactivate}
            loading={deactivateMember.isPending}
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
  headerPhone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
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

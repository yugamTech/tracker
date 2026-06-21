import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PoliceVerificationStatus } from '@saarthi/types';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Avatar, Badge, Button, useToast } from '@saarthi/ui';
import {
  useMemberById,
  useUpdateMember,
  useDeactivateMember,
  useReactivateMember,
  useDriverProfile,
  useUpsertDriverProfile,
} from '@saarthi/api-client';
import { goBackTo } from '../../../../lib/nav';

/** Roles an admin may assign here (PRD-01 FR-13). Mirrors the backend STAFF_ROLES. */
const ROLES = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'TRANSPORT_MANAGER', label: 'Transport Manager' },
] as const;

const PV_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: member, isLoading } = useMemberById(id);
  const updateMember = useUpdateMember();
  const deactivateMember = useDeactivateMember();
  const reactivateMember = useReactivateMember();
  const toast = useToast();

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
    if (!name.trim()) { toast.error('Name is required'); return; }
    updateMember.mutate(
      { id, name: name.trim(), email: email.trim() || undefined, role },
      {
        onSuccess: () => toast.success('Staff member updated'),
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update'),
      },
    );
  };

  const handleReactivate = () => {
    Alert.alert(
      'Reactivate staff member',
      `${member.person.name} will regain access to this school and reappear on the active staff list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: () =>
            reactivateMember.mutate(id, {
              onSuccess: () => { toast.success('Staff member reactivated'); goBackTo('people/staff/[id]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reactivate'),
            }),
        },
      ],
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
              onSuccess: () => { toast.success('Staff member deactivated'); goBackTo('people/staff/[id]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate'),
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

      {/* Driver KYC — only meaningful for DRIVER memberships (text only, no docs). */}
      {member.role === 'DRIVER' && <DriverKycSection membershipId={id} />}

      {/* Deactivate / Reactivate — soft state only (never a hard delete). */}
      {isActive ? (
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
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Reactivate</Text>
          <Text style={styles.hint}>
            This staff member is deactivated. Reactivating restores their access at this school.
          </Text>
          <Button
            title="Reactivate Staff Member"
            onPress={handleReactivate}
            loading={reactivateMember.isPending}
            fullWidth
          />
        </Card>
      )}
    </ScrollView>
  );
}

/**
 * Driver KYC editor (text only — no document-image upload this milestone). Admin
 * may set every field incl. the police-verification outcome. Aadhaar is sensitive
 * personal data (DPDP); it is stored as plain text for staging only.
 */
function DriverKycSection({ membershipId }: { membershipId: string }) {
  const { data: profile, isLoading } = useDriverProfile(membershipId);
  const upsert = useUpsertDriverProfile();
  const toast = useToast();

  const [aadhaar, setAadhaar] = useState('');
  const [address, setAddress] = useState('');
  const [license, setLicense] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [pvStatus, setPvStatus] = useState<string>('PENDING');
  const [pvRef, setPvRef] = useState('');

  useEffect(() => {
    if (profile) {
      setAadhaar(profile.aadhaarNumber ?? '');
      setAddress(profile.address ?? '');
      setLicense(profile.licenseNumber ?? '');
      setLicenseExpiry(profile.licenseExpiry ? profile.licenseExpiry.slice(0, 10) : '');
      setPvStatus(profile.policeVerificationStatus ?? 'PENDING');
      setPvRef(profile.policeVerificationRef ?? '');
    }
  }, [profile]);

  const handleSave = () => {
    upsert.mutate(
      {
        membershipId,
        dto: {
          aadhaarNumber: aadhaar.trim() || undefined,
          address: address.trim() || undefined,
          licenseNumber: license.trim() || undefined,
          licenseExpiry: licenseExpiry.trim() || undefined,
          policeVerificationStatus: pvStatus as PoliceVerificationStatus,
          policeVerificationRef: pvRef.trim() || undefined,
        },
      },
      {
        onSuccess: () => toast.success('Driver KYC updated'),
        onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to save KYC'),
      },
    );
  };

  if (isLoading) {
    return (
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Driver KYC</Text>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Driver KYC</Text>
      <Text style={styles.hint}>
        Identity &amp; verification details (text only). Aadhaar is sensitive personal
        data — stored for staging only.
      </Text>

      <Text style={styles.label}>Aadhaar Number</Text>
      <TextInput
        style={styles.input}
        value={aadhaar}
        onChangeText={setAadhaar}
        placeholder="XXXX XXXX XXXX"
        placeholderTextColor={colors.gray400}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Address</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={address}
        onChangeText={setAddress}
        placeholder="Residential address"
        placeholderTextColor={colors.gray400}
        multiline
      />

      <Text style={styles.label}>Licence Number</Text>
      <TextInput
        style={styles.input}
        value={license}
        onChangeText={setLicense}
        placeholder="DL number"
        placeholderTextColor={colors.gray400}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Licence Expiry (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={licenseExpiry}
        onChangeText={setLicenseExpiry}
        placeholder="2027-12-31"
        placeholderTextColor={colors.gray400}
      />

      <Text style={styles.label}>Police Verification</Text>
      <View style={styles.chipRow}>
        {PV_STATUSES.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.chip, pvStatus === s.value && styles.chipActive]}
            onPress={() => setPvStatus(s.value)}
          >
            <Text style={[styles.chipText, pvStatus === s.value && styles.chipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Police Verification Ref</Text>
      <TextInput
        style={styles.input}
        value={pvRef}
        onChangeText={setPvRef}
        placeholder="Reference / case number"
        placeholderTextColor={colors.gray400}
      />

      <Button
        title="Save KYC"
        onPress={handleSave}
        loading={upsert.isPending}
        fullWidth
        style={styles.saveBtn}
      />
    </Card>
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
  multiline: { minHeight: 64, textAlignVertical: 'top' },
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

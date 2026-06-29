import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { PoliceVerificationStatus } from '@yaanam/types';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Badge, Icon, useToast,
} from '@yaanam/ui';
import {
  useMemberById,
  useUpdateMember,
  useDeactivateMember,
  useReactivateMember,
  useDeleteMember,
  useDriverProfile,
  useUpsertDriverProfile,
  useRoutes,
} from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';
import { GroupCard, Field, FormInput, PillPicker, ActionButton } from '../../../../components/forms';

const HUE = colors.people;

/** Roles an admin may assign here (PRD-01 FR-13). Mirrors the backend STAFF_ROLES. */
const ROLES = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'TEACHER', label: 'Teacher' },
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
  const { data: routes = [] } = useRoutes();
  const updateMember = useUpdateMember();
  const deactivateMember = useDeactivateMember();
  const reactivateMember = useReactivateMember();
  const deleteMember = useDeleteMember();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [routeId, setRouteId] = useState('');

  // Hydrate the form once the member loads. The form manages a single route
  // assignment (RouteStaff[0]).
  useEffect(() => {
    if (member) {
      setName(member.person.name);
      setEmail(member.person.email ?? '');
      setRole(member.role);
      setRouteId(member.routeStaff?.[0]?.route.id ?? '');
    }
  }, [member]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.people} /></View>;
  }

  if (!member) {
    return <View style={styles.loader}><Text style={styles.errorText}>Staff member not found</Text></View>;
  }

  const isActive = member.status === 'ACTIVE';

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    // routeId '' clears the route assignment on the backend.
    updateMember.mutate(
      { id, name: name.trim(), email: email.trim() || undefined, role, routeId },
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

  const handleHardDelete = () => {
    Alert.alert(
      'Delete staff member permanently',
      `${member.person.name} will be permanently deleted from this school. This cannot be undone. Use “Deactivate” instead if you only want to revoke their access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () =>
            deleteMember.mutate(id, {
              onSuccess: () => { toast.success('Staff member deleted'); goBackTo('people/staff/[id]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
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

  const routeOptions = [
    { label: 'None', value: '' },
    ...routes.map((r) => ({ label: r.name, value: r.id })),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Profile header */}
      <Card shadow="sm" radius={22} style={styles.header}>
        <Avatar name={member.person.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{member.person.name}</Text>
          <View style={styles.metaRow}>
            <Icon name="phone" size={13} color={colors.ink3} />
            <Text style={styles.headerMeta}>{member.person.phone}</Text>
          </View>
          <Badge
            label={isActive ? member.role : `${member.role} · DEACTIVATED`}
            variant={isActive ? 'active' : 'inactive'}
            size="sm"
          />
        </View>
      </Card>

      {/* Edit form */}
      <GroupCard title="Edit details" icon="edit" hue={HUE}>
        <Text style={styles.hint}>
          Name &amp; email belong to the person's global identity (shared across schools).
          Phone is the login key and can't be changed here.
        </Text>

        <Field label="Full name" required>
          <FormInput hue={HUE} value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
        </Field>

        <Field label="Email">
          <FormInput hue={HUE} value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
        </Field>

        <Field label="Role">
          <PillPicker hue={HUE} value={role} onChange={setRole} options={ROLES.map((r) => ({ label: r.label, value: r.value }))} />
        </Field>

        <Field
          label="Route (rides aboard)"
          hint="Assign this staff member — typically a teacher — to a route so they show up in the emergency “who's on the bus” lookup. The bus comes from the route."
        >
          <PillPicker hue={colors.route} value={routeId} onChange={setRouteId} options={routeOptions} />
        </Field>

        <ActionButton title="Save changes" hue={HUE} onPress={handleSave} loading={updateMember.isPending} fullWidth />
      </GroupCard>

      {/* Driver KYC — only meaningful for DRIVER memberships (text only, no docs). */}
      {member.role === 'DRIVER' && <DriverKycSection membershipId={id} />}

      {/* Deactivate / Reactivate — soft state only (never a hard delete). */}
      {isActive ? (
        <GroupCard title="Danger zone" icon="alert" hue={colors.crit}>
          <Text style={styles.hint}>
            Deactivating revokes access at this school but preserves the record (audit / DPDP).
          </Text>
          <ActionButton title="Deactivate staff member" tone="danger" onPress={handleDeactivate} loading={deactivateMember.isPending} fullWidth />
        </GroupCard>
      ) : (
        <GroupCard title="Reactivate" icon="checkc" hue={colors.ok}>
          <Text style={styles.hint}>
            This staff member is deactivated. Reactivating restores their access at this school.
          </Text>
          <ActionButton title="Reactivate staff member" hue={colors.ok} onPress={handleReactivate} loading={reactivateMember.isPending} fullWidth />
        </GroupCard>
      )}

      {/* Permanent hard-delete — shown only when the staff member has no run-trip
          history (DPDP erasure of a wrongly-added record); else we explain why. */}
      <GroupCard title="Delete permanently" icon="trash" hue={colors.crit}>
        {member.deletable?.canDelete ? (
          <>
            <Text style={styles.hint}>
              This staff member has never driven or conducted a trip that ran, so they can be permanently erased. This cannot be undone — prefer “Deactivate” unless you’re removing a record added by mistake.
            </Text>
            <ActionButton title="Delete staff member permanently" tone="danger" icon="trash" onPress={handleHardDelete} loading={deleteMember.isPending} fullWidth />
          </>
        ) : (
          <Text style={styles.hint}>
            {member.deletable?.reason ?? 'This staff member has trip history — deactivate instead of deleting.'}
          </Text>
        )}
      </GroupCard>
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
      <GroupCard title="Driver KYC" icon="users" hue={HUE}>
        <ActivityIndicator color={colors.people} />
      </GroupCard>
    );
  }

  return (
    <GroupCard title="Driver KYC" icon="users" hue={HUE}>
      <Text style={styles.hint}>
        Identity &amp; verification details (text only). Aadhaar is sensitive personal
        data — stored for staging only.
      </Text>

      <Field label="Aadhaar number">
        <FormInput hue={HUE} value={aadhaar} onChangeText={setAadhaar} placeholder="XXXX XXXX XXXX" keyboardType="number-pad" />
      </Field>

      <Field label="Address">
        <FormInput hue={HUE} value={address} onChangeText={setAddress} placeholder="Residential address" multiline />
      </Field>

      <Field label="Licence number">
        <FormInput hue={HUE} value={license} onChangeText={setLicense} placeholder="DL number" autoCapitalize="characters" />
      </Field>

      <Field label="Licence expiry (YYYY-MM-DD)">
        <FormInput hue={HUE} value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="2027-12-31" />
      </Field>

      <Field label="Police verification">
        <PillPicker hue={HUE} value={pvStatus} onChange={setPvStatus} options={PV_STATUSES.map((s) => ({ label: s.label, value: s.value }))} />
      </Field>

      <Field label="Police verification ref">
        <FormInput hue={HUE} value={pvRef} onChangeText={setPvRef} placeholder="Reference / case number" />
      </Field>

      <ActionButton title="Save KYC" hue={HUE} onPress={handleSave} loading={upsert.isPending} fullWidth />
    </GroupCard>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },

  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },
});

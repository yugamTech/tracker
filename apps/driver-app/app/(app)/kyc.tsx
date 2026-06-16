import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, LoadingSpinner } from '@saarthi/ui';
import { useMyDriverProfile, useUpdateMyDriverProfile } from '@saarthi/api-client';

const PV_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#F59E0B' },
  VERIFIED: { label: 'Verified', color: '#10B981' },
  REJECTED: { label: 'Rejected', color: '#EF4444' },
};

export default function DriverKycScreen() {
  const { data: profile, isLoading } = useMyDriverProfile();
  const update = useUpdateMyDriverProfile();

  const [aadhaar, setAadhaar] = useState('');
  const [address, setAddress] = useState('');
  const [license, setLicense] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');

  useEffect(() => {
    if (profile) {
      setAadhaar(profile.aadhaarNumber ?? '');
      setAddress(profile.address ?? '');
      setLicense(profile.licenseNumber ?? '');
      setLicenseExpiry(profile.licenseExpiry ? profile.licenseExpiry.slice(0, 10) : '');
    }
  }, [profile]);

  // Police verification is set by the school admin — the driver views it read-only.
  const pv = PV_LABELS[profile?.policeVerificationStatus ?? 'PENDING'] ?? PV_LABELS.PENDING;

  const handleSave = () => {
    update.mutate(
      {
        aadhaarNumber: aadhaar.trim() || undefined,
        address: address.trim() || undefined,
        licenseNumber: license.trim() || undefined,
        licenseExpiry: licenseExpiry.trim() || undefined,
      },
      {
        onSuccess: () => Alert.alert('Saved', 'Your KYC details were updated.'),
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to save'),
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My KYC</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Police verification — admin controlled, read-only here. */}
          <View style={styles.pvCard}>
            <Text style={styles.pvLabel}>Police Verification</Text>
            <View style={[styles.pvBadge, { backgroundColor: pv.color }]}>
              <Text style={styles.pvBadgeText}>{pv.label}</Text>
            </View>
            {profile?.policeVerificationRef ? (
              <Text style={styles.pvRef}>Ref: {profile.policeVerificationRef}</Text>
            ) : null}
          </View>

          <Text style={styles.hint}>
            Keep your details up to date. Aadhaar is used for verification only.
          </Text>

          <Text style={styles.fieldLabel}>Aadhaar Number</Text>
          <TextInput
            style={styles.input}
            value={aadhaar}
            onChangeText={setAadhaar}
            placeholder="XXXX XXXX XXXX"
            placeholderTextColor={colors.gray400}
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={address}
            onChangeText={setAddress}
            placeholder="Residential address"
            placeholderTextColor={colors.gray400}
            multiline
          />

          <Text style={styles.fieldLabel}>Licence Number</Text>
          <TextInput
            style={styles.input}
            value={license}
            onChangeText={setLicense}
            placeholder="DL number"
            placeholderTextColor={colors.gray400}
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>Licence Expiry (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={licenseExpiry}
            onChangeText={setLicenseExpiry}
            placeholder="2027-12-31"
            placeholderTextColor={colors.gray400}
          />

          <Button
            title="Save"
            onPress={handleSave}
            loading={update.isPending}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[4] }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium, width: 40 },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  content: { padding: spacing[4], gap: spacing[2] },
  pvCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing[4],
    borderWidth: 1, borderColor: colors.border, gap: spacing[2], marginBottom: spacing[2],
  },
  pvLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: fontWeights.medium },
  pvBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full },
  pvBadgeText: { fontSize: fontSizes.sm, color: colors.white, fontWeight: fontWeights.bold },
  pvRef: { fontSize: fontSizes.sm, color: colors.textSecondary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing[1] },
  fieldLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary, marginTop: spacing[2] },
  input: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
});

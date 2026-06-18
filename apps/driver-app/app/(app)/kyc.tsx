import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius, letterSpacing,
  Button, Badge, Skeleton, AppHeader, ScreenContainer,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import {
  useMyDriverProfile, useUpdateMyDriverProfile,
  validateKyc, formatAadhaar, normaliseAadhaar, normaliseLicense, isValidDateString,
  type KycErrors,
} from '@saarthi/api-client';

const PV_META: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  VERIFIED: { label: 'Verified', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'error' },
};

export default function DriverKycScreen() {
  const { data: profile, isLoading } = useMyDriverProfile();
  const update = useUpdateMyDriverProfile();

  const [aadhaar, setAadhaar] = useState('');
  const [address, setAddress] = useState('');
  const [license, setLicense] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [errors, setErrors] = useState<KycErrors>({});

  useEffect(() => {
    if (profile) {
      setAadhaar(profile.aadhaarNumber ? formatAadhaar(profile.aadhaarNumber) : '');
      setAddress(profile.address ?? '');
      setLicense(profile.licenseNumber ?? '');
      setLicenseExpiry(profile.licenseExpiry ? profile.licenseExpiry.slice(0, 10) : '');
    }
  }, [profile]);

  // Police verification is set by the school admin — the driver views it read-only.
  const pv = PV_META[profile?.policeVerificationStatus ?? 'PENDING'] ?? PV_META.PENDING;

  // Reformat Aadhaar to XXXX XXXX XXXX as the driver types (once 12 digits land);
  // clear the field's error on edit so the inline message updates live.
  const onAadhaarChange = (v: string) => {
    setAadhaar(formatAadhaar(v));
    if (errors.aadhaarNumber) setErrors((e) => ({ ...e, aadhaarNumber: undefined }));
  };
  const clearError = (field: keyof KycErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSave = () => {
    const input = {
      aadhaarNumber: aadhaar.trim() || undefined,
      address: address.trim() || undefined,
      licenseNumber: license.trim() || undefined,
      licenseExpiry: licenseExpiry.trim() || undefined,
    };
    const found = validateKyc(input);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return; // Block save — inline messages tell the driver what to fix.
    }
    setErrors({});

    // Normalise to canonical storage forms before sending.
    update.mutate(
      {
        aadhaarNumber: input.aadhaarNumber ? normaliseAadhaar(input.aadhaarNumber) : undefined,
        address: input.address,
        licenseNumber: input.licenseNumber ? normaliseLicense(input.licenseNumber) : undefined,
        licenseExpiry: input.licenseExpiry,
      },
      {
        onSuccess: () => Alert.alert('Saved', 'Your KYC details were updated.'),
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to save'),
      },
    );
  };

  return (
    <ScreenContainer bg={colors.backgroundMuted}>
      <AppHeader title="My KYC" onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.content}>
          <Skeleton width="100%" height={92} radius="xl" />
          <Skeleton width="70%" height={14} style={{ marginTop: spacing[4] }} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={48} radius="lg" style={{ marginTop: spacing[4] }} />
          ))}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Police verification — admin controlled, read-only here. */}
          <View style={styles.pvCard}>
            <Text style={styles.pvLabel}>POLICE VERIFICATION</Text>
            <Badge label={pv.label} variant={pv.variant} />
            {profile?.policeVerificationRef ? (
              <Text style={styles.pvRef}>Ref: {profile.policeVerificationRef}</Text>
            ) : null}
          </View>

          <Text style={styles.hint}>
            Keep your details up to date. Aadhaar is used for verification only.
          </Text>

          <Text style={styles.fieldLabel}>Aadhaar Number</Text>
          <TextInput
            style={[styles.input, errors.aadhaarNumber && styles.inputError]}
            value={aadhaar}
            onChangeText={onAadhaarChange}
            placeholder="XXXX XXXX XXXX"
            placeholderTextColor={colors.gray400}
            keyboardType="number-pad"
            maxLength={14}
          />
          {errors.aadhaarNumber ? <Text style={styles.errorText}>{errors.aadhaarNumber}</Text> : null}

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput
            style={[styles.input, styles.multiline, errors.address && styles.inputError]}
            value={address}
            onChangeText={(v) => { setAddress(v); clearError('address'); }}
            placeholder="Residential address"
            placeholderTextColor={colors.gray400}
            multiline
          />
          {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}

          <Text style={styles.fieldLabel}>Licence Number</Text>
          <TextInput
            style={[styles.input, errors.licenseNumber && styles.inputError]}
            value={license}
            onChangeText={(v) => { setLicense(v); clearError('licenseNumber'); }}
            placeholder="MH12 20231234567"
            placeholderTextColor={colors.gray400}
            autoCapitalize="characters"
          />
          {errors.licenseNumber ? <Text style={styles.errorText}>{errors.licenseNumber}</Text> : null}

          <Text style={styles.fieldLabel}>Licence Expiry (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, errors.licenseExpiry && styles.inputError]}
            value={licenseExpiry}
            onChangeText={(v) => { setLicenseExpiry(v); clearError('licenseExpiry'); }}
            placeholder="2027-12-31"
            placeholderTextColor={colors.gray400}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          {errors.licenseExpiry ? (
            <Text style={styles.errorText}>{errors.licenseExpiry}</Text>
          ) : licenseExpiry.trim() && isValidDateString(licenseExpiry.trim()) ? (
            <Text style={styles.helperText}>Valid through {licenseExpiry.trim()}</Text>
          ) : null}

          <Button
            title="Save"
            onPress={handleSave}
            loading={update.isPending}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[5] }}
          />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[2] },
  pvCard: {
    backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing[4],
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing[2],
  },
  pvLabel: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide },
  pvRef: { fontSize: fontSizes.sm, color: colors.textSecondary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18, marginTop: spacing[2], marginBottom: spacing[1] },
  fieldLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary, marginTop: spacing[3] },
  input: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error },
  errorText: { fontSize: fontSizes.xs, color: colors.error, marginTop: spacing[1] },
  helperText: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing[1] },
});

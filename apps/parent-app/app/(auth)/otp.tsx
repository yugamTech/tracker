import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, OtpInput } from '@saarthi/ui';
import { Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { useVerifyOtp } from '@saarthi/api-client';

/** Roles this app serves — login is refused for numbers without one of these. */
const APP_ROLES = ['PARENT', 'TEACHER_RIDER'];

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  // Set when the backend reports this number IS a parent here but the membership
  // is deactivated (MEMBERSHIP_INACTIVE) — we show a dedicated re-subscribe screen
  // instead of the generic "not a parent" rejection.
  const [inactive, setInactive] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const verifyOtp = useVerifyOtp();

  const handleComplete = (code: string) => {
    setOtp(code);
  };

  const handleVerify = async () => {
    const code = otp.length === 6 ? otp : '';
    if (code.length !== 6) return;
    try {
      const result = await verifyOtp.mutateAsync({ phone: phone ?? '', otp: code, allowedRoles: APP_ROLES });
      const activeMembership = result.memberships[0];
      const memberships = result.memberships.map((m) => ({ ...m, role: m.role as any }));
      setAuth(
        result.person,
        memberships,
        {
          personId: result.person.id,
          membershipId: activeMembership.id,
          tenantId: activeMembership.tenantId,
          role: activeMembership.role as any,
        }
      );
      router.replace('/(app)/child-select' as never);
    } catch (err: any) {
      if (err?.response?.data?.error?.code === 'MEMBERSHIP_INACTIVE') {
        setInactive(true);
      } else if (err?.response?.status === 403) {
        Alert.alert(
          'Not a parent account',
          "This number isn't registered as a parent or teacher-rider. If you're a driver, please use the Yaanam Driver app, or contact your school admin.",
        );
      } else {
        Alert.alert('Could not sign in', err?.response?.data?.message ?? 'Invalid or expired OTP');
      }
    }
  };

  if (inactive) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Transport service inactive</Text>
          <Text style={styles.subtitle}>
            Your transport service is inactive — please contact your school to re-subscribe.
          </Text>
          <Button
            title="Back to login"
            onPress={() => router.replace('/(auth)/phone' as never)}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[4] }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        <View style={styles.otpWrapper}>
          <OtpInput length={6} onComplete={handleComplete} disabled={verifyOtp.isPending} />
        </View>

        <Text style={styles.hint}>
          Demo: use <Text style={{ color: colors.primary }}>123456</Text>
        </Text>

        <Button
          title={verifyOtp.isPending ? 'Verifying…' : 'Verify & Continue'}
          onPress={handleVerify}
          loading={verifyOtp.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing[4] }}
        />

        <TouchableOpacity style={styles.resend}>
          <Text style={styles.resendText}>Resend OTP in 30s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing[6] },
  back: { marginTop: spacing[8] },
  backText: { fontSize: fontSizes.base, color: colors.primary, fontWeight: fontWeights.medium },
  content: { flex: 1, justifyContent: 'center', gap: spacing[4] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 24 },
  phone: { fontWeight: fontWeights.semibold, color: colors.textPrimary },
  otpWrapper: { alignItems: 'center', paddingVertical: spacing[4] },
  hint: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
  resend: { alignItems: 'center', marginTop: spacing[2] },
  resendText: { fontSize: fontSizes.sm, color: colors.textMuted },
});

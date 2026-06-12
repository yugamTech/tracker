import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, OtpInput } from '@saarthi/ui';
import { Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { Role } from '@saarthi/types';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleComplete = async (otp: string) => {
    if (otp.length !== 6) return;
    setLoading(true);
    // TODO: replace with real authApi.verifyOtp
    setTimeout(() => {
      setLoading(false);
      // Mock response
      setAuth(
        { id: 'person-001', phone: phone ?? '', name: 'Demo Parent' },
        [{ id: 'mem-parent-001', tenantId: 'tenant-demo-001', tenantName: 'Sunrise School', role: Role.PARENT }],
        { personId: 'person-001', membershipId: 'mem-parent-001', tenantId: 'tenant-demo-001', role: Role.PARENT }
      );
      router.replace('/(app)/home');
    }, 1000);
  };

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
          <OtpInput length={6} onComplete={handleComplete} disabled={loading} />
        </View>

        <Text style={styles.hint}>
          Using bypass mode in dev — enter any 6 digits or{' '}
          <Text style={{ color: colors.primary }}>123456</Text>
        </Text>

        <Button
          title={loading ? 'Verifying…' : 'Verify & Continue'}
          onPress={() => {}}
          loading={loading}
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

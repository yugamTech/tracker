import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, OtpInput, Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { useVerifyOtp } from '@saarthi/api-client';

export default function DriverOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const verifyOtp = useVerifyOtp();

  const handleComplete = (code: string) => {
    setOtp(code);
  };

  const handleVerify = async () => {
    const code = otp.length === 6 ? otp : '';
    if (code.length !== 6) return;
    try {
      const result = await verifyOtp.mutateAsync({ phone: phone ?? '', otp: code });
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
      if (result.memberships.length > 1) {
        router.replace('/(auth)/context-switch' as never);
      } else {
        router.replace('/(app)/home');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Invalid OTP');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Sent to {phone}</Text>
        <View style={styles.otpWrapper}>
          <OtpInput length={6} onComplete={handleComplete} disabled={verifyOtp.isPending} />
        </View>
        <Text style={styles.hint}>Demo: use <Text style={{ color: '#0EA5E9' }}>123456</Text></Text>
        <Button
          title={verifyOtp.isPending ? 'Verifying…' : 'Verify'}
          onPress={handleVerify}
          loading={verifyOtp.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing[4] }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing[6] },
  back: { marginTop: spacing[8] },
  backText: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium },
  content: { flex: 1, justifyContent: 'center', gap: spacing[4] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary },
  otpWrapper: { alignItems: 'center', paddingVertical: spacing[4] },
  hint: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, OtpInput, Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { Role } from '@saarthi/types';

export default function AdminOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleComplete = (_otp: string) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAuth(
        { id: 'person-admin', phone: phone ?? '', name: 'Priya Nair' },
        [{ id: 'mem-admin-001', tenantId: 'tenant-demo-001', tenantName: 'Sunrise School', role: Role.ADMIN }],
        { personId: 'person-admin', membershipId: 'mem-admin-001', tenantId: 'tenant-demo-001', role: Role.ADMIN }
      );
      router.replace('/(app)/dashboard');
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Admin Verification</Text>
        <Text style={styles.subtitle}>Enter OTP sent to {phone}</Text>
        <View style={styles.otpWrapper}>
          <OtpInput length={6} onComplete={handleComplete} disabled={loading} />
        </View>
        <Text style={styles.hint}>Dev: any 6 digits (bypass mode)</Text>
        <Button title={loading ? 'Verifying…' : 'Verify'} onPress={() => {}} loading={loading} fullWidth size="lg" style={{ marginTop: spacing[4] }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing[6] },
  back: { marginTop: spacing[8] },
  backText: { fontSize: fontSizes.sm, color: '#7C3AED', fontWeight: fontWeights.medium },
  content: { flex: 1, justifyContent: 'center', gap: spacing[4] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary },
  otpWrapper: { alignItems: 'center', paddingVertical: spacing[4] },
  hint: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
});

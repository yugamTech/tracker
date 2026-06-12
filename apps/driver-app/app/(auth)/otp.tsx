import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, OtpInput, Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { Role } from '@saarthi/types';

export default function DriverOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleComplete = (_otp: string) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const memberships = [
        { id: 'mem-driver-001', tenantId: 'tenant-demo-001', tenantName: 'Sunrise School', role: Role.DRIVER },
        { id: 'mem-driver-002', tenantId: 'tenant-demo-002', tenantName: 'Delhi Public School', role: Role.DRIVER },
      ];
      setAuth(
        { id: 'person-driver', phone: phone ?? '', name: 'Ramesh Kumar' },
        memberships,
        { personId: 'person-driver', membershipId: memberships[0].id, tenantId: memberships[0].tenantId, role: Role.DRIVER }
      );
      router.replace('/(auth)/context-switch' as never);
    }, 1000);
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
          <OtpInput length={6} onComplete={handleComplete} disabled={loading} />
        </View>
        <Text style={styles.hint}>Dev bypass: enter any 6 digits</Text>
        <Button title={loading ? 'Verifying…' : 'Verify'} onPress={() => {}} loading={loading} fullWidth size="lg" style={{ marginTop: spacing[4] }} />
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

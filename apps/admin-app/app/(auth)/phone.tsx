import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, useToast } from '@yaanam/ui';
import { useRequestOtp } from '@yaanam/api-client';

export default function AdminPhoneScreen() {
  const [phone, setPhone] = useState('');
  const requestOtp = useRequestOtp();
  const toast = useToast();

  const handleContinue = async () => {
    if (phone.length < 10) return;
    try {
      await requestOtp.mutateAsync({ phone: `+91${phone}` });
      router.push({ pathname: '/(auth)/otp', params: { phone: `+91${phone}` } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to send OTP');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.logoBox}><Text style={{ fontSize: 36 }}>🏫</Text></View>
          <Text style={styles.title}>Admin Portal</Text>
          <Text style={styles.subtitle}>Yaanam School Management</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Admin Mobile Number</Text>
          <View style={styles.inputRow}>
            <View style={styles.prefix}><Text style={styles.prefixText}>🇮🇳 +91</Text></View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter admin number"
              placeholderTextColor={colors.gray400}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>
        </View>
        <Button title="Get OTP" onPress={handleContinue} loading={requestOtp.isPending} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  inner: { flex: 1, padding: spacing[6], justifyContent: 'center', gap: spacing[6] },
  header: { alignItems: 'center', gap: spacing[3] },
  logoBox: {
    width: 72, height: 72, borderRadius: radius.xl,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: '#7C3AED' },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary },
  form: { gap: spacing[2] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  inputRow: {
    flexDirection: 'row', borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.gray50,
  },
  prefix: { paddingHorizontal: spacing[3], justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  prefixText: { fontSize: fontSizes.base, color: colors.textPrimary },
  input: { flex: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[4], fontSize: fontSizes.lg, color: colors.textPrimary },
});

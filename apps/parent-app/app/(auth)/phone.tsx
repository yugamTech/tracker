import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, useToast } from '@saarthi/ui';
import { Button } from '@saarthi/ui';
import { useRequestOtp } from '@saarthi/api-client';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const requestOtp = useRequestOtp();
  const toast = useToast();

  const handleContinue = async () => {
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    try {
      await requestOtp.mutateAsync({ phone: `+91${phone}` });
      router.push({ pathname: '/(auth)/otp', params: { phone: `+91${phone}` } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to send OTP');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>🚌</Text>
          </View>
          <Text style={styles.title}>Yaanam</Text>
          <Text style={styles.subtitle}>Safe school transport, tracked live</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.inputRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              placeholderTextColor={colors.gray400}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>
          <Text style={styles.hint}>We'll send a 6-digit OTP to verify your number</Text>
        </View>

        <Button
          title="Get OTP"
          onPress={handleContinue}
          loading={requestOtp.isPending}
          fullWidth
          size="lg"
        />

        <Text style={styles.footer}>
          By continuing, you agree to Yaanam's Terms of Service and Privacy Policy
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  inner: {
    flex: 1,
    padding: spacing[6],
    justifyContent: 'center',
    gap: spacing[6],
  },
  header: { alignItems: 'center', gap: spacing[3] },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 40 },
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.extrabold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center' },
  form: { gap: spacing[2] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray50,
  },
  prefix: {
    paddingHorizontal: spacing[3],
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  prefixText: { fontSize: fontSizes.base, color: colors.textPrimary },
  input: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  hint: { fontSize: fontSizes.xs, color: colors.textMuted },
  footer: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
});

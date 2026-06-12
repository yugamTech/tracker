import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius } from '@saarthi/ui';
import { Button } from '@saarthi/ui';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    // TODO: call authApi.requestOtp({ phone: `+91${phone}` })
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: '/(auth)/otp', params: { phone: `+91${phone}` } });
    }, 800);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>🚌</Text>
          </View>
          <Text style={styles.title}>Saarthi</Text>
          <Text style={styles.subtitle}>Safe school transport, tracked live</Text>
        </View>

        {/* Form */}
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
          loading={loading}
          fullWidth
          size="lg"
        />

        <Text style={styles.footer}>
          By continuing, you agree to Saarthi's Terms of Service and Privacy Policy
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

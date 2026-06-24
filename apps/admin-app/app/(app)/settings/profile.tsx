import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, Avatar, useToast } from '@yaanam/ui';
import { useMe, useUpdateMe } from '@yaanam/api-client';
import { useAuthStore } from '../../../store/auth.store';

/**
 * Self-service profile editor for the signed-in admin. Name & email live on the
 * person's global identity and are editable here. Phone is the login identity —
 * shown read-only; changing it is a separate (OTP-verified) flow.
 */
export default function ProfileScreen() {
  const { data: me, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const updatePerson = useAuthStore((s) => s.updatePerson);
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (me) {
      setName(me.name ?? '');
      setEmail(me.email ?? '');
    }
  }, [me]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!me) {
    return <View style={styles.loader}><Text style={styles.errorText}>Could not load your profile</Text></View>;
  }

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    updateMe.mutate(
      { name: name.trim(), email: email.trim() || undefined },
      {
        onSuccess: (updated) => {
          // Keep the cached identity (settings header, sidebar) in sync.
          updatePerson({ name: updated.name });
          toast.success('Profile updated');
          router.back();
        },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update profile'),
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.header}>
        <Avatar name={me.name ?? 'Admin'} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{me.name}</Text>
          <Text style={styles.headerMeta}>{me.phone}</Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
        <Text style={styles.hint}>
          Your name &amp; email are part of your global identity. Phone is your login and can’t be changed here.
        </Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.gray400}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Optional"
          placeholderTextColor={colors.gray400}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone (login)</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={me.phone}
          editable={false}
        />

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={updateMe.isPending}
          fullWidth
          style={styles.saveBtn}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSizes.base, color: colors.error },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, gap: spacing[1] },
  headerName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  headerMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  input: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  inputDisabled: { backgroundColor: colors.gray50, color: colors.gray500 },
  saveBtn: { marginTop: spacing[2] },
});

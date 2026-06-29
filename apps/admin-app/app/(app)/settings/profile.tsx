import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Icon, useToast,
} from '@yaanam/ui';
import { useMe, useUpdateMe } from '@yaanam/api-client';
import { useAuthStore } from '../../../store/auth.store';
import { router } from 'expo-router';
import { GroupCard, Field, FormInput, ActionButton, ReadValue } from '../../../components/forms';

const HUE = colors.sun;

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
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
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
      <Card shadow="sm" radius={22} style={styles.header}>
        <Avatar name={me.name ?? 'Admin'} size={52} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{me.name}</Text>
          <View style={styles.phoneRow}>
            <Icon name="phone" size={14} color={colors.ink3} />
            <Text style={styles.headerMeta}>{me.phone}</Text>
          </View>
        </View>
      </Card>

      <GroupCard title="Edit profile" spot="users" hue={HUE}>
        <Text style={styles.hint}>
          Name & email are part of your global identity. Phone is your login and can't be changed here.
        </Text>
        <Field label="Full name" required>
          <FormInput hue={HUE} value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
        </Field>
        <Field label="Email">
          <FormInput hue={HUE} value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label="Phone (login)">
          <ReadValue value={me.phone} />
        </Field>
        <ActionButton title="Save changes" hue={HUE} onPress={handleSave} loading={updateMe.isPending} fullWidth />
      </GroupCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.base, color: colors.crit },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, minWidth: 0, gap: spacing[1] },
  headerName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },
  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },
});

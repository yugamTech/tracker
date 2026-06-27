import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Icon, type IconName,
} from '@yaanam/ui';
import { useAuthStore } from '../../../store/auth.store';
import { ActionButton } from '../../../components/forms';

interface InfoRow { icon: IconName; title: string; body: string; }

const INFO: InfoRow[] = [
  { icon: 'phone', title: 'Phone-based login', body: 'You sign in with a one-time code sent to your phone — there is no password to leak.' },
  { icon: 'users', title: "Your school's data stays separate", body: "Every record is scoped to your school. Staff from other schools can never see your students, routes or trips." },
  { icon: 'check', title: 'Role-based access', body: 'Drivers, teachers and parents each see only what their role allows. Admin actions are limited to admins.' },
  { icon: 'flag', title: 'Audit trail', body: 'Sensitive actions — complaint status changes, trip overrides — are recorded with who did them and when.' },
];

/**
 * Privacy & Security — a minimal, honest summary of how the app handles account
 * security and data, plus a log-out action. Kept simple deliberately (no
 * server-side "log out everywhere" exists yet); the link is real, not a dead button.
 */
export default function PrivacySecurityScreen() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert('Log out', 'Log out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/phone'); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card shadow="sm" radius={22} style={styles.card}>
        {INFO.map((row, i) => (
          <View key={row.title}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.row}>
              <View style={styles.iconChip}>
                <Icon name={row.icon} size={18} color={colors.sun} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowBody}>{row.body}</Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <Text style={styles.sessionLabel}>SESSION</Text>
      <ActionButton title="Log out of this device" tone="danger" onPress={handleLogout} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: { overflow: 'hidden', gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginHorizontal: spacing[4] },
  row: { flexDirection: 'row', gap: spacing[3], padding: spacing[4], alignItems: 'flex-start' },
  iconChip: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.sunBg, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  rowTitle: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  rowBody: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19, marginTop: 2 },
  sessionLabel: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink3, letterSpacing: 0.8 },
});

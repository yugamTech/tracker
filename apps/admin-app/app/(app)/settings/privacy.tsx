import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights,
  Card, Button, Divider,
} from '@yaanam/ui';
import { useAuthStore } from '../../../store/auth.store';

interface InfoRow { icon: string; title: string; body: string; }

const INFO: InfoRow[] = [
  { icon: '📱', title: 'Phone-based login', body: 'You sign in with a one-time code sent to your phone — there is no password to leak.' },
  { icon: '🏫', title: 'Your school’s data stays separate', body: 'Every record is scoped to your school. Staff from other schools can never see your students, routes or trips.' },
  { icon: '🔑', title: 'Role-based access', body: 'Drivers, teachers and parents each see only what their role allows. Admin actions are limited to admins.' },
  { icon: '🧾', title: 'Audit trail', body: 'Sensitive actions — complaint status changes, trip overrides — are recorded with who did them and when.' },
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
      <Card shadow="sm" padding={0} style={styles.card}>
        {INFO.map((row, i) => (
          <View key={row.title}>
            <View style={styles.row}>
              <Text style={styles.glyph}>{row.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowBody}>{row.body}</Text>
              </View>
            </View>
            {i < INFO.length - 1 ? <Divider inset={4} /> : null}
          </View>
        ))}
      </Card>

      <Text style={styles.sessionLabel}>SESSION</Text>
      <Button title="Log out of this device" variant="danger" onPress={handleLogout} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', gap: spacing[3], padding: spacing[4] },
  glyph: { fontSize: 22 },
  rowTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  rowBody: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 19, marginTop: 2 },
  sessionLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, letterSpacing: 0.8, marginTop: spacing[2] },
});

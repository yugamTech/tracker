import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Avatar, ListItem, SectionHeader, Divider, AnimatedPressable,
} from '@yaanam/ui';
import { useMyTenant } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { useAuthStore } from '../../../store/auth.store';

interface MenuItem {
  label: string;
  icon: string;
  tint: string;
  onPress?: () => void;
}

export default function SettingsScreen() {
  const { person, activeMembership, logout } = useAuthStore();
  const { data: tenant } = useMyTenant();
  const schoolName = tenant?.name ?? activeMembership?.tenantName ?? 'Your school';

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/phone'); } },
    ]);
  };

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: 'School',
      items: [
        { label: 'School Profile', icon: '🏫', tint: colors.primaryBg },
        { label: 'Bell Timings', icon: '⏰', tint: colors.warningBg },
        { label: 'Alert Numbers', icon: '🚨', tint: colors.errorBg },
        { label: 'Feature Flags', icon: '🚩', tint: colors.accentBg },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', icon: '👤', tint: colors.infoBg, onPress: () => router.push('/(app)/settings/profile' as never) },
        { label: 'Notification Config', icon: '🔔', tint: colors.primaryBg, onPress: () => router.push('/(app)/settings/notifications' as never) },
        { label: 'Privacy & Security', icon: '🔒', tint: colors.successBg },
      ],
    },
  ];

  return (
    <AdminScreen title="Settings" subtitle="School & account" maxWidth={760}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <Card shadow="sm" style={styles.identity}>
          <Avatar name={person?.name ?? 'Admin'} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.idName} numberOfLines={1}>{person?.name ?? 'Admin'}</Text>
            <Text style={styles.idMeta} numberOfLines={1}>{person?.phone ?? ''}</Text>
            <Text style={styles.idSchool} numberOfLines={1}>{schoolName}</Text>
          </View>
        </Card>

        {groups.map((group) => (
          <View key={group.title}>
            <SectionHeader title={group.title} />
            <Card shadow="sm" padding={0} style={styles.group}>
              {group.items.map((item, idx) => (
                <View key={item.label}>
                  <ListItem
                    title={item.label}
                    onPress={item.onPress ?? (() => {})}
                    left={<View style={[styles.iconChip, { backgroundColor: item.tint }]}><Text style={styles.iconGlyph}>{item.icon}</Text></View>}
                  />
                  {idx < group.items.length - 1 ? <Divider inset={4} /> : null}
                </View>
              ))}
            </Card>
          </View>
        ))}

        <AnimatedPressable scaleTo={0.98} onPress={handleLogout} style={styles.logout}>
          <Text style={styles.logoutGlyph}>⏻</Text>
          <Text style={styles.logoutText}>Log out</Text>
        </AnimatedPressable>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[8] },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  idName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  idMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  idSchool: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, marginTop: 2 },
  group: { overflow: 'hidden' },
  iconChip: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: fontSizes.lg },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    marginTop: spacing[4], paddingVertical: spacing[4],
    backgroundColor: colors.background, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  logoutGlyph: { fontSize: fontSizes.lg, color: colors.error },
  logoutText: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.error },
});

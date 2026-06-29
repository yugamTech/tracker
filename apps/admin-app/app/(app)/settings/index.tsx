import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, AnimatedPressable, Icon, type IconName,
} from '@yaanam/ui';
import { useMyTenant } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { useAuthStore } from '../../../store/auth.store';

const HUE = colors.sun;
const HUE_BG = colors.sunBg;

interface MenuItem {
  label: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
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

  const groups: { title: string; hue: string; items: MenuItem[] }[] = [
    {
      title: 'School',
      hue: HUE,
      items: [
        { label: 'School Profile', icon: 'cog', iconBg: HUE_BG, iconColor: HUE, onPress: () => router.push('/(app)/settings/school' as never) },
        { label: 'Bell Timings', icon: 'clock', iconBg: HUE_BG, iconColor: HUE, onPress: () => router.push('/(app)/settings/bell-timings' as never) },
        { label: 'Alert Numbers', icon: 'phone', iconBg: colors.critBg, iconColor: colors.crit, onPress: () => router.push('/(app)/settings/alert-numbers' as never) },
        { label: 'Feature Flags', icon: 'flag', iconBg: colors.talkBg, iconColor: colors.talk, onPress: () => router.push('/(app)/settings/feature-flags' as never) },
      ],
    },
    {
      title: 'Account',
      hue: colors.people,
      items: [
        { label: 'Profile', icon: 'users', iconBg: colors.peopleBg, iconColor: colors.people, onPress: () => router.push('/(app)/settings/profile' as never) },
        { label: 'Notification Config', icon: 'chat', iconBg: colors.talkBg, iconColor: colors.talk, onPress: () => router.push('/(app)/settings/notifications' as never) },
        { label: 'Privacy & Security', icon: 'check', iconBg: colors.okBg, iconColor: colors.ok, onPress: () => router.push('/(app)/settings/privacy' as never) },
      ],
    },
  ];

  return (
    <AdminScreen title="Settings" subtitle="School & account" maxWidth={760}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <Card shadow="sm" radius={22} style={styles.identity}>
          <Avatar name={person?.name ?? 'Admin'} size={52} />
          <View style={styles.idInfo}>
            <Text style={styles.idName} numberOfLines={1}>{person?.name ?? 'Admin'}</Text>
            <Text style={styles.idPhone} numberOfLines={1}>{person?.phone ?? ''}</Text>
            <Text style={styles.idSchool} numberOfLines={1}>{schoolName}</Text>
          </View>
        </Card>

        {groups.map((group) => (
          <View key={group.title} style={styles.groupWrap}>
            <Text style={styles.groupLabel}>{group.title.toUpperCase()}</Text>
            <Card shadow="sm" radius={22} style={styles.groupCard}>
              {group.items.map((item, idx) => (
                <View key={item.label}>
                  {idx > 0 ? <View style={styles.divider} /> : null}
                  <AnimatedPressable scaleTo={0.99} onPress={item.onPress ?? (() => {})} style={styles.menuRow} accessibilityRole="button">
                    <View style={[styles.iconChip, { backgroundColor: item.iconBg }]}>
                      <Icon name={item.icon} size={18} color={item.iconColor} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Icon name="chevron" size={16} color={colors.ink3} />
                  </AnimatedPressable>
                </View>
              ))}
            </Card>
          </View>
        ))}

        <AnimatedPressable scaleTo={0.98} onPress={handleLogout} style={styles.logout} accessibilityRole="button">
          <Icon name="power" size={18} color={colors.crit} />
          <Text style={styles.logoutText}>Log out</Text>
        </AnimatedPressable>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },

  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  idInfo: { flex: 1, minWidth: 0 },
  idName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  idPhone: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  idSchool: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: colors.sun, marginTop: 2 },

  groupWrap: { gap: spacing[2] },
  groupLabel: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink3, letterSpacing: 0.6, paddingHorizontal: spacing[1] },
  groupCard: { overflow: 'hidden', gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginHorizontal: spacing[4] },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  iconChip: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    marginTop: spacing[2], paddingVertical: spacing[4],
    backgroundColor: colors.critBg, borderRadius: 22,
  },
  logoutText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.base, fontWeight: fontWeights.extrabold, color: colors.crit },
});

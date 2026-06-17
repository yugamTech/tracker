import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  colors,
  spacing,
  radius,
  fontSizes,
  fontWeights,
  letterSpacing,
  AnimatedPressable,
  Avatar,
  Divider,
} from '@saarthi/ui';
import { useMyTenant } from '@saarthi/api-client';
import { useAuthStore } from '../store/auth.store';
import { useResponsive } from '../hooks/useResponsive';
import { NAV_GROUPS, activeKeyForPath } from '../lib/nav';

/** Friendly label for a membership role code. */
function roleLabel(role?: string): string {
  if (!role) return 'Administrator';
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * The navigation rail. Renders identically whether it is the always-on desktop
 * sidebar (`drawerType: permanent`) or the phone slide-in drawer — branding
 * header, grouped destinations with an active state, and a profile/logout
 * footer pinned to the bottom.
 */
export function Sidebar(props: Partial<DrawerContentComponentProps>) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { isPhone } = useResponsive();
  const { person, activeMembership, logout } = useAuthStore();
  const { data: tenant } = useMyTenant();

  const activeKey = activeKeyForPath(pathname);
  const schoolName = tenant?.name ?? activeMembership?.tenantName ?? 'Yaanam';

  const go = (href: string) => {
    router.navigate(href as never);
    if (isPhone) props.navigation?.closeDrawer();
  };

  const onLogout = () => {
    const doLogout = () => {
      logout();
      router.replace('/(auth)/phone');
    };
    if (isPhone) {
      Alert.alert('Log out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
      ]);
    } else {
      doLogout();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[4] }]}>
      {/* Branding header */}
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Text style={styles.logoGlyph}>Y</Text>
        </View>
        <View style={styles.brandText}>
          <Text style={styles.schoolName} numberOfLines={1}>{schoolName}</Text>
          <Text style={styles.brandSub}>Admin Console</Text>
        </View>
      </View>

      <Divider color={colors.borderSubtle} spacingY={2} />

      {/* Grouped destinations */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {NAV_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
            {group.items.map((item) => {
              const active = activeKey === item.key;
              return (
                <AnimatedPressable
                  key={item.key}
                  onPress={() => go(item.href)}
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.item, active && styles.itemActive]}
                >
                  <View style={[styles.itemAccent, active && styles.itemAccentActive]} />
                  <Text style={[styles.itemIcon, active && styles.itemTextActive]}>{item.icon}</Text>
                  <Text style={[styles.itemLabel, active && styles.itemTextActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Profile / logout footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        <Divider color={colors.borderSubtle} />
        <View style={styles.profileRow}>
          <Avatar name={person?.name ?? 'Admin'} size={38} />
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>{person?.name ?? 'Admin'}</Text>
            <Text style={styles.profileRole} numberOfLines={1}>{roleLabel(activeMembership?.role)}</Text>
          </View>
          <AnimatedPressable
            onPress={onLogout}
            scaleTo={0.92}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutGlyph}>⏻</Text>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing[3],
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[3],
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    color: colors.textInverse,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
  },
  brandText: { flex: 1 },
  schoolName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    letterSpacing: letterSpacing.tight,
  },
  brandSub: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 1,
    fontWeight: fontWeights.medium,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing[4] },
  group: { marginBottom: spacing[4] },
  groupTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    letterSpacing: letterSpacing.wider,
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[1],
    marginTop: spacing[1],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    height: 44,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    overflow: 'hidden',
  },
  itemActive: { backgroundColor: colors.primaryBg },
  itemAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  itemAccentActive: { backgroundColor: colors.primary },
  itemIcon: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    width: 20,
    textAlign: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },
  itemTextActive: { color: colors.primary, fontWeight: fontWeights.semibold },
  footer: { gap: spacing[3] },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2],
  },
  profileText: { flex: 1 },
  profileName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  profileRole: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundMuted,
  },
  logoutGlyph: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
    fontWeight: fontWeights.semibold,
  },
});

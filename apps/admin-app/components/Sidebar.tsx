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
  fontFamilies,
  letterSpacing,
  AnimatedPressable,
  Avatar,
  Divider,
  IconSplat,
  Icon,
  type SpotIconName,
  type SplatShape,
} from '@yaanam/ui';
import { useMyTenant } from '@yaanam/api-client';
import { useAuthStore } from '../store/auth.store';
import { useResponsive } from '../hooks/useResponsive';
import { NAV_GROUPS, activeKeyForPath } from '../lib/nav';

/**
 * Per-domain visual identity for the nav rail — the same hue/spot-icon language
 * as the design reference's IA grid, so each destination is learnable by colour.
 * Keyed by the nav item's stable `key`; pure presentation over the IA in `nav.ts`.
 */
const NAV_VISUALS: Record<string, { spot: SpotIconName; hue: string; bg: string; shape: SplatShape }> = {
  dashboard: { spot: 'grid', hue: colors.trip, bg: colors.tripBg, shape: 'b1' },
  fleet: { spot: 'bus', hue: colors.fleet, bg: colors.fleetBg, shape: 'b2' },
  trips: { spot: 'trip', hue: colors.trip, bg: colors.tripBg, shape: 'b3' },
  people: { spot: 'users', hue: colors.people, bg: colors.peopleBg, shape: 'b1' },
  routes: { spot: 'route', hue: colors.route, bg: colors.routeBg, shape: 'b2' },
  complaints: { spot: 'chat', hue: colors.talk, bg: colors.talkBg, shape: 'b3' },
  payments: { spot: 'card', hue: colors.pay, bg: colors.payBg, shape: 'b1' },
  settings: { spot: 'cog', hue: colors.sun, bg: colors.sunBg, shape: 'b2' },
};

const SPLAT_NEUTRAL = '#EEF1F6';

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
              const v = NAV_VISUALS[item.key];
              return (
                <AnimatedPressable
                  key={item.key}
                  onPress={() => go(item.href)}
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.item, active && { backgroundColor: v?.bg ?? colors.primaryBg }]}
                >
                  <View style={[styles.itemAccent, active && { backgroundColor: v?.hue ?? colors.primary }]} />
                  <IconSplat
                    shape={v?.shape ?? 'b1'}
                    splatColor={active ? (v?.bg ?? colors.primaryBg) : SPLAT_NEUTRAL}
                    spot={v?.spot}
                    size={34}
                  />
                  <Text
                    style={[styles.itemLabel, active && { color: v?.hue ?? colors.primary, fontFamily: fontFamilies.displayHeavy }]}
                    numberOfLines={1}
                  >
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
            <Icon name="power" size={19} color={colors.crit} />
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
    width: 42,
    height: 42,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 16,
    backgroundColor: colors.trip,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16203B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  logoGlyph: {
    fontFamily: fontFamilies.displayHeavy,
    color: colors.textInverse,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
  },
  brandText: { flex: 1 },
  schoolName: {
    fontFamily: fontFamilies.displayHeavy,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.ink,
    letterSpacing: letterSpacing.tight,
  },
  brandSub: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: fontSizes.xs,
    color: colors.ink3,
    marginTop: 1,
    fontWeight: fontWeights.medium,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing[4], paddingTop: spacing[2] },
  group: { marginBottom: spacing[4] },
  groupTitle: {
    fontFamily: fontFamilies.displayHeavy,
    fontSize: 10.5,
    fontWeight: fontWeights.extrabold,
    color: colors.ink3,
    letterSpacing: 0.8,
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[2],
    marginTop: spacing[1],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    height: 50,
    borderRadius: 16,
    paddingLeft: spacing[2],
    paddingRight: spacing[3],
    marginBottom: 3,
    overflow: 'hidden',
  },
  itemAccent: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 3.5,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
    backgroundColor: 'transparent',
  },
  itemLabel: {
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.ink2,
  },
  footer: { gap: spacing[3] },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2],
  },
  profileText: { flex: 1 },
  profileName: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.ink,
  },
  profileRole: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: fontSizes.xs,
    color: colors.ink3,
    marginTop: 1,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.critBg,
  },
});

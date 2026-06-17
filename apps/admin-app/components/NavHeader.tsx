import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { DrawerHeaderProps } from '@react-navigation/drawer';
import { colors, AppHeader } from '@saarthi/ui';
import { useResponsive } from '../hooks/useResponsive';
import { SECTION_ROUTES } from '../lib/nav';
import { MenuButton } from './MenuButton';

/**
 * The navigator-supplied header for screens that aren't primary sections —
 * detail and CRUD screens reached by a push. It renders the same AppHeader bar
 * as the section screens (one consistent app bar across the whole app) with a
 * back affordance, so these screens need no per-file header of their own.
 */
export function NavHeader({ route, options }: DrawerHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsive();
  const title = options.title ?? route.name;
  const isSection = SECTION_ROUTES.has(route.name);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/(app)/dashboard' as never);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <AppHeader
        title={title}
        onBack={isSection ? undefined : goBack}
        left={isSection && isPhone ? <MenuButton /> : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.background },
});

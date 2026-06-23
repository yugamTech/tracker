import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, radius, AnimatedPressable } from '@yaanam/ui';

/** Hamburger that opens the navigation drawer — the phone affordance for the
 *  collapsible nav (hidden on desktop where the sidebar is always present). */
export function MenuButton() {
  const navigation = useNavigation();
  return (
    <AnimatedPressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      scaleTo={0.9}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      style={styles.button}
    >
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  line: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.textPrimary },
});

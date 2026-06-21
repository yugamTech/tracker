import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Use 'bottom' when the screen is inside a drawer/header navigator that already handles top inset. Default `'all'`. */
  edges?: 'all' | 'bottom';
  /** Background color. Default `colors.background`. */
  bg?: string;
}

/**
 * Safe-area-aware screen root. `edges="all"` insets every side (standalone
 * screens); `edges="bottom"` insets only the bottom (screens under a navigator
 * header that already handles the top).
 *
 * @example
 * <ScreenContainer edges="bottom" bg={colors.backgroundMuted}>
 *   {content}
 * </ScreenContainer>
 */
export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  edges = 'all',
  bg = colors.background,
}) => {
  const insets = useSafeAreaInsets();

  if (edges === 'bottom') {
    return (
      <View style={[styles.base, { backgroundColor: bg, paddingBottom: insets.bottom }, style]}>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.base, { backgroundColor: bg }, style]}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  base: { flex: 1 },
});

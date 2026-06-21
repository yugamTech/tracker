import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Use 'bottom' when the screen is inside a drawer/header navigator that already handles top inset */
  edges?: 'all' | 'bottom';
  bg?: string;
}

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

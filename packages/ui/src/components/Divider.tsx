import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface DividerProps {
  /** Orientation. Default 'horizontal'. */
  orientation?: 'horizontal' | 'vertical';
  /** Left/right (or top/bottom) inset in spacing units. Default 0. */
  inset?: keyof typeof spacing;
  /** Spacing around the divider in spacing units. Default 0. */
  spacingY?: keyof typeof spacing;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  inset = 0,
  spacingY = 0,
  color = colors.border,
  style,
}) => {
  if (orientation === 'vertical') {
    return (
      <View
        style={[
          styles.vertical,
          { backgroundColor: color, marginVertical: spacing[inset], marginHorizontal: spacing[spacingY] },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.horizontal,
        { backgroundColor: color, marginHorizontal: spacing[inset], marginVertical: spacing[spacingY] },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    height: StyleSheet.hairlineWidth,
    width: 'auto',
  },
  vertical: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});

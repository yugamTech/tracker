import React, { forwardRef } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export interface DividerProps {
  /** Orientation. Default `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical';
  /** Left/right (or top/bottom) inset in spacing units. Default `0`. */
  inset?: keyof typeof spacing;
  /** Spacing around the divider in spacing units. Default `0`. */
  spacingY?: keyof typeof spacing;
  /** Line color. Default `colors.border`. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hairline rule for separating content, horizontally or vertically.
 *
 * @example
 * <Divider inset={4} spacingY={2} />
 */
export const Divider = forwardRef<React.ComponentRef<typeof View>, DividerProps>(
  ({ orientation = 'horizontal', inset = 0, spacingY = 0, color = colors.border, style }, ref) => {
    if (orientation === 'vertical') {
      return (
        <View
          ref={ref}
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
        ref={ref}
        style={[
          styles.horizontal,
          { backgroundColor: color, marginHorizontal: spacing[inset], marginVertical: spacing[spacingY] },
          style,
        ]}
      />
    );
  },
);

Divider.displayName = 'Divider';

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

import React, { forwardRef } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { colors } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Inner padding as a `spacing` token. Default `4` (16pt). */
  padding?: keyof typeof spacing;
  /** Elevation token. Default `'md'`. Use `'none'` for a flat, bordered surface. */
  shadow?: 'sm' | 'md' | 'lg' | 'none';
}

/**
 * Elevated content surface: rounded, hairline-bordered, with a configurable
 * shadow and padding. The base building block for grouped content.
 *
 * @example
 * <Card padding={5} shadow="sm">
 *   <Text>Trip summary</Text>
 * </Card>
 */
export const Card = forwardRef<React.ComponentRef<typeof View>, CardProps>(
  ({ children, style, padding = 4, shadow = 'md' }, ref) => {
    return (
      <View
        ref={ref}
        style={[
          styles.card,
          { padding: spacing[padding] },
          shadow !== 'none' && shadows[shadow],
          style,
        ]}
      >
        {children}
      </View>
    );
  },
);

Card.displayName = 'Card';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

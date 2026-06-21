import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';

export type BadgeVariant =
  | 'boarded'
  | 'not_boarded'
  | 'expected'
  | 'cancelled'
  | 'active'
  | 'inactive'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'default';

export interface BadgeProps {
  label: string;
  /** Semantic color. Default `'default'`. */
  variant?: BadgeVariant;
  /** Size scale. Default `'md'`. */
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  boarded:     { bg: colors.successBg, text: colors.success },
  not_boarded: { bg: colors.errorBg,   text: colors.error },
  expected:    { bg: colors.warningBg, text: colors.warning },
  cancelled:   { bg: colors.gray100,   text: colors.gray500 },
  active:      { bg: colors.successBg, text: colors.success },
  inactive:    { bg: colors.gray100,   text: colors.gray500 },
  success:     { bg: colors.successBg, text: colors.success },
  warning:     { bg: colors.warningBg, text: colors.warning },
  error:       { bg: colors.errorBg,   text: colors.error },
  info:        { bg: colors.infoBg,    text: colors.info },
  default:     { bg: colors.gray100,   text: colors.gray600 },
};

/**
 * Small pill that labels a status or category with a semantic color pair.
 * Non-interactive; the label is read out as text.
 *
 * @example
 * <Badge label="Boarded" variant="boarded" />
 * <Badge label="Inactive" variant="inactive" size="sm" />
 */
export const Badge = forwardRef<React.ComponentRef<typeof View>, BadgeProps>(
  ({ label, variant = 'default', size = 'md' }, ref) => {
    const { bg, text } = variantStyles[variant];
    return (
      <View
        ref={ref}
        style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.sm]}
        accessibilityRole="text"
        accessibilityLabel={label}
      >
        <Text style={[styles.text, { color: text }, size === 'sm' && styles.textSm]}>
          {label}
        </Text>
      </View>
    );
  },
);

Badge.displayName = 'Badge';

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: spacing[1] + 2,
    paddingVertical: 2,
  },
  text: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  textSm: {
    fontSize: fontSizes.xs,
  },
});

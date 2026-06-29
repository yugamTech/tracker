import React, { forwardRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type TextStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends TouchableOpacityProps {
  /** Button label. Also used as the default accessibility label. */
  title: string;
  /** Visual style. Default `'primary'`. */
  variant?: ButtonVariant;
  /** Padding/font scale. Default `'md'`. */
  size?: ButtonSize;
  /** Show a spinner and block presses. Default `false`. */
  loading?: boolean;
  /** Stretch to the full width of the parent. Default `false`. */
  fullWidth?: boolean;
  /** Element rendered before the title. */
  leftIcon?: React.ReactNode;
  /** Element rendered after the title. */
  rightIcon?: React.ReactNode;
  /** Override the corner radius (points). Defaults to the standard `radius.lg`. */
  radius?: number;
}

/**
 * Primary call-to-action button. Five variants, three sizes, loading + icon
 * slots. Always meets the 44pt minimum touch target and exposes a `button`
 * accessibility role (defaulting its label to `title`).
 *
 * @example
 * <Button title="Save" onPress={handleSave} loading={isSaving} fullWidth />
 * <Button title="Delete" variant="danger" size="sm" onPress={handleDelete} />
 */
export const Button = forwardRef<React.ComponentRef<typeof TouchableOpacity>, ButtonProps>(
  (
    {
      title,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      style,
      radius: radiusOverride,
      accessibilityLabel,
      ...rest
    },
    ref,
  ) => {
    const containerStyle = [
      styles.base,
      styles[`size_${size}`],
      styles[`variant_${variant}`],
      fullWidth ? styles.fullWidth : undefined,
      (disabled || loading) ? styles.disabled : undefined,
      radiusOverride != null ? { borderRadius: radiusOverride } : undefined,
      style,
    ];

    const textStyle: TextStyle[] = [
      styles.text,
      styles[`text_${size}`],
      styles[`text_${variant}`],
    ];

    return (
      <TouchableOpacity
        ref={ref}
        style={containerStyle}
        disabled={disabled || loading}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.textInverse}
          />
        ) : (
          <>
            {leftIcon}
            <Text style={textStyle}>{title}</Text>
            {rightIcon}
          </>
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.lg,
    minHeight: 44, // a11y: minimum touch target
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },

  // Sizes
  size_sm: { paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  size_md: { paddingVertical: spacing[3], paddingHorizontal: spacing[5] },
  size_lg: { paddingVertical: spacing[4], paddingHorizontal: spacing[6] },

  // Variants
  variant_primary: { backgroundColor: colors.primary, ...shadows.xs },
  variant_secondary: { backgroundColor: colors.secondary, ...shadows.xs },
  variant_outline: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  variant_ghost: { backgroundColor: 'transparent' },
  variant_danger: { backgroundColor: colors.error, ...shadows.xs },

  // Text base
  text: {
    fontFamily: fontFamilies.display,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    letterSpacing: letterSpacing.tight,
  },

  // Text sizes
  text_sm: { fontSize: fontSizes.sm },
  text_md: { fontSize: fontSizes.base },
  text_lg: { fontSize: fontSizes.lg },

  // Text variants
  text_primary: { color: colors.textInverse },
  text_secondary: { color: colors.textInverse },
  text_outline: { color: colors.primary },
  text_ghost: { color: colors.primary },
  text_danger: { color: colors.textInverse },
});

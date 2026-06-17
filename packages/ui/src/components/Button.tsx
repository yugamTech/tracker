import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...rest
}) => {
  const containerStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth ? styles.fullWidth : undefined,
    (disabled || loading) ? styles.disabled : undefined,
    style,
  ];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`text_${size}`],
    styles[`text_${variant}`],
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
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
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.lg,
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
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    letterSpacing: letterSpacing.tight,
  },

  // Text sizes
  text_sm: { fontSize: fontSizes.sm },
  text_md: { fontSize: fontSizes.base },
  text_lg: { fontSize: fontSizes.lg },

  // Text variants
  text_primary: { color: colors.white },
  text_secondary: { color: colors.white },
  text_outline: { color: colors.primary },
  text_ghost: { color: colors.primary },
  text_danger: { color: colors.white },
});

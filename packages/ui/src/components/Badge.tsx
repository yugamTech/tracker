import React from 'react';
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

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
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

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
}) => {
  const { bg, text } = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.sm]}>
      <Text style={[styles.text, { color: text }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
};

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

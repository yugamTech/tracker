import React from 'react';
import { Text, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { AnimatedPressable } from './Pressable';

interface ChipProps {
  label: string;
  /** Selected (filled) vs. unselected (outlined) styling. */
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact, pill-shaped selectable token — used for filters and quick choices.
 * Tappable when `onPress` is set; otherwise renders as a static tag.
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  leftIcon,
  size = 'md',
  disabled,
  style,
}) => {
  const content = (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.labelSm,
          selected ? styles.labelSelected : styles.labelUnselected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <AnimatedPressable onPress={onPress} disabled={disabled} scaleTo={0.94}>
      {content}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  md: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  sm: { paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unselected: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.5 },
  icon: { justifyContent: 'center' },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  labelSm: { fontSize: fontSizes.xs },
  labelSelected: { color: colors.textInverse },
  labelUnselected: { color: colors.textSecondary },
});

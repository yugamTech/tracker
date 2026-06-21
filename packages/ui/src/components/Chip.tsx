import React from 'react';
import { Text, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { AnimatedPressable } from './Pressable';

export interface ChipProps {
  label: string;
  /** Selected (filled) vs. unselected (outlined) styling. Default `false`. */
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  /** Size scale. Default `'md'`. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact, pill-shaped selectable token — used for filters and quick choices.
 * Tappable when `onPress` is set; otherwise renders as a static tag. When
 * tappable it exposes a `button` role with selected/disabled state and an
 * 8pt hitSlop so the small pill still clears the 44pt touch target.
 *
 * @example
 * <Chip label="Active" selected={filter === 'active'} onPress={() => setFilter('active')} />
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
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.94}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
    >
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

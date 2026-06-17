import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { AnimatedPressable } from './Pressable';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders a back affordance on the left when provided. */
  onBack?: () => void;
  /** Optional element pinned to the right (action button, icon, etc). */
  right?: React.ReactNode;
  /** Optional element overriding the default left (back) slot. */
  left?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Hairline bottom border. Default true. */
  bordered?: boolean;
}

export const HEADER_HEIGHT = 56;

/**
 * Consistent app bar: fixed-height row with an optional back affordance, a
 * title (+ optional subtitle), and an optional right action. Title stays
 * centered-friendly by reserving equal-width side slots.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
  right,
  left,
  style,
  bordered = true,
}) => {
  const leftSlot = left ?? (onBack ? (
    <AnimatedPressable
      onPress={onBack}
      hitSlop={8}
      style={styles.backButton}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Text style={styles.backChevron}>‹</Text>
    </AnimatedPressable>
  ) : null);

  return (
    <View style={[styles.container, bordered && styles.bordered, style]}>
      <View style={styles.side}>{leftSlot}</View>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    backgroundColor: colors.background,
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  side: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    letterSpacing: letterSpacing.tight,
  },
  subtitle: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing[1],
  },
  backChevron: {
    fontSize: 30,
    lineHeight: 30,
    color: colors.textPrimary,
    fontWeight: fontWeights.medium,
    marginTop: -2,
  },
});

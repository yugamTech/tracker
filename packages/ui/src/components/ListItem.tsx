import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { AnimatedPressable } from './Pressable';

interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Leading element — icon, Avatar, StatusDot, etc. */
  left?: React.ReactNode;
  /** Trailing element — Badge, value Text, switch, etc. Overrides the chevron. */
  right?: React.ReactNode;
  /** Show a trailing chevron (ignored when `right` is set). Default: true if onPress. */
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard row: leading slot, stacked title/subtitle, trailing slot or chevron.
 * Becomes a tappable row (with scale feedback) when `onPress` is provided.
 */
export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  left,
  right,
  showChevron,
  onPress,
  disabled,
  style,
}) => {
  const chevron = (showChevron ?? !!onPress) && !right
    ? <Text style={styles.chevron}>›</Text>
    : null;

  const content = (
    <View style={[styles.row, disabled && styles.disabled, style]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : chevron}
    </View>
  );

  if (!onPress) return content;

  return (
    <AnimatedPressable onPress={onPress} disabled={disabled} scaleTo={0.985}>
      {content}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.background,
    minHeight: 56,
  },
  disabled: {
    opacity: 0.5,
  },
  left: {
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  chevron: {
    fontSize: fontSizes['2xl'],
    lineHeight: 24,
    color: colors.textMuted,
    fontWeight: fontWeights.medium,
  },
});

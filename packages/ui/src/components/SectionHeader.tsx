import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { spacing } from '../theme/spacing';

export interface SectionHeaderProps {
  title: string;
  /** Optional muted description below the title. */
  description?: string;
  /** Optional trailing element (e.g. a "See all" link or action). */
  action?: React.ReactNode;
  /** Render the title in muted, tracked uppercase (list-section style). Default `true`. */
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Group label that sits above lists and content blocks. Defaults to a small,
 * tracked uppercase caption — the standard grouping cue across the apps. Marked
 * as an accessibility header.
 *
 * @example
 * <SectionHeader title="Today's trips" action={<Text>See all</Text>} />
 */
export const SectionHeader = forwardRef<React.ComponentRef<typeof View>, SectionHeaderProps>(
  ({ title, description, action, uppercase = true, style }, ref) => {
  return (
    <View ref={ref} style={[styles.container, style]}>
      <View style={styles.textWrap}>
        <Text
          accessibilityRole="header"
          style={[styles.title, uppercase ? styles.titleUpper : styles.titlePlain]}
        >
          {uppercase ? title.toUpperCase() : title}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
  },
);

SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: colors.textSecondary,
  },
  titleUpper: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.wider,
    color: colors.textMuted,
  },
  titlePlain: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    letterSpacing: letterSpacing.tight,
  },
  description: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing[1],
  },
  action: {
    marginLeft: spacing[3],
  },
});

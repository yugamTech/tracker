import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface SectionHeaderProps {
  title: string;
  /** Optional muted description below the title. */
  description?: string;
  /** Optional trailing element (e.g. a "See all" link or action). */
  action?: React.ReactNode;
  /** Render the title in muted, tracked uppercase (list-section style). */
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Group label that sits above lists and content blocks. Defaults to a small,
 * tracked uppercase caption — the standard grouping cue across the apps.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  uppercase = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textWrap}>
        <Text style={[styles.title, uppercase ? styles.titleUpper : styles.titlePlain]}>
          {uppercase ? title.toUpperCase() : title}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
};

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

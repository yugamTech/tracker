import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';

export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

const TONE: Record<StatTone, { color: string; chipBg: string }> = {
  neutral: { color: colors.textPrimary, chipBg: colors.gray100 },
  primary: { color: colors.primary, chipBg: colors.primaryBg },
  success: { color: colors.success, chipBg: colors.successBg },
  warning: { color: colors.warning, chipBg: colors.warningBg },
  error: { color: colors.error, chipBg: colors.errorBg },
  info: { color: colors.info, chipBg: colors.infoBg },
};

export interface StatTileProps {
  /** Caption above the value (rendered uppercase). */
  label: string;
  /** The headline metric. */
  value: string | number;
  /** Optional sub-line below the value. */
  hint?: string;
  /** Optional glyph/emoji shown in a tinted chip in the top-right. */
  icon?: string;
  /** Accent color for the value + icon chip. Default `'neutral'`. */
  tone?: StatTone;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact KPI tile: an uppercase label, a large value, an optional hint, and a
 * tinted accent chosen by `tone`. Designed to sit in a row/grid of tiles.
 *
 * @example
 * <StatTile label="Boarded" value={`${boarded}/${total}`} tone="success" icon="🚌" />
 */
export const StatTile = forwardRef<React.ComponentRef<typeof View>, StatTileProps>(
  ({ label, value, hint, icon, tone = 'neutral', style }, ref) => {
    const t = TONE[tone];
    return (
      <View
        ref={ref}
        style={[styles.stat, style]}
        accessibilityRole="text"
        accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
      >
        <View style={styles.statTop}>
          <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
          {icon ? (
            <View style={[styles.statChip, { backgroundColor: t.chipBg }]}>
              <Text style={styles.statChipGlyph}>{icon}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.statValue, { color: t.color }]}>{value}</Text>
        {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
      </View>
    );
  },
);

StatTile.displayName = 'StatTile';

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    gap: spacing[1],
    ...shadows.xs,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  statLabel: {
    flex: 1,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    letterSpacing: letterSpacing.wide,
  },
  statChip: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChipGlyph: { fontSize: fontSizes.base },
  statValue: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.extrabold,
    letterSpacing: letterSpacing.tight,
  },
  statHint: { fontSize: fontSizes.sm, color: colors.textSecondary },
});

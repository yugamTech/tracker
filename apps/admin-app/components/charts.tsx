import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSizes, fontWeights } from '@yaanam/ui';

/* ────────────────────────────────────────────────────────────────────────
 * Lightweight, dependency-free charts built from plain Views. The repo has no
 * charting library and these admin analytics need only simple bars, so we draw
 * them by hand against the design tokens. Values are real; nothing is mocked.
 * ──────────────────────────────────────────────────────────────────────── */

export interface VBar {
  key: string;
  /** Axis label under the bar (e.g. a weekday). */
  label: string;
  /** Bar value; null renders a hollow "no data" bar so the series stays continuous. */
  value: number | null;
}

interface VBarChartProps {
  bars: VBar[];
  /** Upper bound for scaling. Omit to auto-scale to the largest value (min 1). */
  max?: number;
  color?: string;
  /** Plot height in px (excludes the value/label rows). */
  height?: number;
  /** Format the printed value above each bar. Defaults to a plain number. */
  formatValue?: (v: number) => string;
}

/**
 * A row of vertical bars with a value above and a label below each. Auto-scales
 * unless `max` is given (pass max=1 for 0–1 rates). Empty/null days render a
 * faint hollow bar.
 */
export function VBarChart({ bars, max, color = colors.primary, height = 120, formatValue }: VBarChartProps) {
  const values = bars.map((b) => b.value).filter((v): v is number => v != null);
  const ceiling = max ?? Math.max(1, ...values);
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <View style={styles.vWrap}>
      {bars.map((b) => {
        const pct = b.value == null || ceiling === 0 ? 0 : Math.max(0, Math.min(1, b.value / ceiling));
        const empty = b.value == null;
        return (
          <View key={b.key} style={styles.vCol}>
            <Text style={[styles.vValue, empty && styles.vValueEmpty]} numberOfLines={1}>
              {empty ? '–' : fmt(b.value as number)}
            </Text>
            <View style={[styles.vTrack, { height }]}>
              <View
                style={[
                  styles.vFill,
                  { height: `${pct * 100}%`, backgroundColor: color },
                  empty && styles.vFillEmpty,
                ]}
              />
            </View>
            <Text style={styles.vLabel} numberOfLines={1}>{b.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  /** Optional right-aligned override for the printed value (else the count). */
  display?: string;
}

interface HBarListProps {
  items: HBarItem[];
  color?: string;
  max?: number;
  emptyText?: string;
}

/**
 * Horizontal proportional bars — one per row, label left, value right. Good for
 * "by route / by driver / by status" breakdowns. Auto-scales to the largest value.
 */
export function HBarList({ items, color = colors.primary, max, emptyText = 'No data yet' }: HBarListProps) {
  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }
  const ceiling = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <View style={styles.hWrap}>
      {items.map((it) => {
        const pct = ceiling === 0 ? 0 : Math.max(0.02, Math.min(1, it.value / ceiling));
        return (
          <View key={it.key} style={styles.hRow}>
            <Text style={styles.hLabel} numberOfLines={1}>{it.label}</Text>
            <View style={styles.hBarArea}>
              <View style={[styles.hBar, { width: `${pct * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.hValue}>{it.display ?? String(it.value)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  vWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  vCol: { flex: 1, alignItems: 'center', gap: spacing[1] },
  vValue: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  vValueEmpty: { color: colors.textMuted },
  vTrack: {
    width: '100%', backgroundColor: colors.borderSubtle, borderRadius: radius.sm,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  vFill: { width: '100%', borderRadius: radius.sm, minHeight: 2 },
  vFillEmpty: { backgroundColor: 'transparent', minHeight: 0 },
  vLabel: { fontSize: fontSizes.xs, color: colors.textMuted },

  hWrap: { gap: spacing[3] },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  hLabel: { width: 110, fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  hBarArea: { flex: 1, height: 10, backgroundColor: colors.borderSubtle, borderRadius: radius.full, overflow: 'hidden' },
  hBar: { height: '100%', borderRadius: radius.full, minWidth: 4 },
  hValue: { width: 44, textAlign: 'right', fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary },

  empty: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },
});

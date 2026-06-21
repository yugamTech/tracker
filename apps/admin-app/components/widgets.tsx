import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  colors,
  spacing,
  radius,
  fontSizes,
  fontWeights,
  letterSpacing,
  shadows,
  EmptyState,
} from '@saarthi/ui';

/* ────────────────────────────────────────────────────────────────────────
 * GridList — a FlatList that lays cards out in a responsive number of columns.
 * Ghost cells pad the final row so items keep an even width instead of
 * stretching. Pass `columns: 1` for a plain single-column list.
 * ──────────────────────────────────────────────────────────────────────── */

const GHOST = Symbol('ghost');

interface GridListProps<T> {
  data: T[];
  columns: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  gap?: number;
  ListHeaderComponent?: React.ComponentProps<typeof FlatList>['ListHeaderComponent'];
  ListEmptyComponent?: React.ComponentProps<typeof FlatList>['ListEmptyComponent'];
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function GridList<T>({
  data,
  columns,
  renderItem,
  keyExtractor,
  gap = spacing[4],
  ListHeaderComponent,
  ListEmptyComponent,
  contentContainerStyle,
}: GridListProps<T>) {
  const multi = columns > 1;
  const items: (T | typeof GHOST)[] = [...data];
  if (multi && data.length > 0) {
    const remainder = data.length % columns;
    if (remainder !== 0) {
      for (let i = 0; i < columns - remainder; i++) items.push(GHOST);
    }
  }

  return (
    <FlatList
      key={columns}
      data={items as T[]}
      numColumns={multi ? columns : 1}
      keyExtractor={(item, index) => (item === (GHOST as unknown) ? `ghost-${index}` : keyExtractor(item))}
      columnWrapperStyle={multi ? { gap } : undefined}
      contentContainerStyle={[styles.listContent, { gap }, contentContainerStyle]}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) =>
        item === (GHOST as unknown) ? (
          <View style={styles.ghost} />
        ) : (
          <View style={multi ? styles.cell : undefined}>{renderItem(item, index)}</View>
        )
      }
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * StatCard — a compact KPI tile: label, value, optional hint, tinted accent.
 * ──────────────────────────────────────────────────────────────────────── */

export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

const TONE: Record<StatTone, { color: string; chipBg: string }> = {
  neutral: { color: colors.textPrimary, chipBg: colors.gray100 },
  primary: { color: colors.primary, chipBg: colors.primaryBg },
  success: { color: colors.success, chipBg: colors.successBg },
  warning: { color: colors.warning, chipBg: colors.warningBg },
  error: { color: colors.error, chipBg: colors.errorBg },
  info: { color: colors.info, chipBg: colors.infoBg },
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
  tone?: StatTone;
  style?: StyleProp<ViewStyle>;
}

export function StatCard({ label, value, hint, icon, tone = 'neutral', style }: StatCardProps) {
  const t = TONE[tone];
  return (
    <View style={[styles.stat, style]}>
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
}

/* ────────────────────────────────────────────────────────────────────────
 * Placeholder — a centered "coming soon" state with a tinted icon chip. Shared
 * by the analytics/reconciliation screens that aren't built yet.
 * ──────────────────────────────────────────────────────────────────────── */

export function Placeholder({
  icon,
  tint = colors.primaryBg,
  title,
  description,
}: {
  icon: string;
  tint?: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.placeholder}>
      <EmptyState
        icon={<View style={[styles.placeholderIcon, { backgroundColor: tint }]}><Text style={styles.placeholderGlyph}>{icon}</Text></View>}
        title={title}
        description={description}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing[4], flexGrow: 1 },
  cell: { flex: 1 },
  ghost: { flex: 1 },

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

  placeholder: { flex: 1, justifyContent: 'center' },
  placeholderIcon: {
    width: 64, height: 64, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderGlyph: { fontSize: 30 },

  statValue: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.extrabold,
    letterSpacing: letterSpacing.tight,
  },
  statHint: { fontSize: fontSizes.sm, color: colors.textSecondary },
});

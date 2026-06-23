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
  EmptyState,
  StatTile,
  type StatTone,
} from '@yaanam/ui';

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
 * StatCard — the shared KPI tile from @yaanam/ui (StatTile), re-exported under
 * the name admin screens already import. Prefer StatTile directly in new code.
 * ──────────────────────────────────────────────────────────────────────── */

export type { StatTone };
export const StatCard = StatTile;

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

  placeholder: { flex: 1, justifyContent: 'center' },
  placeholderIcon: {
    width: 64, height: 64, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderGlyph: { fontSize: 30 },
});

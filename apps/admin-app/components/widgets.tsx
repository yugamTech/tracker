import React, { useMemo, useCallback } from 'react';
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
  /** When every row is a known fixed height, enables getItemLayout (skips measure). */
  itemHeight?: number;
  /** Opt-in: detach off-screen rows. Off by default to avoid blank-cell glitches. */
  removeClippedSubviews?: boolean;
  ListHeaderComponent?: React.ComponentProps<typeof FlatList>['ListHeaderComponent'];
  ListEmptyComponent?: React.ComponentProps<typeof FlatList>['ListEmptyComponent'];
  refreshControl?: React.ComponentProps<typeof FlatList>['refreshControl'];
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function GridList<T>({
  data,
  columns,
  renderItem,
  keyExtractor,
  gap = spacing[4],
  itemHeight,
  removeClippedSubviews,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
  contentContainerStyle,
}: GridListProps<T>) {
  const multi = columns > 1;

  // Pad the final row with ghost cells so items keep an even width. Memoised so a
  // parent re-render that doesn't touch `data` keeps the same array identity and
  // FlatList skips reconciling every row.
  const items = useMemo<(T | typeof GHOST)[]>(() => {
    const next: (T | typeof GHOST)[] = [...data];
    if (multi && data.length > 0) {
      const remainder = data.length % columns;
      if (remainder !== 0) {
        for (let i = 0; i < columns - remainder; i++) next.push(GHOST);
      }
    }
    return next;
  }, [data, columns, multi]);

  // Hoisted with stable identity so passing them to FlatList doesn't invalidate
  // its internal row memoization on every render.
  const keyExtractorInner = useCallback(
    (item: T, index: number) => (item === (GHOST as unknown) ? `ghost-${index}` : keyExtractor(item)),
    [keyExtractor],
  );

  const renderInner = useCallback(
    ({ item, index }: { item: T; index: number }) =>
      item === (GHOST as unknown) ? (
        <View style={styles.ghost} />
      ) : (
        <View style={multi ? styles.cell : undefined}>{renderItem(item, index)}</View>
      ),
    [renderItem, multi],
  );

  // Fixed-height fast path: derive each row's offset directly (grid-aware), so the
  // list can scroll to any index without measuring. Only when the caller opts in.
  const getItemLayout = useMemo(
    () =>
      itemHeight == null
        ? undefined
        : (_d: ArrayLike<T> | null | undefined, index: number) => {
            const row = multi ? Math.floor(index / columns) : index;
            return { length: itemHeight, offset: (itemHeight + gap) * row, index };
          },
    [itemHeight, multi, columns, gap],
  );

  return (
    <FlatList
      key={columns}
      data={items as T[]}
      numColumns={multi ? columns : 1}
      keyExtractor={keyExtractorInner}
      columnWrapperStyle={multi ? { gap } : undefined}
      contentContainerStyle={[styles.listContent, { gap }, contentContainerStyle]}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      getItemLayout={getItemLayout}
      removeClippedSubviews={removeClippedSubviews}
      renderItem={renderInner}
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

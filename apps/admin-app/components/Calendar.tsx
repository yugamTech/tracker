import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing, AnimatedPressable,
} from '@saarthi/ui';

/* ────────────────────────────────────────────────────────────────────────
 * Dependency-free calendar — local date helpers + a month grid. Shared by the
 * trip scheduler (single-select day view) and the "+ Schedule" form
 * (multi-select). All keys are local-time `YYYY-MM-DD` strings so they line up
 * with the backend's calendar-day semantics without any timezone math.
 * ──────────────────────────────────────────────────────────────────────── */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local-time `YYYY-MM-DD` for a Date. */
export function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** First day of the month containing `d`, at local midnight. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last day of the month containing `d`, at local midnight. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** `d` shifted by `n` whole months (negative to go back). */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Comparable month ordinal — lets us bound navigation without Date math. */
function monthOrdinal(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/** Human label for a single day key (e.g. "Wed, 17 Jun 2026"). */
export function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

interface MonthCalendarProps {
  /** Selected day keys. Single-select callers pass a one-element set. */
  selected: Set<string>;
  onSelectDay: (key: string) => void;
  /** Days that show a dot (have trips). */
  marked?: Set<string>;
  /** Earliest / latest navigable month (any date within the month). */
  minMonth: Date;
  maxMonth: Date;
  /** Month shown first. Defaults to `minMonth`. */
  initialMonth?: Date;
  /** Days strictly before this key are dimmed and unselectable. */
  minDay?: string;
  /** Key of "today" — gets a subtle ring even when not selected. */
  todayKey?: string;
}

export function MonthCalendar({
  selected,
  onSelectDay,
  marked,
  minMonth,
  maxMonth,
  initialMonth,
  minDay,
  todayKey,
}: MonthCalendarProps) {
  const [view, setView] = useState(() => startOfMonth(initialMonth ?? minMonth));

  const minOrd = monthOrdinal(minMonth);
  const maxOrd = monthOrdinal(maxMonth);
  const viewOrd = monthOrdinal(view);
  const canPrev = viewOrd > minOrd;
  const canNext = viewOrd < maxOrd;

  const weeks = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [view]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <NavButton glyph="‹" disabled={!canPrev} onPress={() => canPrev && setView(addMonths(view, -1))} />
        <Text style={styles.title}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
        <NavButton glyph="›" disabled={!canNext} onPress={() => canNext && setView(addMonths(view, 1))} />
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekLabel}>{w}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.cell} />;
            const key = ymdKey(date);
            const isSelected = selected.has(key);
            const isMarked = marked?.has(key);
            const isToday = todayKey === key;
            const disabled = !!minDay && key < minDay;
            return (
              <View key={di} style={styles.cell}>
                <AnimatedPressable
                  scaleTo={disabled ? 1 : 0.9}
                  disabled={disabled}
                  onPress={() => onSelectDay(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled }}
                  style={[
                    styles.day,
                    isToday && !isSelected && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      disabled && styles.dayTextDisabled,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  <View
                    style={[
                      styles.dot,
                      isMarked && !isSelected && styles.dotVisible,
                      isMarked && isSelected && styles.dotOnSelected,
                    ]}
                  />
                </AnimatedPressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function NavButton({ glyph, disabled, onPress }: { glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      scaleTo={disabled ? 1 : 0.9}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.nav, disabled && styles.navDisabled]}
    >
      <Text style={[styles.navGlyph, disabled && styles.navGlyphDisabled]}>{glyph}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[2],
  },
  title: {
    fontSize: fontSizes.base, fontWeight: fontWeights.bold,
    color: colors.textPrimary, letterSpacing: letterSpacing.tight,
  },
  nav: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  navDisabled: { borderColor: colors.borderSubtle, backgroundColor: 'transparent' },
  navGlyph: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, lineHeight: fontSizes.xl },
  navGlyphDisabled: { color: colors.textMuted },

  weekRow: { flexDirection: 'row' },
  weekLabel: {
    flex: 1, textAlign: 'center', paddingVertical: spacing[1],
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    color: colors.textMuted, letterSpacing: letterSpacing.wide,
  },

  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  day: {
    flex: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    gap: 3,
  },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  daySelected: { backgroundColor: colors.primary },
  dayText: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  dayTextDisabled: { color: colors.textMuted, opacity: 0.5 },
  dayTextSelected: { color: colors.textInverse, fontWeight: fontWeights.bold },

  dot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: 'transparent' },
  dotVisible: { backgroundColor: colors.primary },
  dotOnSelected: { backgroundColor: colors.textInverse },
});

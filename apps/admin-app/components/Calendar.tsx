import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing, AnimatedPressable, Sheet,
} from '@saarthi/ui';

/* ────────────────────────────────────────────────────────────────────────
 * Dependency-free calendar — local date helpers + a month grid. Shared by the
 * trip scheduler (single-select day view) and the "+ Schedule" form
 * (multi-select). All keys are local-time `YYYY-MM-DD` strings so they line up
 * with the backend's calendar-day semantics without any timezone math.
 *
 * The grid uses fixed-height rows (never `aspectRatio`), so an expanded month
 * stays compact and bounded instead of ballooning into a screen-filling square.
 * Month + year navigation: ‹ › step months and a tappable header opens a
 * month/year picker so any month — past or future — is one tap away.
 * ──────────────────────────────────────────────────────────────────────── */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** How far the picker may roam when no explicit nav bound is given (viewing). */
const DEFAULT_NAV_YEARS = 5;

/** Local-time `YYYY-MM-DD` for a Date. */
export function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A `YYYY-MM-DD` key parsed into a local-midnight Date. */
function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** First day of the month containing `d`, at local midnight. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last day of the month containing `d`, at local midnight. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** `d` shifted by `n` whole months (negative to go back), at first-of-month. */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Comparable month ordinal — lets us bound navigation without Date math. */
function monthOrdinal(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/** Human label for a single day key (e.g. "Wed, 17 Jun 2026"). */
export function formatDayLabel(key: string): string {
  const date = keyToDate(key);
  return date.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** "Month YYYY" label for a single day key (e.g. "June 2026"). */
export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** A `YYYY-MM-DD` key shifted by `n` whole days (negative to go back). */
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return ymdKey(new Date(y, m - 1, d + n));
}

/** The 7 day keys (Sunday→Saturday) of the week containing `key`. */
export function weekKeys(key: string): string[] {
  const dow = keyToDate(key).getDay();
  return Array.from({ length: 7 }, (_, i) => addDaysKey(key, i - dow));
}

interface MonthCalendarProps {
  /** Selected day keys. Single-select callers pass a one-element set. */
  selected: Set<string>;
  onSelectDay: (key: string) => void;
  /** Days that show a dot (have trips). */
  marked?: Set<string>;
  /** Key of "today" — gets a ring even when not selected. */
  todayKey: string;
  /** Days strictly before this key are dimmed and unselectable (scheduling lower bound). */
  minSelectable?: string;
  /** Days strictly after this key are dimmed and unselectable (scheduling upper bound). */
  maxSelectable?: string;
  /** Earliest navigable month (any day within it). Omit → wide window before today. */
  minMonth?: Date;
  /** Latest navigable month (any day within it). Omit → wide window after today. */
  maxMonth?: Date;
  /** Month shown first (any day within it). Defaults to earliest selected day, else today. */
  initialMonthKey?: string;
  /** Fired with the first-of-month key whenever the visible month changes (incl. mount). */
  onVisibleMonthChange?: (firstOfMonthKey: string) => void;
}

export function MonthCalendar({
  selected,
  onSelectDay,
  marked,
  todayKey,
  minSelectable,
  maxSelectable,
  minMonth,
  maxMonth,
  initialMonthKey,
  onVisibleMonthChange,
}: MonthCalendarProps) {
  const navMin = useMemo(
    () => startOfMonth(minMonth ?? addMonths(keyToDate(todayKey), -12 * DEFAULT_NAV_YEARS)),
    [minMonth, todayKey],
  );
  const navMax = useMemo(
    () => startOfMonth(maxMonth ?? addMonths(keyToDate(todayKey), 12 * DEFAULT_NAV_YEARS)),
    [maxMonth, todayKey],
  );
  const minOrd = monthOrdinal(navMin);
  const maxOrd = monthOrdinal(navMax);

  const [view, setView] = useState<Date>(() => {
    if (initialMonthKey) return startOfMonth(keyToDate(initialMonthKey));
    const first = [...selected].sort()[0];
    return startOfMonth(first ? keyToDate(first) : keyToDate(todayKey));
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const viewOrd = monthOrdinal(view);
  const canPrev = viewOrd > minOrd;
  const canNext = viewOrd < maxOrd;

  // Let the parent follow the visible month (e.g. to fetch trip dots for it).
  // Depending only on `view` keeps this from looping when a parent inlines the
  // callback — `view` is internal, so nothing the parent does re-drives it.
  useEffect(() => {
    onVisibleMonthChange?.(ymdKey(view));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const stepMonth = (delta: number) => {
    const next = addMonths(view, delta);
    const ord = monthOrdinal(next);
    if (ord < minOrd || ord > maxOrd) return;
    setView(next);
  };

  const jumpTo = (year: number, monthIdx: number) => {
    const next = new Date(year, monthIdx, 1);
    const ord = monthOrdinal(next);
    if (ord < minOrd || ord > maxOrd) return;
    setView(next);
    setPickerOpen(false);
  };

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
        <NavButton glyph="‹" disabled={!canPrev} onPress={() => stepMonth(-1)} />
        <AnimatedPressable
          scaleTo={0.96}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose month and year"
          style={styles.titleBtn}
        >
          <Text style={styles.title}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
          <Text style={styles.titleCaret}>▾</Text>
        </AnimatedPressable>
        <NavButton glyph="›" disabled={!canNext} onPress={() => stepMonth(1)} />
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
            const isToday = key === todayKey;
            const disabled =
              (!!minSelectable && key < minSelectable) || (!!maxSelectable && key > maxSelectable);
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
                      isToday && !isSelected && styles.dayTextToday,
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

      <MonthYearPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        viewYear={view.getFullYear()}
        viewMonth={view.getMonth()}
        minOrd={minOrd}
        maxOrd={maxOrd}
        onPick={jumpTo}
      />
    </View>
  );
}

/** Bottom-sheet month/year jump: a year stepper over a 12-month grid. */
function MonthYearPicker({
  visible, onClose, viewYear, viewMonth, minOrd, maxOrd, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  viewYear: number;
  viewMonth: number;
  minOrd: number;
  maxOrd: number;
  onPick: (year: number, monthIdx: number) => void;
}) {
  const [pickYear, setPickYear] = useState(viewYear);
  // Re-anchor to the visible year each time the sheet opens.
  useEffect(() => { if (visible) setPickYear(viewYear); }, [visible, viewYear]);

  const minYear = Math.floor(minOrd / 12);
  const maxYear = Math.floor(maxOrd / 12);

  return (
    <Sheet visible={visible} onClose={onClose} title="Jump to month">
      <View style={styles.pickerYearRow}>
        <NavButton glyph="‹" disabled={pickYear <= minYear} onPress={() => setPickYear((y) => Math.max(minYear, y - 1))} />
        <Text style={styles.pickerYear}>{pickYear}</Text>
        <NavButton glyph="›" disabled={pickYear >= maxYear} onPress={() => setPickYear((y) => Math.min(maxYear, y + 1))} />
      </View>
      <View style={styles.monthGrid}>
        {MONTHS_SHORT.map((label, idx) => {
          const ord = pickYear * 12 + idx;
          const disabled = ord < minOrd || ord > maxOrd;
          const isCurrent = pickYear === viewYear && idx === viewMonth;
          return (
            <AnimatedPressable
              key={idx}
              scaleTo={disabled ? 1 : 0.94}
              disabled={disabled}
              onPress={() => onPick(pickYear, idx)}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent, disabled }}
              style={[
                styles.monthChip,
                isCurrent && styles.monthChipActive,
                disabled && styles.monthChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.monthChipText,
                  isCurrent && styles.monthChipTextActive,
                  disabled && styles.monthChipTextDisabled,
                ]}
              >
                {label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </Sheet>
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
  titleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.md,
  },
  title: {
    fontSize: fontSizes.base, fontWeight: fontWeights.bold,
    color: colors.textPrimary, letterSpacing: letterSpacing.tight,
  },
  titleCaret: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
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

  // Fixed-height rows keep the grid compact and bounded — never a square balloon.
  cell: { flex: 1, height: 44, padding: 2 },
  day: {
    flex: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  daySelected: { backgroundColor: colors.primary },
  dayText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  dayTextDisabled: { color: colors.textMuted, opacity: 0.45 },
  dayTextToday: { color: colors.primary, fontWeight: fontWeights.bold },
  dayTextSelected: { color: colors.textInverse, fontWeight: fontWeights.bold },

  dot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: 'transparent' },
  dotVisible: { backgroundColor: colors.primary },
  dotOnSelected: { backgroundColor: colors.textInverse },

  // Month/year picker sheet
  pickerYearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[5],
    paddingBottom: spacing[3],
  },
  pickerYear: {
    fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary,
    letterSpacing: letterSpacing.tight, minWidth: 80, textAlign: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  monthChip: {
    width: '31%', flexGrow: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  monthChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthChipDisabled: { borderColor: colors.borderSubtle, backgroundColor: 'transparent' },
  monthChipText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  monthChipTextActive: { color: colors.textInverse },
  monthChipTextDisabled: { color: colors.textMuted, opacity: 0.5 },
});

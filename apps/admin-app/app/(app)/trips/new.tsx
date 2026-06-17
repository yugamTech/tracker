import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, LoadingSpinner } from '@saarthi/ui';
import {
  useRoutes, useVehicles, useMembers, useStudents, useCreateTrip,
  useTripById, useUpdateTrip,
} from '@saarthi/api-client';
import { MonthCalendar, ymdKey, startOfMonth, formatDayLabel } from '../../../components/Calendar';
import { useScheduleResultStore, type ScheduleDayResult } from '../../../store/schedule.store';

/** Minutes from now before which a trip can't be scheduled (small booking buffer). */
const SCHEDULE_BUFFER_MIN = 15;

/** Build a full ISO timestamp from a `YYYY-MM-DD` day key + chosen HH:MM (local). */
function isoFromKey(key: string, hour: number, minute: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

/** `from` shifted exactly one calendar month forward (the scheduling horizon). */
function oneMonthAhead(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export default function ScheduleTripScreen() {
  const { data: routes = [], isLoading: routesLoading } = useRoutes();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { data: drivers = [], isLoading: driversLoading } = useMembers('DRIVER');
  const { data: conductors = [] } = useMembers('CONDUCTOR');
  const { data: students = [] } = useStudents();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const setScheduleResult = useScheduleResultStore((s) => s.set);

  // Edit mode: `/(app)/trips/new?tripId=…` reuses this form to PATCH one trip.
  const { tripId: editTripId } = useLocalSearchParams<{ tripId?: string }>();
  const isEdit = !!editTripId;
  const { data: editingTrip, isLoading: tripLoading } = useTripById(editTripId ?? '');

  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [conductorId, setConductorId] = useState<string | undefined>(undefined);
  const [startHour, setStartHour] = useState('08');
  const [startMin, setStartMin] = useState('00');
  const [direction, setDirection] = useState<'PICKUP' | 'DROP'>('PICKUP');

  // `now` is re-anchored on every focus so the schedulable window (and the
  // form) is always fresh — the Drawer keeps this screen mounted between visits.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const minSelectableKey = useMemo(() => ymdKey(new Date(nowMs + SCHEDULE_BUFFER_MIN * 60_000)), [nowMs]);
  const maxDate = useMemo(() => oneMonthAhead(new Date(nowMs)), [nowMs]);
  const maxSelectableKey = useMemo(() => ymdKey(maxDate), [maxDate]);
  const todayKey = useMemo(() => ymdKey(new Date(nowMs)), [nowMs]);
  const minMonth = useMemo(() => startOfMonth(new Date(nowMs)), [nowMs]);
  const maxMonth = useMemo(() => startOfMonth(maxDate), [maxDate]);

  // Multi-select day picker — one trip is created per selected date.
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set([ymdKey(new Date(Date.now() + SCHEDULE_BUFFER_MIN * 60_000))]));

  // Whole-batch submission flag (a batch is several sequential POSTs).
  const [submitting, setSubmitting] = useState(false);

  /**
   * Reset to a clean state on every focus. The Drawer keeps this screen mounted,
   * so without this a previous submission or edit would linger: re-opening
   * "+ Schedule" must always show a fresh form, and editing must always re-open
   * the prefilled form (never a stale summary).
   */
  useFocusEffect(
    useCallback(() => {
      setSubmitting(false);
      setNowMs(Date.now());
      if (!isEdit) {
        setRouteId('');
        setVehicleId('');
        setDriverId('');
        setConductorId(undefined);
        setStartHour('08');
        setStartMin('00');
        setDirection('PICKUP');
        setSelectedDays(new Set([ymdKey(new Date(Date.now() + SCHEDULE_BUFFER_MIN * 60_000))]));
      }
      // Edit-mode prefill is driven by the `editingTrip` effect below.
    }, [isEdit]),
  );

  // In edit mode, prefill the form from the trip being edited (once it loads).
  useEffect(() => {
    if (!editingTrip) return;
    const t = editingTrip as any;
    setRouteId(t.routeId ?? '');
    setVehicleId(t.vehicleId ?? '');
    setDriverId(t.driverId ?? '');
    setConductorId(t.conductorId ?? undefined);
    if (t.direction) setDirection(t.direction);
    const ss = t.scheduledStart ?? t.date;
    if (ss) {
      const d = new Date(ss);
      setStartHour(String(d.getHours()).padStart(2, '0'));
      setStartMin(String(d.getMinutes()).padStart(2, '0'));
    }
    if (t.date) setSelectedDays(new Set([ymdKey(new Date(t.date))]));
  }, [editingTrip]);

  const toggleDay = (key: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const activeVehicles = vehicles.filter((v) => v.status === 'ACTIVE');

  const rosterCount = useMemo(
    () => (routeId
      ? students.filter((s) => s.routeId === routeId && s.status === 'ACTIVE' && !!s.stopId).length
      : 0),
    [students, routeId],
  );

  const selectRoute = (id: string) => {
    setRouteId(id);
    const route = routes.find((r) => r.id === id);
    if (route?.direction) setDirection(route.direction);
  };

  const isLoading = routesLoading || vehiclesLoading || driversLoading || (isEdit && tripLoading);
  const sortedDays = useMemo(() => [...selectedDays].sort(), [selectedDays]);

  const startWindow = (() => {
    const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    const early = new Date(0); early.setHours(h - 1 < 0 ? 23 : h - 1, m);
    const late = new Date(0); late.setHours(h + 1 > 23 ? 0 : h + 1, m);
    return `${pad(early.getHours())}:${pad(early.getMinutes())}–${pad(late.getHours())}:${pad(late.getMinutes())}`;
  })();

  const handleCreate = async () => {
    if (!routeId) { Alert.alert('Validation', 'Please select a route'); return; }
    if (!vehicleId) { Alert.alert('Validation', 'Please select a vehicle'); return; }
    if (!driverId) { Alert.alert('Validation', 'Please select a driver'); return; }
    if (sortedDays.length === 0) { Alert.alert('Validation', 'Please select at least one date'); return; }

    const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));

    // Enforce the scheduling window on the exact instant (the calendar bounds
    // days; the chosen time can still push a day's start out of range). Days
    // outside [now + buffer, now + 1 month] are flagged, never POSTed — the
    // backend re-validates the same window.
    const now = Date.now();
    const minInstant = now + SCHEDULE_BUFFER_MIN * 60_000;
    const maxInstant = oneMonthAhead(new Date(now)).getTime();

    const plan = sortedDays.map((key) => {
      const iso = isoFromKey(key, h, m);
      const t = new Date(iso).getTime();
      if (t < minInstant) return { key, iso, reason: 'Start time has passed' as string | null };
      if (t > maxInstant) return { key, iso, reason: 'Beyond 1-month window' as string | null };
      return { key, iso, reason: null as string | null };
    });

    if (plan.every((p) => p.reason)) {
      Alert.alert(
        'Outside the schedulable window',
        `Trips can be scheduled from about ${SCHEDULE_BUFFER_MIN} min from now up to one month ahead. Adjust the time or dates.`,
      );
      return;
    }

    setSubmitting(true);
    const tally: ScheduleDayResult[] = [];

    // Sequential POSTs — one trip per selected day, so a partial failure leaves
    // a clear per-day record instead of an all-or-nothing error.
    for (const { key, iso, reason } of plan) {
      if (reason) { tally.push({ key, ok: false, message: reason }); continue; }
      try {
        await createTrip.mutateAsync({
          routeId, vehicleId, driverId, conductorId,
          date: iso, direction, scheduledStart: iso,
        });
        tally.push({ key, ok: true });
      } catch (e: any) {
        tally.push({ key, ok: false, message: e?.response?.data?.message ?? 'Failed' });
      }
    }

    // Stow the summary and leave — the form must never sit in a terminal state.
    setSubmitting(false);
    setScheduleResult(tally);
    router.replace('/(app)/trips/schedule-result' as never);
  };

  // Edit mode: a single PATCH of the SCHEDULED trip, then back to its detail.
  const handleUpdate = () => {
    if (!routeId) { Alert.alert('Validation', 'Please select a route'); return; }
    if (!vehicleId) { Alert.alert('Validation', 'Please select a vehicle'); return; }
    if (!driverId) { Alert.alert('Validation', 'Please select a driver'); return; }
    const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));
    const dayKey = sortedDays[0] ?? todayKey;
    const iso = isoFromKey(dayKey, h, m);
    updateTrip.mutate(
      { tripId: editTripId as string, routeId, vehicleId, driverId, conductorId, direction, scheduledStart: iso },
      {
        onSuccess: () => { Alert.alert('Saved', 'Trip updated'); router.replace(`/(app)/fleet/${editTripId}` as never); },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update trip'),
      },
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Route *</Text>
        {routes.length === 0 && <Text style={styles.empty}>No routes configured yet</Text>}
        <View style={styles.chipRow}>
          {routes.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, routeId === r.id && styles.chipActive]}
              onPress={() => selectRoute(r.id)}
            >
              <Text style={[styles.chipText, routeId === r.id && styles.chipTextActive]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle *</Text>
        {activeVehicles.length === 0 && <Text style={styles.empty}>No active vehicles</Text>}
        <View style={styles.chipRow}>
          {activeVehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.chip, vehicleId === v.id && styles.chipActive]}
              onPress={() => setVehicleId(v.id)}
            >
              <Text style={[styles.chipText, vehicleId === v.id && styles.chipTextActive]}>{v.regNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Driver *</Text>
        {drivers.length === 0 && <Text style={styles.empty}>No drivers — add one under People → Staff</Text>}
        <View style={styles.chipRow}>
          {drivers.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, driverId === m.personId && styles.chipActive]}
              onPress={() => setDriverId(m.personId)}
            >
              <Text style={[styles.chipText, driverId === m.personId && styles.chipTextActive]}>{m.person.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Conductor (optional)</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !conductorId && styles.chipActive]}
            onPress={() => setConductorId(undefined)}
          >
            <Text style={[styles.chipText, !conductorId && styles.chipTextActive]}>None</Text>
          </TouchableOpacity>
          {conductors.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, conductorId === m.personId && styles.chipActive]}
              onPress={() => setConductorId(m.personId)}
            >
              <Text style={[styles.chipText, conductorId === m.personId && styles.chipTextActive]}>{m.person.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        {isEdit ? (
          <>
            <Text style={styles.sectionTitle}>Date</Text>
            <Text style={styles.hint}>
              {sortedDays[0] ? formatDayLabel(sortedDays[0]) : '—'} · a trip's day is fixed — edit its time and assignment below.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.dateHeader}>
              <Text style={styles.sectionTitle}>Dates *</Text>
              <Text style={styles.dateCount}>
                {sortedDays.length} day{sortedDays.length === 1 ? '' : 's'} selected
              </Text>
            </View>
            <Text style={styles.hint}>
              Tap any number of days — one trip per day. Schedulable from now up to one month ahead.
            </Text>
            <MonthCalendar
              selected={selectedDays}
              onSelectDay={toggleDay}
              todayKey={todayKey}
              minSelectable={minSelectableKey}
              maxSelectable={maxSelectableKey}
              minMonth={minMonth}
              maxMonth={maxMonth}
              initialMonthKey={minSelectableKey}
            />
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing[3] }]}>Start time *</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeInputWrap}>
            <TextInput
              style={styles.timeInput}
              value={startHour}
              onChangeText={(v) => setStartHour(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="HH"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.timeLabel}>hour</Text>
          </View>
          <Text style={styles.timeSep}>:</Text>
          <View style={styles.timeInputWrap}>
            <TextInput
              style={styles.timeInput}
              value={startMin}
              onChangeText={(v) => setStartMin(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="MM"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.timeLabel}>min</Text>
          </View>
          <Text style={styles.timePreview}>→ Driver window {startWindow}</Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Direction *</Text>
        <View style={styles.chipRow}>
          {(['PICKUP', 'DROP'] as const).map((dir) => (
            <TouchableOpacity
              key={dir}
              style={[styles.chip, direction === dir && styles.chipActive]}
              onPress={() => setDirection(dir)}
            >
              <Text style={[styles.chipText, direction === dir && styles.chipTextActive]}>{dir}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Roster preview */}
      <Card style={styles.previewCard}>
        <Text style={styles.previewLabel}>Roster preview</Text>
        <Text style={styles.previewCount}>
          {routeId ? `${rosterCount} rider${rosterCount !== 1 ? 's' : ''}` : '—'}
        </Text>
        <Text style={styles.previewHint}>
          {routeId
            ? `Active students on this route with a boarding stop will be added as EXPECTED on each of the ${sortedDays.length} day${sortedDays.length === 1 ? '' : 's'}.`
            : 'Select a route to preview the roster.'}
        </Text>
      </Card>

      <Button
        title={isEdit ? 'Save Changes' : sortedDays.length > 1 ? `Schedule ${sortedDays.length} Trips` : 'Schedule Trip'}
        onPress={isEdit ? handleUpdate : handleCreate}
        loading={isEdit ? updateTrip.isPending : submitting}
        fullWidth
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  empty: { fontSize: fontSizes.sm, color: colors.textMuted },
  hint: { fontSize: fontSizes.xs, color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.white },

  dateHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  dateCount: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  timeInputWrap: { alignItems: 'center', gap: 2 },
  timeInput: {
    width: 56, height: 44, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, textAlign: 'center',
    fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  timeLabel: { fontSize: fontSizes.xs, color: colors.textMuted },
  timeSep: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textSecondary, paddingBottom: 14 },
  timePreview: { fontSize: fontSizes.xs, color: colors.textSecondary, flex: 1 },

  previewCard: { gap: spacing[1], alignItems: 'center', paddingVertical: spacing[4] },
  previewLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  previewCount: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  previewHint: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
  saveBtn: { marginTop: spacing[2] },
});

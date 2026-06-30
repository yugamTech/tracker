import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  LoadingSpinner, IconSplat, Icon, useToast,
} from '@yaanam/ui';
import {
  useRoutes, useVehicles, useMembers, useStudents, useCreateTrip,
  useTripById, useUpdateTrip, useShifts,
} from '@yaanam/api-client';
import { MonthCalendar, ymdKey, startOfMonth, formatDayLabel } from '../../../components/Calendar';
import { useScheduleResultStore, type ScheduleDayResult } from '../../../store/schedule.store';
import { GroupCard, Field, FormInput, PillPicker, ActionButton } from '../../../components/forms';

const HUE = colors.trip;
const HUE_BG = colors.tripBg;

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
  const { data: shifts = [] } = useShifts();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const toast = useToast();
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
  // Optional shift: '' = whole route. When set, the roster is filtered to that
  // shift's students and the start time follows the shift's pickup/drop time.
  const [shiftId, setShiftId] = useState('');
  // Optional per-trip destination override ("Different destination?"), off by
  // default so a normal trip needs zero extra input.
  const [anchorMode, setAnchorMode] = useState<'school' | 'custom'>('school');
  const [anchorLabel, setAnchorLabel] = useState('');
  const [anchorLat, setAnchorLat] = useState('');
  const [anchorLng, setAnchorLng] = useState('');

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
        setShiftId('');
        setAnchorMode('school');
        setAnchorLabel('');
        setAnchorLat('');
        setAnchorLng('');
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
    setShiftId(t.shiftId ?? '');
    if (t.direction) setDirection(t.direction);
    const ss = t.scheduledStart ?? t.date;
    if (ss) {
      const d = new Date(ss);
      setStartHour(String(d.getHours()).padStart(2, '0'));
      setStartMin(String(d.getMinutes()).padStart(2, '0'));
    }
    if (t.date) setSelectedDays(new Set([ymdKey(new Date(t.date))]));
  }, [editingTrip]);

  // When a shift is chosen (create mode), the start time follows the shift's
  // pickup/drop time for the current direction, so the trip departs on shift. In
  // edit mode we keep the trip's stored time (re-pick the shift to resync).
  useEffect(() => {
    if (isEdit || !shiftId) return;
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    const t = direction === 'PICKUP' ? shift.pickupTime : shift.dropTime;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
      const [h, m] = t.split(':');
      setStartHour(h);
      setStartMin(m);
    }
  }, [shiftId, direction, shifts, isEdit]);

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
      ? students.filter(
          (s) =>
            s.routeId === routeId &&
            s.status === 'ACTIVE' &&
            !!s.stopId &&
            (!shiftId || s.ageGroupId === shiftId),
        ).length
      : 0),
    [students, routeId, shiftId],
  );

  const selectRoute = (id: string) => {
    // A route is direction-agnostic; the admin picks the trip direction explicitly.
    setRouteId(id);
  };

  const isLoading = routesLoading || vehiclesLoading || driversLoading || (isEdit && tripLoading);
  const sortedDays = useMemo(() => [...selectedDays].sort(), [selectedDays]);

  // Empty-route guard (mirrors the backend POST /trips rejection): a route with no
  // eligible riders (no stops, or no ACTIVE stop-pinned students) can't be scheduled.
  // In edit mode this only bites when the route is actually being CHANGED to an
  // empty one — editing time/driver on an existing trip is never blocked.
  const originalRouteId = (editingTrip as any)?.routeId as string | undefined;
  const blockEmptyRoute = !!routeId && rosterCount === 0 && (!isEdit || routeId !== originalRouteId);

  const startWindow = (() => {
    const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    const early = new Date(0); early.setHours(h - 1 < 0 ? 23 : h - 1, m);
    const late = new Date(0); late.setHours(h + 1 > 23 ? 0 : h + 1, m);
    return `${pad(early.getHours())}:${pad(early.getMinutes())}–${pad(late.getHours())}:${pad(late.getMinutes())}`;
  })();

  /**
   * Validate the optional destination override and return the fields to send
   * (empty object when "Same as school"). Shows a toast + returns 'INVALID' on a
   * bad/partial pin so the caller can bail.
   */
  const resolveAnchorFields = (): { anchorLat?: number; anchorLng?: number; anchorLabel?: string } | 'INVALID' => {
    if (anchorMode !== 'custom') return {};
    const latStr = anchorLat.trim();
    const lngStr = anchorLng.trim();
    if (latStr === '' || lngStr === '') { toast.error('Enter both a latitude and longitude for the destination'); return 'INVALID'; }
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) { toast.error('Destination latitude must be between -90 and 90'); return 'INVALID'; }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) { toast.error('Destination longitude must be between -180 and 180'); return 'INVALID'; }
    return { anchorLat: lat, anchorLng: lng, anchorLabel: anchorLabel.trim() || undefined };
  };

  const handleCreate = async () => {
    if (!routeId) { toast.error('Please select a route'); return; }
    if (!vehicleId) { toast.error('Please select a vehicle'); return; }
    if (!driverId) { toast.error('Please select a driver'); return; }
    if (sortedDays.length === 0) { toast.error('Please select at least one date'); return; }

    // Optional destination override — both coords required, range-checked (the
    // backend re-validates). Built once and applied to every day in the batch.
    const anchorFields = resolveAnchorFields();
    if (anchorFields === 'INVALID') return;

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
      toast.error(
        `Trips can be scheduled from about ${SCHEDULE_BUFFER_MIN} min from now up to one month ahead. Adjust the time or dates.`,
        'Outside the schedulable window',
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
          shiftId: shiftId || undefined,
          ...anchorFields,
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
    if (!routeId) { toast.error('Please select a route'); return; }
    if (!vehicleId) { toast.error('Please select a vehicle'); return; }
    if (!driverId) { toast.error('Please select a driver'); return; }
    const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));
    const dayKey = sortedDays[0] ?? todayKey;
    const iso = isoFromKey(dayKey, h, m);
    updateTrip.mutate(
      { tripId: editTripId as string, routeId, vehicleId, driverId, conductorId, direction, scheduledStart: iso, shiftId },
      {
        onSuccess: () => { toast.success('Trip updated'); router.replace(`/(app)/fleet/${editTripId}` as never); },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update trip'),
      },
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const routeOptions = routes.map((r) => ({ label: r.name, value: r.id }));
  const vehicleOptions = activeVehicles.map((v) => ({ label: v.regNumber, value: v.id }));
  const driverOptions = drivers.map((m) => ({ label: m.person.name, value: m.personId }));
  const conductorOptions = [
    { label: 'None', value: '' },
    ...conductors.map((m) => ({ label: m.person.name, value: m.personId })),
  ];
  // "Whole route" clears the shift; each shift shows its time for the current direction.
  const shiftOptions = [
    { label: 'Whole route', value: '' },
    ...shifts.map((s) => ({ label: `${s.name} · ${direction === 'PICKUP' ? s.pickupTime : s.dropTime}`, value: s.id })),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <GroupCard title="Route" spot="route" hue={colors.route}>
        {routes.length === 0
          ? <Text style={styles.empty}>No routes configured yet</Text>
          : <PillPicker hue={colors.route} value={routeId} onChange={selectRoute} options={routeOptions} />}
      </GroupCard>

      <GroupCard title="Vehicle" spot="bus" hue={colors.fleet}>
        {activeVehicles.length === 0
          ? <Text style={styles.empty}>No active vehicles</Text>
          : <PillPicker hue={colors.fleet} value={vehicleId} onChange={setVehicleId} options={vehicleOptions} />}
      </GroupCard>

      <GroupCard title="Driver" icon="users" hue={HUE}>
        {drivers.length === 0
          ? <Text style={styles.empty}>No drivers — add one under People → Staff</Text>
          : <PillPicker hue={HUE} value={driverId} onChange={setDriverId} options={driverOptions} />}
      </GroupCard>

      <GroupCard title="Conductor (optional)" icon="users" hue={colors.people}>
        <PillPicker
          hue={colors.people}
          value={conductorId ?? ''}
          onChange={(v) => setConductorId(v || undefined)}
          options={conductorOptions}
        />
      </GroupCard>

      <GroupCard title="Shift (optional)" spot="trip" hue={colors.people}>
        {shifts.length === 0 ? (
          <Text style={styles.empty}>No shifts yet — add them under Settings → Shifts to carry one shift at a time.</Text>
        ) : (
          <>
            <PillPicker hue={colors.people} value={shiftId} onChange={setShiftId} options={shiftOptions} />
            <Text style={styles.shiftHint}>
              {shiftId
                ? 'Only this shift’s students ride, and the start time follows the shift.'
                : 'Whole route — every eligible student on the route rides.'}
            </Text>
          </>
        )}
      </GroupCard>

      <GroupCard title="Dates" spot="trip" hue={HUE}>
        {isEdit ? (
          <Field label="Date">
            <Text style={styles.editDate}>
              {sortedDays[0] ? formatDayLabel(sortedDays[0]) : '—'}
            </Text>
            <Text style={styles.editDateHint}>A trip's day is fixed — edit its time and assignment below.</Text>
          </Field>
        ) : (
          <>
            <View style={styles.datesHeader}>
              <Text style={styles.datesHint}>Tap any number of days — one trip per day. Schedulable from now up to one month ahead.</Text>
              <Text style={styles.datesCount}>{sortedDays.length} day{sortedDays.length === 1 ? '' : 's'}</Text>
            </View>
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

        <Field label="Start time" style={styles.timeField}>
          <View style={styles.timeRow}>
            <View style={styles.timeInputWrap}>
              <FormInput
                hue={HUE}
                value={startHour}
                onChangeText={(v) => setStartHour(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
                style={styles.timeInput}
              />
              <Text style={styles.timeLabel}>hour</Text>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeInputWrap}>
              <FormInput
                hue={HUE}
                value={startMin}
                onChangeText={(v) => setStartMin(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                style={styles.timeInput}
              />
              <Text style={styles.timeLabel}>min</Text>
            </View>
            <Text style={styles.timePreview}>Driver window {startWindow}</Text>
          </View>
        </Field>
      </GroupCard>

      <GroupCard title="Direction" spot="trip" hue={HUE}>
        <PillPicker
          hue={HUE}
          value={direction}
          onChange={(v) => setDirection(v as 'PICKUP' | 'DROP')}
          options={[{ label: 'Pickup', value: 'PICKUP' }, { label: 'Drop', value: 'DROP' }]}
        />
      </GroupCard>

      {/* Optional per-trip destination override (create only; defaulted off). */}
      {!isEdit ? (
        <GroupCard title="Destination" spot="route" hue={HUE}>
          <PillPicker
            hue={HUE}
            value={anchorMode}
            onChange={(v) => setAnchorMode(v as 'school' | 'custom')}
            options={[
              { label: 'Same as school', value: 'school' },
              { label: 'Different destination', value: 'custom' },
            ]}
          />
          {anchorMode === 'custom' ? (
            <>
              <Text style={styles.shiftHint}>This trip ends/starts at a custom point instead of the school pin.</Text>
              <Field label="Label">
                <FormInput hue={HUE} value={anchorLabel} onChangeText={setAnchorLabel} placeholder="e.g. Sports ground" autoCapitalize="words" />
              </Field>
              <View style={styles.coordRow}>
                <Field label="Latitude" hint="-90 … 90" style={styles.coordField}>
                  <FormInput hue={HUE} value={anchorLat} onChangeText={setAnchorLat} placeholder="12.9716" keyboardType="numbers-and-punctuation" />
                </Field>
                <Field label="Longitude" hint="-180 … 180" style={styles.coordField}>
                  <FormInput hue={HUE} value={anchorLng} onChangeText={setAnchorLng} placeholder="77.5946" keyboardType="numbers-and-punctuation" />
                </Field>
              </View>
            </>
          ) : null}
        </GroupCard>
      ) : null}

      {/* Roster preview */}
      <View style={[styles.rosterCard, { backgroundColor: HUE_BG }]}>
        <IconSplat shape="b3" splatColor={colors.white} spot="users" size={40} />
        <View style={styles.rosterInfo}>
          <Text style={styles.rosterCount}>
            {routeId ? `${rosterCount} rider${rosterCount !== 1 ? 's' : ''}` : '—'}
          </Text>
          <Text style={styles.rosterHint}>
            {routeId
              ? `Active stop-pinned students on this route. Each will be added as EXPECTED on ${sortedDays.length} day${sortedDays.length === 1 ? '' : 's'}.`
              : 'Select a route to preview the roster.'}
          </Text>
        </View>
      </View>

      {blockEmptyRoute ? (
        <View style={styles.blockWarn}>
          <Icon name="alert" size={15} color={colors.warningDark} />
          <Text style={styles.blockWarnText}>
            This route has no eligible riders. Add stops and assign active students to a stop on it
            before scheduling — a driver can't be given an empty route.
          </Text>
        </View>
      ) : null}

      <ActionButton
        title={isEdit ? 'Save changes' : sortedDays.length > 1 ? `Schedule ${sortedDays.length} trips` : 'Schedule trip'}
        hue={HUE}
        onPress={isEdit ? handleUpdate : handleCreate}
        loading={isEdit ? updateTrip.isPending : submitting}
        disabled={blockEmptyRoute}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },

  empty: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink3 },
  shiftHint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, lineHeight: 16 },
  coordRow: { flexDirection: 'row', gap: spacing[3] },
  coordField: { flex: 1 },

  datesHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  datesHint: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, lineHeight: 16 },
  datesCount: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: colors.trip },
  editDate: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  editDateHint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, marginTop: 2 },

  timeField: { marginTop: spacing[2] },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  timeInputWrap: { alignItems: 'center', gap: 4 },
  timeInput: { width: 60, textAlign: 'center' },
  timeLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },
  timeSep: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.ink2, paddingBottom: 16 },
  timePreview: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, flex: 1 },

  rosterCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: 22, padding: spacing[3] },
  rosterInfo: { flex: 1 },
  rosterCount: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.trip },
  rosterHint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink2, lineHeight: 16, marginTop: 2 },

  blockWarn: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: colors.warnBg, borderRadius: 16,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  blockWarnText: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: '#92400E', lineHeight: 19 },
});

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, LoadingSpinner } from '@saarthi/ui';
import {
  useRoutes, useVehicles, useMembers, useStudents, useCreateTrip,
} from '@saarthi/api-client';

/** Dependency-free date presets — the trip is scheduled for one of the next few days. */
function dayOption(offset: number): { label: string; date: Date } {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setSeconds(0, 0);
  const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return { label, date: d };
}
const DATE_OPTIONS = [dayOption(0), dayOption(1), dayOption(2)];

export default function ScheduleTripScreen() {
  const { data: routes = [], isLoading: routesLoading } = useRoutes();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { data: drivers = [], isLoading: driversLoading } = useMembers('DRIVER');
  const { data: conductors = [] } = useMembers('CONDUCTOR');
  const { data: students = [] } = useStudents();
  const createTrip = useCreateTrip();

  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [conductorId, setConductorId] = useState<string | undefined>(undefined);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [startHour, setStartHour] = useState('08');
  const [startMin, setStartMin] = useState('00');
  const [direction, setDirection] = useState<'PICKUP' | 'DROP'>('PICKUP');

  // Build the full scheduledStart ISO string from the selected date + HH:MM inputs.
  const scheduledStartIso = (() => {
    const d = new Date(DATE_OPTIONS[selectedDateIdx].date);
    const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  })();

  const activeVehicles = vehicles.filter((v) => v.status === 'ACTIVE');

  // Roster preview — mirrors the backend exactly: ACTIVE students on the chosen
  // route that have a boarding stop.
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

  const isLoading = routesLoading || vehiclesLoading || driversLoading;

  const handleCreate = () => {
    if (!routeId) { Alert.alert('Validation', 'Please select a route'); return; }
    if (!vehicleId) { Alert.alert('Validation', 'Please select a vehicle'); return; }
    if (!driverId) { Alert.alert('Validation', 'Please select a driver'); return; }

    createTrip.mutate(
      { routeId, vehicleId, driverId, conductorId, date: scheduledStartIso, direction, scheduledStart: scheduledStartIso },
      {
        onSuccess: () => { Alert.alert('Scheduled', `Trip created with ${rosterCount} rider${rosterCount !== 1 ? 's' : ''} on the roster`); router.back(); },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to schedule trip'),
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
        <Text style={styles.sectionTitle}>Date *</Text>
        <View style={styles.chipRow}>
          {DATE_OPTIONS.map((d, i) => (
            <TouchableOpacity
              key={d.label}
              style={[styles.chip, selectedDateIdx === i && styles.chipActive]}
              onPress={() => setSelectedDateIdx(i)}
            >
              <Text style={[styles.chipText, selectedDateIdx === i && styles.chipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
          <Text style={styles.timePreview}>
            → Driver window {(() => {
              const h = Math.min(23, Math.max(0, parseInt(startHour, 10) || 0));
              const m = Math.min(59, Math.max(0, parseInt(startMin, 10) || 0));
              const pad = (n: number) => String(n).padStart(2, '0');
              const early = new Date(0); early.setHours(h - 1 < 0 ? 23 : h - 1, m);
              const late  = new Date(0); late.setHours(h + 1 > 23 ? 0 : h + 1, m);
              return `${pad(early.getHours())}:${pad(early.getMinutes())}–${pad(late.getHours())}:${pad(late.getMinutes())}`;
            })()}
          </Text>
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
            ? 'Active students on this route with a boarding stop will be added as EXPECTED.'
            : 'Select a route to preview the roster.'}
        </Text>
      </Card>

      <Button
        title="Schedule Trip"
        onPress={handleCreate}
        loading={createTrip.isPending}
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.white },
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

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, AnimatedPressable, IconSplat, Icon, useToast,
} from '@yaanam/ui';
import {
  useRouteById, useCreateRoute, useUpdateRoute, useDeactivateRoute, useReactivateRoute, useDeleteRoute,
  useCreateStop, useAddStop, useUpdateStop, useVehicles,
} from '@yaanam/api-client';
import type { Stop } from '@yaanam/api-client';
import { goBackTo } from '../../../lib/nav';
import {
  GroupCard, Field, FormInput, PillPicker, ReadValue, ActionButton, AddButton, SeatMeter,
} from '../../../components/forms';

const HUE = colors.route;
const DIRECTIONS = ['PICKUP', 'DROP'] as const;

/**
 * Client-side lat/lng range check (mirrors the backend DTO @Min/@Max). Returns a
 * clear message for an out-of-range or non-numeric coordinate, or null when valid.
 */
function validateLatLng(lat: number, lng: number): string | null {
  if (isNaN(lat) || isNaN(lng)) return 'Enter valid lat/lng';
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90';
  if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180';
  return null;
}

export default function RouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const isNew = routeId === 'new';

  const { data: route, isLoading } = useRouteById(isNew ? '' : routeId);
  const { data: vehicles = [] } = useVehicles();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deactivateRoute = useDeactivateRoute();
  const reactivateRoute = useReactivateRoute();
  const createStop = useCreateStop();
  const addStop = useAddStop();
  const updateStop = useUpdateStop();
  const deleteRoute = useDeleteRoute();
  const toast = useToast();

  const [name, setName] = useState('');
  const [direction, setDirection] = useState<typeof DIRECTIONS[number]>('PICKUP');
  const [vehicleId, setVehicleId] = useState('');
  const [editing, setEditing] = useState(isNew);

  // Stop creation form
  const [newStopName, setNewStopName] = useState('');
  const [newStopLat, setNewStopLat] = useState('');
  const [newStopLng, setNewStopLng] = useState('');
  const [showStopForm, setShowStopForm] = useState(false);

  // Inline stop-edit form (one row at a time).
  const [editStopId, setEditStopId] = useState<string | null>(null);
  const [editStopName, setEditStopName] = useState('');
  const [editStopLat, setEditStopLat] = useState('');
  const [editStopLng, setEditStopLng] = useState('');
  const [editStopRadius, setEditStopRadius] = useState('');

  useEffect(() => {
    if (route) {
      setName(route.name);
      setDirection(route.direction);
      setVehicleId(route.vehicleId ?? '');
    }
  }, [route]);

  const handleSave = () => {
    if (!name.trim()) { toast.error('Route name is required'); return; }
    if (isNew) {
      createRoute.mutate(
        { name: name.trim(), direction },
        {
          onSuccess: (created) => {
            toast.success('Route created');
            router.replace(`/(app)/routes/${created.id}` as never);
          },
          onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
        },
      );
    } else {
      // vehicleId '' clears the designated bus on the backend.
      updateRoute.mutate(
        { id: routeId, name: name.trim(), vehicleId },
        {
          onSuccess: () => { toast.success('Route updated'); setEditing(false); },
          onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
        },
      );
    }
  };

  const handleDeactivate = () => {
    if (!route) return;
    Alert.alert(
      'Deactivate route',
      `${route.name} will be marked inactive and hidden from the active routes list. Its stops, students and trip history are kept. You can reactivate it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () =>
            deactivateRoute.mutate(routeId, {
              onSuccess: () => { toast.success('Route deactivated'); goBackTo('routes/[routeId]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate'),
            }),
        },
      ],
    );
  };

  const handleReactivate = () => {
    if (!route) return;
    Alert.alert(
      'Reactivate route',
      `${route.name} will be marked active and return to the active routes list for scheduling.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: () =>
            reactivateRoute.mutate(routeId, {
              onSuccess: () => { toast.success('Route reactivated'); goBackTo('routes/[routeId]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reactivate'),
            }),
        },
      ],
    );
  };

  const handleAddStop = () => {
    const lat = parseFloat(newStopLat);
    const lng = parseFloat(newStopLng);
    if (!newStopName.trim()) { toast.error('Stop name is required'); return; }
    const coordErr = validateLatLng(lat, lng);
    if (coordErr) { toast.error(coordErr); return; }
    const existing = route?.stops ?? [];
    const nextSeq = existing.length ? Math.max(...existing.map((rs) => rs.sequence)) + 1 : 1;
    createStop.mutate(
      { name: newStopName.trim(), lat, lng },
      {
        onSuccess: (created) => {
          // Attach the new stop to this route at the next sequence so the admin
          // builds the ordered path (market → via → destination) in one step.
          addStop.mutate(
            { routeId, stopId: created.id, sequence: nextSeq },
            {
              onSuccess: () => {
                setNewStopName(''); setNewStopLat(''); setNewStopLng('');
                setShowStopForm(false);
              },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add stop to route'),
            },
          );
        },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
      },
    );
  };

  const startEditStop = (stop: Stop) => {
    setEditStopId(stop.id);
    setEditStopName(stop.name);
    setEditStopLat(String(stop.lat));
    setEditStopLng(String(stop.lng));
    setEditStopRadius(stop.geofenceRadius != null ? String(stop.geofenceRadius) : '');
  };

  const handleSaveStop = () => {
    if (!editStopId) return;
    if (!editStopName.trim()) { toast.error('Stop name is required'); return; }
    const lat = parseFloat(editStopLat);
    const lng = parseFloat(editStopLng);
    const coordErr = validateLatLng(lat, lng);
    if (coordErr) { toast.error(coordErr); return; }
    let geofenceRadius: number | undefined;
    if (editStopRadius.trim()) {
      const r = parseInt(editStopRadius, 10);
      if (isNaN(r) || r < 0) { toast.error('Geofence radius must be 0 or more'); return; }
      geofenceRadius = r;
    }
    updateStop.mutate(
      { id: editStopId, name: editStopName.trim(), lat, lng, ...(geofenceRadius !== undefined ? { geofenceRadius } : {}) },
      {
        onSuccess: () => { toast.success('Stop updated'); setEditStopId(null); },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update stop'),
      },
    );
  };

  const handleHardDelete = () => {
    if (!route) return;
    Alert.alert(
      'Delete route permanently',
      `${route.name} will be permanently deleted. This cannot be undone. Its stop links are removed and any assigned students/age groups are detached.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () =>
            deleteRoute.mutate(routeId, {
              onSuccess: () => { toast.success('Route deleted'); goBackTo('routes/[routeId]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
            }),
        },
      ],
    );
  };

  const isSaving = createRoute.isPending || updateRoute.isPending;

  if (!isNew && isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }

  const routeStops: Array<{ sequence: number; stop: Stop }> = route?.stops ?? [];

  // Empty-route guard surface: a route can only be scheduled if it has stops AND
  // active students pinned to one of them (the roster a trip would carry).
  const eligibleRiders = (route?.students ?? []).filter((s) => s.status === 'ACTIVE' && !!s.stopId).length;
  const noStops = !isNew && !!route && routeStops.length === 0;
  const noRiders = !isNew && !!route && routeStops.length > 0 && eligibleRiders === 0;

  // Seat capacity (fleet-integrity §1): seats used vs the designated bus's capacity.
  const seatsUsed = route?.seatsUsed ?? 0;
  const capacity = route?.capacity ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!isNew && route ? (
        <Card shadow="sm" radius={22} style={styles.header}>
          <IconSplat shape="b2" splatColor={colors.routeBg} spot="route" size={48} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{route.name}</Text>
            <View style={styles.badgeRow}>
              <Badge label={route.direction} variant="default" size="sm" />
              <Badge label={route.status} variant={route.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
            </View>
          </View>
          <AnimatedPressable onPress={() => setEditing((e) => !e)} style={styles.editBtn} accessibilityRole="button">
            <Icon name={editing ? 'x' : 'edit'} size={14} color={HUE} />
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </AnimatedPressable>
        </Card>
      ) : null}

      {(noStops || noRiders) ? (
        <Card shadow="sm" radius={22} style={styles.warnBanner}>
          <View style={styles.warnTop}>
            <Icon name="alert" size={18} color={colors.warningDark} />
            <Text style={styles.warnBannerTitle}>
              {noStops ? 'No stops on this route' : 'No riders on this route'}
            </Text>
          </View>
          <Text style={styles.warnBannerText}>
            {noStops
              ? 'Add at least one stop, then assign active students to it. A trip can’t be scheduled on a route with no stops.'
              : 'No active students are pinned to a stop on this route. Assign students to a stop before scheduling — a driver can’t be given an empty route.'}
          </Text>
        </Card>
      ) : null}

      <GroupCard title={isNew ? 'New route' : 'Route info'} spot="route" hue={HUE}>
        <Field label="Route name" required>
          {editing
            ? <FormInput hue={HUE} value={name} onChangeText={setName} placeholder="e.g. Route A – Morning Pickup" />
            : <ReadValue value={name} />}
        </Field>

        <Field label="Direction">
          {editing
            ? <PillPicker hue={HUE} value={direction} onChange={(v) => setDirection(v as typeof DIRECTIONS[number])} options={DIRECTIONS.map((d) => ({ label: d, value: d }))} />
            : <ReadValue value={direction} />}
        </Field>

        {editing ? (
          <ActionButton title={isNew ? 'Create route' : 'Save changes'} hue={HUE} onPress={handleSave} loading={isSaving} fullWidth />
        ) : null}
      </GroupCard>

      {/* Designated bus & seat capacity — shown for existing routes */}
      {!isNew && route ? (
        <GroupCard title="Bus & capacity" spot="bus" hue={HUE}>
          {capacity != null ? (
            <SeatMeter used={seatsUsed} capacity={capacity} hue={HUE} />
          ) : (
            <View style={styles.noBusRow}>
              <Icon name="bus" size={15} color={colors.ink3} />
              <Text style={styles.noBusText}>{seatsUsed} seats used · no bus assigned</Text>
            </View>
          )}

          <Field label="Designated bus" hint={editing ? 'Assign the bus that serves this route. Its capacity is enforced when students are added — a full bus blocks new assignments.' : undefined}>
            {editing ? (
              <PillPicker
                hue={HUE}
                value={vehicleId}
                onChange={setVehicleId}
                options={[
                  { label: 'None', value: '' },
                  ...vehicles
                    .filter((v) => v.status === 'ACTIVE' || v.id === vehicleId)
                    .map((v) => ({ label: `${v.regNumber} · ${v.capacity} seats`, value: v.id })),
                ]}
              />
            ) : (
              <ReadValue value={route.vehicle ? `${route.vehicle.regNumber} · ${route.vehicle.capacity} seats` : 'No bus assigned'} />
            )}
          </Field>
        </GroupCard>
      ) : null}

      {/* Stops list — shown for existing routes */}
      {!isNew ? (
        <GroupCard title={`Stops · ${routeStops.length}`} icon="pin" hue={HUE}>
          <View style={styles.stopsHeader}>
            <Text style={styles.stopsHint}>The ordered path a trip follows on this route.</Text>
            {showStopForm
              ? <ActionButton title="Cancel" tone="ghost" onPress={() => setShowStopForm(false)} style={styles.stopToggle} />
              : <AddButton label="New stop" hue={HUE} onPress={() => setShowStopForm(true)} />}
          </View>

          {showStopForm ? (
            <View style={styles.stopForm}>
              <Field label="Stop name" required>
                <FormInput hue={HUE} value={newStopName} onChangeText={setNewStopName} placeholder="e.g. DLF Phase 2 Gate" />
              </Field>
              <View style={styles.latLngRow}>
                <Field label="Latitude" style={styles.latLngField}>
                  <FormInput hue={HUE} value={newStopLat} onChangeText={setNewStopLat} keyboardType="decimal-pad" placeholder="28.4595" />
                </Field>
                <Field label="Longitude" style={styles.latLngField}>
                  <FormInput hue={HUE} value={newStopLng} onChangeText={setNewStopLng} keyboardType="decimal-pad" placeholder="77.0266" />
                </Field>
              </View>
              <ActionButton title="Add stop" hue={HUE} onPress={handleAddStop} loading={createStop.isPending || addStop.isPending} fullWidth />
            </View>
          ) : null}

          {routeStops.length === 0 ? (
            <Text style={styles.emptyText}>No stops assigned yet</Text>
          ) : null}
          {routeStops
            .sort((a, b) => a.sequence - b.sequence)
            .map((rs) =>
              editStopId === rs.stop.id ? (
                <View key={rs.stop.id} style={styles.stopForm}>
                  <Field label="Stop name" required>
                    <FormInput hue={HUE} value={editStopName} onChangeText={setEditStopName} placeholder="Stop name" />
                  </Field>
                  <View style={styles.latLngRow}>
                    <Field label="Latitude" style={styles.latLngField}>
                      <FormInput hue={HUE} value={editStopLat} onChangeText={setEditStopLat} keyboardType="decimal-pad" placeholder="28.4595" />
                    </Field>
                    <Field label="Longitude" style={styles.latLngField}>
                      <FormInput hue={HUE} value={editStopLng} onChangeText={setEditStopLng} keyboardType="decimal-pad" placeholder="77.0266" />
                    </Field>
                  </View>
                  <Field label="Geofence radius (m)">
                    <FormInput hue={HUE} value={editStopRadius} onChangeText={setEditStopRadius} keyboardType="number-pad" placeholder="100" />
                  </Field>
                  <View style={styles.editStopActions}>
                    <ActionButton title="Cancel" tone="outline" onPress={() => setEditStopId(null)} />
                    <ActionButton title="Save stop" hue={HUE} onPress={handleSaveStop} loading={updateStop.isPending} />
                  </View>
                </View>
              ) : (
                <View key={rs.stop.id} style={styles.stopRow}>
                  <View style={styles.stopSeq}>
                    <Text style={styles.stopSeqText}>{rs.sequence}</Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={styles.stopName} numberOfLines={1}>{rs.stop.name}</Text>
                    <Text style={styles.stopCoord}>
                      {rs.stop.lat != null && rs.stop.lng != null
                        ? `${rs.stop.lat.toFixed(4)}, ${rs.stop.lng.toFixed(4)}`
                        : 'No coordinates'}
                    </Text>
                  </View>
                  <AnimatedPressable onPress={() => startEditStop(rs.stop)} style={styles.editBtn} accessibilityRole="button">
                    <Icon name="edit" size={14} color={HUE} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </AnimatedPressable>
                </View>
              ),
            )}
        </GroupCard>
      ) : null}

      {/* Deactivate / Reactivate — soft delete only (never a hard delete). */}
      {!isNew && route?.status === 'ACTIVE' ? (
        <GroupCard title="Danger zone" icon="alert" hue={colors.crit}>
          <Text style={styles.hint}>
            Deactivating hides the route from scheduling but preserves its stops, students and trip history.
          </Text>
          <ActionButton title="Deactivate route" tone="danger" onPress={handleDeactivate} loading={deactivateRoute.isPending} fullWidth />
        </GroupCard>
      ) : null}
      {!isNew && route?.status === 'INACTIVE' ? (
        <GroupCard title="Reactivate" icon="checkc" hue={colors.ok}>
          <Text style={styles.hint}>
            This route is deactivated. Reactivating returns it to the active routes list for scheduling.
          </Text>
          <ActionButton title="Reactivate route" hue={colors.ok} onPress={handleReactivate} loading={reactivateRoute.isPending} fullWidth />
        </GroupCard>
      ) : null}

      {/* Permanent hard-delete — only meaningful once the record exists, and only
          permitted when it has no trip history (else we explain why). */}
      {!isNew && route ? (
        <GroupCard title="Delete permanently" icon="trash" hue={colors.crit}>
          {route.deletable?.canDelete ? (
            <>
              <Text style={styles.hint}>
                This route has no trip history, so it can be permanently deleted. This cannot be undone — prefer “Deactivate” unless you’re erasing a record added by mistake.
              </Text>
              <ActionButton title="Delete route permanently" tone="danger" onPress={handleHardDelete} loading={deleteRoute.isPending} fullWidth />
            </>
          ) : (
            <Text style={styles.hint}>
              {route.deletable?.reason ?? 'This route has trip history — deactivate it instead of deleting.'}
            </Text>
          )}
        </GroupCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, minWidth: 0, gap: spacing[1], alignItems: 'flex-start' },
  headerName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.routeBg },
  editBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: HUE },

  warnBanner: { backgroundColor: colors.warnBg, gap: spacing[2] },
  warnTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warnBannerTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.base, fontWeight: fontWeights.extrabold, color: colors.warningDark },
  warnBannerText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: '#92400E', lineHeight: 19 },

  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },
  noBusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  noBusText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },

  stopsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  stopsHint: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },
  stopToggle: { minHeight: 0, paddingVertical: 8, paddingHorizontal: 13 },
  stopForm: { gap: spacing[3], padding: spacing[3], backgroundColor: colors.ground, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  editStopActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
  latLngRow: { flexDirection: 'row', gap: spacing[3] },
  latLngField: { flex: 1 },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  stopSeq: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.routeBg, alignItems: 'center', justifyContent: 'center' },
  stopSeqText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: HUE },
  stopInfo: { flex: 1, minWidth: 0 },
  stopName: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  stopCoord: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, marginTop: 2 },
  emptyText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink3, textAlign: 'center', paddingVertical: spacing[3] },
});

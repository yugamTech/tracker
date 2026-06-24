import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, Badge, useToast } from '@yaanam/ui';
import {
  useRouteById, useCreateRoute, useUpdateRoute, useDeactivateRoute, useReactivateRoute, useDeleteRoute,
  useStops, useCreateStop, useAddStop, useUpdateStop,
} from '@yaanam/api-client';
import type { Stop } from '@yaanam/api-client';
import { goBackTo } from '../../../lib/nav';

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
  const { data: allStops = [] } = useStops();
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
      updateRoute.mutate(
        { id: routeId, name: name.trim() },
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
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  const routeStops: Array<{ sequence: number; stop: Stop }> = route?.stops ?? [];

  // Empty-route guard surface: a route can only be scheduled if it has stops AND
  // active students pinned to one of them (the roster a trip would carry).
  const eligibleRiders = (route?.students ?? []).filter((s) => s.status === 'ACTIVE' && !!s.stopId).length;
  const noStops = !isNew && !!route && routeStops.length === 0;
  const noRiders = !isNew && !!route && routeStops.length > 0 && eligibleRiders === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!isNew && route && (
        <Card style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{route.name}</Text>
            <View style={styles.badgeRow}>
              <Badge label={route.direction} variant="default" size="sm" />
              <Badge
                label={route.status}
                variant={route.status === 'ACTIVE' ? 'active' : 'inactive'}
                size="sm"
              />
            </View>
          </View>
          <TouchableOpacity onPress={() => setEditing((e) => !e)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </Card>
      )}

      {(noStops || noRiders) ? (
        <Card style={styles.warnBanner}>
          <Text style={styles.warnBannerTitle}>
            {noStops ? '⚠ No stops on this route' : '⚠ No riders on this route'}
          </Text>
          <Text style={styles.warnBannerText}>
            {noStops
              ? 'Add at least one stop, then assign active students to it. A trip can’t be scheduled on a route with no stops.'
              : 'No active students are pinned to a stop on this route. Assign students to a stop before scheduling — a driver can’t be given an empty route.'}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{isNew ? 'New Route' : 'Route Info'}</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          value={name}
          onChangeText={setName}
          editable={editing}
          placeholder="e.g. Route A – Morning Pickup"
          placeholderTextColor={colors.gray400}
        />

        <Text style={styles.label}>Direction</Text>
        {editing ? (
          <View style={styles.chipRow}>
            {DIRECTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, direction === d && styles.chipActive]}
                onPress={() => setDirection(d)}
              >
                <Text style={[styles.chipText, direction === d && styles.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.valueText}>{direction}</Text>
        )}

        {editing && (
          <Button title={isNew ? 'Create Route' : 'Save Name'} onPress={handleSave} loading={isSaving} fullWidth />
        )}
      </Card>

      {/* Stops list — shown for existing routes */}
      {!isNew && (
        <Card style={styles.section}>
          <View style={styles.stopsHeader}>
            <Text style={styles.sectionTitle}>Stops ({routeStops.length})</Text>
            <TouchableOpacity onPress={() => setShowStopForm((v) => !v)} style={styles.addStopBtn}>
              <Text style={styles.addStopText}>{showStopForm ? 'Cancel' : '+ New Stop'}</Text>
            </TouchableOpacity>
          </View>

          {showStopForm && (
            <View style={styles.stopForm}>
              <Text style={styles.label}>Stop Name *</Text>
              <TextInput style={styles.input} value={newStopName} onChangeText={setNewStopName} placeholder="e.g. DLF Phase 2 Gate" placeholderTextColor={colors.gray400} />
              <View style={styles.latLngRow}>
                <View style={styles.latLngField}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput style={styles.input} value={newStopLat} onChangeText={setNewStopLat} keyboardType="decimal-pad" placeholder="28.4595" placeholderTextColor={colors.gray400} />
                </View>
                <View style={styles.latLngField}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput style={styles.input} value={newStopLng} onChangeText={setNewStopLng} keyboardType="decimal-pad" placeholder="77.0266" placeholderTextColor={colors.gray400} />
                </View>
              </View>
              <Button title="Add Stop" onPress={handleAddStop} loading={createStop.isPending || addStop.isPending} size="sm" />
            </View>
          )}

          {routeStops.length === 0 && (
            <Text style={styles.emptyText}>No stops assigned yet</Text>
          )}
          {routeStops
            .sort((a, b) => a.sequence - b.sequence)
            .map((rs) =>
              editStopId === rs.stop.id ? (
                <View key={rs.stop.id} style={styles.stopForm}>
                  <Text style={styles.label}>Stop Name *</Text>
                  <TextInput style={styles.input} value={editStopName} onChangeText={setEditStopName} placeholder="Stop name" placeholderTextColor={colors.gray400} />
                  <View style={styles.latLngRow}>
                    <View style={styles.latLngField}>
                      <Text style={styles.label}>Latitude</Text>
                      <TextInput style={styles.input} value={editStopLat} onChangeText={setEditStopLat} keyboardType="decimal-pad" placeholder="28.4595" placeholderTextColor={colors.gray400} />
                    </View>
                    <View style={styles.latLngField}>
                      <Text style={styles.label}>Longitude</Text>
                      <TextInput style={styles.input} value={editStopLng} onChangeText={setEditStopLng} keyboardType="decimal-pad" placeholder="77.0266" placeholderTextColor={colors.gray400} />
                    </View>
                  </View>
                  <Text style={styles.label}>Geofence radius (m)</Text>
                  <TextInput style={styles.input} value={editStopRadius} onChangeText={setEditStopRadius} keyboardType="number-pad" placeholder="100" placeholderTextColor={colors.gray400} />
                  <View style={styles.editStopActions}>
                    <Button title="Cancel" variant="outline" size="sm" onPress={() => setEditStopId(null)} />
                    <Button title="Save Stop" size="sm" onPress={handleSaveStop} loading={updateStop.isPending} />
                  </View>
                </View>
              ) : (
                <View key={rs.stop.id} style={styles.stopRow}>
                  <View style={styles.stopSeq}>
                    <Text style={styles.stopSeqText}>{rs.sequence}</Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={styles.stopName}>{rs.stop.name}</Text>
                    <Text style={styles.stopCoord}>
                      {rs.stop.lat != null && rs.stop.lng != null
                        ? `${rs.stop.lat.toFixed(4)}, ${rs.stop.lng.toFixed(4)}`
                        : 'No coordinates'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => startEditStop(rs.stop)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ),
            )}
        </Card>
      )}

      {/* Deactivate / Reactivate — soft delete only (never a hard delete). */}
      {!isNew && route?.status === 'ACTIVE' && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.hint}>
            Deactivating hides the route from scheduling but preserves its stops, students and trip history.
          </Text>
          <Button
            title="Deactivate Route"
            variant="danger"
            onPress={handleDeactivate}
            loading={deactivateRoute.isPending}
            fullWidth
          />
        </Card>
      )}
      {!isNew && route?.status === 'INACTIVE' && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Reactivate</Text>
          <Text style={styles.hint}>
            This route is deactivated. Reactivating returns it to the active routes list for scheduling.
          </Text>
          <Button
            title="Reactivate Route"
            onPress={handleReactivate}
            loading={reactivateRoute.isPending}
            fullWidth
          />
        </Card>
      )}

      {/* Permanent hard-delete — only meaningful once the record exists, and only
          permitted when it has no trip history (else we explain why). */}
      {!isNew && route && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Delete permanently</Text>
          {route.deletable?.canDelete ? (
            <>
              <Text style={styles.hint}>
                This route has no trip history, so it can be permanently deleted. This cannot be undone — prefer “Deactivate” unless you’re erasing a record added by mistake.
              </Text>
              <Button
                title="Delete Route Permanently"
                variant="danger"
                onPress={handleHardDelete}
                loading={deleteRoute.isPending}
                fullWidth
              />
            </>
          ) : (
            <Text style={styles.hint}>
              {route.deletable?.reason ?? 'This route has trip history — deactivate it instead of deleting.'}
            </Text>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerInfo: { flex: 1, gap: spacing[1] },
  headerName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  editBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary },
  editBtnText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  input: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  inputDisabled: { backgroundColor: colors.gray50, color: colors.gray500 },
  valueText: { fontSize: fontSizes.base, color: colors.textPrimary, paddingVertical: spacing[1] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.white },
  stopsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addStopBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary },
  addStopText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  stopForm: { gap: spacing[3], padding: spacing[3], backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  editStopActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
  latLngRow: { flexDirection: 'row', gap: spacing[3] },
  latLngField: { flex: 1, gap: spacing[1] },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border },
  stopSeq: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stopSeqText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.white },
  stopInfo: { flex: 1 },
  stopName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  stopCoord: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing[4] },
  warnBanner: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warning, gap: spacing[1] },
  warnBannerTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.warningDark },
  warnBannerText: { fontSize: fontSizes.sm, color: colors.warningDark, lineHeight: 18 },
});

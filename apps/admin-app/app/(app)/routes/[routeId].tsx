import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, Badge } from '@saarthi/ui';
import {
  useRouteById, useCreateRoute, useUpdateRoute, useDeactivateRoute,
  useStops, useCreateStop, useAddStop,
} from '@saarthi/api-client';
import type { Stop } from '@saarthi/api-client';
import { goBackTo } from '../../../lib/nav';

const DIRECTIONS = ['PICKUP', 'DROP'] as const;

export default function RouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const isNew = routeId === 'new';

  const { data: route, isLoading } = useRouteById(isNew ? '' : routeId);
  const { data: allStops = [] } = useStops();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deactivateRoute = useDeactivateRoute();
  const createStop = useCreateStop();
  const addStop = useAddStop();

  const [name, setName] = useState('');
  const [direction, setDirection] = useState<typeof DIRECTIONS[number]>('PICKUP');
  const [editing, setEditing] = useState(isNew);

  // Stop creation form
  const [newStopName, setNewStopName] = useState('');
  const [newStopLat, setNewStopLat] = useState('');
  const [newStopLng, setNewStopLng] = useState('');
  const [showStopForm, setShowStopForm] = useState(false);

  useEffect(() => {
    if (route) {
      setName(route.name);
      setDirection(route.direction);
    }
  }, [route]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Validation', 'Route name is required'); return; }
    if (isNew) {
      createRoute.mutate(
        { name: name.trim(), direction },
        {
          onSuccess: (created) => {
            Alert.alert('Success', 'Route created');
            router.replace(`/(app)/routes/${created.id}` as never);
          },
          onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
        },
      );
    } else {
      updateRoute.mutate(
        { id: routeId, name: name.trim() },
        {
          onSuccess: () => { Alert.alert('Saved', 'Route updated'); setEditing(false); },
          onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
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
              onSuccess: () => { Alert.alert('Done', 'Route deactivated'); goBackTo('routes/[routeId]'); },
              onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to deactivate'),
            }),
        },
      ],
    );
  };

  const handleAddStop = () => {
    const lat = parseFloat(newStopLat);
    const lng = parseFloat(newStopLng);
    if (!newStopName.trim()) { Alert.alert('Validation', 'Stop name is required'); return; }
    if (isNaN(lat) || isNaN(lng)) { Alert.alert('Validation', 'Enter valid lat/lng'); return; }
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
              onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to add stop to route'),
            },
          );
        },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
      },
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
            .map((rs, i) => (
              <View key={rs.stop.id} style={styles.stopRow}>
                <View style={styles.stopSeq}>
                  <Text style={styles.stopSeqText}>{rs.sequence}</Text>
                </View>
                <View style={styles.stopInfo}>
                  <Text style={styles.stopName}>{rs.stop.name}</Text>
                  <Text style={styles.stopCoord}>{rs.stop.lat.toFixed(4)}, {rs.stop.lng.toFixed(4)}</Text>
                </View>
              </View>
            ))}
        </Card>
      )}

      {/* Deactivate — soft delete only (never a hard delete). */}
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

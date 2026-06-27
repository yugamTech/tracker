import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, AnimatedPressable, IconSplat, Icon, useToast,
} from '@yaanam/ui';
import { useVehicleById, useCreateVehicle, useUpdateVehicle, useDeactivateVehicle, useReactivateVehicle } from '@yaanam/api-client';
import { goBackTo } from '../../../../lib/nav';
import { GroupCard, Field, FormInput, PillPicker, ActionButton, ReadValue } from '../../../../components/forms';

const HUE = colors.fleet;
const TYPES = ['BUS', 'MINI_BUS', 'VAN'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const;

export default function VehicleDetailScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const isNew = vehicleId === 'new';

  const { data: vehicle, isLoading } = useVehicleById(isNew ? '' : vehicleId);
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deactivateVehicle = useDeactivateVehicle();
  const reactivateVehicle = useReactivateVehicle();
  const toast = useToast();

  const [regNumber, setRegNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('BUS');
  const [status, setStatus] = useState<typeof STATUSES[number]>('ACTIVE');
  const [editing, setEditing] = useState(isNew);

  useEffect(() => {
    if (vehicle) {
      setRegNumber(vehicle.regNumber);
      setCapacity(String(vehicle.capacity));
      setType(vehicle.type ?? 'BUS');
      setStatus(vehicle.status);
    }
  }, [vehicle]);

  const handleSave = () => {
    const cap = parseInt(capacity, 10);
    if (!regNumber.trim()) { toast.error('Registration number is required'); return; }
    if (isNaN(cap) || cap < 1) { toast.error('Enter a valid capacity'); return; }

    if (isNew) {
      createVehicle.mutate(
        { regNumber: regNumber.trim().toUpperCase(), capacity: cap, type },
        {
          onSuccess: () => { toast.success('Vehicle added'); goBackTo('routes/vehicle/[vehicleId]'); },
          onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add vehicle'),
        },
      );
    } else {
      updateVehicle.mutate(
        { id: vehicleId, regNumber: regNumber.trim().toUpperCase(), capacity: cap, type, status },
        {
          onSuccess: () => { toast.success('Vehicle updated'); setEditing(false); },
          onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
        },
      );
    }
  };

  const handleDeactivate = () => {
    if (!vehicle) return;
    Alert.alert(
      'Deactivate vehicle',
      `${vehicle.regNumber} will be marked inactive and removed from scheduling. Its record and assignment history are kept. You can reactivate it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () =>
            deactivateVehicle.mutate(vehicleId, {
              onSuccess: () => { toast.success('Vehicle deactivated'); goBackTo('routes/vehicle/[vehicleId]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate'),
            }),
        },
      ],
    );
  };

  const handleReactivate = () => {
    if (!vehicle) return;
    Alert.alert(
      'Reactivate vehicle',
      `${vehicle.regNumber} will be marked active and rejoin the fleet for scheduling.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: () =>
            reactivateVehicle.mutate(vehicleId, {
              onSuccess: () => { toast.success('Vehicle reactivated'); goBackTo('routes/vehicle/[vehicleId]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reactivate'),
            }),
        },
      ],
    );
  };

  const isSaving = createVehicle.isPending || updateVehicle.isPending;

  if (!isNew && isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.fleet} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!isNew && vehicle ? (
        <Card shadow="sm" radius={22} style={styles.header}>
          <IconSplat shape="b2" splatColor={colors.fleetBg} spot="bus" size={48} />
          <View style={styles.headerInfo}>
            <Text style={styles.regText} numberOfLines={1}>{vehicle.regNumber}</Text>
            <Badge label={vehicle.status} variant={vehicle.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
          </View>
          <AnimatedPressable onPress={() => setEditing((e) => !e)} style={styles.editBtn} accessibilityRole="button">
            <Icon name={editing ? 'x' : 'edit'} size={14} color={HUE} />
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </AnimatedPressable>
        </Card>
      ) : null}

      <GroupCard title={isNew ? 'New vehicle' : 'Vehicle details'} spot="bus" hue={HUE}>
        <Field label="Registration number" required>
          {editing
            ? <FormInput hue={HUE} value={regNumber} onChangeText={setRegNumber} placeholder="e.g. HR26DL9900" autoCapitalize="characters" />
            : <ReadValue value={regNumber} />}
        </Field>

        <Field label="Capacity (seats)" required>
          {editing
            ? <FormInput hue={HUE} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="e.g. 25" />
            : <ReadValue value={capacity} />}
        </Field>

        <Field label="Type">
          {editing
            ? <PillPicker hue={HUE} value={type} onChange={setType} options={TYPES.map((t) => ({ label: t.replace('_', ' '), value: t }))} />
            : <ReadValue value={type} />}
        </Field>

        {!isNew ? (
          <Field label="Status">
            {editing
              ? <PillPicker hue={HUE} value={status} onChange={(v) => setStatus(v as typeof STATUSES[number])} options={STATUSES.map((s) => ({ label: s, value: s }))} />
              : <ReadValue value={status} />}
          </Field>
        ) : null}
      </GroupCard>

      {!isNew && vehicle?.assignments && vehicle.assignments.length > 0 ? (
        <GroupCard title="Assigned staff" icon="users" hue={HUE}>
          {vehicle.assignments.map((a, i) => (
            <View key={a.id} style={[styles.assignRow, i > 0 && styles.assignBorder]}>
              <Text style={styles.assignName}>{a.membership.person.name}</Text>
              <Text style={styles.assignMeta}>{a.membership.role} · {a.membership.person.phone}</Text>
            </View>
          ))}
        </GroupCard>
      ) : null}

      {editing ? (
        <ActionButton
          title={isNew ? 'Add vehicle' : 'Save changes'}
          hue={HUE}
          onPress={handleSave}
          loading={isSaving}
          fullWidth
        />
      ) : null}

      {/* Deactivate / Reactivate — soft delete only (never a hard delete). */}
      {!isNew && vehicle?.status === 'ACTIVE' ? (
        <GroupCard title="Danger zone" icon="alert" hue={colors.crit}>
          <Text style={styles.hint}>
            Deactivating removes the vehicle from scheduling but preserves its record and assignment history.
          </Text>
          <ActionButton title="Deactivate vehicle" tone="danger" onPress={handleDeactivate} loading={deactivateVehicle.isPending} fullWidth />
        </GroupCard>
      ) : null}
      {!isNew && vehicle?.status === 'INACTIVE' ? (
        <GroupCard title="Reactivate" icon="checkc" hue={colors.ok}>
          <Text style={styles.hint}>
            This vehicle is deactivated. Reactivating returns it to the active fleet for scheduling.
          </Text>
          <ActionButton title="Reactivate vehicle" hue={colors.ok} onPress={handleReactivate} loading={reactivateVehicle.isPending} fullWidth />
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
  regText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.fleetBg },
  editBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: HUE },
  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },
  assignRow: { paddingVertical: spacing[2] },
  assignBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  assignName: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  assignMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
});

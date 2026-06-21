import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, Card, Badge, useToast } from '@saarthi/ui';
import { useVehicleById, useCreateVehicle, useUpdateVehicle, useDeactivateVehicle, useReactivateVehicle } from '@saarthi/api-client';
import { goBackTo } from '../../../../lib/nav';

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
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!isNew && vehicle && (
        <Card style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.regText}>{vehicle.regNumber}</Text>
            <Badge label={vehicle.status} variant={vehicle.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
          </View>
          <TouchableOpacity onPress={() => setEditing((e) => !e)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </Card>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{isNew ? 'New Vehicle' : 'Vehicle Details'}</Text>

        <Text style={styles.label}>Registration Number *</Text>
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          value={regNumber}
          onChangeText={setRegNumber}
          editable={editing}
          placeholder="e.g. HR26DL9900"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Capacity (seats) *</Text>
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          value={capacity}
          onChangeText={setCapacity}
          editable={editing}
          keyboardType="number-pad"
          placeholder="e.g. 25"
          placeholderTextColor={colors.gray400}
        />

        <Text style={styles.label}>Type</Text>
        {editing ? (
          <View style={styles.chipRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.valueText}>{type}</Text>
        )}

        {!isNew && (
          <>
            <Text style={styles.label}>Status</Text>
            {editing ? (
              <View style={styles.chipRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, status === s && styles.chipActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.valueText}>{status}</Text>
            )}
          </>
        )}
      </Card>

      {!isNew && vehicle?.assignments && vehicle.assignments.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned Staff</Text>
          {vehicle.assignments.map((a) => (
            <View key={a.id} style={styles.assignRow}>
              <Text style={styles.assignName}>{a.membership.person.name}</Text>
              <Text style={styles.assignMeta}>{a.membership.role} · {a.membership.person.phone}</Text>
            </View>
          ))}
        </Card>
      )}

      {editing && (
        <Button
          title={isNew ? 'Add Vehicle' : 'Save Changes'}
          onPress={handleSave}
          loading={isSaving}
          fullWidth
          style={styles.saveBtn}
        />
      )}

      {/* Deactivate / Reactivate — soft delete only (never a hard delete). */}
      {!isNew && vehicle?.status === 'ACTIVE' && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.hint}>
            Deactivating removes the vehicle from scheduling but preserves its record and assignment history.
          </Text>
          <Button
            title="Deactivate Vehicle"
            variant="danger"
            onPress={handleDeactivate}
            loading={deactivateVehicle.isPending}
            fullWidth
          />
        </Card>
      )}
      {!isNew && vehicle?.status === 'INACTIVE' && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Reactivate</Text>
          <Text style={styles.hint}>
            This vehicle is deactivated. Reactivating returns it to the active fleet for scheduling.
          </Text>
          <Button
            title="Reactivate Vehicle"
            onPress={handleReactivate}
            loading={reactivateVehicle.isPending}
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
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  regText: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  editBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary },
  editBtnText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing[1] },
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
  assignRow: { paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border },
  assignName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  assignMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  saveBtn: { marginTop: spacing[2] },
});

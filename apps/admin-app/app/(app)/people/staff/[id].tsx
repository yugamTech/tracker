import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Avatar, Badge, Button } from '@saarthi/ui';
import { useMemberById, useAssignVehicle, useVehicles } from '@saarthi/api-client';

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: member, isLoading } = useMemberById(id);
  const { data: vehicles = [] } = useVehicles();
  const assignVehicle = useAssignVehicle();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const currentVehicle = member?.vehicleAssignments?.[0]?.vehicle ?? null;

  const handleAssign = (vehicleId: string | null) => {
    assignVehicle.mutate(
      { memberId: id, vehicleId },
      {
        onSuccess: () => {
          Alert.alert('Saved', vehicleId ? 'Vehicle assigned' : 'Vehicle assignment cleared');
          setShowAssign(false);
          setSelectedVehicleId(null);
        },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
      },
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!member) {
    return <View style={styles.loader}><Text style={styles.errorText}>Staff member not found</Text></View>;
  }

  const activeVehicles = vehicles.filter((v) => v.status === 'ACTIVE');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <Card style={styles.header}>
        <Avatar name={member.person.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{member.person.name}</Text>
          <Text style={styles.headerPhone}>{member.person.phone}</Text>
          <Badge
            label={member.role}
            variant={member.role === 'DRIVER' ? 'active' : 'inactive'}
            size="sm"
          />
        </View>
      </Card>

      {/* Vehicle assignment */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Assignment</Text>

        {currentVehicle ? (
          <View style={styles.vehicleRow}>
            <View style={styles.vehicleIcon}>
              <Text style={{ fontSize: 24 }}>🚌</Text>
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleReg}>{currentVehicle.regNumber}</Text>
              <Text style={styles.vehicleSub}>Currently assigned</Text>
            </View>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => Alert.alert('Clear Assignment', 'Remove vehicle from this driver?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => handleAssign(null) },
              ])}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.unassignedText}>No vehicle assigned</Text>
        )}

        <Button
          title={showAssign ? 'Cancel' : (currentVehicle ? 'Reassign Vehicle' : 'Assign Vehicle')}
          variant="outline"
          size="sm"
          onPress={() => setShowAssign((v) => !v)}
        />

        {showAssign && (
          <View style={styles.vehicleList}>
            <Text style={styles.listHint}>Select a vehicle:</Text>
            {activeVehicles.length === 0 && (
              <Text style={styles.unassignedText}>No active vehicles available</Text>
            )}
            {activeVehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.vehicleOption, selectedVehicleId === v.id && styles.vehicleOptionActive]}
                onPress={() => setSelectedVehicleId(v.id)}
              >
                <View>
                  <Text style={[styles.vehicleOptionReg, selectedVehicleId === v.id && styles.vehicleOptionRegActive]}>
                    {v.regNumber}
                  </Text>
                  <Text style={styles.vehicleOptionMeta}>{v.type} · {v.capacity} seats</Text>
                </View>
              </TouchableOpacity>
            ))}
            {selectedVehicleId && (
              <Button
                title="Confirm Assignment"
                onPress={() => handleAssign(selectedVehicleId)}
                loading={assignVehicle.isPending}
                fullWidth
              />
            )}
          </View>
        )}
      </Card>

      {/* Role info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{member.role}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{member.status}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{member.person.phone}</Text>
        </View>
        {member.person.email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{member.person.email}</Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSizes.base, color: colors.error },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, gap: spacing[1] },
  headerName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  headerPhone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  vehicleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  vehicleInfo: { flex: 1 },
  vehicleReg: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  vehicleSub: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  clearBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.error },
  clearBtnText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.semibold },
  unassignedText: { fontSize: fontSizes.sm, color: colors.textMuted, paddingVertical: spacing[2] },
  vehicleList: { gap: spacing[3] },
  listHint: { fontSize: fontSizes.sm, color: colors.textSecondary },
  vehicleOption: {
    padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  vehicleOptionActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  vehicleOptionReg: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  vehicleOptionRegActive: { color: colors.primary },
  vehicleOptionMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border },
  infoLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
});

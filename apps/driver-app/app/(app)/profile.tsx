import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Avatar, Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { useMe } from '@saarthi/api-client';

export default function DriverProfileScreen() {
  const { logout } = useAuthStore();
  const { data: me } = useMe();

  const vehicleReg: string | null =
    (me as any)?.vehicleAssignments?.[0]?.vehicle?.regNumber ?? null;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/phone' as never);
        },
      },
    ]);
  };

  const displayName = me?.name ?? 'Driver';
  const displayPhone = me?.phone ?? '—';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.profileCard}>
        <Avatar name={displayName} size={72} />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.phone}>{displayPhone}</Text>
          <Text style={styles.role}>DRIVER</Text>
        </View>
      </View>

      {vehicleReg && (
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleLabel}>Assigned Vehicle</Text>
          <Text style={styles.vehicleReg}>{vehicleReg}</Text>
        </View>
      )}

      <View style={styles.menu}>
        {[
          { label: '🔧 Vehicle Check', onPress: () => router.push('/(app)/vehicle-check' as never) },
          { label: '📋 Trip History', onPress: () => Alert.alert('Coming soon', 'Trip history coming in a later phase') },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Logout" variant="danger" onPress={handleLogout} fullWidth style={{ margin: spacing[5] }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    margin: spacing[4], padding: spacing[5], backgroundColor: colors.white,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
  },
  profileInfo: { gap: spacing[1] },
  name: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  phone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  role: { fontSize: fontSizes.xs, color: '#0EA5E9', fontWeight: fontWeights.medium },
  vehicleCard: {
    marginHorizontal: spacing[4], marginBottom: spacing[2], padding: spacing[4],
    backgroundColor: '#E0F2FE', borderRadius: radius.xl,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  vehicleLabel: { fontSize: fontSizes.xs, color: '#0369A1', fontWeight: fontWeights.medium },
  vehicleReg: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: '#0369A1', marginTop: 2 },
  menu: { backgroundColor: colors.white, borderRadius: radius.xl, marginHorizontal: spacing[4], overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuLabel: { fontSize: fontSizes.base, color: colors.textPrimary },
  arrow: { fontSize: fontSizes.xl, color: colors.gray400 },
});

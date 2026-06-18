import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius, letterSpacing,
  Avatar, Button, AppHeader, ListItem, SectionHeader, Divider, ScreenContainer,
} from '@saarthi/ui';
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

  const menu = [
    { label: 'My KYC', onPress: () => router.push('/(app)/kyc' as never) },
    { label: 'Vehicle Check', onPress: () => router.push('/(app)/vehicle-check' as never) },
    { label: 'Trip History', onPress: () => router.push('/(app)/history' as never) },
  ];

  return (
    <ScreenContainer bg={colors.backgroundMuted}>
      <AppHeader title="Profile" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
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
            <Text style={styles.vehicleLabel}>ASSIGNED VEHICLE</Text>
            <Text style={styles.vehicleReg}>{vehicleReg}</Text>
          </View>
        )}

        <SectionHeader title="Account" />
        <View style={styles.menu}>
          {menu.map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <Divider inset={4} />}
              <ListItem title={item.label} onPress={item.onPress} />
            </React.Fragment>
          ))}
        </View>

        <Button title="Logout" variant="danger" onPress={handleLogout} fullWidth size="lg" style={styles.logout} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], paddingBottom: spacing[8] },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    padding: spacing[5], backgroundColor: colors.background,
    borderRadius: radius['2xl'], borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  profileInfo: { flex: 1, gap: spacing[1] },
  name: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  phone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  role: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide, marginTop: 2 },
  vehicleCard: {
    marginTop: spacing[3], padding: spacing[4],
    backgroundColor: colors.secondaryBg, borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.secondaryLight,
  },
  vehicleLabel: { fontSize: fontSizes.xs, color: colors.secondaryDark, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide },
  vehicleReg: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.secondaryDark, marginTop: 2 },
  menu: {
    backgroundColor: colors.background, borderRadius: radius.xl, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  logout: { marginTop: spacing[6] },
});

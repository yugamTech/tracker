import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Avatar, Button } from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';
import { useMyStudents } from '@saarthi/api-client';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { person, activeMembership, logout } = useAuthStore();
  const { data: students } = useMyStudents();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => { logout(); router.replace('/(auth)/phone'); },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
      </View>

      {/* Identity card */}
      <View style={styles.profileCard}>
        <Avatar name={person?.name ?? 'Parent'} size={72} />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{person?.name ?? 'Parent'}</Text>
          <Text style={styles.phone}>{person?.phone}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>Parent</Text>
          </View>
        </View>
      </View>

      {/* School pill */}
      {activeMembership?.tenantName && (
        <View style={styles.schoolRow}>
          <Text style={styles.schoolIcon}>🏫</Text>
          <Text style={styles.schoolName}>{activeMembership.tenantName}</Text>
          {students != null && (
            <View style={styles.childCount}>
              <Text style={styles.childCountText}>
                {students.length} child{students.length !== 1 ? 'ren' : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        {[
          {
            label: '👶 My Children',
            value: students != null ? `${students.length} linked` : '',
            onPress: () => Alert.alert('Coming soon', 'This feature is being built'),
          },
          {
            label: '🔔 Notifications',
            value: '',
            onPress: () => router.push('/(app)/profile/notifications' as never),
          },
          {
            label: '🔒 Privacy & Consent',
            value: '',
            onPress: () => Alert.alert('Coming soon', 'This feature is being built'),
          },
          {
            label: '📞 Contact Support',
            value: '',
            onPress: () => Alert.alert('Coming soon', 'This feature is being built'),
          },
          {
            label: '📜 Terms & Privacy',
            value: '',
            onPress: () => Alert.alert('Coming soon', 'This feature is being built'),
          },
        ].map((item, idx, arr) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, idx === arr.length - 1 && styles.menuItemLast]}
            onPress={item.onPress}
          >
            <Text style={styles.menuLabel}>{item.label}</Text>
            <View style={styles.menuRight}>
              {item.value ? <Text style={styles.menuValue}>{item.value}</Text> : null}
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Logout"
        variant="danger"
        onPress={handleLogout}
        fullWidth
        style={{ margin: spacing[5] }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    padding: spacing[5],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    margin: spacing[4], padding: spacing[5], backgroundColor: colors.white,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
  },
  profileInfo: { gap: spacing[2] },
  name: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  phone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  roleText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.semibold },
  schoolRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    padding: spacing[3], backgroundColor: colors.white,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
  },
  schoolIcon: { fontSize: 18 },
  schoolName: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  childCount: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: radius.full,
  },
  childCountText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.semibold },
  menu: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    marginHorizontal: spacing[4], overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuLabel: { fontSize: fontSizes.base, color: colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  menuValue: { fontSize: fontSizes.sm, color: colors.textSecondary },
  arrow: { fontSize: fontSizes.xl, color: colors.gray400 },
});

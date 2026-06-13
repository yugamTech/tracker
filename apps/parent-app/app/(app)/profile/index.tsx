import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Avatar, Button } from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { person, activeMembership, logout } = useAuthStore();

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
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.profileCard}>
        <Avatar name={person?.name ?? 'Parent'} size={72} />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{person?.name ?? 'Demo Parent'}</Text>
          <Text style={styles.phone}>{person?.phone}</Text>
          <Text style={styles.role}>{activeMembership?.role ?? 'PARENT'}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        {[
          { label: '👶 My Children', onPress: () => Alert.alert('Coming soon', 'This feature is being built') },
          { label: '🔔 Notifications', onPress: () => router.push('/(app)/profile/notifications' as never) },
          { label: '🔒 Privacy Settings', onPress: () => Alert.alert('Coming soon', 'This feature is being built') },
          { label: '📞 Contact Support', onPress: () => Alert.alert('Coming soon', 'This feature is being built') },
          { label: '📜 Terms & Privacy', onPress: () => Alert.alert('Coming soon', 'This feature is being built') },
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
  header: { padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    margin: spacing[4], padding: spacing[5], backgroundColor: colors.white,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
  },
  profileInfo: { gap: spacing[1] },
  name: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  phone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  role: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.medium },
  menu: { backgroundColor: colors.white, borderRadius: radius.xl, marginHorizontal: spacing[4], overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuLabel: { fontSize: fontSizes.base, color: colors.textPrimary },
  arrow: { fontSize: fontSizes.xl, color: colors.gray400 },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScrollView } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius } from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { person, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/phone'); } },
    ]);
  };

  const SECTIONS = [
    {
      title: 'School Settings',
      items: [
        { label: '🏫 School Profile', onPress: () => {} },
        { label: '⏰ Bell Timings', onPress: () => {} },
        { label: '🚨 Alert Numbers', onPress: () => {} },
        { label: '🚩 Feature Flags', onPress: () => {} },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: '👤 Profile', onPress: () => {} },
        { label: '🔔 Notification Config', onPress: () => {} },
        { label: '🔒 Privacy & Security', onPress: () => {} },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Admin info */}
      <View style={styles.adminCard}>
        <View style={styles.adminAvatar}>
          <Text style={{ fontSize: 28 }}>👩‍💼</Text>
        </View>
        <View>
          <Text style={styles.adminName}>{person?.name ?? 'Admin'}</Text>
          <Text style={styles.adminPhone}>{person?.phone}</Text>
          <Text style={styles.adminRole}>School Admin · Sunrise School</Text>
        </View>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuGroup}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, idx < section.items.length - 1 && styles.menuItemBorder]}
                onPress={item.onPress}
              >
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  adminCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    margin: spacing[4], padding: spacing[5],
    backgroundColor: '#7C3AED', borderRadius: radius.xl,
  },
  adminAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  adminName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.white },
  adminPhone: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  adminRole: { fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  section: { marginHorizontal: spacing[4], marginBottom: spacing[4] },
  sectionTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing[2], paddingLeft: spacing[1] },
  menuGroup: { backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4] },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { fontSize: fontSizes.base, color: colors.textPrimary },
  arrow: { fontSize: fontSizes.xl, color: colors.gray400 },
  logoutBtn: {
    margin: spacing[4], padding: spacing[4],
    backgroundColor: colors.white, borderRadius: radius.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.errorBg,
    marginBottom: spacing[8],
  },
  logoutText: { fontSize: fontSizes.base, color: colors.error, fontWeight: fontWeights.semibold },
});

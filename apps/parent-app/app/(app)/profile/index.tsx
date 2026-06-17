import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing, radius,
  AppHeader, Avatar, Card, Badge, Button, ListItem, Divider, SectionHeader,
} from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';
import { useMyStudents } from '@saarthi/api-client';

export default function ProfileScreen() {
  const { person, activeMembership, logout } = useAuthStore();
  const { data: students } = useMyStudents();
  const childCount = students?.length ?? 0;
  const multiple = childCount > 1;

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => { logout(); router.replace('/(auth)/phone'); },
      },
    ]);
  };

  const soon = () => Alert.alert('Coming soon', 'This feature is being built');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Profile" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <Card style={styles.identity} shadow="md">
          <Avatar name={person?.name ?? 'Parent'} size={64} />
          <View style={styles.identityInfo}>
            <Text style={styles.name} numberOfLines={1}>{person?.name ?? 'Parent'}</Text>
            <Text style={styles.phone}>{person?.phone}</Text>
            <Badge label="Parent" variant="info" size="sm" />
          </View>
        </Card>

        {/* School */}
        {activeMembership?.tenantName ? (
          <Card style={styles.school} shadow="sm">
            <Text style={styles.schoolIcon}>🏫</Text>
            <Text style={styles.schoolName} numberOfLines={1}>{activeMembership.tenantName}</Text>
            <Badge
              label={`${childCount} ${childCount === 1 ? 'child' : 'children'}`}
              variant="default"
              size="sm"
            />
          </Card>
        ) : null}

        {/* Menu */}
        <SectionHeader title="Account" />
        <Card style={styles.menu} padding={0} shadow="sm">
          {multiple && (
            <>
              <ListItem
                left={<Text style={styles.menuIcon}>👶</Text>}
                title="Switch child"
                subtitle={`${childCount} linked profiles`}
                onPress={() => router.push('/(app)/child-select' as never)}
              />
              <Divider inset={4} />
            </>
          )}
          <ListItem
            left={<Text style={styles.menuIcon}>🔔</Text>}
            title="Notifications"
            onPress={() => router.push('/(app)/profile/notifications' as never)}
          />
          <Divider inset={4} />
          <ListItem
            left={<Text style={styles.menuIcon}>🔒</Text>}
            title="Privacy & consent"
            onPress={soon}
          />
          <Divider inset={4} />
          <ListItem
            left={<Text style={styles.menuIcon}>📞</Text>}
            title="Contact support"
            onPress={soon}
          />
          <Divider inset={4} />
          <ListItem
            left={<Text style={styles.menuIcon}>📜</Text>}
            title="Terms & privacy"
            onPress={soon}
          />
        </Card>

        <Button
          title="Log out"
          variant="danger"
          fullWidth
          onPress={handleLogout}
          style={styles.logout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  scroll: { padding: spacing[4], paddingBottom: spacing[8] },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  identityInfo: { flex: 1, gap: spacing[1], alignItems: 'flex-start' },
  name: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  phone: { fontSize: fontSizes.sm, color: colors.textSecondary },
  school: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
  schoolIcon: { fontSize: 18 },
  schoolName: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  menu: { overflow: 'hidden' },
  menuIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  logout: { marginTop: spacing[6] },
});

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';
import { colors, spacing, fontSizes, fontWeights, radius, Card } from '@yaanam/ui';

export default function ContextSwitchScreen() {
  const { memberships, setActiveMembership } = useAuthStore();

  const select = (m: typeof memberships[number]) => {
    setActiveMembership(m);
    router.replace('/(app)/child-select' as never);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Account</Text>
      <Text style={styles.subtitle}>You have access to multiple schools</Text>
      <FlatList
        data={memberships}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ gap: spacing[3] }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => select(item)} activeOpacity={0.8}>
            <Card>
              <Text style={styles.schoolName}>{item.tenantName}</Text>
              <Text style={styles.role}>{item.role}</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing[6] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing[8], marginBottom: spacing[2] },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing[5] },
  schoolName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  role: { fontSize: fontSizes.sm, color: colors.primary, marginTop: spacing[1] },
});

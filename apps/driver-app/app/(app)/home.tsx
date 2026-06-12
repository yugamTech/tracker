import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';

const MOCK_TRIPS = [
  {
    id: 'trip-today-001',
    route: 'Route A — Sector 18',
    direction: 'PICKUP',
    time: '07:15 AM',
    riderCount: 22,
    status: 'SCHEDULED',
  },
  {
    id: 'trip-today-002',
    route: 'Route A — Sector 18',
    direction: 'DROP',
    time: '02:30 PM',
    riderCount: 22,
    status: 'SCHEDULED',
  },
];

export default function DriverHomeScreen() {
  const person = useAuthStore((s) => s.person);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {person?.name?.split(' ')[0] ?? 'Driver'} 👋</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <TouchableOpacity style={styles.checkBtn} onPress={() => router.push('/(app)/vehicle-check' as never)}>
          <Text style={{ fontSize: 20 }}>🔧</Text>
          <Text style={styles.checkLabel}>Vehicle Check</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Today's Trips ({MOCK_TRIPS.length})</Text>

      <FlatList
        data={MOCK_TRIPS}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.time}>{item.time}</Text>
                <Text style={styles.route}>{item.route}</Text>
                <Text style={styles.direction}>{item.direction === 'PICKUP' ? '⬆️ Pickup' : '⬇️ Drop'}</Text>
              </View>
              <Badge label={item.status} variant="warning" size="sm" />
            </View>
            <View style={styles.riderRow}>
              <Text style={styles.riderCount}>👥 {item.riderCount} Riders</Text>
            </View>
            <Button
              title="Start Trip →"
              onPress={() => router.push(`/(app)/trip/${item.id}/index` as never)}
              fullWidth
              size="md"
              style={{ marginTop: spacing[3] }}
            />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greeting: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  date: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  checkBtn: { alignItems: 'center', gap: 4 },
  checkLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, margin: spacing[4] },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  time: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  route: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  riderRow: { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border },
  riderCount: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
});

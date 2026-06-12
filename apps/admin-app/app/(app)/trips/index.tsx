import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';

const MOCK_TRIPS = [
  { id: 'trip-001', date: 'Today, Jun 12', direction: 'PICKUP', route: 'Route A', bus: 'HR26-DL-9900', driver: 'Ramesh Kumar', status: 'COMPLETED', boarded: 22, total: 22 },
  { id: 'trip-002', date: 'Today, Jun 12', direction: 'PICKUP', route: 'Route B', bus: 'HR26-DL-9901', driver: 'Suresh Yadav', status: 'COMPLETED', boarded: 18, total: 20 },
  { id: 'trip-003', date: 'Today, Jun 12', direction: 'PICKUP', route: 'Route C', bus: 'HR26-DL-9902', driver: 'Mohan Das', status: 'ABORTED', boarded: 0, total: 25 },
  { id: 'trip-004', date: 'Yesterday, Jun 11', direction: 'DROP', route: 'Route A', bus: 'HR26-DL-9900', driver: 'Ramesh Kumar', status: 'COMPLETED', boarded: 22, total: 22 },
  { id: 'trip-005', date: 'Yesterday, Jun 11', direction: 'DROP', route: 'Route B', bus: 'HR26-DL-9901', driver: 'Suresh Yadav', status: 'COMPLETED', boarded: 19, total: 20 },
  { id: 'trip-006', date: 'Jun 10', direction: 'PICKUP', route: 'Route A', bus: 'HR26-DL-9900', driver: 'Ramesh Kumar', status: 'COMPLETED', boarded: 21, total: 22 },
  { id: 'trip-007', date: 'Jun 10', direction: 'PICKUP', route: 'Route B', bus: 'HR26-DL-9901', driver: 'Suresh Yadav', status: 'COMPLETED', boarded: 20, total: 20 },
];

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: colors.success,
  ABORTED: colors.error,
  IN_PROGRESS: '#0EA5E9',
};

export default function TripHistoryScreen() {
  const [search, setSearch] = useState('');

  const filtered = MOCK_TRIPS.filter((t) =>
    !search || t.route.toLowerCase().includes(search.toLowerCase()) || t.driver.toLowerCase().includes(search.toLowerCase()) || t.bus.includes(search)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search route, driver, bus…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(app)/fleet/${item.id}` as never)} activeOpacity={0.85}>
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.leftCol}>
                  <Text style={styles.date}>{item.date}</Text>
                  <Text style={styles.route}>{item.route} · {item.direction}</Text>
                  <Text style={styles.driver}>{item.driver}</Text>
                  <Text style={styles.bus}>{item.bus}</Text>
                </View>
                <View style={styles.rightCol}>
                  <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? colors.gray400 }]}>{item.status}</Text>
                  <Text style={styles.boarding}>{item.boarded}/{item.total}</Text>
                  <Text style={styles.boardingLabel}>boarded</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No trips match your search</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  searchRow: { padding: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: {
    backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing[3], fontSize: fontSizes.base, color: colors.textPrimary,
  },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  leftCol: { flex: 1, gap: spacing[1] },
  date: { fontSize: fontSizes.xs, color: colors.textMuted },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  driver: { fontSize: fontSizes.sm, color: colors.textSecondary },
  bus: { fontSize: fontSizes.xs, color: colors.textMuted },
  rightCol: { alignItems: 'flex-end', gap: spacing[1] },
  status: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  boarding: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  boardingLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing[8] },
});

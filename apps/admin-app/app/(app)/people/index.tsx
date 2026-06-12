import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Avatar, Card } from '@saarthi/ui';

const MOCK_STUDENTS = [
  { id: 's1', name: 'Arjun Sharma', regId: 'SRS-2024-001', class: '4-B', route: 'Route A', stop: 'Sector 18' },
  { id: 's2', name: 'Priya Gupta', regId: 'SRS-2024-002', class: '3-A', route: 'Route A', stop: 'DLF Phase 2' },
  { id: 's3', name: 'Rohan Verma', regId: 'SRS-2024-003', class: '5-C', route: 'Route B', stop: 'Vatika City' },
  { id: 's4', name: 'Ananya Singh', regId: 'SRS-2024-004', class: '2-A', route: 'Route B', stop: 'Sector 18' },
  { id: 's5', name: 'Kabir Mehta', regId: 'SRS-2024-005', class: '1-B', route: 'Route C', stop: 'DLF Phase 2' },
];

export default function PeopleScreen() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'students' | 'staff'>('students');

  const filtered = MOCK_STUDENTS.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.regId.includes(search)
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or ID…"
          placeholderTextColor={colors.gray400}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['students', 'staff'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tab === 'students' ? filtered : []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tab === 'staff' ? 'Staff list coming soon' : 'No students found'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <Avatar name={item.name} size={44} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.regId} · Class {item.class}</Text>
                <Text style={styles.route}>🚌 {item.route} · 📍 {item.stop}</Text>
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  searchRow: { padding: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
  },
  tabs: { flexDirection: 'row', backgroundColor: colors.white },
  tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#7C3AED' },
  tabText: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.gray400 },
  tabTextActive: { color: '#7C3AED', fontWeight: fontWeights.bold },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  info: { flex: 1 },
  name: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  route: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', padding: spacing[8] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
});

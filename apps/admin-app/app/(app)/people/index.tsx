import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Avatar, Card, Button } from '@saarthi/ui';
import { useStudents, useMembers } from '@saarthi/api-client';
import { router } from 'expo-router';

export default function PeopleScreen() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'students' | 'staff'>('students');

  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: staff, isLoading: staffLoading } = useMembers(tab === 'staff' ? undefined : undefined);

  const filteredStudents = (students ?? []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.regId ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredStaff = (staff ?? []).filter((m) =>
    m.person.name.toLowerCase().includes(search.toLowerCase()) ||
    m.person.phone.includes(search)
  );

  const isLoading = tab === 'students' ? studentsLoading : staffLoading;

  return (
    <View style={styles.container}>
      {/* Search + Add */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or ID…"
          placeholderTextColor={colors.gray400}
        />
        <Button
          title="Import"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/(app)/people/import' as never)}
          style={styles.addBtn}
        />
        <Button
          title="+ Add"
          size="sm"
          onPress={() =>
            router.push(
              (tab === 'students' ? '/(app)/people/students/new' : '/(app)/people/staff/new') as never,
            )
          }
          style={styles.addBtn}
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

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : tab === 'students' ? (
        <FlatList
          data={filteredStudents}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No students found</Text></View>}
          renderItem={({ item: s }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/people/students/${s.id}` as never)} activeOpacity={0.85}>
              <Card style={styles.card}>
                <View style={styles.cardRow}>
                  <Avatar name={s.name} size={44} />
                  <View style={styles.info}>
                    <Text style={styles.name}>{s.name}</Text>
                    {s.regId && <Text style={styles.meta}>{s.regId}</Text>}
                    {(s.route || s.stop) && (
                      <Text style={styles.route}>
                        {s.route ? `🚌 ${s.route.name}` : ''}{s.stop ? ` · 📍 ${s.stop.name}` : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={filteredStaff}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No staff found</Text></View>}
          renderItem={({ item: m }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/people/staff/${m.id}` as never)} activeOpacity={0.85}>
              <Card style={styles.card}>
                <View style={styles.cardRow}>
                  <Avatar name={m.person.name} size={44} />
                  <View style={styles.info}>
                    <Text style={styles.name}>{m.person.name}</Text>
                    <Text style={styles.meta}>{m.person.phone} · {m.role}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  addBtn: { flexShrink: 0 },
  chevron: { fontSize: 20, color: colors.gray400, paddingLeft: spacing[2] },
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
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

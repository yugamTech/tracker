import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Avatar, Badge, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useMembers } from '@saarthi/api-client';

/** Role filter chips. `undefined` value = all staff (PRD-01 §7 people management). */
const ROLE_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'DRIVER', label: 'Drivers' },
  { value: 'CONDUCTOR', label: 'Conductors' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'TRANSPORT_MANAGER', label: 'Transport' },
] as const;

/** Status filter chips — `''` = all (deactivated staff have a non-ACTIVE membership). */
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

export default function StaffListScreen() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: staff, isLoading, isError } = useMembers(roleFilter);

  const filtered = (staff ?? []).filter((m) =>
    (!statusFilter || (statusFilter === 'ACTIVE' ? m.status === 'ACTIVE' : m.status !== 'ACTIVE')) &&
    (!search ||
      m.person.name.toLowerCase().includes(search.toLowerCase()) ||
      m.person.phone.includes(search)),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.search}
            placeholder="Search name or phone…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/people/staff/new' as never)}
        >
          <Text style={styles.addBtnText}>+ Add Staff</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => {
          const active = roleFilter === f.value;
          return (
            <TouchableOpacity
              key={f.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setRoleFilter(f.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.statusRow}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <TouchableOpacity
              key={f.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setStatusFilter(f.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && <LoadingSpinner fullScreen />}

      {isError && (
        <EmptyState title="Could not load staff" description="Check your connection and try again" />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={search ? 'No staff match' : 'No staff yet'}
              description={search ? 'Try a different search term' : 'Add a driver, conductor or admin with + Add Staff'}
            />
          }
          renderItem={({ item: m }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(app)/people/staff/${m.id}` as never)}
              activeOpacity={0.85}
            >
              <Card style={styles.card}>
                <View style={styles.cardRow}>
                  <Avatar name={m.person.name} size={44} />
                  <View style={styles.info}>
                    <Text style={styles.name}>{m.person.name}</Text>
                    <Text style={styles.meta}>{m.person.phone}</Text>
                  </View>
                  <View style={styles.badges}>
                    <Badge label={m.role} variant={m.status === 'ACTIVE' ? 'active' : 'default'} size="sm" />
                    {m.status !== 'ACTIVE' ? <Badge label="Inactive" variant="inactive" size="sm" /> : null}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[4], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchWrap: { flex: 1 },
  search: {
    backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing[3], fontSize: fontSizes.base, color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: '#7C3AED', borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  addBtnText: { color: colors.white, fontWeight: fontWeights.semibold, fontSize: fontSizes.sm },
  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
    backgroundColor: colors.white,
  },
  statusRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3],
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.white },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  info: { flex: 1 },
  name: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
});

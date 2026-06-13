import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useStudents } from '@saarthi/api-client';

export default function StudentsScreen() {
  const [search, setSearch] = useState('');
  const { data: students, isLoading, isError } = useStudents();

  const filtered = (students ?? []).filter((s) =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.regId ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.route?.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.search}
            placeholder="Search name, reg ID, route…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/people/students/new' as never)}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <LoadingSpinner fullScreen />}

      {isError && (
        <EmptyState title="Could not load students" description="Check your connection and try again" />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={search ? 'No students match' : 'No students yet'}
              description={search ? 'Try a different search term' : 'Add students via the import wizard or the + button'}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(app)/people/students/${item.id}` as never)}
              activeOpacity={0.85}
            >
              <Card style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {item.regId ? `${item.regId} · ` : ''}{item.route?.name ?? 'No route assigned'}
                    </Text>
                  </View>
                  <Badge
                    label={item.status}
                    variant={item.status === 'ACTIVE' ? 'active' : 'inactive'}
                    size="sm"
                  />
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
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: fontWeights.bold, fontSize: fontSizes.lg },
  info: { flex: 1 },
  name: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
});

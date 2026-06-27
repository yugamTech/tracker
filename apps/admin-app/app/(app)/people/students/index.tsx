import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Badge, LoadingSpinner, EmptyState, AnimatedPressable, Icon, IconSplat,
} from '@yaanam/ui';
import { useStudents } from '@yaanam/api-client';
import { AddButton, FormInput, PillPicker } from '../../../../components/forms';

/** Status filter chips — `''` = all (deactivated students set status INACTIVE). */
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

const HUE = colors.people;

export default function StudentsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data: students, isLoading, isError } = useStudents();

  const filtered = (students ?? []).filter((s) =>
    (!statusFilter || s.status === statusFilter) &&
    (!search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.regId ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.route?.name ?? '').toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.headerRow}>
          <View style={styles.searchWrap}>
            <FormInput hue={HUE} placeholder="Search name, reg ID, route…" value={search} onChangeText={setSearch} />
          </View>
          <AddButton onPress={() => router.push('/(app)/people/students/new' as never)} />
        </View>
        <PillPicker
          hue={HUE}
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map((f) => ({ label: f.label, value: f.value }))}
        />
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
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<IconSplat shape="b1" splatColor={colors.peopleBg} spot="users" size={60} />}
                title={search ? 'No students match' : 'No students yet'}
                description={search ? 'Try a different search term' : 'Add students via the import wizard or the + button'}
              />
            </View>
          }
          renderItem={({ item }) => (
            <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/people/students/${item.id}` as never)}>
              <Card shadow="sm" radius={20}>
                <View style={styles.cardRow}>
                  <Avatar name={item.name} size={44} />
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.metaRow}>
                      <Icon name="pin" size={13} color={colors.ink3} />
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.regId ? `${item.regId} · ` : ''}{item.route?.name ?? 'No route assigned'}
                      </Text>
                    </View>
                  </View>
                  <Badge label={item.status} variant={item.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
                  <Icon name="chevron" size={16} color={colors.ink3} />
                </View>
              </Card>
            </AnimatedPressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  toolbar: {
    gap: spacing[3], padding: spacing[4], backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  searchWrap: { flex: 1 },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320, justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.base, fontWeight: fontWeights.extrabold, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },
});

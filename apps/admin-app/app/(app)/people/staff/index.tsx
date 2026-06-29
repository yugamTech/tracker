import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Badge, LoadingSpinner, EmptyState, AnimatedPressable, Icon, IconSplat,
} from '@yaanam/ui';
import { useMembers } from '@yaanam/api-client';
import { AddButton, FormInput, PillPicker } from '../../../../components/forms';

/** Role filter chips. `''` value = all staff (PRD-01 §7 people management). */
const ROLE_FILTERS = [
  { value: '', label: 'All' },
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

const HUE = colors.people;

export default function StaffListScreen() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // includeInactive: the management list must surface deactivated (SUSPENDED)
  // staff so the Inactive filter works and they can be reopened to reactivate.
  const { data: staff, isLoading, isError } = useMembers(roleFilter || undefined, true);

  const filtered = (staff ?? []).filter((m) =>
    (!statusFilter || (statusFilter === 'ACTIVE' ? m.status === 'ACTIVE' : m.status !== 'ACTIVE')) &&
    (!search ||
      m.person.name.toLowerCase().includes(search.toLowerCase()) ||
      m.person.phone.includes(search)),
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.headerRow}>
          <View style={styles.searchWrap}>
            <FormInput hue={HUE} placeholder="Search name or phone…" value={search} onChangeText={setSearch} />
          </View>
          <AddButton label="Add staff" onPress={() => router.push('/(app)/people/staff/new' as never)} />
        </View>
        <PillPicker
          hue={HUE}
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLE_FILTERS.map((f) => ({ label: f.label, value: f.value }))}
        />
        <PillPicker
          hue={HUE}
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map((f) => ({ label: f.label, value: f.value }))}
        />
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
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<IconSplat shape="b2" splatColor={colors.peopleBg} spot="users" size={60} />}
                title={search ? 'No staff match' : 'No staff yet'}
                description={search ? 'Try a different search term' : 'Add a driver, conductor or admin with + Add staff'}
              />
            </View>
          }
          renderItem={({ item: m }) => (
            <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/people/staff/${m.id}` as never)}>
              <Card shadow="sm" radius={20}>
                <View style={styles.cardRow}>
                  <Avatar name={m.person.name} size={44} />
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{m.person.name}</Text>
                    <View style={styles.metaRow}>
                      <Icon name="phone" size={13} color={colors.ink3} />
                      <Text style={styles.meta} numberOfLines={1}>{m.person.phone}</Text>
                    </View>
                  </View>
                  <View style={styles.badges}>
                    <Badge label={m.role} variant={m.status === 'ACTIVE' ? 'active' : 'default'} size="sm" />
                    {m.status !== 'ACTIVE' ? <Badge label="Inactive" variant="inactive" size="sm" /> : null}
                  </View>
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
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Avatar, Badge, Button, Skeleton, EmptyState, AnimatedPressable, SegmentedControl,
} from '@saarthi/ui';
import { useStudents, useMembers } from '@saarthi/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { SearchField } from '../../../components/SearchField';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';

type Tab = 'students' | 'staff' | 'import';
const TABS = [
  { label: 'Students', value: 'students' as const },
  { label: 'Staff', value: 'staff' as const },
  { label: 'Import', value: 'import' as const },
];

function SkeletonGrid() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} shadow="sm" style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <Skeleton width={44} height={44} circle />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="55%" height={15} />
              <Skeleton width="35%" height={12} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function PeopleScreen() {
  const [tab, setTab] = useState<Tab>('students');
  const [search, setSearch] = useState('');
  const { gridColumns } = useResponsive();

  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: staff, isLoading: staffLoading } = useMembers();

  const q = search.toLowerCase();
  const filteredStudents = (students ?? []).filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.regId ?? '').toLowerCase().includes(q) || (s.route?.name ?? '').toLowerCase().includes(q),
  );
  const filteredStaff = (staff ?? []).filter(
    (m) => !q || m.person.name.toLowerCase().includes(q) || m.person.phone.includes(search),
  );

  const headerRight =
    tab === 'students' ? <HeaderAction label="+ Add" onPress={() => router.push('/(app)/people/students/new' as never)} />
    : tab === 'staff' ? <HeaderAction label="+ Add" onPress={() => router.push('/(app)/people/staff/new' as never)} />
    : undefined;

  return (
    <AdminScreen
      title="People"
      subtitle="Students, staff & imports"
      headerRight={headerRight}
      subnav={<SegmentedControl segments={TABS} value={tab} onChange={(v) => setTab(v as Tab)} />}
    >
      <View style={styles.root}>
        {tab !== 'import' ? (
          <View style={styles.searchRow}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={tab === 'students' ? 'Search name, reg ID, route…' : 'Search name or phone…'}
            />
          </View>
        ) : null}

        {tab === 'import' ? (
          <ImportPanel />
        ) : tab === 'students' ? (
          studentsLoading ? <SkeletonGrid /> : (
            <GridList
              data={filteredStudents}
              columns={gridColumns}
              keyExtractor={(s) => s.id}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <EmptyState
                    icon={<Text style={{ fontSize: 40 }}>🧑‍🎓</Text>}
                    title={search ? 'No students match' : 'No students yet'}
                    description={search ? 'Try a different search term.' : 'Add students with the + button or the import wizard.'}
                  />
                </View>
              }
              renderItem={(item) => (
                <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/people/students/${item.id}` as never)}>
                  <Card shadow="sm">
                    <View style={styles.row}>
                      <Avatar name={item.name} size={44} />
                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.meta} numberOfLines={1}>
                          {item.regId ? `${item.regId} · ` : ''}{item.route?.name ?? 'No route assigned'}
                        </Text>
                      </View>
                      <Badge label={item.status} variant={item.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />
                    </View>
                  </Card>
                </AnimatedPressable>
              )}
            />
          )
        ) : (
          staffLoading ? <SkeletonGrid /> : (
            <GridList
              data={filteredStaff}
              columns={gridColumns}
              keyExtractor={(m) => m.id}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <EmptyState
                    icon={<Text style={{ fontSize: 40 }}>🧑‍✈️</Text>}
                    title={search ? 'No staff match' : 'No staff yet'}
                    description={search ? 'Try a different search term.' : 'Add a driver, conductor or admin with the + button.'}
                  />
                </View>
              }
              renderItem={(m) => (
                <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/people/staff/${m.id}` as never)}>
                  <Card shadow="sm">
                    <View style={styles.row}>
                      <Avatar name={m.person.name} size={44} />
                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>{m.person.name}</Text>
                        <Text style={styles.meta} numberOfLines={1}>{m.person.phone}</Text>
                      </View>
                      <Badge label={m.role} variant="active" size="sm" />
                    </View>
                  </Card>
                </AnimatedPressable>
              )}
            />
          )
        )}
      </View>
    </AdminScreen>
  );
}

function ImportPanel() {
  return (
    <View style={styles.importWrap}>
      <Card shadow="sm" style={styles.importCard}>
        <View style={styles.importIcon}><Text style={{ fontSize: 30 }}>📥</Text></View>
        <Text style={styles.importTitle}>Bulk import</Text>
        <Text style={styles.importBody}>
          Upload a spreadsheet of students or staff. We'll validate every row and show a preview before anything is saved.
        </Text>
        <Button title="Start import" onPress={() => router.push('/(app)/people/import' as never)} style={styles.importBtn} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 300, flexGrow: 1 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  emptyWrap: { flex: 1, minHeight: 320 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  info: { flex: 1 },
  name: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },

  importWrap: { padding: spacing[4], alignItems: 'center' },
  importCard: { maxWidth: 460, width: '100%', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] },
  importIcon: {
    width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1],
  },
  importTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  importBody: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing[2] },
  importBtn: { marginTop: spacing[3], alignSelf: 'stretch' },
});

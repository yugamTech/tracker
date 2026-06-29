import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Badge, Chip, Skeleton, EmptyState, AnimatedPressable, SegmentedControl, SlideIn,
  IconSplat, Icon, type IconName,
} from '@yaanam/ui';
import { useStudents, useMembers, useParents } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SearchField } from '../../../components/SearchField';
import { GridList } from '../../../components/widgets';
import { AddButton } from '../../../components/forms';
import { useResponsive } from '../../../hooks/useResponsive';

type Tab = 'students' | 'parents' | 'staff' | 'import';
const TABS = [
  { label: 'Students', value: 'students' as const },
  { label: 'Parents', value: 'parents' as const },
  { label: 'Staff', value: 'staff' as const },
  { label: 'Import', value: 'import' as const },
];

type StatusFilter = 'all' | 'active' | 'inactive';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];
/** Per-card entrance delay for the grid stagger, capped so long lists stay snappy. */
const cardDelay = (i: number) => Math.min(i, 8) * 45;

/** Active iff the record's status is exactly ACTIVE; everything else is inactive. */
function matchesStatus(status: string, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const active = status === 'ACTIVE';
  return filter === 'active' ? active : !active;
}

function SkeletonGrid() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} shadow="sm" radius={20} style={styles.skeletonCard}>
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

/** Shared person list row — avatar, name, an icon-led meta line, a status pill. */
function PersonRow({
  name, metaIcon, meta, badge, onPress, delay,
}: {
  name: string;
  metaIcon: IconName;
  meta: string;
  badge: React.ReactNode;
  onPress: () => void;
  delay: number;
}) {
  return (
    <SlideIn delay={delay}>
      <AnimatedPressable scaleTo={0.99} onPress={onPress}>
        <Card shadow="sm" radius={20}>
          <View style={styles.row}>
            <Avatar name={name} size={44} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <View style={styles.metaRow}>
                <Icon name={metaIcon} size={13} color={colors.ink3} />
                <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
              </View>
            </View>
            {badge}
            <Icon name="chevron" size={16} color={colors.ink3} />
          </View>
        </Card>
      </AnimatedPressable>
    </SlideIn>
  );
}

export default function PeopleScreen() {
  const [tab, setTab] = useState<Tab>('students');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const { gridColumns } = useResponsive();

  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: parents, isLoading: parentsLoading } = useParents(true);
  const { data: staff, isLoading: staffLoading } = useMembers(undefined, true);

  const q = search.toLowerCase();
  const filteredStudents = (students ?? []).filter(
    (s) => matchesStatus(s.status, status) &&
      (!q || s.name.toLowerCase().includes(q) || (s.regId ?? '').toLowerCase().includes(q) || (s.route?.name ?? '').toLowerCase().includes(q)),
  );
  const filteredParents = (parents ?? []).filter(
    (p) => matchesStatus(p.status, status) &&
      (!q || p.person.name.toLowerCase().includes(q) || p.person.phone.includes(search)),
  );
  const filteredStaff = (staff ?? []).filter(
    (m) => matchesStatus(m.status, status) &&
      (!q || m.person.name.toLowerCase().includes(q) || m.person.phone.includes(search)),
  );

  const headerRight =
    tab === 'students' ? <AddButton onPress={() => router.push('/(app)/people/students/new' as never)} />
    : tab === 'staff' ? <AddButton onPress={() => router.push('/(app)/people/staff/new' as never)} />
    : undefined;
    // Parents are always added via student creation (guardian linkage), so no standalone + Add button.

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
              placeholder={
                tab === 'students' ? 'Search name, reg ID, route…' : 'Search name or phone…'
              }
            />
            <View style={styles.statusFilterRow}>
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.key} label={f.label} selected={status === f.key} onPress={() => setStatus(f.key)} size="sm" />
              ))}
            </View>
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
                    icon={<IconSplat shape="b1" splatColor={colors.peopleBg} spot="users" size={64} />}
                    title={search ? 'No students match' : 'No students yet'}
                    description={search ? 'Try a different search term.' : 'Add students with the + button or the import wizard.'}
                  />
                </View>
              }
              renderItem={(item, i) => (
                <PersonRow
                  name={item.name}
                  metaIcon="pin"
                  meta={`${item.regId ? `${item.regId} · ` : ''}${item.route?.name ?? 'No route assigned'}`}
                  badge={<Badge label={item.status} variant={item.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />}
                  onPress={() => router.push(`/(app)/people/students/${item.id}` as never)}
                  delay={cardDelay(i)}
                />
              )}
            />
          )
        ) : tab === 'parents' ? (
          parentsLoading ? <SkeletonGrid /> : (
            <GridList
              data={filteredParents}
              columns={gridColumns}
              keyExtractor={(p) => p.id}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <EmptyState
                    icon={<IconSplat shape="b3" splatColor={colors.peopleBg} spot="users" size={64} />}
                    title={search ? 'No parents match' : 'No parents yet'}
                    description={search ? 'Try a different search term.' : 'Parents are added automatically when a student is created with parent details.'}
                  />
                </View>
              }
              renderItem={(p, i) => (
                <PersonRow
                  name={p.person.name}
                  metaIcon="users"
                  meta={p.person.guardianships.map((g) => g.student.name).join(', ') || p.person.phone}
                  badge={<Badge label={p.status} variant={p.status === 'ACTIVE' ? 'active' : 'inactive'} size="sm" />}
                  onPress={() => router.push(`/(app)/people/parents/${p.id}` as never)}
                  delay={cardDelay(i)}
                />
              )}
            />
          )
        ) : tab === 'staff' ? (
          staffLoading ? <SkeletonGrid /> : (
            <GridList
              data={filteredStaff}
              columns={gridColumns}
              keyExtractor={(m) => m.id}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <EmptyState
                    icon={<IconSplat shape="b2" splatColor={colors.peopleBg} spot="users" size={64} />}
                    title={search ? 'No staff match' : 'No staff yet'}
                    description={search ? 'Try a different search term.' : 'Add a driver, conductor or admin with the + button.'}
                  />
                </View>
              }
              renderItem={(m, i) => (
                <PersonRow
                  name={m.person.name}
                  metaIcon="phone"
                  meta={m.person.phone}
                  badge={<Badge label={m.role} variant="active" size="sm" />}
                  onPress={() => router.push(`/(app)/people/staff/${m.id}` as never)}
                  delay={cardDelay(i)}
                />
              )}
            />
          )
        ) : null}
      </View>
    </AdminScreen>
  );
}

function ImportPanel() {
  return (
    <View style={styles.importWrap}>
      <Card shadow="sm" radius={24} style={styles.importCard}>
        <IconSplat shape="b1" splatColor={colors.peopleBg} spot="users" size={64} />
        <Text style={styles.importTitle}>Bulk import</Text>
        <Text style={styles.importBody}>
          Upload a spreadsheet of students or staff. We'll validate every row and show a preview before anything is saved.
        </Text>
        <AnimatedPressable
          scaleTo={0.97}
          onPress={() => router.push('/(app)/people/import' as never)}
          style={styles.importBtn}
          accessibilityRole="button"
        >
          <Text style={styles.importBtnText}>Start import</Text>
        </AnimatedPressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[3] },
  statusFilterRow: { flexDirection: 'row', gap: spacing[2] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 300, flexGrow: 1 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  emptyWrap: { flex: 1, minHeight: 320 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.base, fontWeight: fontWeights.extrabold, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },

  importWrap: { padding: spacing[4], alignItems: 'center' },
  importCard: { maxWidth: 460, width: '100%', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] },
  importTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3, marginTop: spacing[1] },
  importBody: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing[2] },
  importBtn: { marginTop: spacing[3], alignSelf: 'stretch', backgroundColor: colors.people, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  importBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: 15, fontWeight: fontWeights.extrabold, color: colors.white },
});

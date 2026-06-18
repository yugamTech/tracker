import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Avatar, Badge, Button } from '@saarthi/ui';
import { useParents, useDeactivateMember, useReactivateMember } from '@saarthi/api-client';
import { goBackTo } from '../../../../lib/nav';

export default function ParentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: parents, isLoading } = useParents(true);
  const parent = parents?.find((p) => p.id === id);

  const deactivateMember = useDeactivateMember();
  const reactivateMember = useReactivateMember();

  const handleDeactivate = () => {
    if (!parent) return;
    Alert.alert(
      'Deactivate parent access',
      `${parent.person.name} will lose access to the parent app. Their account and linked students are preserved. You can reactivate it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () =>
            deactivateMember.mutate(id, {
              onSuccess: () => Alert.alert('Done', 'Parent access deactivated'),
              onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to deactivate'),
            }),
        },
      ],
    );
  };

  const handleReactivate = () => {
    if (!parent) return;
    Alert.alert(
      'Reactivate parent access',
      `${parent.person.name} will regain access to the parent app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: () =>
            reactivateMember.mutate(id, {
              onSuccess: () => Alert.alert('Done', 'Parent access reactivated'),
              onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to reactivate'),
            }),
        },
      ],
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!parent) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>Parent not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isActive = parent.status === 'ACTIVE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <Avatar name={parent.person.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{parent.person.name}</Text>
          <Text style={styles.headerPhone}>{parent.person.phone}</Text>
          {parent.person.email ? <Text style={styles.headerEmail}>{parent.person.email}</Text> : null}
        </View>
        <Badge label={parent.status} variant={isActive ? 'active' : 'inactive'} size="sm" />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Linked students ({parent.person.guardianships.length})</Text>
        {parent.person.guardianships.length === 0 ? (
          <Text style={styles.emptyText}>No linked students</Text>
        ) : (
          parent.person.guardianships.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.studentRow}
              onPress={() => router.push(`/(app)/people/students/${g.student.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{g.student.name}</Text>
                <Text style={styles.studentMeta}>
                  {g.relation} {g.student.regId ? `· ${g.student.regId}` : ''}
                </Text>
              </View>
              <View style={styles.studentRight}>
                <Badge
                  label={g.student.status}
                  variant={g.student.status === 'ACTIVE' ? 'active' : 'inactive'}
                  size="sm"
                />
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Card>

      {isActive ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.hint}>
            Deactivating removes this parent's app access. Their account and linked students are preserved.
          </Text>
          <Button
            title="Deactivate Access"
            variant="danger"
            onPress={handleDeactivate}
            loading={deactivateMember.isPending}
            fullWidth
          />
        </Card>
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Reactivate</Text>
          <Text style={styles.hint}>
            This parent's access is deactivated. Reactivating restores their ability to log in to the parent app.
          </Text>
          <Button
            title="Reactivate Access"
            onPress={handleReactivate}
            loading={reactivateMember.isPending}
            fullWidth
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errorText: { fontSize: fontSizes.base, color: colors.textSecondary },
  backBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  backBtnText: { fontSize: fontSizes.sm, color: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1 },
  headerName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  headerPhone: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  headerEmail: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 1 },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing[1] },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  emptyText: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing[3] },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: colors.border,
  },
  studentInfo: { flex: 1 },
  studentName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  studentMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  studentRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  chevron: { fontSize: fontSizes.lg, color: colors.textMuted },
});

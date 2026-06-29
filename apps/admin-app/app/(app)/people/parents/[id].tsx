import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Avatar, Badge, AnimatedPressable, Icon, useToast,
} from '@yaanam/ui';
import { useParents, useUpdateMember, useDeactivateMember, useReactivateMember } from '@yaanam/api-client';
import { GroupCard, Field, FormInput, ActionButton } from '../../../../components/forms';

const HUE = colors.people;

export default function ParentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: parents, isLoading } = useParents(true);
  // Reachable by membership id (People → Parents) OR personId (Student → guardian),
  // so navigation from a student's parent link resolves the same record.
  const parent = parents?.find((p) => p.id === id || p.personId === id);

  const updateMember = useUpdateMember();
  const deactivateMember = useDeactivateMember();
  const reactivateMember = useReactivateMember();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (parent) {
      setName(parent.person.name);
      setEmail(parent.person.email ?? '');
    }
  }, [parent?.id]);

  const handleSave = () => {
    if (!parent) return;
    if (!name.trim()) { toast.error('Name is required'); return; }
    updateMember.mutate(
      { id: parent.id, name: name.trim(), email: email.trim() || undefined },
      {
        onSuccess: () => { toast.success('Parent details updated'); setEditing(false); },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
      },
    );
  };

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
              onSuccess: () => toast.success('Parent access deactivated'),
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate'),
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
              onSuccess: () => toast.success('Parent access reactivated'),
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reactivate'),
            }),
        },
      ],
    );
  };

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.people} /></View>;
  }

  if (!parent) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>Parent not found</Text>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const isActive = parent.status === 'ACTIVE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <Card shadow="sm" radius={22} style={styles.header}>
        <Avatar name={parent.person.name} size={56} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{parent.person.name}</Text>
          <View style={styles.metaRow}>
            <Icon name="phone" size={13} color={colors.ink3} />
            <Text style={styles.headerMeta}>{parent.person.phone}</Text>
          </View>
          {parent.person.email ? (
            <View style={styles.metaRow}>
              <Icon name="mail" size={13} color={colors.ink3} />
              <Text style={styles.headerMeta} numberOfLines={1}>{parent.person.email}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <Badge label={parent.status} variant={isActive ? 'active' : 'inactive'} size="sm" />
          <AnimatedPressable onPress={() => setEditing((e) => !e)} style={styles.editBtn} accessibilityRole="button">
            <Icon name={editing ? 'x' : 'edit'} size={14} color={HUE} />
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </AnimatedPressable>
        </View>
      </Card>

      {editing ? (
        <GroupCard title="Edit details" icon="edit" hue={HUE}>
          <Field label="Full name" required>
            <FormInput hue={HUE} value={name} onChangeText={setName} autoCapitalize="words" />
          </Field>
          <Field label="Email" hint={`Phone (${parent.person.phone}) is the login identity and can't be changed here.`}>
            <FormInput
              hue={HUE}
              value={email}
              onChangeText={setEmail}
              placeholder="Optional"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
          <ActionButton title="Save changes" hue={HUE} onPress={handleSave} loading={updateMember.isPending} fullWidth />
        </GroupCard>
      ) : null}

      <GroupCard title={`Linked students (${parent.person.guardianships.length})`} icon="users" hue={HUE}>
        {parent.person.guardianships.length === 0 ? (
          <Text style={styles.emptyText}>No linked students</Text>
        ) : (
          parent.person.guardianships.map((g, i) => (
            <AnimatedPressable
              key={g.id}
              scaleTo={0.99}
              style={[styles.studentRow, i > 0 && styles.studentRowBorder]}
              onPress={() => router.push(`/(app)/people/students/${g.student.id}` as never)}
              accessibilityRole="button"
            >
              <Avatar name={g.student.name} size={38} />
              <View style={styles.studentInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{g.student.name}</Text>
                <Text style={styles.studentMeta} numberOfLines={1}>
                  {g.relation} {g.student.regId ? `· ${g.student.regId}` : ''}
                </Text>
              </View>
              <Badge
                label={g.student.status}
                variant={g.student.status === 'ACTIVE' ? 'active' : 'inactive'}
                size="sm"
              />
              <Icon name="chevron" size={16} color={colors.ink3} />
            </AnimatedPressable>
          ))
        )}
      </GroupCard>

      {isActive ? (
        <GroupCard title="Danger zone" icon="alert" hue={colors.crit}>
          <Text style={styles.hint}>
            Deactivating removes this parent's app access. Their account and linked students are preserved.
          </Text>
          <ActionButton title="Deactivate access" tone="danger" onPress={handleDeactivate} loading={deactivateMember.isPending} fullWidth />
        </GroupCard>
      ) : (
        <GroupCard title="Reactivate" icon="checkc" hue={colors.ok}>
          <Text style={styles.hint}>
            This parent's access is deactivated. Reactivating restores their ability to log in to the parent app.
          </Text>
          <ActionButton title="Reactivate access" hue={colors.ok} onPress={handleReactivate} loading={reactivateMember.isPending} fullWidth />
        </GroupCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errorText: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, color: colors.ink2 },
  backBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  backBtnText: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.people },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, minWidth: 0, gap: 3 },
  headerName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerMeta: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2 },
  headerRight: { alignItems: 'flex-end', gap: spacing[2] },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: colors.peopleBg, backgroundColor: colors.peopleBg },
  editBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: colors.people },

  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },
  emptyText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink3, textAlign: 'center', paddingVertical: spacing[3] },

  studentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  studentRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  studentInfo: { flex: 1, minWidth: 0 },
  studentName: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  studentMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2, textTransform: 'capitalize' },
});

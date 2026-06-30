import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import {
  colors, spacing, fontSizes, fontFamilies,
  Card, EmptyState, useToast, IconSplat, Badge,
} from '@yaanam/ui';
import type { Shift } from '@yaanam/types';
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift } from '@yaanam/api-client';
import { isValidTime } from '../../../lib/settings';
import { GroupCard, Field, FormInput, ActionButton } from '../../../components/forms';

const HUE = colors.sun;

/** Pull the server's human message off an axios error (mirrors the other screens). */
function errMsg(e: any): string | undefined {
  return e?.response?.data?.error?.message ?? e?.response?.data?.message;
}

/**
 * Shifts — the school's pickup/drop shifts (e.g. First shift 08:00, Second shift
 * 13:00). Backed by the AgeGroup CRUD API. Each student belongs to one shift, and
 * a trip can be scheduled shift-aware so only that shift's students ride. Times
 * use a 24-hour clock (HH:MM). A shift with students can't be deleted until they
 * are reassigned (the server returns 409, surfaced here as a toast).
 */
export default function ShiftsScreen() {
  const { data: shifts = [], isLoading } = useShifts();
  const toast = useToast();

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        A shift is a pickup/drop time band each student belongs to. Schedule a trip for a shift to carry just that
        shift's students. Times use a 24-hour clock (HH:MM).
      </Text>

      {shifts.length === 0 ? (
        <Card shadow="sm" radius={22} style={styles.emptyCard}>
          <EmptyState
            icon={<IconSplat shape="b2" splatColor={colors.sunBg} spot="trip" size={56} />}
            title="No shifts yet"
            description="Add your first shift below — e.g. First shift, pickup 08:00, drop 14:30."
          />
        </Card>
      ) : (
        shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} onToast={toast} />)
      )}

      <AddShiftCard onToast={toast} />
    </ScrollView>
  );
}

/** One existing shift — editable in place, with Save (when dirty) and Delete. */
function ShiftCard({ shift, onToast }: { shift: Shift; onToast: ReturnType<typeof useToast> }) {
  const update = useUpdateShift();
  const del = useDeleteShift();

  const [name, setName] = useState(shift.name);
  const [pickup, setPickup] = useState(shift.pickupTime);
  const [drop, setDrop] = useState(shift.dropTime);

  const studentCount = shift._count?.students ?? 0;
  const dirty = name !== shift.name || pickup !== shift.pickupTime || drop !== shift.dropTime;

  const save = () => {
    if (!name.trim()) { onToast.error('Shift needs a name'); return; }
    if (!isValidTime(pickup)) { onToast.error(`Pickup "${pickup}" isn't a valid 24-hour time (HH:MM)`); return; }
    if (!isValidTime(drop)) { onToast.error(`Drop "${drop}" isn't a valid 24-hour time (HH:MM)`); return; }
    update.mutate(
      { id: shift.id, name: name.trim(), pickupTime: pickup.trim(), dropTime: drop.trim() },
      {
        onSuccess: () => onToast.success('Shift updated'),
        onError: (e: any) => onToast.error(errMsg(e) ?? 'Failed to save shift'),
      },
    );
  };

  const remove = () => {
    Alert.alert(
      'Delete shift',
      studentCount > 0
        ? `"${shift.name}" still has ${studentCount} student${studentCount === 1 ? '' : 's'}. Reassign them first, or this will be refused.`
        : `Delete "${shift.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            del.mutate(shift.id, {
              onSuccess: () => onToast.success('Shift deleted'),
              // A 409 ("Reassign students…") arrives here — show the server's message.
              onError: (e: any) => onToast.error(errMsg(e) ?? 'Could not delete shift'),
            }),
        },
      ],
    );
  };

  return (
    <Card shadow="sm" radius={22} style={styles.rowCard}>
      <View style={styles.rowHead}>
        <Field label="Shift name" style={styles.flex1}>
          <FormInput hue={HUE} value={name} onChangeText={setName} placeholder="e.g. First shift" autoCapitalize="words" />
        </Field>
        <Badge label={`${studentCount} student${studentCount === 1 ? '' : 's'}`} variant={studentCount > 0 ? 'info' : 'default'} />
      </View>

      <View style={styles.timesRow}>
        <Field label="Pickup (HH:MM)" style={styles.timeField}>
          <FormInput hue={HUE} value={pickup} onChangeText={setPickup} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        </Field>
        <Field label="Drop (HH:MM)" style={styles.timeField}>
          <FormInput hue={HUE} value={drop} onChangeText={setDrop} placeholder="14:30" keyboardType="numbers-and-punctuation" maxLength={5} />
        </Field>
      </View>

      <View style={styles.rowActions}>
        <ActionButton title="Delete" tone="danger" hue={colors.crit} onPress={remove} loading={del.isPending} />
        <ActionButton title="Save" hue={HUE} onPress={save} loading={update.isPending} disabled={!dirty} style={styles.flex1} />
      </View>
    </Card>
  );
}

/** The "add a new shift" form. */
function AddShiftCard({ onToast }: { onToast: ReturnType<typeof useToast> }) {
  const create = useCreateShift();
  const [name, setName] = useState('');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');

  const add = () => {
    if (!name.trim()) { onToast.error('Shift needs a name'); return; }
    if (!isValidTime(pickup)) { onToast.error(`Pickup "${pickup}" isn't a valid 24-hour time (HH:MM)`); return; }
    if (!isValidTime(drop)) { onToast.error(`Drop "${drop}" isn't a valid 24-hour time (HH:MM)`); return; }
    create.mutate(
      { name: name.trim(), pickupTime: pickup.trim(), dropTime: drop.trim() },
      {
        onSuccess: () => { onToast.success('Shift added'); setName(''); setPickup(''); setDrop(''); },
        onError: (e: any) => onToast.error(errMsg(e) ?? 'Failed to add shift'),
      },
    );
  };

  return (
    <GroupCard title="Add a shift" spot="trip" hue={HUE}>
      <Field label="Shift name" required>
        <FormInput hue={HUE} value={name} onChangeText={setName} placeholder="e.g. Second shift" autoCapitalize="words" />
      </Field>
      <View style={styles.timesRow}>
        <Field label="Pickup (HH:MM)" required style={styles.timeField}>
          <FormInput hue={HUE} value={pickup} onChangeText={setPickup} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        </Field>
        <Field label="Drop (HH:MM)" required style={styles.timeField}>
          <FormInput hue={HUE} value={drop} onChangeText={setDrop} placeholder="14:30" keyboardType="numbers-and-punctuation" maxLength={5} />
        </Field>
      </View>
      <ActionButton title="+ Add shift" hue={HUE} onPress={add} loading={create.isPending} fullWidth />
    </GroupCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  intro: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 20 },
  emptyCard: { paddingVertical: spacing[4] },

  rowCard: { gap: spacing[3] },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  flex1: { flex: 1 },
  timesRow: { flexDirection: 'row', gap: spacing[3] },
  timeField: { flex: 1 },
  rowActions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
});

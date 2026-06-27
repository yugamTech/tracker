import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, AnimatedPressable, IconSplat, Icon, useToast,
} from '@yaanam/ui';
import { useComplaintById, useUpdateComplaintStatus } from '@yaanam/api-client';
import { COMPLAINT_TRANSITIONS, ComplaintStatus } from '@yaanam/types';
import { GroupCard, Field, FormInput, ActionButton } from '../../../components/forms';

const HUE = colors.talk;

const STATUS_V: Record<string, 'warning' | 'info' | 'success' | 'default' | 'error'> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', COUNSELLING_CALL: 'info', ADMIN_CALL: 'info',
  VISIT: 'info', RESOLVED: 'success', PARENT_RATING: 'success', REOPENED: 'error', CLOSED: 'default',
};

const EVENT_COLORS: Record<string, string> = {
  RECEIVED: colors.ink3,
  IN_PROGRESS: colors.warn,
  COUNSELLING_CALL: colors.warn,
  ADMIN_CALL: colors.warn,
  VISIT: colors.warn,
  RESOLVED: colors.ok,
  PARENT_RATING: colors.ok,
  REOPENED: colors.crit,
  ESCALATED: colors.crit,
  CLOSED: colors.ink3,
};

export default function AdminComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: complaint, isLoading, isError } = useComplaintById(id ?? '');
  const { mutate: updateStatus, isPending } = useUpdateComplaintStatus();
  const toast = useToast();

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={HUE} />
      </View>
    );
  }

  if (isError || !complaint) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.notFound}>Complaint not found.</Text>
      </View>
    );
  }

  const events = (complaint as any).events ?? [];
  const student = (complaint as any).student;
  const trip = (complaint as any).trip;
  const route = trip?.route;
  const raiser = (complaint as any).raiser as { name?: string; phone?: string } | undefined;
  const rating = (complaint as any).resolutionRating as
    | { rating: number; satisfied: boolean; comment?: string; ts: string }
    | null
    | undefined;
  // Only valid next statuses are offered (single-sourced from @yaanam/types so the
  // backend's validation and these buttons never drift). RESOLVED & CLOSED get the
  // primary highlight as the usual forward actions.
  const allowed = COMPLAINT_TRANSITIONS[complaint.status] ?? [];
  // The parent has responded once a resolution rating exists — the close gate.
  const parentResponded = !!rating;

  const handleStatusChange = (toStatus: string) => {
    if (toStatus === 'CLOSED') { handleClose(); return; }
    if (toStatus === 'RESOLVED') {
      // Resolution requires a note so the parent sees what was done.
      setPendingStatus(toStatus);
      setResolveNote('');
      return;
    }
    Alert.alert(
      'Update Status',
      `Move to ${toStatus.replace(/_/g, ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () =>
            updateStatus(
              { id: complaint.id, status: toStatus },
              { onError: () => toast.error('Failed to update status.') },
            ),
        },
      ],
    );
  };

  const doClose = (override?: boolean) =>
    updateStatus(
      { id: complaint.id, status: 'CLOSED', override },
      { onError: () => toast.error('Failed to close complaint.') },
    );

  // Close gate: free to close once the parent has responded; otherwise require an
  // explicit, recorded override (the backend rejects an un-overridden close too).
  const handleClose = () => {
    if (parentResponded) {
      Alert.alert('Close Complaint', 'Close this complaint? The parent has submitted their feedback.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close', onPress: () => doClose() },
      ]);
      return;
    }
    Alert.alert(
      'Parent hasn’t responded',
      'The parent has not rated the resolution yet. Closing now will be recorded as an admin override.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close anyway (override)', style: 'destructive', onPress: () => doClose(true) },
      ],
    );
  };

  const handleResolve = () => {
    const note = resolveNote.trim();
    if (!note) return;
    updateStatus(
      { id: complaint.id, status: 'RESOLVED', note },
      {
        onSuccess: () => { setPendingStatus(null); setResolveNote(''); },
        onError: () => toast.error('Failed to resolve complaint.'),
      },
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Info card */}
        <Card shadow="sm" radius={22} style={styles.infoCard}>
          <View style={styles.infoTop}>
            <IconSplat shape="b3" splatColor={colors.talkBg} spot="chat" size={48} />
            <View style={styles.infoHead}>
              <Text style={styles.category} numberOfLines={1}>{complaint.category.replace('_', ' ')}</Text>
              <Badge label={complaint.status.replace('_', ' ')} variant={STATUS_V[complaint.status] ?? 'default'} size="sm" />
            </View>
          </View>
          <Text style={styles.description}>{complaint.description ?? '—'}</Text>
          {/* WHO raised it — the parent's name + phone (raisedBy resolved server-side). */}
          {raiser?.name ? (
            <View style={styles.metaRow}>
              <Icon name="users" size={14} color={colors.ink3} />
              <Text style={styles.meta}>
                Raised by <Text style={styles.metaStrong}>{raiser.name}</Text>
                {raiser.phone ? `  ·  ${raiser.phone}` : ''}
              </Text>
            </View>
          ) : null}
          {student ? (
            <View style={styles.metaRow}>
              <Icon name="users" size={14} color={colors.ink3} />
              <Text style={styles.meta}>Student: {student.name ?? student.id}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Icon name="calendar" size={14} color={colors.ink3} />
            <Text style={styles.meta}>
              Filed {new Date(complaint.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </Card>

        {/* Trip context — shown when complaint is linked to a trip */}
        {trip ? (
          <GroupCard title="Linked trip" spot="route" hue={colors.route}>
            <View style={styles.tripRow}>
              <IconSplat shape="b2" splatColor={colors.routeBg} spot="route" size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.tripRoute} numberOfLines={1}>{route?.name ?? '—'}</Text>
                <Text style={styles.tripMeta}>
                  {new Date(trip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {'  ·  '}
                  <Text style={styles.tripDir}>{trip.direction === 'PICKUP' ? 'Pickup' : 'Drop'}</Text>
                </Text>
                <View style={styles.metaRow}>
                  <Icon name="users" size={13} color={colors.ink3} />
                  <Text style={styles.tripMeta}>{trip.driver?.name ?? 'Driver not assigned'}</Text>
                </View>
              </View>
            </View>
            <AnimatedPressable
              style={styles.openTripBtn}
              scaleTo={0.97}
              onPress={() => router.push(`/(app)/fleet/${trip.id}` as never)}
              accessibilityRole="button"
            >
              <Text style={styles.openTripText}>Open trip</Text>
              <Icon name="chevron" size={14} color={colors.route} />
            </AnimatedPressable>
          </GroupCard>
        ) : null}

        {/* Parent satisfaction — surfaced before the admin can close. */}
        {rating ? (
          <GroupCard title="Parent satisfaction" spot="users" hue={HUE}>
            <View style={styles.satRow}>
              <Text style={styles.satStars}>
                {'★'.repeat(rating.rating)}{'☆'.repeat(5 - rating.rating)}
              </Text>
              <Badge
                label={rating.satisfied ? 'Satisfied' : 'Not satisfied'}
                variant={rating.satisfied ? 'success' : 'error'}
                size="sm"
              />
            </View>
            {rating.comment ? <Text style={styles.satComment}>“{rating.comment}”</Text> : null}
            <View style={styles.metaRow}>
              <Icon name="calendar" size={13} color={colors.ink3} />
              <Text style={styles.meta}>
                Rated {new Date(rating.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </GroupCard>
        ) : null}

        {/* Status transition controls — only valid next statuses (from @yaanam/types). */}
        <GroupCard title="Update status" spot="chat" hue={HUE}>
          {allowed.length === 0 ? (
            <Text style={styles.meta}>This complaint is closed — no further changes.</Text>
          ) : (
            <>
              {allowed.includes(ComplaintStatus.CLOSED) && !parentResponded ? (
                <View style={styles.closeHint}>
                  <Icon name="alert" size={14} color={colors.warningDark} />
                  <Text style={styles.closeHintText}>
                    Parent hasn’t rated the resolution yet — closing requires an override.
                  </Text>
                </View>
              ) : null}
              <View style={styles.statusButtons}>
                {allowed.map((s) => {
                  const isPrimary = s === ComplaintStatus.RESOLVED || s === ComplaintStatus.CLOSED;
                  const label = s === ComplaintStatus.CLOSED && !parentResponded ? 'Close (override)' : s.replace(/_/g, ' ');
                  return (
                    <AnimatedPressable
                      key={s}
                      scaleTo={0.96}
                      style={[
                        styles.statusBtn,
                        isPrimary && styles.statusBtnPrimary,
                        isPending && styles.statusBtnDisabled,
                      ]}
                      onPress={() => handleStatusChange(s)}
                      disabled={isPending}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.statusBtnText, isPrimary && styles.statusBtnTextPrimary]}>
                        {label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </>
          )}
        </GroupCard>

        {/* Event log */}
        {events.length > 0 ? (
          <GroupCard title="Event log" icon="clock" hue={HUE}>
            <View style={styles.timeline}>
              {events.map((ev: any, idx: number) => (
                <View key={ev.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: EVENT_COLORS[ev.toStatus] ?? colors.ink3 }]} />
                    {idx < events.length - 1 ? <View style={styles.timelineConnector} /> : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineType}>{ev.toStatus.replace('_', ' ')}</Text>
                    {ev.actorName ? <Text style={styles.timelineActor}>by {ev.actorName}</Text> : null}
                    {ev.note ? <Text style={styles.timelineNote}>{ev.note}</Text> : null}
                    <Text style={styles.timelineTime}>
                      {new Date(ev.ts ?? ev.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </GroupCard>
        ) : null}
      </ScrollView>

      {/* Resolution note modal — required when moving to RESOLVED */}
      <Modal visible={pendingStatus === 'RESOLVED'} transparent animationType="fade" onRequestClose={() => setPendingStatus(null)}>
        <View style={styles.modalBackdrop}>
          <Card shadow="lg" radius={22} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Resolve complaint</Text>
            <Text style={styles.modalSub}>Add a resolution note. The parent will be notified with this text.</Text>
            <Field>
              <FormInput
                hue={HUE}
                value={resolveNote}
                onChangeText={setResolveNote}
                placeholder="e.g. Spoke with the driver and addressed the concern."
                multiline
                autoFocus
              />
            </Field>
            <ActionButton
              title={isPending ? 'Resolving…' : 'Mark as resolved'}
              hue={colors.ok}
              onPress={handleResolve}
              loading={isPending}
              disabled={!resolveNote.trim()}
              fullWidth
            />
            <ActionButton title="Cancel" tone="ghost" onPress={() => setPendingStatus(null)} fullWidth />
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  center: { justifyContent: 'center', alignItems: 'center' },
  notFound: { fontFamily: fontFamilies.bodySemibold, color: colors.ink2 },
  content: { padding: spacing[4], gap: spacing[4] },

  infoCard: { gap: spacing[2] },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[1] },
  infoHead: { flex: 1, minWidth: 0, gap: spacing[1], alignItems: 'flex-start' },
  category: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  description: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },
  metaStrong: { color: colors.ink, fontWeight: fontWeights.bold },

  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  tripRoute: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  tripMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  tripDir: { color: colors.route, fontWeight: fontWeights.bold },
  openTripBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: 999, backgroundColor: colors.routeBg,
  },
  openTripText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, color: colors.route, fontWeight: fontWeights.extrabold },

  satRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  satStars: { fontSize: fontSizes.lg, color: colors.warn, letterSpacing: 2 },
  satComment: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink, fontStyle: 'italic', marginTop: spacing[1], lineHeight: 20 },

  closeHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.warnBg, borderRadius: 13,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  closeHintText: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: '#92400E', lineHeight: 17 },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statusBtn: {
    paddingHorizontal: 15, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1.8, borderColor: colors.hairlineStrong,
    backgroundColor: colors.white,
  },
  statusBtnPrimary: { borderColor: HUE, backgroundColor: colors.talkBg },
  statusBtnDisabled: { opacity: 0.5 },
  statusBtnText: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, color: colors.ink2, fontWeight: fontWeights.bold },
  statusBtnTextPrimary: { color: HUE, fontWeight: fontWeights.extrabold },

  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: spacing[3] },
  timelineLine: { alignItems: 'center', width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.hairlineStrong, marginVertical: 4 },
  timelineBody: { flex: 1, paddingBottom: spacing[4], gap: 2 },
  timelineType: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.4 },
  timelineActor: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink2 },
  timelineNote: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink },
  timelineTime: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing[5] },
  modalCard: { gap: spacing[3] },
  modalTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink },
  modalSub: { fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 20 },
});

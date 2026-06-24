import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, useToast } from '@yaanam/ui';
import { useComplaintById, useUpdateComplaintStatus } from '@yaanam/api-client';
import { COMPLAINT_TRANSITIONS, ComplaintStatus } from '@yaanam/types';

const STATUS_V: Record<string, 'warning' | 'info' | 'success' | 'default' | 'error'> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', COUNSELLING_CALL: 'info', ADMIN_CALL: 'info',
  VISIT: 'info', RESOLVED: 'success', PARENT_RATING: 'success', REOPENED: 'error', CLOSED: 'default',
};

const EVENT_COLORS: Record<string, string> = {
  RECEIVED: colors.gray400,
  IN_PROGRESS: '#F59E0B',
  COUNSELLING_CALL: '#F59E0B',
  ADMIN_CALL: '#F59E0B',
  VISIT: '#F59E0B',
  RESOLVED: '#10B981',
  PARENT_RATING: '#10B981',
  REOPENED: '#EF4444',
  ESCALATED: '#EF4444',
  CLOSED: colors.gray400,
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !complaint) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>Complaint not found.</Text>
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
        <Card>
          <View style={styles.row}>
            <Text style={styles.category}>{complaint.category.replace('_', ' ')}</Text>
            <Badge label={complaint.status.replace('_', ' ')} variant={STATUS_V[complaint.status] ?? 'default'} size="sm" />
          </View>
          <Text style={styles.description}>{complaint.description ?? '—'}</Text>
          {/* WHO raised it — the parent's name + phone (raisedBy resolved server-side). */}
          {raiser?.name && (
            <Text style={styles.meta}>
              Raised by: <Text style={styles.metaStrong}>{raiser.name}</Text>
              {raiser.phone ? `  ·  ${raiser.phone}` : ''}
            </Text>
          )}
          {student && (
            <Text style={styles.meta}>Student: {student.name ?? student.id}</Text>
          )}
          <Text style={styles.meta}>
            Filed: {new Date(complaint.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Card>

        {/* Trip context — shown when complaint is linked to a trip */}
        {trip && (
          <Card>
            <Text style={styles.sectionLabel}>Linked Trip</Text>
            <View style={styles.tripRow}>
              <Text style={styles.tripIcon}>🛣️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripRoute}>{route?.name ?? '—'}</Text>
                <Text style={styles.tripMeta}>
                  {new Date(trip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {'  ·  '}
                  <Text style={styles.tripDir}>{trip.direction === 'PICKUP' ? '⬆ Pickup' : '⬇ Drop'}</Text>
                </Text>
                <Text style={styles.tripMeta}>🧑‍✈️ {trip.driver?.name ?? 'Driver not assigned'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.openTripBtn}
              onPress={() => router.push(`/(app)/fleet/${trip.id}` as never)}
              activeOpacity={0.8}
            >
              <Text style={styles.openTripText}>Open trip →</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Parent satisfaction — surfaced before the admin can close. */}
        {rating && (
          <Card>
            <Text style={styles.sectionLabel}>Parent Satisfaction</Text>
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
            <Text style={styles.meta}>
              Rated: {new Date(rating.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Card>
        )}

        {/* Status transition controls — only valid next statuses (from @yaanam/types). */}
        <Card>
          <Text style={styles.sectionLabel}>Update Status</Text>
          {allowed.length === 0 ? (
            <Text style={styles.meta}>This complaint is closed — no further changes.</Text>
          ) : (
            <>
              {allowed.includes(ComplaintStatus.CLOSED) && !parentResponded && (
                <Text style={styles.closeHint}>
                  ⚠ Parent hasn’t rated the resolution yet — closing requires an override.
                </Text>
              )}
              <View style={styles.statusButtons}>
                {allowed.map((s) => {
                  const isPrimary = s === ComplaintStatus.RESOLVED || s === ComplaintStatus.CLOSED;
                  const label = s === ComplaintStatus.CLOSED && !parentResponded ? 'CLOSE (OVERRIDE)' : s.replace(/_/g, ' ');
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusBtn,
                        isPrimary && styles.statusBtnPrimary,
                        isPending && styles.statusBtnDisabled,
                      ]}
                      onPress={() => handleStatusChange(s)}
                      disabled={isPending}
                    >
                      <Text style={[styles.statusBtnText, isPrimary && styles.statusBtnTextPrimary]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </Card>

        {/* Event log */}
        {events.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Event Log</Text>
            <View style={styles.timeline}>
              {events.map((ev: any, idx: number) => (
                <View key={ev.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: EVENT_COLORS[ev.toStatus] ?? colors.gray400 }]} />
                    {idx < events.length - 1 && <View style={styles.timelineConnector} />}
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
          </>
        )}
      </ScrollView>

      {/* Resolution note modal — required when moving to RESOLVED */}
      <Modal visible={pendingStatus === 'RESOLVED'} transparent animationType="fade" onRequestClose={() => setPendingStatus(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Resolve Complaint</Text>
            <Text style={styles.modalSub}>Add a resolution note. The parent will be notified with this text.</Text>
            <TextInput
              style={styles.modalInput}
              value={resolveNote}
              onChangeText={setResolveNote}
              placeholder="e.g. Spoke with the driver and addressed the concern."
              placeholderTextColor={colors.gray400}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.resolveBtn, !resolveNote.trim() && styles.resolveBtnDisabled]}
              onPress={handleResolve}
              disabled={!resolveNote.trim() || isPending}
            >
              <Text style={styles.resolveBtnText}>{isPending ? 'Resolving…' : 'Mark as Resolved'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setPendingStatus(null)}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  content: { padding: spacing[4], gap: spacing[4] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  category: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  description: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22 },
  meta: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2] },
  metaStrong: { color: colors.textPrimary, fontWeight: fontWeights.semibold },
  satRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  satStars: { fontSize: fontSizes.lg, color: '#F59E0B', letterSpacing: 2 },
  satComment: { fontSize: fontSizes.sm, color: colors.textPrimary, fontStyle: 'italic', marginTop: spacing[2], lineHeight: 20 },
  closeHint: { fontSize: fontSizes.xs, color: colors.warning, marginBottom: spacing[2], lineHeight: 18 },
  timelineActor: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: fontWeights.medium },
  sectionLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  tripRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  tripIcon: { fontSize: 20, marginTop: 2 },
  tripRoute: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  tripMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  tripDir: { color: colors.primary, fontWeight: fontWeights.medium },
  openTripBtn: {
    marginTop: spacing[3], alignSelf: 'flex-start',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#EEF2FF',
  },
  openTripText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statusBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  statusBtnPrimary: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  statusBtnDisabled: { opacity: 0.5 },
  statusBtnText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  statusBtnTextPrimary: { color: colors.primary, fontWeight: fontWeights.semibold },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: spacing[3] },
  timelineLine: { alignItems: 'center', width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  timelineBody: { flex: 1, paddingBottom: spacing[4], gap: 2 },
  timelineType: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.textSecondary, textTransform: 'uppercase' },
  timelineNote: { fontSize: fontSizes.sm, color: colors.textPrimary },
  timelineTime: { fontSize: fontSizes.xs, color: colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing[5] },
  modalCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing[5], gap: spacing[3] },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  modalSub: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  modalInput: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: 'top',
  },
  resolveBtn: {
    backgroundColor: '#10B981', borderRadius: radius.lg,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  resolveBtnDisabled: { opacity: 0.4 },
  resolveBtnText: { color: colors.white, fontWeight: fontWeights.semibold, fontSize: fontSizes.base },
  cancelLink: { alignItems: 'center', paddingVertical: spacing[2] },
  cancelLinkText: { fontSize: fontSizes.sm, color: colors.textSecondary },
});

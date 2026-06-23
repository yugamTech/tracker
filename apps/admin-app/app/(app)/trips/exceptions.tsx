import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights,
  Card, Badge, Button, Chip, Skeleton, EmptyState, AnimatedPressable, useToast,
} from '@yaanam/ui';
import {
  useTripStartExceptions, useResolveStartException, useOverdueTrips,
  useTripCompletionExceptions, useResolveCompletionException,
  useLifecycleAlarms, useForceCompleteTrip, useAbortTrip, useAcknowledgeTrip,
} from '@yaanam/api-client';
import type {
  TripStartExceptionWithTrip, TripCompletionExceptionWithTrip, OverdueTrip, LifecycleAlarmTrip,
} from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

type FilterKey = 'open' | 'all';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'all', label: 'All' },
];

function offsetLabel(deltaMinutes: number): string {
  if (deltaMinutes === 0) return 'on time';
  const mins = Math.abs(deltaMinutes);
  return `${mins} min ${deltaMinutes < 0 ? 'early' : 'late'}`;
}

function overdueLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** A still-SCHEDULED trip overdue to start (>12h). Tap to review (start / cancel) on the monitor. */
function OverdueCard({ item }: { item: OverdueTrip }) {
  const start = item.scheduledStart ?? item.date;
  return (
    <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/fleet/${item.id}` as never)}>
      <Card shadow="sm" style={[styles.card, { borderLeftColor: colors.warning }]}>
        <View style={styles.cardTop}>
          <Text style={styles.route} numberOfLines={1}>{item.route?.name ?? 'Route'} · {item.direction}</Text>
          <Badge label="Never started" variant="warning" size="sm" />
        </View>
        <Text style={styles.meta}>{item.driver?.name ?? '—'} · {item.vehicle?.regNumber ?? '—'}</Text>
        <View style={styles.flags}>
          <Text style={styles.flag}>⏱ Overdue by {overdueLabel(item.overdueMinutes)}</Text>
        </View>
        <Text style={styles.times}>Scheduled {start ? new Date(start).toLocaleString() : '—'}</Text>
      </Card>
    </AnimatedPressable>
  );
}

/**
 * A started-not-completed lifecycle alarm (PRD-02a): an OVERDUE trip still under way,
 * or an ABANDONED trip the system auto-aborted. Admin can force-complete / force-abort
 * an overdue trip, or acknowledge either (removes it from the open feed).
 */
function LifecycleAlarmCard({
  item,
  busy,
  onForceComplete,
  onForceAbort,
  onAcknowledge,
}: {
  item: LifecycleAlarmTrip;
  busy: boolean;
  onForceComplete: (item: LifecycleAlarmTrip) => void;
  onForceAbort: (item: LifecycleAlarmTrip) => void;
  onAcknowledge: (item: LifecycleAlarmTrip) => void;
}) {
  const abandoned = item.lifecycleStage === 'ABANDONED';
  const routeName = item.route?.name ?? 'Route';
  const driverName = item.driver?.name ?? '—';
  const vehicleReg = item.vehicle?.regNumber ?? '—';
  return (
    <Card shadow="sm" style={[styles.card, { borderLeftColor: abandoned ? colors.error : colors.warning }]}>
      <View style={styles.cardTop}>
        <Text style={styles.route} numberOfLines={1}>{routeName} · {item.direction}</Text>
        <Badge label={abandoned ? 'Abandoned' : 'Overdue'} variant={abandoned ? 'error' : 'warning'} size="sm" />
      </View>
      <Text style={styles.meta}>{driverName} · {vehicleReg}</Text>

      <View style={styles.flags}>
        <Text style={styles.flag}>⏱ {abandoned ? 'Ran' : 'Running'} {overdueLabel(item.overdueMinutes)}</Text>
      </View>

      {abandoned && item.abortReason ? (
        <>
          <Text style={styles.reasonLabel}>AUTO-CLOSE REASON</Text>
          <Text style={styles.reason}>{item.abortReason}</Text>
        </>
      ) : null}

      {item.startedAt ? (
        <Text style={styles.times}>Started {new Date(item.startedAt).toLocaleString()}</Text>
      ) : null}

      <View style={styles.actions}>
        {!abandoned && (
          <>
            <Button title="Force-complete" variant="outline" onPress={() => onForceComplete(item)} disabled={busy} fullWidth />
            <Button title="Force-abort" variant="outline" onPress={() => onForceAbort(item)} disabled={busy} fullWidth />
          </>
        )}
        <Button title="Acknowledge" onPress={() => onAcknowledge(item)} loading={busy} fullWidth />
      </View>
    </Card>
  );
}

/** An early trip-completion (driver ended before the final stop). Mark resolved here. */
function CompletionExceptionCard({
  item,
  onResolve,
  resolving,
}: {
  item: TripCompletionExceptionWithTrip;
  onResolve: (item: TripCompletionExceptionWithTrip) => void;
  resolving: boolean;
}) {
  const resolved = !!item.resolvedAt;
  const routeName = item.trip?.route?.name ?? 'Route';
  const driverName = item.trip?.driver?.name ?? '—';
  const vehicleReg = item.trip?.vehicle?.regNumber ?? '—';
  return (
    <Card shadow="sm" style={[styles.card, { borderLeftColor: resolved ? colors.gray300 : colors.error }]}>
      <View style={styles.cardTop}>
        <Text style={styles.route} numberOfLines={1}>{routeName} · {item.trip?.direction ?? ''}</Text>
        <Badge label={resolved ? 'Resolved' : 'Open'} variant={resolved ? 'cancelled' : 'error'} size="sm" />
      </View>
      <Text style={styles.meta}>{driverName} · {vehicleReg}</Text>

      <View style={styles.flags}>
        <Text style={styles.flag}>🛑 Ended at stop {item.stoppedAtSeq} of {item.totalStops}</Text>
        <Text style={styles.flag}>🧒 {item.boarded}/{item.totalRiders} boarded</Text>
      </View>

      <Text style={styles.reasonLabel}>DRIVER'S REASON</Text>
      <Text style={styles.reason}>{item.reason}</Text>

      <Text style={styles.times}>Ended {new Date(item.completedAt).toLocaleString()}</Text>

      {resolved ? (
        <Text style={styles.resolvedNote}>
          Resolved {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ''}
        </Text>
      ) : (
        <Button title="Mark Resolved" onPress={() => onResolve(item)} loading={resolving} fullWidth style={styles.resolveBtn} />
      )}
    </Card>
  );
}

export default function TripStartAlarmsScreen() {
  const [filter, setFilter] = useState<FilterKey>('open');
  const { data, isLoading, isError } = useTripStartExceptions(filter === 'all' ? 'all' : undefined);
  const { data: overdue = [] } = useOverdueTrips();
  const { data: completionExceptions = [] } = useTripCompletionExceptions(filter === 'all' ? 'all' : undefined);
  const { data: lifecycleAlarms = [] } = useLifecycleAlarms();
  const resolve = useResolveStartException();
  const resolveCompletion = useResolveCompletionException();
  const forceComplete = useForceCompleteTrip();
  const abort = useAbortTrip();
  const acknowledge = useAcknowledgeTrip();
  const toast = useToast();
  const { gridColumns } = useResponsive();

  // Reason capture for force-complete / force-abort (both require a note, PRD-02a §4).
  const [reasonModal, setReasonModal] =
    useState<{ trip: LifecycleAlarmTrip; kind: 'force-complete' | 'force-abort' } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const busyForTrip = (id: string) =>
    (forceComplete.isPending && forceComplete.variables?.tripId === id) ||
    (abort.isPending && abort.variables?.tripId === id) ||
    (acknowledge.isPending && acknowledge.variables?.tripId === id);

  const onForceComplete = (item: LifecycleAlarmTrip) => {
    setReasonText('');
    setReasonModal({ trip: item, kind: 'force-complete' });
  };
  const onForceAbort = (item: LifecycleAlarmTrip) => {
    setReasonText('');
    setReasonModal({ trip: item, kind: 'force-abort' });
  };
  const onAcknowledgeAlarm = (item: LifecycleAlarmTrip) => {
    Alert.alert('Acknowledge alarm', 'Remove this trip from the open alarm feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acknowledge',
        onPress: () =>
          acknowledge.mutate(
            { tripId: item.id },
            { onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to acknowledge') },
          ),
      },
    ]);
  };
  const onConfirmReason = () => {
    const reason = reasonText.trim();
    if (!reason || !reasonModal) return;
    const { trip, kind } = reasonModal;
    const opts = {
      onSuccess: () => setReasonModal(null),
      onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Action failed'),
    };
    if (kind === 'force-complete') forceComplete.mutate({ tripId: trip.id, reason }, opts);
    else abort.mutate({ tripId: trip.id, reason }, opts);
  };

  // Started-not-completed alarms (PRD-02a): overdue (live) + abandoned (auto-aborted).
  // Most urgent, so it stacks at the top of the unified panel.
  const lifecycleSection = lifecycleAlarms.length > 0 ? (
    <View style={styles.overdueSection}>
      <Text style={styles.sectionHeading}>Active &amp; overdue · {lifecycleAlarms.length}</Text>
      <Text style={styles.sectionSub}>Trips that started but never completed. Force-complete, abort, or acknowledge.</Text>
      <View style={styles.overdueList}>
        {lifecycleAlarms.map((t) => (
          <LifecycleAlarmCard
            key={t.id}
            item={t}
            busy={busyForTrip(t.id)}
            onForceComplete={onForceComplete}
            onForceAbort={onForceAbort}
            onAcknowledge={onAcknowledgeAlarm}
          />
        ))}
      </View>
    </View>
  ) : null;

  const onResolveCompletion = (item: TripCompletionExceptionWithTrip) => {
    Alert.alert('Resolve alarm', 'Mark this early-completion exception as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () =>
          resolveCompletion.mutate(item.id, {
            onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to resolve'),
          }),
      },
    ]);
  };

  // "Never started" alarms (computed on read): SCHEDULED trips >12h overdue. Shown
  // as a section above the start-exception list so both alarm kinds share one panel.
  const overdueSection = overdue.length > 0 ? (
    <View style={styles.overdueSection}>
      <Text style={styles.sectionHeading}>Never started · {overdue.length}</Text>
      <Text style={styles.sectionSub}>Still scheduled more than 12h after departure. Tap to start or cancel.</Text>
      <View style={styles.overdueList}>
        {overdue.map((t) => <OverdueCard key={t.id} item={t} />)}
      </View>
    </View>
  ) : null;

  // Early-completion alarms: trips the driver ended before the final stop, with a reason.
  const completionSection = completionExceptions.length > 0 ? (
    <View style={styles.overdueSection}>
      <Text style={styles.sectionHeading}>Ended early · {completionExceptions.length}</Text>
      <Text style={styles.sectionSub}>Trips completed before the final stop. Review the driver's reason.</Text>
      <View style={styles.overdueList}>
        {completionExceptions.map((e) => (
          <CompletionExceptionCard
            key={e.id}
            item={e}
            onResolve={onResolveCompletion}
            resolving={resolveCompletion.isPending && resolveCompletion.variables === e.id}
          />
        ))}
      </View>
    </View>
  ) : null;

  // Lifecycle / never-started / early-completion sections stack above the
  // start-exception list, in one unified panel.
  const headerSections = (
    <>
      {lifecycleSection}
      {overdueSection}
      {completionSection}
    </>
  );

  const onResolve = (item: TripStartExceptionWithTrip) => {
    Alert.alert('Resolve alarm', 'Mark this trip-start exception as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () =>
          resolve.mutate(item.id, {
            onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to resolve'),
          }),
      },
    ]);
  };

  return (
    <AdminScreen
      title="Trips"
      subtitle="Trip alarms"
      subnav={<SubNav segments={SUBNAV.trips} value="exceptions" />}
    >
      <View style={styles.root}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>

        {isError ? (
          <EmptyState title="Could not load alarms" description="Check your connection and try again." />
        ) : isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="35%" height={13} style={{ marginTop: 10 }} />
                <Skeleton width="90%" height={13} style={{ marginTop: 12 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={data ?? []}
            columns={gridColumns}
            keyExtractor={(e) => e.id}
            ListHeaderComponent={headerSections}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>✅</Text>}
                  title={filter === 'open' ? 'No off-protocol starts' : 'No start exceptions'}
                  description="Trips that start off-protocol will appear here."
                />
              </View>
            }
            renderItem={(item) => {
              const resolved = !!item.resolvedAt;
              const routeName = item.trip?.route?.name ?? 'Route';
              const driverName = item.trip?.driver?.name ?? '—';
              const vehicleReg = item.trip?.vehicle?.regNumber ?? '—';
              return (
                <Card shadow="sm" style={[styles.card, { borderLeftColor: resolved ? colors.gray300 : colors.error }]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.route} numberOfLines={1}>{routeName} · {item.trip?.direction ?? ''}</Text>
                    <Badge label={resolved ? 'Resolved' : 'Open'} variant={resolved ? 'cancelled' : 'error'} size="sm" />
                  </View>
                  <Text style={styles.meta}>{driverName} · {vehicleReg}</Text>

                  <View style={styles.flags}>
                    {!item.dailyCheckDone ? <Text style={styles.flag}>⚠️ No daily check</Text> : null}
                    <Text style={styles.flag}>⏱ {offsetLabel(item.deltaMinutes)}</Text>
                  </View>

                  <Text style={styles.reasonLabel}>DRIVER'S REASON</Text>
                  <Text style={styles.reason}>{item.reason}</Text>

                  <Text style={styles.times}>
                    Scheduled {new Date(item.scheduledStart).toLocaleString()} · Started {new Date(item.startedAt).toLocaleString()}
                  </Text>

                  {resolved ? (
                    <Text style={styles.resolvedNote}>
                      Resolved {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ''}
                    </Text>
                  ) : (
                    <Button
                      title="Mark Resolved"
                      onPress={() => onResolve(item)}
                      loading={resolve.isPending && resolve.variables === item.id}
                      fullWidth
                      style={styles.resolveBtn}
                    />
                  )}
                </Card>
              );
            }}
          />
        )}
      </View>

      {/* Reason capture for force-complete / force-abort (both mandatory, PRD-02a §4). */}
      <Modal
        visible={reasonModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {reasonModal?.kind === 'force-complete' ? 'Force-complete trip' : 'Force-abort trip'}
            </Text>
            <Text style={styles.modalWhy}>
              {reasonModal?.kind === 'force-complete'
                ? 'Close this trip on the driver’s behalf. Parents are notified it completed.'
                : 'Abort this trip. Affected parents and the driver are notified.'}
            </Text>
            <Text style={styles.modalLabel}>Reason *</Text>
            <TextInput
              style={styles.modalInput}
              value={reasonText}
              onChangeText={setReasonText}
              placeholder={
                reasonModal?.kind === 'force-complete'
                  ? 'e.g. Driver confirmed all riders dropped; forgot to tap complete'
                  : 'e.g. Vehicle breakdown; trip could not continue'
              }
              placeholderTextColor={colors.gray400}
              multiline
            />
            <Button
              title={reasonModal?.kind === 'force-complete' ? 'Force-complete' : 'Force-abort'}
              onPress={onConfirmReason}
              fullWidth
              disabled={!reasonText.trim()}
              loading={forceComplete.isPending || abort.isPending}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setReasonModal(null)}
              fullWidth
              style={{ marginTop: spacing[1] }}
            />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  overdueSection: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[2] },
  sectionHeading: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  sectionSub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  overdueList: { gap: spacing[3], marginTop: spacing[1] },

  card: { gap: spacing[1], borderLeftWidth: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  route: { flex: 1, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  meta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] },
  flag: { fontSize: fontSizes.xs, color: colors.warningDark, fontWeight: fontWeights.medium },
  reasonLabel: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2], fontWeight: fontWeights.semibold },
  reason: { fontSize: fontSizes.sm, color: colors.textPrimary },
  times: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[1] },
  resolvedNote: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing[1], fontStyle: 'italic' },
  resolveBtn: { marginTop: spacing[2] },
  actions: { gap: spacing[2], marginTop: spacing[3] },

  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing[5] },
  modalCard: { backgroundColor: colors.background, borderRadius: radius['2xl'], padding: spacing[5], gap: spacing[3], maxWidth: 440, width: '100%', alignSelf: 'center' },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  modalWhy: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  modalLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  modalInput: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minHeight: 72, textAlignVertical: 'top',
  },
});

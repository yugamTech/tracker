import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, fontFamilies,
  Card, Skeleton, EmptyState, AnimatedPressable, Stagger, IconSplat, Icon, SegmentedControl, useToast,
  type SpotIconName, type IconName,
} from '@yaanam/ui';
import {
  useTripStartExceptions, useResolveStartException, useOverdueTrips,
  useTripCompletionExceptions, useResolveCompletionException,
  useLifecycleAlarms, useForceCompleteTrip, useAbortTrip, useAcknowledgeTrip,
} from '@yaanam/api-client';
import type {
  TripStartExceptionWithTrip, TripCompletionExceptionWithTrip, LifecycleAlarmTrip,
} from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { SUBNAV } from '../../../lib/nav';

// ── presentation model ───────────────────────────────────────────────────────
// One unified item per exception, regardless of which feed it came from. The
// data hooks below are untouched; this is pure client-side shaping + grouping.

type Severity = 'crit' | 'warn' | 'done';
type ExKind = 'abandoned' | 'overdue' | 'never-started' | 'ended-early' | 'off-protocol';

interface UItem {
  id: string;
  severity: Severity;
  kind: ExKind;
  tag: string;
  /** Multi-colour spot icon, when the kind has one. */
  spot?: SpotIconName;
  /** Duotone icon (used when there's no spot). */
  icon?: IconName;
  iconColor?: string;
  route: string;
  meta: string[];
  reason?: string;
  resolvedNote?: string;
  resolved: boolean;
  /** Higher = more urgent within a severity band. */
  urgency: number;
  /** Trip id for the "review" navigation, when available. */
  tripId?: string;
  raw: unknown;
}

const SEV_RANK: Record<Severity, number> = { crit: 0, warn: 1, done: 2 };
const SPLAT_NEUTRAL = '#EEF1F6';

const KIND_LABEL: Record<ExKind, string> = {
  abandoned: 'Abandoned',
  overdue: 'Overdue',
  'never-started': 'Never started',
  'ended-early': 'Ended early',
  'off-protocol': 'Off-protocol start',
};

type StatusView = 'needs' | 'resolved' | 'all';
const STATUS_TABS: { key: StatusView; label: string }[] = [
  { key: 'needs', label: 'Needs action' },
  { key: 'resolved', label: 'Resolved' },
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

function timeLabel(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function TripExceptionsScreen() {
  const [view, setView] = useState<StatusView>('needs');
  const [typeFilter, setTypeFilter] = useState<'all' | ExKind>('all');

  // Always request the full set ('all' is the same argument the screen already
  // used) so the triage tiles + the three status tabs can be computed entirely
  // client-side and stay accurate no matter which tab is active.
  const { data: startData = [], isLoading, isError } = useTripStartExceptions('all');
  const { data: overdue = [] } = useOverdueTrips();
  const { data: completionExceptions = [] } = useTripCompletionExceptions('all');
  const { data: lifecycleAlarms = [] } = useLifecycleAlarms();

  const resolve = useResolveStartException();
  const resolveCompletion = useResolveCompletionException();
  const forceComplete = useForceCompleteTrip();
  const abort = useAbortTrip();
  const acknowledge = useAcknowledgeTrip();
  const toast = useToast();

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

  const reviewTrip = (tripId?: string) => {
    if (tripId) router.push(`/(app)/fleet/${tripId}` as never);
  };

  // ── build the unified, shaped list (pure presentation) ──────────────────────
  const allItems = useMemo<UItem[]>(() => {
    const items: UItem[] = [];

    // Started-not-completed lifecycle alarms: ABANDONED (auto-aborted) = critical,
    // OVERDUE (still live, past cutoff) = attention.
    for (const t of lifecycleAlarms) {
      const abandoned = t.lifecycleStage === 'ABANDONED';
      items.push({
        id: `lc-${t.id}`,
        severity: abandoned ? 'crit' : 'warn',
        kind: abandoned ? 'abandoned' : 'overdue',
        tag: abandoned ? KIND_LABEL.abandoned : KIND_LABEL.overdue,
        spot: abandoned ? 'abandoned' : 'overdue',
        route: `${t.route?.name ?? 'Route'} · ${t.direction}`,
        meta: [
          `${abandoned ? 'Ran' : 'Running'} ${overdueLabel(t.overdueMinutes)}`,
          abandoned ? 'auto-closed' : 'still live',
          t.driver?.name ?? undefined,
        ].filter(Boolean) as string[],
        reason: abandoned && t.abortReason ? t.abortReason : undefined,
        resolved: false,
        urgency: 10000 + t.overdueMinutes,
        tripId: t.id,
        raw: t,
      });
    }

    // Never-started: still SCHEDULED long past departure — attention.
    for (const t of overdue) {
      const start = t.scheduledStart ?? t.date;
      items.push({
        id: `ov-${t.id}`,
        severity: 'warn',
        kind: 'never-started',
        tag: KIND_LABEL['never-started'],
        spot: 'overdue',
        route: `${t.route?.name ?? 'Route'} · ${t.direction}`,
        meta: [
          `Overdue by ${overdueLabel(t.overdueMinutes)}`,
          `scheduled ${timeLabel(start)}`,
          t.driver?.name ?? undefined,
        ].filter(Boolean) as string[],
        resolved: false,
        urgency: 5000 + t.overdueMinutes,
        tripId: t.id,
        raw: t,
      });
    }

    // Ended-early completion exceptions: attention while open, resolved otherwise.
    for (const e of completionExceptions) {
      const resolved = !!e.resolvedAt;
      items.push({
        id: `ce-${e.id}`,
        severity: resolved ? 'done' : 'warn',
        kind: 'ended-early',
        tag: KIND_LABEL['ended-early'],
        icon: resolved ? 'checkc' : 'alert',
        iconColor: resolved ? colors.ink3 : colors.warn,
        route: `${e.trip?.route?.name ?? 'Route'} · ${e.trip?.direction ?? ''}`.trim(),
        meta: [
          `Ended at stop ${e.stoppedAtSeq} of ${e.totalStops}`,
          `${e.boarded}/${e.totalRiders} boarded`,
        ],
        reason: !resolved ? e.reason : undefined,
        resolvedNote: resolved ? `Resolved ${timeLabel(e.resolvedAt)}` : undefined,
        resolved,
        urgency: 100,
        tripId: e.trip?.id,
        raw: e,
      });
    }

    // Off-protocol starts: attention while open, resolved otherwise.
    for (const s of startData) {
      const resolved = !!s.resolvedAt;
      const flags = [
        !s.dailyCheckDone ? 'No daily check' : undefined,
        offsetLabel(s.deltaMinutes),
      ].filter(Boolean) as string[];
      items.push({
        id: `se-${s.id}`,
        severity: resolved ? 'done' : 'warn',
        kind: 'off-protocol',
        tag: KIND_LABEL['off-protocol'],
        icon: resolved ? 'checkc' : 'flag',
        iconColor: resolved ? colors.ink3 : colors.warn,
        route: `${s.trip?.route?.name ?? 'Route'} · ${s.trip?.direction ?? ''}`.trim(),
        meta: flags,
        reason: !resolved ? s.reason : undefined,
        resolvedNote: resolved ? `Resolved ${timeLabel(s.resolvedAt)}` : undefined,
        resolved,
        urgency: 50,
        tripId: s.trip?.id,
        raw: s,
      });
    }

    // Priority sort: Critical → Attention → Resolved, most urgent first within a band.
    return items.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.urgency - a.urgency);
  }, [lifecycleAlarms, overdue, completionExceptions, startData]);

  // Triage counts come from the full set so they're stable across tabs.
  const counts = useMemo(() => {
    let crit = 0, warn = 0, done = 0;
    for (const it of allItems) {
      if (it.severity === 'crit') crit++;
      else if (it.severity === 'warn') warn++;
      else done++;
    }
    return { crit, warn, done };
  }, [allItems]);

  // Type chips reflect which kinds are actually present.
  const presentKinds = useMemo(() => {
    const seen = new Set<ExKind>();
    for (const it of allItems) seen.add(it.kind);
    return (Object.keys(KIND_LABEL) as ExKind[]).filter((k) => seen.has(k));
  }, [allItems]);

  const needReview = counts.crit + counts.warn;

  const visible = useMemo(() => {
    return allItems.filter((it) => {
      if (view === 'needs' && it.resolved) return false;
      if (view === 'resolved' && !it.resolved) return false;
      if (typeFilter !== 'all' && it.kind !== typeFilter) return false;
      return true;
    });
  }, [allItems, view, typeFilter]);

  return (
    <AdminScreen
      title="Exceptions"
      subtitle={`${needReview} need review · live`}
      subnav={<SubNav segments={SUBNAV.trips} value="exceptions" />}
    >
      <View style={styles.root}>
        {/* Pinned status tabs — uses the shared SegmentedControl (proven to render
            labels + handle switching) rather than a hand-rolled tab row. */}
        <View style={styles.toolbar}>
          <SegmentedControl
            segments={STATUS_TABS.map((t) => ({ label: t.label, value: t.key }))}
            value={view}
            onChange={setView}
          />
        </View>

        {isError ? (
          <View style={styles.fill}>
            <EmptyState title="Could not load exceptions" description="Check your connection and try again." />
          </View>
        ) : isLoading ? (
          <View style={styles.scrollPad}>
            {[0, 1].map((i) => (
              <Card key={i} shadow="sm" radius={22} style={styles.skeletonCard}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="35%" height={13} style={{ marginTop: 10 }} />
                <Skeleton width="90%" height={13} style={{ marginTop: 12 }} />
              </Card>
            ))}
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollPad}
            showsVerticalScrollIndicator={false}
          >
            {/* Triage summary */}
            <View style={styles.triage}>
              <TriageTile tone="crit" n={counts.crit} label="Critical" />
              <TriageTile tone="warn" n={counts.warn} label="Attention" />
              <TriageTile tone="ok" n={counts.done} label="Resolved" />
            </View>

            {/* Type filters */}
            <View style={styles.filters}>
              <FilterChip label="All types" active={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
              {presentKinds.map((k) => (
                <FilterChip
                  key={k}
                  label={KIND_LABEL[k]}
                  dot={k === 'abandoned' ? colors.crit : colors.warn}
                  active={typeFilter === k}
                  onPress={() => setTypeFilter(k)}
                />
              ))}
            </View>

            {visible.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<IconSplat shape="b1" splatColor={colors.okBg} icon="checkc" iconColor={colors.ok} size={64} />}
                  title={view === 'resolved' ? 'Nothing resolved yet' : 'All clear'}
                  description={
                    view === 'resolved'
                      ? 'Resolved exceptions will appear here.'
                      : 'No exceptions need your attention right now.'
                  }
                />
              </View>
            ) : (
              <Stagger key={`${view}-${typeFilter}`} interval={70}>
                {visible.map((item) => (
                  <ExceptionCard
                    key={item.id}
                    item={item}
                    busyForTrip={busyForTrip}
                    onReview={reviewTrip}
                    onAcknowledge={onAcknowledgeAlarm}
                    onForceComplete={onForceComplete}
                    onForceAbort={onForceAbort}
                    onResolveStart={onResolve}
                    onResolveCompletion={onResolveCompletion}
                    resolveStartPending={resolve.isPending ? (resolve.variables as string) : undefined}
                    resolveCompletionPending={resolveCompletion.isPending ? (resolveCompletion.variables as string) : undefined}
                  />
                ))}
              </Stagger>
            )}
          </ScrollView>
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
              placeholderTextColor={colors.ink3}
              multiline
            />
            <ActionButton
              title={reasonModal?.kind === 'force-complete' ? 'Force-complete' : 'Force-abort'}
              tone="solid"
              color={colors.trip}
              onPress={onConfirmReason}
              disabled={!reasonText.trim()}
              loading={forceComplete.isPending || abort.isPending}
            />
            <ActionButton title="Cancel" tone="ghost" onPress={() => setReasonModal(null)} />
          </View>
        </View>
      </Modal>
    </AdminScreen>
  );
}

// ── triage tile ───────────────────────────────────────────────────────────────
function TriageTile({ tone, n, label }: { tone: 'crit' | 'warn' | 'ok'; n: number; label: string }) {
  return (
    <View style={[styles.tcell, styles[`tcell_${tone}`]]}>
      <Text style={[styles.tcellN, styles[`tcellText_${tone}`]]}>{n}</Text>
      <Text style={[styles.tcellL, styles[`tcellText_${tone}`]]}>{label}</Text>
      <View style={[styles.tcellGlow, styles[`tcellGlow_${tone}`]]} />
    </View>
  );
}

// ── filter chip ────────────────────────────────────────────────────────────────
function FilterChip({ label, dot, active, onPress }: { label: string; dot?: string; active: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      scaleTo={0.95}
      hitSlop={6}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

// ── action button (matches the reference's rounded solid / neutral / ghost) ─────
function ActionButton({
  title, tone, color, onPress, disabled, loading,
}: {
  title: string;
  tone: 'solid' | 'outline' | 'ghost';
  color?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isSolid = tone === 'solid';
  return (
    <AnimatedPressable
      scaleTo={0.97}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        tone === 'ghost' ? styles.btnGhost : styles.btnFlex,
        isSolid
          ? { backgroundColor: color ?? colors.trip, borderColor: color ?? colors.trip }
          : tone === 'outline'
            ? styles.btnNeutral
            : null,
        (disabled || loading) && styles.btnDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isSolid ? colors.white : colors.ink2} />
      ) : (
        <Text
          style={[
            styles.btnText,
            isSolid ? styles.btnTextSolid : tone === 'outline' ? styles.btnTextNeutral : styles.btnTextGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

// ── unified exception card ──────────────────────────────────────────────────────
function ExceptionCard({
  item, busyForTrip, onReview, onAcknowledge, onForceComplete, onForceAbort,
  onResolveStart, onResolveCompletion, resolveStartPending, resolveCompletionPending,
}: {
  item: UItem;
  busyForTrip: (id: string) => boolean;
  onReview: (tripId?: string) => void;
  onAcknowledge: (t: LifecycleAlarmTrip) => void;
  onForceComplete: (t: LifecycleAlarmTrip) => void;
  onForceAbort: (t: LifecycleAlarmTrip) => void;
  onResolveStart: (e: TripStartExceptionWithTrip) => void;
  onResolveCompletion: (e: TripCompletionExceptionWithTrip) => void;
  resolveStartPending?: string;
  resolveCompletionPending?: string;
}) {
  const sevColor = item.severity === 'crit' ? colors.crit : item.severity === 'warn' ? colors.warn : colors.hairlineStrong;
  const tagStyle =
    item.severity === 'crit' ? styles.tagCrit : item.severity === 'warn' ? styles.tagWarn : styles.tagDone;
  const tagTextStyle =
    item.severity === 'crit' ? styles.tagTextCrit : item.severity === 'warn' ? styles.tagTextWarn : styles.tagTextDone;

  // Actions wired to the existing handlers, by kind.
  const actions = (() => {
    switch (item.kind) {
      case 'abandoned': {
        const t = item.raw as LifecycleAlarmTrip;
        const busy = busyForTrip(t.id);
        return (
          <View style={styles.actions}>
            <ActionButton title="Review trip" tone="solid" color={colors.crit} onPress={() => onReview(item.tripId)} />
            <ActionButton title="Acknowledge" tone="outline" loading={busy} onPress={() => onAcknowledge(t)} />
          </View>
        );
      }
      case 'overdue': {
        const t = item.raw as LifecycleAlarmTrip;
        const busy = busyForTrip(t.id);
        return (
          <View style={styles.actionsCol}>
            <View style={styles.actions}>
              <ActionButton title="Force-complete" tone="solid" color={colors.warn} disabled={busy} onPress={() => onForceComplete(t)} />
              <ActionButton title="Force-abort" tone="outline" disabled={busy} onPress={() => onForceAbort(t)} />
            </View>
            <View style={styles.actions}>
              <ActionButton title="Acknowledge" tone="outline" loading={busy} onPress={() => onAcknowledge(t)} />
              <ActionButton title="Review" tone="outline" onPress={() => onReview(item.tripId)} />
            </View>
          </View>
        );
      }
      case 'never-started':
        return (
          <View style={styles.actions}>
            <ActionButton title="Review trip" tone="solid" color={colors.warn} onPress={() => onReview(item.tripId)} />
          </View>
        );
      case 'ended-early': {
        const e = item.raw as TripCompletionExceptionWithTrip;
        return (
          <View style={styles.actions}>
            <ActionButton
              title="Mark resolved"
              tone="solid"
              color={colors.trip}
              loading={resolveCompletionPending === e.id}
              onPress={() => onResolveCompletion(e)}
            />
            <ActionButton title="Review" tone="outline" onPress={() => onReview(item.tripId)} />
          </View>
        );
      }
      case 'off-protocol': {
        const s = item.raw as TripStartExceptionWithTrip;
        return (
          <View style={styles.actions}>
            <ActionButton
              title="Mark resolved"
              tone="solid"
              color={colors.trip}
              loading={resolveStartPending === s.id}
              onPress={() => onResolveStart(s)}
            />
            <ActionButton title="Review" tone="outline" onPress={() => onReview(item.tripId)} />
          </View>
        );
      }
    }
  })();

  return (
    <Card
      shadow="sm"
      radius={22}
      padding={0}
      style={[styles.exCard, item.resolved && styles.exCardDone]}
    >
      <View style={[styles.wash, { backgroundColor: sevColor }]} />
      <View style={styles.exBody}>
        <AnimatedPressable
          scaleTo={0.99}
          onPress={() => onReview(item.tripId)}
          disabled={!item.tripId}
          accessibilityRole="button"
          accessibilityLabel={`${item.tag} · ${item.route}`}
        >
          <View style={styles.exTop}>
            <IconSplat
              shape="b1"
              splatColor={SPLAT_NEUTRAL}
              spot={item.spot}
              icon={item.icon}
              iconColor={item.iconColor}
              size={50}
            />
            <View style={styles.exMain}>
              <View style={[styles.tag, tagStyle]}>
                <Text style={[styles.tagText, tagTextStyle]}>{item.tag}</Text>
              </View>
              <Text style={styles.exRoute} numberOfLines={1}>{item.route}</Text>
              <View style={styles.exMeta}>
                {item.meta.map((m, i) => (
                  <React.Fragment key={i}>
                    {i > 0 ? <View style={styles.metaSep} /> : null}
                    <Text style={styles.exMetaText}>{m}</Text>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </View>

          {item.reason ? (
            <View style={styles.reasonBox}>
              <Icon name="alert" size={16} color={colors.warn} />
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          ) : null}
        </AnimatedPressable>

        {item.resolved ? (
          <View style={styles.rez}>
            <Icon name="check" size={16} color={colors.ok} />
            <Text style={styles.rezText}>{item.resolvedNote}</Text>
          </View>
        ) : (
          actions
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1, minHeight: 320 },
  scroll: { flex: 1 },
  scrollPad: { padding: spacing[4], maxWidth: 640, width: '100%', alignSelf: 'center' },

  // status tabs
  toolbar: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  tabs: {
    flexDirection: 'row',
    gap: spacing[1],
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
    borderRadius: 16,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: 12 },
  tabActive: {
    backgroundColor: colors.white,
    shadowColor: '#16203B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  tabLabel: { fontFamily: fontFamilies.display, fontSize: 13, fontWeight: fontWeights.bold, color: colors.ink2 },
  tabLabelActive: { color: colors.trip },

  // triage
  triage: { flexDirection: 'row', gap: spacing[2] + 1, marginBottom: spacing[4] },
  tcell: { flex: 1, borderRadius: 20, paddingVertical: 13, paddingHorizontal: 13, borderWidth: 1, overflow: 'hidden' },
  tcell_crit: { backgroundColor: colors.critBg, borderColor: '#FBCBD6' },
  tcell_warn: { backgroundColor: colors.warnBg, borderColor: '#FAE2B5' },
  tcell_ok: { backgroundColor: colors.okBg, borderColor: '#B7EBCF' },
  tcellN: { fontFamily: fontFamilies.displayHeavy, fontSize: 27, fontWeight: fontWeights.extrabold, lineHeight: 28 },
  tcellL: { fontSize: 11.5, fontWeight: fontWeights.bold, marginTop: 5 },
  tcellText_crit: { color: colors.crit },
  tcellText_warn: { color: colors.warningDark },
  tcellText_ok: { color: colors.successDark },
  tcellGlow: { position: 'absolute', right: -14, bottom: -16, width: 58, height: 58, borderRadius: 29, opacity: 0.16 },
  tcellGlow_crit: { backgroundColor: colors.crit },
  tcellGlow_warn: { backgroundColor: colors.warn },
  tcellGlow_ok: { backgroundColor: colors.ok },

  // filters
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.hairlineStrong, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { fontFamily: fontFamilies.display, fontSize: 12.5, fontWeight: fontWeights.bold, color: colors.ink2 },
  chipLabelActive: { color: colors.white },

  // exception card
  exCard: { marginBottom: 13, overflow: 'hidden', borderColor: colors.hairline },
  exCardDone: { backgroundColor: colors.gray50 },
  wash: { height: 6, width: '100%' },
  exBody: { padding: 15 },
  exTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  exMain: { flex: 1, minWidth: 0 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  tagCrit: { backgroundColor: colors.critBg },
  tagWarn: { backgroundColor: colors.warnBg },
  tagDone: { backgroundColor: colors.border },
  tagText: { fontFamily: fontFamilies.displayHeavy, fontSize: 10.5, fontWeight: fontWeights.extrabold, letterSpacing: 0.4, textTransform: 'uppercase' },
  tagTextCrit: { color: colors.crit },
  tagTextWarn: { color: colors.warningDark },
  tagTextDone: { color: colors.ink2 },
  exRoute: { fontFamily: fontFamilies.displayHeavy, fontSize: 16, fontWeight: fontWeights.extrabold, color: colors.ink, marginTop: 7 },
  exMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  exMetaText: { fontSize: 13, color: colors.ink2, fontWeight: fontWeights.medium },
  metaSep: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.ink3 },
  reasonBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.warnBg, borderRadius: 13, padding: 11, marginTop: 11,
  },
  reasonText: { flex: 1, fontSize: 12.5, color: '#92400E', fontWeight: fontWeights.medium, lineHeight: 17 },
  rez: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  rezText: { fontFamily: fontFamilies.bodySemibold, fontSize: 12.5, color: colors.successDark, fontWeight: fontWeights.bold },

  // actions
  actions: { flexDirection: 'row', gap: 9, marginTop: 13 },
  actionsCol: { gap: 9, marginTop: 13 },
  btn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5 },
  btnFlex: { flex: 1 },
  btnGhost: { alignSelf: 'stretch', borderWidth: 0 },
  btnNeutral: { backgroundColor: colors.white, borderColor: colors.hairlineStrong },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: fontFamilies.displayHeavy, fontSize: 13.5, fontWeight: fontWeights.extrabold },
  btnTextSolid: { color: colors.white },
  btnTextNeutral: { color: colors.ink },
  btnTextGhost: { color: colors.ink2 },

  // skeleton / empty
  skeletonCard: { marginBottom: 13, padding: spacing[4] },
  emptyWrap: { minHeight: 280, justifyContent: 'center' },

  // modal (reason capture) — preserved behaviour, refreshed tokens
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing[5] },
  modalCard: { backgroundColor: colors.background, borderRadius: radius['2xl'], padding: spacing[5], gap: spacing[3], maxWidth: 440, width: '100%', alignSelf: 'center' },
  modalTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.ink },
  modalWhy: { fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 20 },
  modalLabel: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.ink2 },
  modalInput: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: fontSizes.base, color: colors.ink,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minHeight: 72, textAlignVertical: 'top',
  },
});

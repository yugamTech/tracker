import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, RefreshControl, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, Button, LoadingSpinner, EmptyState, LiveBusMap, SpotIcon, Icon, useToast,
} from '@yaanam/ui';
import type { BadgeVariant, IconName, SpotIconName } from '@yaanam/ui';
import {
  useTripById, useRoster, useCancelTrip, useLatestPosition, useTripSocket, useTripLifecycleEvents,
} from '@yaanam/api-client';
import type { RosterGuardian, TripLifecycleEvent } from '@yaanam/api-client';
import { goBackTo } from '../../../lib/nav';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: colors.ok,
  ABORTED: colors.crit,
  IN_PROGRESS: '#0EA5E9',
  STARTED: '#0EA5E9',
  SCHEDULED: colors.gray400,
  CANCELLED: colors.gray400,
};

function boardVariant(status: string): BadgeVariant {
  switch (status) {
    case 'BOARDED': return 'boarded';
    case 'NOT_BOARDED': return 'not_boarded';
    case 'CANCELLED': return 'cancelled';
    default: return 'expected';
  }
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function startDeltaLabel(startedAt?: string | null, scheduledStart?: string | null): string | null {
  if (!startedAt || !scheduledStart) return null;
  const d = Math.round((new Date(startedAt).getTime() - new Date(scheduledStart).getTime()) / 60_000);
  if (d === 0) return 'on time';
  return `${Math.abs(d)} min ${d < 0 ? 'early' : 'late'}`;
}

interface TimelineItem {
  time?: string;
  title: string;
  sub?: string;
  dotColor: string;
  icon: IconName;
}

function GuardianRow({ g }: { g: RosterGuardian }) {
  return (
    <TouchableOpacity
      style={styles.guardianRow}
      onPress={() => Linking.openURL(`tel:${g.phone}`)}
      activeOpacity={0.7}
    >
      <View style={styles.guardianInfo}>
        <Text style={styles.guardianName}>
          {g.name} {g.isPrimary ? '· primary' : ''}
        </Text>
        <Text style={styles.guardianPhone}>{g.phone}</Text>
      </View>
      <View style={styles.callBtn}>
        <Icon name="phone" size={14} color={colors.white} />
        <Text style={styles.callBtnText}>Call</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TripMonitorScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTripById(tripId);
  const { data: roster, isLoading, isError, refetch, isRefetching } = useRoster(tripId);
  const { data: primed } = useLatestPosition(tripId);
  const { data: lifecycleEvents = [] } = useTripLifecycleEvents(tripId);
  const cancelTrip = useCancelTrip();
  const toast = useToast();

  // Live bus position: primed from the REST snapshot, then advanced by this
  // trip's own socket room — no need to subscribe to (and filter) the whole fleet.
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  useTripSocket(tripId, {
    onLocation: (d) => setPos({ lat: d.lat, lng: d.lng }),
  });
  const busPos = pos ?? (primed ? { lat: primed.lat, lng: primed.lng } : null);

  // Ordered route stops with coords for the live map.
  const routeStops = useMemo(
    () =>
      (((trip as any)?.route?.stops ?? []) as any[])
        .map((rs: any) => ({
          id: rs.stop?.id ?? rs.id,
          name: rs.stop?.name ?? rs.name,
          lat: rs.stop?.lat,
          lng: rs.stop?.lng,
        }))
        .filter((s) => s.lat != null && s.lng != null),
    [trip],
  );

  // Resolved school / override-destination anchor (server-computed), or null when
  // no school coords are configured for the tenant and no per-trip override is set.
  const anchor = (trip as any)?.anchor as
    | { lat: number; lng: number; label: string | null; role: 'ORIGIN' | 'DESTINATION' }
    | null
    | undefined;

  const handleCancel = () => {
    Alert.alert(
      'Cancel trip',
      'This cancels the scheduled trip and notifies the driver, conductor and admins. This cannot be undone.',
      [
        { text: 'Keep trip', style: 'cancel' },
        {
          text: 'Cancel trip',
          style: 'destructive',
          onPress: () =>
            cancelTrip.mutate(tripId, {
              onSuccess: () => { toast.success('The trip has been cancelled.', 'Cancelled'); goBackTo('fleet/[tripId]'); },
              onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to cancel trip'),
            }),
        },
      ],
    );
  };

  // Compose the lifecycle story from the trip's own fields + the immutable
  // lifecycle-event audit trail. Pure presentation over read-only data.
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!roster) return [];
    const t = trip as any;
    const items: TimelineItem[] = [];
    const total = roster.summary.total;
    const stopCount = roster.stops.length;

    items.push({
      time: fmtTime(t?.scheduledStart ?? t?.date),
      title: 'Scheduled',
      sub: `${total} student${total !== 1 ? 's' : ''} across ${stopCount} stop${stopCount !== 1 ? 's' : ''}.`,
      dotColor: colors.ok,
      icon: 'check',
    });

    if (t?.startedAt) {
      const delta = startDeltaLabel(t.startedAt, t.scheduledStart);
      items.push({
        time: fmtTime(t.startedAt),
        title: 'Trip started',
        sub: [delta, 'GPS live'].filter(Boolean).join(' · '),
        dotColor: colors.people,
        icon: 'bus',
      });

      const missed = roster.stops.filter((s) => s.riders.some((r) => r.boardStatus === 'NOT_BOARDED')).map((s) => s.stopName);
      const missedText =
        missed.length > 0
          ? `${roster.summary.notBoarded} missed at ${missed.slice(0, 2).join(' & ')}${missed.length > 2 ? '…' : ''}.`
          : 'All riders boarded.';
      items.push({
        title: `${roster.summary.boarded} of ${total} boarded`,
        sub: missedText,
        dotColor: colors.route,
        icon: 'users',
      });
    }

    for (const e of lifecycleEvents) {
      items.push(lifecycleTimelineItem(e));
    }

    // Normally-completed trips carry no lifecycle event — close the story off the
    // trip's own completedAt.
    if (t?.status === 'COMPLETED' && t?.completedAt && !lifecycleEvents.some((e) => e.action === 'FORCE_COMPLETED')) {
      items.push({
        time: fmtTime(t.completedAt),
        title: 'Completed',
        sub: `${roster.summary.boarded}/${total} boarded.`,
        dotColor: colors.ok,
        icon: 'checkc',
      });
    }

    return items;
  }, [trip, roster, lifecycleEvents]);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isError || !roster) {
    return <EmptyState title="Could not load trip" description="Check your connection and try again" />;
  }

  const t = trip as any;
  const routeName: string = t?.route?.name ?? roster.tripId;
  const driverName: string = t?.driver?.name ?? '—';
  const conductorName: string | undefined = t?.conductor?.name;
  const vehicleReg: string = t?.vehicle?.regNumber ?? '—';
  const status: string = t?.status ?? '';

  const isLive = status === 'STARTED' || status === 'IN_PROGRESS';
  const isEnded = status === 'COMPLETED' || status === 'ABORTED';
  const isAborted = status === 'ABORTED';

  // Flatten riders to surface not-boarded exceptions across all stops.
  const allRiders = roster.stops.flatMap((s) => s.riders.map((r) => ({ ...r, stopName: s.stopName })));
  const notBoarded = allRiders.filter((r) => r.boardStatus === 'NOT_BOARDED');

  // Post-mortem header content (ENDED trips).
  const autoAborted = lifecycleEvents.some((e) => e.action === 'AUTO_ABORTED');
  const forceAborted = lifecycleEvents.some((e) => e.action === 'FORCE_ABORTED');
  const pmBadge: SpotIconName = isAborted ? 'abandoned' : 'started';
  const pmTag = isAborted
    ? autoAborted ? 'Abandoned · auto-closed' : forceAborted ? 'Force-aborted' : 'Aborted'
    : 'Completed';
  const pmDate = fmtDate(t?.scheduledStart ?? t?.date);

  // Post-mortem stat row.
  const lastEvent = lifecycleEvents.length ? lifecycleEvents[lifecycleEvents.length - 1] : undefined;
  const startMs = t?.startedAt ? new Date(t.startedAt).getTime() : null;
  const endMs = t?.completedAt
    ? new Date(t.completedAt).getTime()
    : lastEvent
      ? new Date(lastEvent.createdAt).getTime()
      : null;
  const durationLabel = startMs && endMs && endMs >= startMs ? fmtDuration(Math.round((endMs - startMs) / 60_000)) : '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.trip} />}
    >
      {/* Live route map — shown when trip is started/in-progress */}
      {isLive && routeStops.length > 0 && (
        <>
          <LiveBusMap
            stops={routeStops}
            busLat={busPos?.lat}
            busLng={busPos?.lng}
            schoolLat={anchor?.lat}
            schoolLng={anchor?.lng}
            schoolLabel={anchor?.label}
            schoolRole={anchor?.role}
            routeName={routeName}
            height={180}
          />
          {!anchor && (
            <Text style={styles.anchorNudge}>
              🏫 Set your school location in Settings to show it on the route.
            </Text>
          )}
        </>
      )}

      {/* Header — post-mortem hero for ENDED trips, plain card otherwise */}
      {isEnded ? (
        <View style={styles.pmHead}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="pmGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#3B2C8F" />
                <Stop offset="0.6" stopColor="#5B4DE0" />
                <Stop offset="1" stopColor="#7C5CF0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#pmGrad)" />
          </Svg>
          <View style={styles.pmBadge}>
            <SpotIcon name={pmBadge} size={32} />
          </View>
          <View style={styles.pmTag}>
            <Icon name={isAborted ? 'alert' : 'check'} size={14} color={colors.white} />
            <Text style={styles.pmTagText}>{pmTag}</Text>
          </View>
          <Text style={styles.pmTitle}>{routeName}{t?.direction ? ` · ${t.direction}` : ''}</Text>
          <Text style={styles.pmSub}>{pmDate} · Driver {driverName} · Bus {vehicleReg}</Text>
        </View>
      ) : (
        <Card style={styles.section}>
          <View style={styles.headerTop}>
            <Text style={styles.routeName}>{routeName}{t?.direction ? ` · ${t.direction}` : ''}</Text>
            {!!status && (
              <Text style={[styles.status, { color: STATUS_COLORS[status] ?? colors.gray400 }]}>{status}</Text>
            )}
          </View>
          <View style={styles.headerMetaRow}>
            <Icon name="users" size={16} color={colors.ink2} />
            <Text style={styles.headerMeta}>{driverName}{conductorName ? ` · ${conductorName}` : ''}</Text>
          </View>
          <View style={styles.headerMetaRow}>
            <Icon name="bus" size={16} color={colors.ink2} />
            <Text style={styles.headerMeta}>{vehicleReg}</Text>
          </View>
        </Card>
      )}

      {/* Edit / cancel — only while the trip is still SCHEDULED; once started it's read-only. */}
      {status === 'SCHEDULED' && (
        <Card style={styles.actionCard}>
          <Text style={styles.actionHint}>This trip hasn't started yet — you can change its plan or cancel it.</Text>
          <View style={styles.actionRow}>
            <View style={styles.actionBtn}>
              <Button
                title="Edit trip"
                variant="secondary"
                onPress={() => router.push(`/(app)/trips/new?tripId=${tripId}` as never)}
                fullWidth
              />
            </View>
            <View style={styles.actionBtn}>
              <Button
                title="Cancel trip"
                variant="danger"
                onPress={handleCancel}
                loading={cancelTrip.isPending}
                fullWidth
              />
            </View>
          </View>
        </Card>
      )}

      {/* Stat row — post-mortem (duration / boarded / not boarded) for ENDED trips */}
      {isEnded ? (
        <View style={styles.pmStats}>
          <PmStat value={durationLabel} label={isAborted ? 'Open duration' : 'Duration'} />
          <PmStat value={String(roster.summary.boarded)} label="Boarded" tone="ok" />
          <PmStat value={String(roster.summary.notBoarded)} label="Not boarded" tone="bad" />
        </View>
      ) : (
        <Card style={styles.summaryCard}>
          <Stat label="Total" value={roster.summary.total} />
          <Stat label="Boarded" value={roster.summary.boarded} color={colors.ok} />
          <Stat label="Not boarded" value={roster.summary.notBoarded} color={colors.crit} />
          <Stat label="Expected" value={roster.summary.expected} color={colors.ink3} />
        </Card>
      )}

      {/* What happened — the colour-graded lifecycle timeline */}
      {timeline.length > 0 && (
        <Card style={styles.section} radius={24}>
          <Text style={styles.cardbTitle}>What happened</Text>
          <Timeline items={timeline} />
        </Card>
      )}

      {/* Exceptions */}
      {notBoarded.length > 0 && (
        <Card style={[styles.section, styles.exceptionCard]}>
          <View style={styles.headerMetaRow}>
            <Icon name="alert" size={18} color={colors.crit} />
            <Text style={styles.exceptionTitle}>Not boarded ({notBoarded.length})</Text>
          </View>
          {notBoarded.map((r) => (
            <View key={r.studentId} style={styles.exceptionRow}>
              <Text style={styles.exceptionName}>{r.studentName}</Text>
              <Text style={styles.exceptionStop}>{r.stopName}</Text>
              {r.guardians.map((g, i) => <GuardianRow key={`${r.studentId}-${i}`} g={g} />)}
            </View>
          ))}
        </Card>
      )}

      {/* Per-stop roster */}
      {roster.stops.length === 0 && (
        <EmptyState title="No riders" description="This trip has no roster yet" />
      )}
      {roster.stops.map((stop) => (
        <Card key={stop.stopId} style={styles.section}>
          <View style={styles.headerMetaRow}>
            <Icon name="pin" size={16} color={colors.route} />
            <Text style={styles.stopName}>{stop.stopName} · {stop.riders.length} rider{stop.riders.length !== 1 ? 's' : ''}</Text>
          </View>
          {stop.riders.map((r) => (
            <View key={r.studentId} style={styles.riderBlock}>
              <View style={styles.riderRow}>
                <Text style={styles.riderName}>{r.studentName}</Text>
                <Badge label={r.boardStatus.replace('_', ' ')} variant={boardVariant(r.boardStatus)} size="sm" />
              </View>
              {r.guardians.length === 0 ? (
                <Text style={styles.noGuardian}>No guardian contact on file</Text>
              ) : (
                r.guardians.map((g, i) => <GuardianRow key={`${r.studentId}-${i}`} g={g} />)
              )}
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

/** Map one immutable lifecycle-event row to a graded timeline step. */
function lifecycleTimelineItem(e: TripLifecycleEvent): TimelineItem {
  switch (e.action) {
    case 'AUTO_ABORTED':
      return { time: fmtTime(e.createdAt), title: 'Auto-closed (abandoned)', sub: e.reason ?? 'Driver never marked it complete.', dotColor: colors.crit, icon: 'x' };
    case 'FORCE_ABORTED':
      return { time: fmtTime(e.createdAt), title: 'Force-aborted', sub: e.reason ?? undefined, dotColor: colors.crit, icon: 'x' };
    case 'FORCE_COMPLETED':
      return { time: fmtTime(e.createdAt), title: 'Force-completed', sub: e.reason ?? undefined, dotColor: colors.warn, icon: 'check' };
    case 'ACKNOWLEDGED':
      return { time: fmtTime(e.createdAt), title: 'Acknowledged', sub: e.reason ?? undefined, dotColor: colors.ink3, icon: 'check' };
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View style={styles.tl}>
      <View style={styles.tlLine} />
      {items.map((it, i) => (
        <View key={i} style={[styles.tlItem, i === items.length - 1 && styles.tlItemLast]}>
          <View style={[styles.tlDot, { backgroundColor: it.dotColor }]}>
            <Icon name={it.icon} size={15} color={colors.white} strokeWidth={2.2} />
          </View>
          {it.time ? <Text style={styles.tlTime}>{it.time}</Text> : null}
          <Text style={styles.tlHead}>{it.title}</Text>
          {it.sub ? <Text style={styles.tlSub}>{it.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function PmStat({ value, label, tone }: { value: string; label: string; tone?: 'ok' | 'bad' }) {
  return (
    <View style={styles.pmStat}>
      <Text style={[styles.pmStatV, tone === 'ok' && { color: colors.ok }, tone === 'bad' && { color: colors.crit }]}>{value}</Text>
      <Text style={styles.pmStatK}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[3] },
  section: { gap: spacing[2] },
  anchorNudge: {
    fontSize: fontSizes.xs, color: colors.ink3,
    marginTop: -spacing[1], marginHorizontal: spacing[1],
  },

  // plain header (live / scheduled)
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.ink, flex: 1 },
  status: { fontFamily: fontFamilies.display, fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerMeta: { fontSize: fontSizes.sm, color: colors.ink2 },

  actionCard: { gap: spacing[3] },
  actionHint: { fontSize: fontSizes.sm, color: colors.ink2 },
  actionRow: { flexDirection: 'row', gap: spacing[3] },
  actionBtn: { flex: 1 },

  // post-mortem hero
  pmHead: { borderRadius: 26, padding: 18, paddingRight: 80, overflow: 'hidden', backgroundColor: '#5B4DE0', minHeight: 110 },
  pmBadge: {
    position: 'absolute', right: 16, top: 16, width: 52, height: 52, backgroundColor: colors.white,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#140C3C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6,
  },
  pmTag: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.17)', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99,
  },
  pmTagText: { fontFamily: fontFamilies.displayHeavy, fontSize: 11, fontWeight: fontWeights.extrabold, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.white },
  pmTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: 23, fontWeight: fontWeights.extrabold, color: colors.white, marginTop: 12, letterSpacing: -0.4 },
  pmSub: { fontSize: 13.5, color: '#DDD8FF', marginTop: 4, fontWeight: fontWeights.medium },

  // post-mortem stat row
  pmStats: { flexDirection: 'row', gap: spacing[2] + 1 },
  pmStat: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline, borderRadius: 19, padding: 13, alignItems: 'center' },
  pmStatV: { fontFamily: fontFamilies.displayHeavy, fontSize: 22, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.4 },
  pmStatK: { fontSize: 11, color: colors.ink2, marginTop: 3, fontWeight: fontWeights.semibold },

  // timeline
  cardbTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: 12, fontWeight: fontWeights.extrabold, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink3, marginBottom: spacing[3] },
  tl: { position: 'relative', paddingLeft: 34 },
  tlLine: { position: 'absolute', left: 13, top: 8, bottom: 14, width: 2.5, backgroundColor: colors.hairlineStrong, borderRadius: 9 },
  tlItem: { position: 'relative', paddingBottom: 19 },
  tlItemLast: { paddingBottom: 0 },
  tlDot: {
    position: 'absolute', left: -34, top: 0, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#16203B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 7, elevation: 3,
  },
  tlTime: { fontFamily: fontFamilies.displayHeavy, fontSize: 11, fontWeight: fontWeights.extrabold, color: colors.ink3, letterSpacing: 0.3, textTransform: 'uppercase' },
  tlHead: { fontFamily: fontFamilies.displayHeavy, fontSize: 15, fontWeight: fontWeights.extrabold, color: colors.ink, marginTop: 2 },
  tlSub: { fontSize: 13, color: colors.ink2, marginTop: 2, fontWeight: fontWeights.medium, lineHeight: 18 },

  // summary (live / scheduled)
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing[4] },
  stat: { alignItems: 'center', gap: spacing[1] },
  statValue: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.ink },
  statLabel: { fontSize: fontSizes.xs, color: colors.ink2 },

  // exceptions
  exceptionCard: { borderWidth: 1, borderColor: colors.crit, backgroundColor: colors.critBg },
  exceptionTitle: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.crit },
  exceptionRow: { gap: spacing[1], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: '#FECACA' },
  exceptionName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.ink },
  exceptionStop: { fontSize: fontSizes.xs, color: colors.ink2 },

  // roster
  stopName: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  riderBlock: { gap: spacing[1], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.hairline },
  riderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riderName: { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.ink, flex: 1 },
  noGuardian: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, fontStyle: 'italic' },
  guardianRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.ground, borderRadius: 12, padding: spacing[2], marginTop: spacing[1],
  },
  guardianInfo: { flex: 1 },
  guardianName: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.ink },
  guardianPhone: { fontSize: fontSizes.xs, color: colors.ink2 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: 12, backgroundColor: colors.trip },
  callBtnText: { fontFamily: fontFamilies.display, fontSize: fontSizes.xs, color: colors.white, fontWeight: fontWeights.semibold },
});

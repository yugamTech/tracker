import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, StatusDot, Skeleton, EmptyState, AnimatedPressable, Divider, Stagger,
  IconSplat, Icon, type SpotIconName, type IconName,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useFleet, useTodayTrips, useLifecycleAlarms, useTripTrends, useComplaintKpi } from '@yaanam/api-client';
import type { FleetEntry } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const ACTIVE = new Set(['STARTED', 'IN_PROGRESS']);
const SPLAT_NEUTRAL = '#EEF1F6';

function statusBadge(status: string): { label: string; variant: BadgeVariant } {
  if (ACTIVE.has(status)) return { label: 'Live', variant: 'info' };
  if (status === 'SIGNAL_LOST') return { label: 'Signal lost', variant: 'error' };
  if (status === 'COMPLETED') return { label: 'Completed', variant: 'success' };
  return { label: 'Scheduled', variant: 'default' };
}

export default function DashboardScreen() {
  const { isDesktop } = useResponsive();
  const { data: fleet, isLoading: fleetLoading } = useFleet();
  const { data: trips, isLoading: tripsLoading } = useTodayTrips();
  const { data: lifecycleAlarms, isLoading: alarmsLoading } = useLifecycleAlarms();
  // Today's on-time / boarding rates come from the last day of the trend series;
  // open-complaint count from the complaint KPI rollup. Both degrade to '—' / 0.
  const { data: trends, isLoading: trendsLoading } = useTripTrends(7);
  const { data: complaintKpi, isLoading: kpiLoading } = useComplaintKpi();

  const list = fleet ?? [];
  const active = list.filter((f) => ACTIVE.has(f.status));
  const signalLost = list.filter((f) => f.status === 'SIGNAL_LOST');
  const tripList = trips ?? [];
  const completed = tripList.filter((t) => t.status === 'COMPLETED').length;
  // Started-not-completed alarms (PRD-02a): Stage-1 overdue (still live) + Stage-2
  // abandoned-pending-ack. Red when any need attention.
  const alarms = lifecycleAlarms ?? [];
  const today = trends?.[trends.length - 1];
  const openComplaints = complaintKpi?.open ?? 0;

  return (
    <AdminScreen
      title="Dashboard"
      subtitle="Today at a glance"
      subnav={<SubNav segments={SUBNAV.dashboard} value="overview" />}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* KPI grid — calm white tiles that light up only when something needs you. */}
        <View style={[styles.kpiRow, isDesktop ? styles.kpiRowDesktop : styles.kpiRowPhone]}>
          <Stagger interval={60} itemStyle={isDesktop ? styles.kpiCellDesktop : styles.kpiCellPhone}>
            <KpiTile
              label="Active trips"
              value={fleetLoading ? '—' : active.length}
              spot="started"
              valueColor={colors.fleet}
            />
            <KpiTile
              label="Signal lost"
              value={fleetLoading ? '—' : signalLost.length}
              spot="signal"
              alert={signalLost.length > 0}
              alertBg={colors.critBg}
              valueColor={signalLost.length ? colors.crit : colors.ink3}
            />
            <KpiTile
              label="Trips today"
              value={tripsLoading ? '—' : tripList.length}
              spot="trip"
              valueColor={colors.trip}
            />
            <KpiTile
              label="Completed"
              value={tripsLoading ? '—' : completed}
              icon="checkc"
              iconColor={colors.ok}
              iconSplatBg={colors.okBg}
              valueColor={colors.ok}
            />
            <KpiTile
              label="Active & overdue"
              value={alarmsLoading ? '—' : alarms.length}
              spot="overdue"
              alert={alarms.length > 0}
              alertBg={colors.warnBg}
              valueColor={alarms.length ? colors.warn : colors.ink3}
              onPress={() => router.push('/(app)/trips/exceptions' as never)}
            />
          </Stagger>
        </View>

        {/* Today's performance + open service load (real, at-a-glance) */}
        <TodayStrip
          loading={trendsLoading}
          onTimeRate={today?.onTimeRate ?? null}
          boardingRate={today?.boardingRate ?? null}
          openComplaints={openComplaints}
          complaintsLoading={kpiLoading}
        />

        {/* Main + side region */}
        <View style={[styles.region, isDesktop && styles.regionDesktop]}>
          <View style={isDesktop ? styles.mainCol : undefined}>
            <FleetPanel loading={fleetLoading} fleet={list} />
          </View>
          <View style={isDesktop ? styles.sideCol : styles.sideColPhone}>
            <AttentionPanel loading={fleetLoading} signalLost={signalLost} />
          </View>
        </View>
      </ScrollView>
    </AdminScreen>
  );
}

/**
 * A KPI tile in the reference's calm-card style: a painted spot/duotone icon
 * badge, a big rounded-display value and a muted label. Stays white until its
 * metric needs attention, when it washes in the severity tint with a corner glow.
 */
function KpiTile({
  label, value, spot, icon, iconColor, iconSplatBg, valueColor, alert, alertBg, onPress,
}: {
  label: string;
  value: string | number;
  spot?: SpotIconName;
  icon?: IconName;
  iconColor?: string;
  iconSplatBg?: string;
  valueColor?: string;
  alert?: boolean;
  alertBg?: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.kpi, alert && alertBg ? { backgroundColor: alertBg, borderColor: 'transparent' } : null]}>
      <View style={styles.kpiTop}>
        <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
        <IconSplat
          shape="b1"
          splatColor={iconSplatBg ?? SPLAT_NEUTRAL}
          spot={spot}
          icon={icon}
          iconColor={iconColor}
          size={38}
        />
      </View>
      <Text style={[styles.kpiValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {alert ? <View style={[styles.kpiGlow, { backgroundColor: valueColor ?? colors.warn }]} /> : null}
    </View>
  );
  return onPress ? (
    <AnimatedPressable scaleTo={0.98} onPress={onPress} accessibilityRole="button">{body}</AnimatedPressable>
  ) : body;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * A compact "Today" strip: on-time % and boarding % for today (from the trend
 * feed's latest day) plus the open-complaint count (tappable → Complaints). Rates
 * read '—' before any trips start, so it never shows a misleading 0%.
 */
function TodayStrip({
  loading, onTimeRate, boardingRate, openComplaints, complaintsLoading,
}: {
  loading: boolean;
  onTimeRate: number | null;
  boardingRate: number | null;
  openComplaints: number;
  complaintsLoading: boolean;
}) {
  return (
    <Card shadow="sm" radius={22} style={styles.todayCard}>
      <TodayStat
        icon="clock"
        iconColor={colors.ok}
        label="On-time today"
        value={loading ? '—' : onTimeRate == null ? '—' : pct(onTimeRate)}
      />
      <View style={styles.todayDivider} />
      <TodayStat
        icon="users"
        iconColor={colors.route}
        label="Boarding today"
        value={loading ? '—' : boardingRate == null ? '—' : pct(boardingRate)}
      />
      <View style={styles.todayDivider} />
      <AnimatedPressable
        scaleTo={0.97}
        onPress={() => router.push('/(app)/complaints' as never)}
        style={styles.todayStat}
        accessibilityRole="button"
      >
        <Icon name="chat" size={18} color={openComplaints > 0 ? colors.talk : colors.ink3} />
        <Text style={[styles.todayValue, openComplaints > 0 && { color: colors.talk }]}>
          {complaintsLoading ? '—' : openComplaints}
        </Text>
        <View style={styles.todayLabelRow}>
          <Text style={styles.todayLabel}>Open complaints</Text>
          <Icon name="chevron" size={12} color={colors.ink3} />
        </View>
      </AnimatedPressable>
    </Card>
  );
}

function TodayStat({ icon, iconColor, label, value }: { icon: IconName; iconColor: string; label: string; value: string | number }) {
  return (
    <View style={styles.todayStat}>
      <Icon name={icon} size={18} color={iconColor} />
      <Text style={styles.todayValue}>{value}</Text>
      <Text style={styles.todayLabel}>{label}</Text>
    </View>
  );
}

function PanelHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.panelHeader}>
      <Text style={styles.panelTitle}>{title}</Text>
      {count != null ? <View style={styles.panelCountPill}><Text style={styles.panelCount}>{count}</Text></View> : null}
    </View>
  );
}

function FleetPanel({ loading, fleet }: { loading: boolean; fleet: FleetEntry[] }) {
  return (
    <Card shadow="sm" radius={22} padding={0} style={styles.panel}>
      <View style={styles.panelPad}>
        <PanelHeader title="Live fleet" count={loading ? undefined : fleet.length} />
      </View>
      <Divider />
      {loading ? (
        <View style={styles.panelPad}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.rowSkeleton}>
              <Skeleton width={10} height={10} circle />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="50%" height={15} />
                <Skeleton width="30%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : fleet.length === 0 ? (
        <EmptyState
          icon={<IconSplat shape="b2" splatColor={colors.fleetBg} spot="bus" size={64} />}
          title="No active trips"
          description="Buses appear here once trips start for the day."
        />
      ) : (
        fleet.map((f, i) => {
          const b = statusBadge(f.status);
          return (
            <AnimatedPressable
              key={f.tripId}
              scaleTo={0.99}
              onPress={() => router.push(`/(app)/fleet/${f.tripId}` as never)}
            >
              <View style={[styles.fleetRow, i < fleet.length - 1 && styles.rowBorder]}>
                <StatusDot variant={ACTIVE.has(f.status) ? 'live' : f.status === 'SIGNAL_LOST' ? 'offline' : 'idle'} />
                <View style={styles.fleetInfo}>
                  <Text style={styles.fleetRoute} numberOfLines={1}>{f.routeName}</Text>
                  <Text style={styles.fleetMeta} numberOfLines={1}>
                    {(f.vehicleReg ?? 'Unassigned')}{f.direction ? ` · ${f.direction}` : ''}
                  </Text>
                </View>
                <Badge label={b.label} variant={b.variant} size="sm" />
              </View>
            </AnimatedPressable>
          );
        })
      )}
    </Card>
  );
}

function AttentionPanel({ loading, signalLost }: { loading: boolean; signalLost: FleetEntry[] }) {
  return (
    <Card shadow="sm" radius={22} padding={0} style={styles.panel}>
      <View style={styles.panelPad}>
        <PanelHeader title="Needs attention" count={loading ? undefined : signalLost.length} />
      </View>
      <Divider />
      {loading ? (
        <View style={styles.panelPad}>
          <Skeleton width="70%" height={15} />
          <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
        </View>
      ) : signalLost.length === 0 ? (
        <View style={styles.allClear}>
          <IconSplat shape="b1" splatColor={colors.okBg} icon="checkc" iconColor={colors.ok} size={52} />
          <Text style={styles.allClearText}>All buses reporting</Text>
        </View>
      ) : (
        signalLost.map((f, i) => (
          <View key={f.tripId} style={[styles.attnRow, i < signalLost.length - 1 && styles.rowBorder]}>
            <IconSplat shape="b2" splatColor={SPLAT_NEUTRAL} spot="signal" size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attnTitle}>{f.vehicleReg ?? 'Bus'} lost signal</Text>
              <Text style={styles.attnMeta}>{f.routeName}</Text>
            </View>
          </View>
        ))
      )}
      <Divider />
      <AnimatedPressable onPress={() => router.push('/(app)/fleet/exceptions' as never)} scaleTo={0.98}>
        <View style={styles.panelLink}>
          <Text style={styles.panelLinkText}>View all exceptions</Text>
          <Icon name="chevron" size={15} color={colors.trip} />
        </View>
      </AnimatedPressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },

  kpiRow: {},
  kpiRowDesktop: { flexDirection: 'row', gap: spacing[3] },
  kpiRowPhone: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  kpiCellDesktop: { flex: 1 },
  kpiCellPhone: { width: '48%' },

  kpi: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    minHeight: 104,
    overflow: 'hidden',
    shadowColor: '#16203B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
  kpiLabel: {
    flex: 1, fontFamily: fontFamilies.display, fontSize: 12.5, fontWeight: fontWeights.bold,
    color: colors.ink2, marginTop: 3,
  },
  kpiValue: {
    fontFamily: fontFamilies.displayHeavy, fontSize: 32, fontWeight: fontWeights.extrabold,
    color: colors.ink, letterSpacing: -0.5, marginTop: 6,
  },
  kpiGlow: { position: 'absolute', right: -18, bottom: -20, width: 64, height: 64, borderRadius: 32, opacity: 0.14 },

  todayCard: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: spacing[4] },
  todayStat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: spacing[1] },
  todayValue: { fontFamily: fontFamilies.displayHeavy, fontSize: 24, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.4 },
  todayLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  todayLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.ink2 },
  todayDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: spacing[1] },

  region: { gap: spacing[4] },
  regionDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { flex: 2 },
  sideCol: { flex: 1 },
  sideColPhone: {},

  panel: { overflow: 'hidden' },
  panelPad: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.md, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  panelCountPill: { backgroundColor: colors.hairline, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  panelCount: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink2 },

  rowSkeleton: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },

  fleetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  fleetInfo: { flex: 1 },
  fleetRoute: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  fleetMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 1 },

  allClear: { alignItems: 'center', paddingVertical: spacing[5], gap: spacing[2] },
  allClearText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, fontWeight: fontWeights.semibold },

  attnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  attnTitle: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.ink },
  attnMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, marginTop: 1 },

  panelLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  panelLinkText: { fontFamily: fontFamilies.display, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.trip },
});

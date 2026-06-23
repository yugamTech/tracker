import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, StatusDot, Skeleton, EmptyState, AnimatedPressable, Divider,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useFleet, useTodayTrips, useLifecycleAlarms } from '@yaanam/api-client';
import type { FleetEntry } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { StatCard } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const ACTIVE = new Set(['STARTED', 'IN_PROGRESS']);

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

  const list = fleet ?? [];
  const active = list.filter((f) => ACTIVE.has(f.status));
  const signalLost = list.filter((f) => f.status === 'SIGNAL_LOST');
  const tripList = trips ?? [];
  const completed = tripList.filter((t) => t.status === 'COMPLETED').length;
  // Started-not-completed alarms (PRD-02a): Stage-1 overdue (still live) + Stage-2
  // abandoned-pending-ack. Red when any need attention.
  const alarms = lifecycleAlarms ?? [];

  return (
    <AdminScreen
      title="Dashboard"
      subtitle="Today at a glance"
      subnav={<SubNav segments={SUBNAV.dashboard} value="overview" />}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* KPI row */}
        <View style={[styles.kpiRow, isDesktop ? styles.kpiRowDesktop : styles.kpiRowPhone]}>
          <Kpi desktop={isDesktop}>
            <StatCard label="Active Trips" value={fleetLoading ? '—' : active.length} icon="⬢" tone="primary" />
          </Kpi>
          <Kpi desktop={isDesktop}>
            <StatCard label="Signal Lost" value={fleetLoading ? '—' : signalLost.length} icon="📡" tone={signalLost.length ? 'error' : 'neutral'} />
          </Kpi>
          <Kpi desktop={isDesktop}>
            <StatCard label="Trips Today" value={tripsLoading ? '—' : tripList.length} icon="◆" tone="info" />
          </Kpi>
          <Kpi desktop={isDesktop}>
            <StatCard label="Completed" value={tripsLoading ? '—' : completed} icon="✓" tone="success" />
          </Kpi>
          <Kpi desktop={isDesktop}>
            <AnimatedPressable scaleTo={0.99} onPress={() => router.push('/(app)/trips/exceptions' as never)}>
              <StatCard
                label="Active & Overdue"
                value={alarmsLoading ? '—' : alarms.length}
                icon="⏱"
                tone={alarms.length ? 'error' : 'neutral'}
              />
            </AnimatedPressable>
          </Kpi>
        </View>

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

function Kpi({ desktop, children }: { desktop: boolean; children: React.ReactNode }) {
  return <View style={desktop ? styles.kpiCellDesktop : styles.kpiCellPhone}>{children}</View>;
}

function PanelHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.panelHeader}>
      <Text style={styles.panelTitle}>{title}</Text>
      {count != null ? <Text style={styles.panelCount}>{count}</Text> : null}
    </View>
  );
}

function FleetPanel({ loading, fleet }: { loading: boolean; fleet: FleetEntry[] }) {
  return (
    <Card shadow="sm" padding={0} style={styles.panel}>
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
          icon={<Text style={{ fontSize: 36 }}>🚍</Text>}
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
    <Card shadow="sm" padding={0} style={styles.panel}>
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
          <Text style={styles.allClearGlyph}>✓</Text>
          <Text style={styles.allClearText}>All buses reporting</Text>
        </View>
      ) : (
        signalLost.map((f, i) => (
          <View key={f.tripId} style={[styles.attnRow, i < signalLost.length - 1 && styles.rowBorder]}>
            <Text style={styles.attnGlyph}>📡</Text>
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
          <Text style={styles.panelLinkChevron}>›</Text>
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

  region: { gap: spacing[4] },
  regionDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { flex: 2 },
  sideCol: { flex: 1 },
  sideColPhone: {},

  panel: { overflow: 'hidden' },
  panelPad: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  panelCount: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textMuted },

  rowSkeleton: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },

  fleetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  fleetInfo: { flex: 1 },
  fleetRoute: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  fleetMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },

  allClear: { alignItems: 'center', paddingVertical: spacing[6], gap: spacing[2] },
  allClearGlyph: { fontSize: 28, color: colors.success, fontWeight: fontWeights.bold },
  allClearText: { fontSize: fontSizes.sm, color: colors.textSecondary },

  attnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  attnGlyph: { fontSize: 20 },
  attnTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  attnMeta: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 1 },

  panelLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  panelLinkText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  panelLinkChevron: { fontSize: 20, color: colors.primary, fontWeight: fontWeights.semibold },
});

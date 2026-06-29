import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Skeleton, EmptyState, IconSplat,
} from '@yaanam/ui';
import { useComplaintKpi } from '@yaanam/api-client';
import type { ComplaintKpi } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { StatCard } from '../../../components/widgets';
import { HBarList } from '../../../components/charts';
import type { HBarItem } from '../../../components/charts';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

/** 'IN_PROGRESS' → 'In progress', 'VEHICLE_CONDITION' → 'Vehicle condition'. */
function pretty(s: string): string {
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Mean resolution time in human terms: hours under 2 days, else days. */
function formatResolution(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function ComplaintKpiScreen() {
  const { isDesktop } = useResponsive();
  const { data: kpi, isLoading } = useComplaintKpi();

  return (
    <AdminScreen
      title="Complaints"
      subtitle="Service KPIs"
      subnav={<SubNav segments={SUBNAV.complaints} value="kpi" />}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading || !kpi ? (
          <LoadingState />
        ) : kpi.total === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<IconSplat shape="b3" splatColor={colors.talkBg} spot="chat" size={64} />}
              title="No complaints yet"
              description="Once parents raise complaints, service KPIs — resolution time, SLA health and driver/route breakdowns — appear here."
            />
          </View>
        ) : (
          <Content kpi={kpi} isDesktop={isDesktop} />
        )}
      </ScrollView>
    </AdminScreen>
  );
}

function Content({ kpi, isDesktop }: { kpi: ComplaintKpi; isDesktop: boolean }) {
  const tiles = [
    { label: 'Total', value: kpi.total, icon: '◈', tone: 'primary' as const },
    { label: 'Open', value: kpi.open, icon: '◷', tone: kpi.open ? ('warning' as const) : ('neutral' as const) },
    { label: 'Awaiting closure', value: kpi.awaitingClosure, icon: '⧖', tone: 'info' as const },
    { label: 'Closed', value: kpi.closed, icon: '✓', tone: 'success' as const },
  ];

  const statusItems: HBarItem[] = kpi.byStatus.map((s) => ({ key: s.status, label: pretty(s.status), value: s.count }));
  const categoryItems: HBarItem[] = kpi.byCategory.map((c) => ({ key: c.category, label: pretty(c.category), value: c.count }));
  // Drop the synthetic "unlinked"/"unassigned" buckets when they're the only thing, but keep them otherwise for honesty.
  const routeItems: HBarItem[] = kpi.byRoute.map((r) => ({ key: r.routeId ?? 'none', label: r.routeName, value: r.count }));
  const driverItems: HBarItem[] = kpi.byDriver.map((d) => ({ key: d.driverId ?? 'none', label: d.driverName, value: d.count }));

  const resolutionPct = kpi.resolutionRate == null ? '—' : `${Math.round(kpi.resolutionRate * 100)}%`;
  const satisfiedPct = kpi.rating.satisfiedRate == null ? '—' : `${Math.round(kpi.rating.satisfiedRate * 100)}%`;
  const avgStars = kpi.rating.avg == null ? '—' : kpi.rating.avg.toFixed(1);

  return (
    <View style={{ gap: spacing[4] }}>
      {/* Headline counts */}
      <View style={[styles.kpiRow, isDesktop ? styles.kpiRowDesktop : styles.kpiRowPhone]}>
        {tiles.map((t) => (
          <View key={t.label} style={isDesktop ? styles.kpiCellDesktop : styles.kpiCellPhone}>
            <StatCard label={t.label} value={t.value} icon={t.icon} tone={t.tone} />
          </View>
        ))}
      </View>

      {/* Health strip */}
      <Card shadow="sm" style={styles.healthCard}>
        <Health label="Resolution rate" value={resolutionPct} hint="closed of all" />
        <View style={styles.healthDivider} />
        <Health label="Avg resolution" value={formatResolution(kpi.avgResolutionHours)} hint="time to resolve" />
        <View style={styles.healthDivider} />
        <Health
          label="Satisfaction"
          value={avgStars === '—' ? '—' : `★ ${avgStars}`}
          hint={kpi.rating.count ? `${satisfiedPct} satisfied · ${kpi.rating.count}` : 'no ratings yet'}
        />
      </Card>

      <Breakdown title="By status" items={statusItems} color={colors.talk} />
      <Breakdown title="By category" items={categoryItems} color={colors.sun} />
      <Breakdown title="By route" items={routeItems} color={colors.route} emptyText="No route-linked complaints" />
      <Breakdown title="By driver" items={driverItems} color={colors.fleet} emptyText="No driver-linked complaints" />

      <Text style={styles.footnote}>
        Computed live from complaint records. Resolution rating reflects the parent
        satisfaction loop; metrics fill in as real data lands.
      </Text>
    </View>
  );
}

function Health({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.health}>
      <Text style={styles.healthValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={styles.healthHint} numberOfLines={1}>{hint}</Text>
    </View>
  );
}

function Breakdown({ title, items, color, emptyText }: { title: string; items: HBarItem[]; color: string; emptyText?: string }) {
  return (
    <Card shadow="sm" style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <HBarList items={items} color={color} emptyText={emptyText} />
    </Card>
  );
}

function LoadingState() {
  return (
    <View style={{ gap: spacing[4] }}>
      <View style={styles.kpiRowPhone}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.kpiCellPhone}>
            <Card shadow="sm"><Skeleton width="60%" height={24} /><Skeleton width="80%" height={12} style={{ marginTop: 10 }} /></Card>
          </View>
        ))}
      </View>
      {[0, 1].map((i) => (
        <Card key={i} shadow="sm" style={styles.section}>
          <Skeleton width="40%" height={15} />
          <Skeleton width="100%" height={12} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={12} style={{ marginTop: 8 }} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[4], paddingBottom: spacing[8] },
  emptyWrap: { flex: 1, minHeight: 360, justifyContent: 'center' },

  kpiRow: {},
  kpiRowDesktop: { flexDirection: 'row', gap: spacing[3] },
  kpiRowPhone: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  kpiCellDesktop: { flex: 1 },
  kpiCellPhone: { width: '48%' },

  healthCard: { flexDirection: 'row', alignItems: 'stretch' },
  health: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing[1] },
  healthValue: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.talk, letterSpacing: -0.3 },
  healthLabel: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink2 },
  healthHint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },
  healthDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: spacing[1] },

  section: { gap: spacing[3] },
  sectionTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.md, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  footnote: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, lineHeight: 16, marginTop: spacing[1] },
});

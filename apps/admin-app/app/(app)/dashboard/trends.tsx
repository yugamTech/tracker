import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Skeleton, EmptyState, IconSplat, Icon,
} from '@yaanam/ui';
import { useTripTrends } from '@yaanam/api-client';
import type { TripTrendDay } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { VBarChart } from '../../../components/charts';
import type { VBar } from '../../../components/charts';
import { SUBNAV } from '../../../lib/nav';

const WINDOW_DAYS = 7;

/** Short weekday for a `YYYY-MM-DD` key (parsed as a local calendar day). */
function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', { weekday: 'short' });
}

function mean(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function TrendsScreen() {
  const { data: trends, isLoading } = useTripTrends(WINDOW_DAYS);

  return (
    <AdminScreen
      title="Dashboard"
      subtitle="Trends & analytics"
      subnav={<SubNav segments={SUBNAV.dashboard} value="trends" />}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading || !trends ? (
          <LoadingState />
        ) : trends.every((d) => d.tripsTotal === 0) ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<IconSplat shape="b3" splatColor={colors.tripBg} spot="trip" size={64} />}
              title="No trips in the last 7 days"
              description="On-time rate, boarding rate and completed-trip trends appear here once trips run."
            />
          </View>
        ) : (
          <Content trends={trends} />
        )}
      </ScrollView>
    </AdminScreen>
  );
}

function Content({ trends }: { trends: TripTrendDay[] }) {
  const avgOnTime = mean(trends.map((d) => d.onTimeRate));
  const avgBoarding = mean(trends.map((d) => d.boardingRate));
  const totalCompleted = trends.reduce((a, d) => a + d.tripsCompleted, 0);
  const totalTrips = trends.reduce((a, d) => a + d.tripsTotal, 0);

  const onTimeBars: VBar[] = trends.map((d) => ({ key: d.date, label: dayLabel(d.date), value: d.onTimeRate }));
  const boardingBars: VBar[] = trends.map((d) => ({ key: d.date, label: dayLabel(d.date), value: d.boardingRate }));
  const completedBars: VBar[] = trends.map((d) => ({ key: d.date, label: dayLabel(d.date), value: d.tripsCompleted }));

  return (
    <View style={{ gap: spacing[4] }}>
      {/* 7-day summary */}
      <Card shadow="sm" radius={22} style={styles.summaryCard}>
        <Summary label="Avg on-time" value={avgOnTime == null ? '—' : pct(avgOnTime)} color={colors.ok} />
        <View style={styles.summaryDivider} />
        <Summary label="Avg boarding" value={avgBoarding == null ? '—' : pct(avgBoarding)} color={colors.route} />
        <View style={styles.summaryDivider} />
        <Summary label="Trips done" value={`${totalCompleted}/${totalTrips}`} color={colors.trip} />
      </Card>

      <ChartCard title="On-time rate" caption="Trips that started on protocol, per day." icon="clock" hue={colors.ok}>
        <VBarChart bars={onTimeBars} max={1} color={colors.ok} formatValue={pct} />
      </ChartCard>

      <ChartCard title="Boarding rate" caption="Riders boarded of those expected, per day." icon="users" hue={colors.route}>
        <VBarChart bars={boardingBars} max={1} color={colors.route} formatValue={pct} />
      </ChartCard>

      <ChartCard title="Trips completed" caption="Cleanly completed trips, per day." icon="checkc" hue={colors.trip}>
        <VBarChart bars={completedBars} color={colors.trip} />
      </ChartCard>

      <Text style={styles.footnote}>
        Last {WINDOW_DAYS} days, school-wide. On-time and boarding use the same
        definitions as driver history; empty days show a hollow bar.
      </Text>
    </View>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summary}>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ChartCard({
  title, caption, icon, hue, children,
}: {
  title: string;
  caption: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  hue: string;
  children: React.ReactNode;
}) {
  return (
    <Card shadow="sm" radius={22} style={styles.chartCard}>
      <View style={styles.chartHead}>
        <View style={[styles.chartIcon, { backgroundColor: `${hue}1A` }]}>
          <Icon name={icon} size={18} color={hue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.chartCaption}>{caption}</Text>
        </View>
      </View>
      <View style={styles.chartBody}>{children}</View>
    </Card>
  );
}

function LoadingState() {
  return (
    <View style={{ gap: spacing[4] }}>
      <Card shadow="sm"><Skeleton width="100%" height={48} /></Card>
      {[0, 1, 2].map((i) => (
        <Card key={i} shadow="sm" style={styles.chartCard}>
          <Skeleton width="40%" height={15} />
          <Skeleton width="100%" height={120} style={{ marginTop: 16 }} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing[4], paddingBottom: spacing[8] },
  emptyWrap: { flex: 1, minHeight: 360, justifyContent: 'center' },

  summaryCard: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: spacing[4] },
  summary: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontFamily: fontFamilies.displayHeavy, fontSize: 24, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.4 },
  summaryLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.ink2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: spacing[1] },

  chartCard: { gap: spacing[1] },
  chartHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  chartIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chartTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.md, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  chartCaption: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, marginTop: 1 },
  chartBody: { marginTop: spacing[3] },

  footnote: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3, lineHeight: 16, marginTop: spacing[1] },
});

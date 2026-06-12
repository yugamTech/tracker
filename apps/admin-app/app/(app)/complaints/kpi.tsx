import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Card } from '@saarthi/ui';

const MOCK_SLA = [
  { label: 'Open', value: 4, color: '#EF4444', bg: '#FEE2E2' },
  { label: 'In Progress', value: 6, color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Resolved', value: 38, color: '#10B981', bg: '#D1FAE5' },
  { label: 'SLA Breached', value: 2, color: '#7C3AED', bg: '#EDE9FE' },
];

const MOCK_BY_CATEGORY = [
  { category: 'Late Arrival', count: 18, resolved: 16, avgDays: 1.2 },
  { category: 'Driver Behaviour', count: 11, resolved: 9, avgDays: 2.1 },
  { category: 'GPS Issue', count: 8, resolved: 8, avgDays: 0.8 },
  { category: 'Attendance Error', count: 6, resolved: 5, avgDays: 1.5 },
  { category: 'Payment', count: 5, resolved: 4, avgDays: 3.0 },
];

const MOCK_RATING = {
  avg: 3.8,
  total: 32,
  breakdown: [
    { stars: 5, count: 12 },
    { stars: 4, count: 8 },
    { stars: 3, count: 6 },
    { stars: 2, count: 4 },
    { stars: 1, count: 2 },
  ],
};

export default function ComplaintKpiScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Status grid */}
      <View style={styles.grid}>
        {MOCK_SLA.map((s) => (
          <View key={s.label} style={[styles.kpiCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.kpiVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.kpiLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* SLA health bar */}
      <Card style={styles.slaCard}>
        <Text style={styles.sectionTitle}>SLA Health (7-day)</Text>
        <View style={styles.slaBar}>
          <View style={[styles.slaFill, { flex: 38, backgroundColor: '#10B981' }]} />
          <View style={[styles.slaFill, { flex: 6, backgroundColor: '#F59E0B' }]} />
          <View style={[styles.slaFill, { flex: 4, backgroundColor: '#EF4444' }]} />
          <View style={[styles.slaFill, { flex: 2, backgroundColor: '#7C3AED' }]} />
        </View>
        <View style={styles.slaLegend}>
          {[{ label: 'Resolved 79%', color: '#10B981' }, { label: 'In Progress 12%', color: '#F59E0B' }, { label: 'Open 8%', color: '#EF4444' }, { label: 'Breached 4%', color: '#7C3AED' }].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* By category */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>By Category</Text>
        {MOCK_BY_CATEGORY.map((c) => (
          <View key={c.category} style={styles.catRow}>
            <View style={styles.catLeft}>
              <Text style={styles.catName}>{c.category}</Text>
              <Text style={styles.catSub}>{c.resolved}/{c.count} resolved · avg {c.avgDays}d</Text>
            </View>
            <View style={styles.catBar}>
              <View style={[styles.catFill, { width: `${(c.resolved / c.count) * 100}%` as any }]} />
            </View>
          </View>
        ))}
      </Card>

      {/* Resolution ratings */}
      <Card style={[styles.sectionCard, { marginBottom: spacing[8] }]}>
        <Text style={styles.sectionTitle}>Resolution Ratings</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingAvg}>{MOCK_RATING.avg.toFixed(1)}</Text>
          <View>
            <Text style={styles.stars}>{'★'.repeat(Math.round(MOCK_RATING.avg))}{'☆'.repeat(5 - Math.round(MOCK_RATING.avg))}</Text>
            <Text style={styles.ratingCount}>{MOCK_RATING.total} ratings</Text>
          </View>
        </View>
        {MOCK_RATING.breakdown.map((b) => (
          <View key={b.stars} style={styles.breakRow}>
            <Text style={styles.breakLabel}>{b.stars}★</Text>
            <View style={styles.breakTrack}>
              <View style={[styles.breakFill, { width: `${(b.count / MOCK_RATING.total) * 100}%` as any }]} />
            </View>
            <Text style={styles.breakCount}>{b.count}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing[4], gap: spacing[3] },
  kpiCard: { flex: 1, minWidth: '44%', padding: spacing[4], borderRadius: radius.xl, alignItems: 'center', gap: spacing[1] },
  kpiVal: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold },
  kpiLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },
  slaCard: { marginHorizontal: spacing[4], marginBottom: spacing[3] },
  sectionCard: { marginHorizontal: spacing[4], marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: spacing[3] },
  slaBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', gap: 2 },
  slaFill: { height: '100%' },
  slaLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSizes.xs, color: colors.textSecondary },
  catRow: { marginBottom: spacing[3], gap: spacing[2] },
  catLeft: {},
  catName: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  catSub: { fontSize: fontSizes.xs, color: colors.textMuted },
  catBar: { height: 8, backgroundColor: colors.gray100, borderRadius: 4 },
  catFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginBottom: spacing[4] },
  ratingAvg: { fontSize: fontSizes['4xl'], fontWeight: fontWeights.extrabold, color: '#F59E0B' },
  stars: { fontSize: fontSizes.xl, color: '#F59E0B' },
  ratingCount: { fontSize: fontSizes.xs, color: colors.textMuted },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2] },
  breakLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, width: 24 },
  breakTrack: { flex: 1, height: 8, backgroundColor: colors.gray100, borderRadius: 4 },
  breakFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  breakCount: { fontSize: fontSizes.xs, color: colors.textMuted, width: 20, textAlign: 'right' },
});

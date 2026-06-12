import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Card } from '@saarthi/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MOCK_METRICS = [
  {
    key: 'boarding_rate',
    label: 'Boarding Rate',
    unit: '%',
    color: '#10B981',
    bg: '#D1FAE5',
    data: [91, 88, 93, 87, 95, 0, 0],
    target: 90,
  },
  {
    key: 'on_time',
    label: 'On-Time Trips',
    unit: '%',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    data: [83, 78, 85, 80, 88, 0, 0],
    target: 85,
  },
  {
    key: 'complaints',
    label: 'Open Complaints',
    unit: '',
    color: '#F59E0B',
    bg: '#FEF3C7',
    data: [4, 5, 3, 6, 2, 0, 0],
    target: 3,
  },
  {
    key: 'collection',
    label: 'Fee Collection',
    unit: '%',
    color: '#7C3AED',
    bg: '#EDE9FE',
    data: [82, 82, 85, 85, 87, 87, 87],
    target: 90,
  },
];

const BAR_MAX_HEIGHT = 80;

function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const height = max > 0 ? (value / max) * BAR_MAX_HEIGHT : 0;
  return (
    <View style={bar.col}>
      <Text style={bar.val}>{value > 0 ? value : '–'}</Text>
      <View style={[bar.track, { height: BAR_MAX_HEIGHT }]}>
        {value > 0 && <View style={[bar.fill, { height, backgroundColor: color }]} />}
      </View>
      <Text style={bar.day}>{label}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  col: { alignItems: 'center', gap: 2 },
  val: { fontSize: 9, color: colors.textMuted },
  track: { width: 22, backgroundColor: colors.gray100, borderRadius: 4, justifyContent: 'flex-end' },
  fill: { width: '100%', borderRadius: 4 },
  day: { fontSize: 9, color: colors.textMuted },
});

export default function TrendsScreen() {
  const [activeMetric, setActiveMetric] = useState('boarding_rate');
  const metric = MOCK_METRICS.find((m) => m.key === activeMetric)!;
  const maxVal = Math.max(...metric.data, metric.target);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Metric selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {MOCK_METRICS.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setActiveMetric(m.key)}
            style={[styles.pill, activeMetric === m.key && { backgroundColor: m.color }]}
          >
            <Text style={[styles.pillText, activeMetric === m.key && { color: colors.white }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart card */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{metric.label} — Last 7 days</Text>
          <Text style={styles.target}>Target: {metric.target}{metric.unit}</Text>
        </View>
        <View style={styles.bars}>
          {DAYS.map((day, i) => (
            <MiniBar key={day} value={metric.data[i]} max={maxVal} color={metric.color} label={day} />
          ))}
        </View>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: metric.color }]} />
          <Text style={styles.legendText}>{metric.label}</Text>
          <View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} />
          <Text style={styles.legendText}>Weekend / no trips</Text>
        </View>
      </Card>

      {/* Summary cards */}
      <Text style={styles.sectionTitle}>Weekly Summary</Text>
      <View style={styles.summaryGrid}>
        {MOCK_METRICS.map((m) => {
          const weekData = m.data.filter((v) => v > 0);
          const avg = Math.round(weekData.reduce((a, b) => a + b, 0) / weekData.length);
          const vs = avg - m.target;
          return (
            <View key={m.key} style={[styles.summaryCard, { backgroundColor: m.bg }]}>
              <Text style={styles.summaryLabel}>{m.label}</Text>
              <Text style={[styles.summaryVal, { color: m.color }]}>{avg}{m.unit}</Text>
              <Text style={[styles.summaryDelta, { color: vs >= 0 ? colors.success : colors.error }]}>
                {vs >= 0 ? '▲' : '▼'} {Math.abs(vs)}{m.unit} vs target
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  pills: { padding: spacing[4], gap: spacing[2] },
  pill: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chartCard: { margin: spacing[4] },
  chartHeader: { marginBottom: spacing[4] },
  chartTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  target: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4] },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSizes.xs, color: colors.textSecondary, marginRight: spacing[2] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, marginHorizontal: spacing[4], marginBottom: spacing[3] },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  summaryCard: {
    flex: 1, minWidth: '44%', padding: spacing[4], borderRadius: radius.xl, gap: spacing[1],
  },
  summaryLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  summaryVal: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold },
  summaryDelta: { fontSize: fontSizes.xs, fontWeight: fontWeights.medium },
});

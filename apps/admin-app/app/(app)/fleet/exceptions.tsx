import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Badge } from '@saarthi/ui';

type Severity = 'high' | 'medium' | 'low';

const MOCK_EXCEPTIONS = [
  { id: 'e1', type: 'SIGNAL_LOST', icon: '📡', title: 'Signal lost — Bus HR26-DL-9900', detail: 'No GPS ping for 4 minutes', route: 'Route A', time: '07:32 AM', severity: 'high' as Severity, resolved: false },
  { id: 'e2', type: 'NOT_BOARDED', icon: '🧒', title: 'Student not boarded', detail: 'Arjun Sharma absent at Sector 18 Stop', route: 'Route A', time: '07:18 AM', severity: 'medium' as Severity, resolved: false },
  { id: 'e3', type: 'OVERSPEED', icon: '🚨', title: 'Over-speed event', detail: 'Bus HR26-DL-9901 hit 65 km/h on NH-48', route: 'Route B', time: '07:04 AM', severity: 'high' as Severity, resolved: false },
  { id: 'e4', type: 'NOT_BOARDED', icon: '🧒', title: 'Student not boarded', detail: 'Riya Gupta absent at Sector 22 Stop', route: 'Route B', time: '06:58 AM', severity: 'medium' as Severity, resolved: true },
  { id: 'e5', type: 'SIGNAL_LOST', icon: '📡', title: 'Signal lost — Bus HR26-DL-9902', detail: 'Recovered after 2 min (underpass)', route: 'Route C', time: '06:45 AM', severity: 'low' as Severity, resolved: true },
];

const SEVERITY_COLORS: Record<Severity, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#6B7280',
};

const FILTERS = ['All', 'Unresolved', 'High', 'Signal', 'Absent', 'Speed'];

export default function ExceptionsFeedScreen() {
  const [filter, setFilter] = useState('All');

  const filtered = MOCK_EXCEPTIONS.filter((e) => {
    if (filter === 'Unresolved') return !e.resolved;
    if (filter === 'High') return e.severity === 'high';
    if (filter === 'Signal') return e.type === 'SIGNAL_LOST';
    if (filter === 'Absent') return e.type === 'NOT_BOARDED';
    if (filter === 'Speed') return e.type === 'OVERSPEED';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: SEVERITY_COLORS[item.severity] }, item.resolved && styles.resolved]}>
            <View style={styles.cardRow}>
              <Text style={styles.icon}>{item.icon}</Text>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                <Text style={styles.detail}>{item.detail}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.route}>{item.route}</Text>
                  {item.resolved
                    ? <Text style={styles.resolvedTag}>✓ Resolved</Text>
                    : <Text style={[styles.severityTag, { color: SEVERITY_COLORS[item.severity] }]}>
                        {item.severity.toUpperCase()}
                      </Text>
                  }
                </View>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={styles.emptyText}>No exceptions for this filter</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  filterRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[2], flexWrap: 'wrap' },
  filterPill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterPillActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  filterTextActive: { color: colors.white, fontWeight: fontWeights.semibold },
  list: { paddingHorizontal: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing[4], borderLeftWidth: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  resolved: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', gap: spacing[3] },
  icon: { fontSize: 28 },
  cardBody: { flex: 1, gap: spacing[1] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  time: { fontSize: fontSizes.xs, color: colors.textMuted },
  detail: { fontSize: fontSizes.sm, color: colors.textSecondary },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1] },
  route: { fontSize: fontSizes.xs, color: colors.textMuted },
  severityTag: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  resolvedTag: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.semibold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
});

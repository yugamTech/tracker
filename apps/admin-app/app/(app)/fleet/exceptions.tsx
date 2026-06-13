import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useFleet } from '@saarthi/api-client';
import type { FleetEntry } from '@saarthi/api-client';

type FilterKey = 'All' | 'Signal';
const FILTERS: FilterKey[] = ['All', 'Signal'];

type Severity = 'high' | 'medium';

interface ExceptionItem {
  key: string;
  icon: string;
  title: string;
  detail: string;
  route: string;
  severity: Severity;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
};

function fleetToExceptions(fleet: FleetEntry[]): ExceptionItem[] {
  const items: ExceptionItem[] = [];

  for (const f of fleet) {
    if (f.status === 'SIGNAL_LOST') {
      items.push({
        key: `signal-${f.tripId}`,
        icon: '📡',
        title: `Signal lost — ${f.vehicleReg ?? 'Bus'}`,
        detail: 'No GPS ping received recently',
        route: f.routeName,
        severity: 'high',
      });
    }

    const riders: any[] = (f as any)?.riders ?? [];
    for (const r of riders) {
      if (r.boardStatus === 'NOT_BOARDED') {
        items.push({
          key: `absent-${f.tripId}-${r.studentId}`,
          icon: '🧒',
          title: 'Student not boarded',
          detail: `${r.studentName} absent`,
          route: f.routeName,
          severity: 'medium',
        });
      }
    }
  }

  return items;
}

export default function ExceptionsFeedScreen() {
  const [filter, setFilter] = useState<FilterKey>('All');
  const { data: fleet, isLoading, isError } = useFleet();

  const allExceptions = fleetToExceptions(fleet ?? []);
  const filtered = allExceptions.filter((e) => {
    if (filter === 'Signal') return e.icon === '📡';
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

      {isLoading && <LoadingSpinner fullScreen />}

      {isError && (
        <EmptyState title="Could not load exceptions" description="Check your connection and try again" />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderLeftColor: SEVERITY_COLORS[item.severity] }]}>
              <View style={styles.cardRow}>
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.detail}>{item.detail}</Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.route}>{item.route}</Text>
                    <Text style={[styles.severityTag, { color: SEVERITY_COLORS[item.severity] }]}>
                      {item.severity.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={styles.emptyText}>
                {fleet && fleet.length > 0 ? 'No exceptions right now' : 'No active trips'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  filterRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[2] },
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
  cardRow: { flexDirection: 'row', gap: spacing[3] },
  icon: { fontSize: 28 },
  cardBody: { flex: 1, gap: spacing[1] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  detail: { fontSize: fontSizes.sm, color: colors.textSecondary },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1] },
  route: { fontSize: fontSizes.xs, color: colors.textMuted },
  severityTag: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights,
  Card, Chip, Skeleton, EmptyState,
} from '@saarthi/ui';
import { useFleet } from '@saarthi/api-client';
import type { FleetEntry } from '@saarthi/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';

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

const SEVERITY: Record<Severity, { color: string; bg: string }> = {
  high: { color: colors.error, bg: colors.errorBg },
  medium: { color: colors.warning, bg: colors.warningBg },
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
  const { gridColumns } = useResponsive();

  const all = fleetToExceptions(fleet ?? []);
  const filtered = all.filter((e) => (filter === 'Signal' ? e.icon === '📡' : true));

  return (
    <AdminScreen
      title="Fleet Exceptions"
      subtitle={isLoading || isError ? undefined : `${all.length} active`}
      onBack={() => (router.canGoBack() ? router.back() : router.navigate('/(app)/fleet' as never))}
    >
      <View style={styles.root}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>

        {isError ? (
          <EmptyState title="Could not load exceptions" description="Check your connection and try again." />
        ) : isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="60%" height={15} />
                <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={filtered}
            columns={gridColumns}
            keyExtractor={(e) => e.key}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 44 }}>✅</Text>}
                  title={fleet && fleet.length > 0 ? 'No exceptions right now' : 'No active trips'}
                  description="Signal loss and missed boardings will surface here in real time."
                />
              </View>
            }
            renderItem={(item) => {
              const sev = SEVERITY[item.severity];
              return (
                <Card shadow="sm" style={[styles.card, { borderLeftColor: sev.color }]}>
                  <View style={styles.cardRow}>
                    <View style={[styles.iconChip, { backgroundColor: sev.bg }]}>
                      <Text style={styles.iconGlyph}>{item.icon}</Text>
                    </View>
                    <View style={styles.body}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.detail} numberOfLines={1}>{item.detail}</Text>
                      <View style={styles.cardBottom}>
                        <Text style={styles.route} numberOfLines={1}>{item.route}</Text>
                        <Text style={[styles.severityTag, { color: sev.color }]}>{item.severity.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { borderLeftWidth: 4 },
  cardRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  iconChip: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 20 },
  body: { flex: 1, gap: 2 },
  cardTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  detail: { fontSize: fontSizes.sm, color: colors.textSecondary },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[1] },
  route: { flex: 1, fontSize: fontSizes.xs, color: colors.textMuted },
  severityTag: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
});

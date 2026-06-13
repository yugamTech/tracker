import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useTodayTrips } from '@saarthi/api-client';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: colors.success,
  ABORTED: colors.error,
  IN_PROGRESS: '#0EA5E9',
  STARTED: '#0EA5E9',
  SCHEDULED: colors.gray400,
  CANCELLED: colors.gray400,
};

export default function TripHistoryScreen() {
  const [search, setSearch] = useState('');
  const { data: trips, isLoading, isError } = useTodayTrips();

  const filtered = (trips ?? []).filter((t) => {
    if (!search) return true;
    const routeName: string = (t as any)?.route?.name ?? t.routeId;
    const vehicleReg: string = (t as any)?.vehicle?.regNumber ?? t.vehicleId ?? '';
    const driverName: string = (t as any)?.driver?.name ?? '';
    return (
      routeName.toLowerCase().includes(search.toLowerCase()) ||
      vehicleReg.toLowerCase().includes(search.toLowerCase()) ||
      driverName.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search route, driver, bus…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/trips/new' as never)}
        >
          <Text style={styles.addBtnText}>+ Schedule</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <LoadingSpinner fullScreen />}

      {isError && (
        <EmptyState title="Could not load trips" description="Check your connection and try again" />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.header}>Today — {filtered.length} trip{filtered.length !== 1 ? 's' : ''}</Text>
          }
          ListEmptyComponent={
            <EmptyState
              title={search ? 'No trips match' : 'No trips today'}
              description={search ? 'Try a different search' : 'No trips are scheduled for today'}
            />
          }
          renderItem={({ item }) => {
            const t = item as any;
            const routeName: string = t?.route?.name ?? item.routeId;
            const vehicleReg: string = t?.vehicle?.regNumber ?? item.vehicleId ?? '—';
            const driverName: string = t?.driver?.name ?? '—';
            const boarded: number = t?.boardedCount ?? 0;
            const total: number = t?.riderCount ?? 0;

            return (
              <TouchableOpacity
                onPress={() => router.push(`/(app)/fleet/${item.id}` as never)}
                activeOpacity={0.85}
              >
                <Card style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.leftCol}>
                      <Text style={styles.route}>{routeName} · {item.direction}</Text>
                      <Text style={styles.driver}>{driverName}</Text>
                      <Text style={styles.bus}>{vehicleReg}</Text>
                    </View>
                    <View style={styles.rightCol}>
                      <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? colors.gray400 }]}>
                        {item.status}
                      </Text>
                      {total > 0 && (
                        <>
                          <Text style={styles.boarding}>{boarded}/{total}</Text>
                          <Text style={styles.boardingLabel}>boarded</Text>
                        </>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[4], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  search: {
    flex: 1,
    backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing[3], fontSize: fontSizes.base, color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: '#7C3AED', borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  addBtnText: { color: colors.white, fontWeight: fontWeights.semibold, fontSize: fontSizes.sm },
  header: {
    fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
    color: colors.textSecondary, marginBottom: spacing[2],
  },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  leftCol: { flex: 1, gap: spacing[1] },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  driver: { fontSize: fontSizes.sm, color: colors.textSecondary },
  bus: { fontSize: fontSizes.xs, color: colors.textMuted },
  rightCol: { alignItems: 'flex-end', gap: spacing[1] },
  status: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold },
  boarding: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  boardingLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
});

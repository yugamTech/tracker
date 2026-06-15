import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useAuthStore } from '../../store/auth.store';
import { useTodayTrips } from '@saarthi/api-client';
import type { BadgeVariant } from '@saarthi/ui';

function tripStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'IN_PROGRESS': case 'STARTED': return 'info';
    case 'SCHEDULED': return 'warning';
    case 'CANCELLED': return 'cancelled';
    case 'ABORTED': return 'error';
    default: return 'default';
  }
}

export default function DriverHomeScreen() {
  const person = useAuthStore((s) => s.person);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  const { data: trips, isLoading, isError } = useTodayTrips();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {person?.name?.split(' ')[0] ?? 'Driver'} 👋</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/(app)/profile' as never)}>
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkBtn} onPress={() => router.push('/(app)/vehicle-check' as never)}>
            <Text style={{ fontSize: 20 }}>🔧</Text>
            <Text style={styles.checkLabel}>Check</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && <LoadingSpinner fullScreen />}

      {isError && (
        <EmptyState title="Could not load trips" description="Check your connection and try again" />
      )}

      {!isLoading && !isError && (
        <>
          <Text style={styles.sectionTitle}>Today's Trips ({trips?.length ?? 0})</Text>
          <FlatList
            data={trips ?? []}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState title="No trips today" description="You have no assigned trips for today" />
            }
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.route}>{(item as any)?.route?.name ?? item.routeId}</Text>
                    <Text style={styles.direction}>{item.direction === 'PICKUP' ? '⬆️ Pickup' : '⬇️ Drop'}</Text>
                    {(item as any)?.scheduledTime && (
                      <Text style={styles.time}>{(item as any).scheduledTime}</Text>
                    )}
                  </View>
                  <Badge label={item.status} variant={tripStatusVariant(item.status)} size="sm" />
                </View>
                {(item as any)?.riderCount != null && (
                  <View style={styles.riderRow}>
                    <Text style={styles.riderCount}>👥 {(item as any).riderCount} Riders</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.startBtn}
                  onPress={() => router.push(`/(app)/trip/${item.id}`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.startBtnText}>View Trip →</Text>
                </TouchableOpacity>
              </Card>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greeting: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  date: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  profileBtn: { padding: spacing[1] },
  checkBtn: { alignItems: 'center', gap: 4 },
  checkLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, margin: spacing[4] },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginTop: spacing[1] },
  riderRow: { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border },
  riderCount: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  startBtn: {
    marginTop: spacing[3], backgroundColor: '#0EA5E9', borderRadius: radius.lg,
    padding: spacing[3], alignItems: 'center',
  },
  startBtnText: { color: colors.white, fontWeight: fontWeights.semibold, fontSize: fontSizes.base },
});

import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, LoadingSpinner, EmptyState } from '@saarthi/ui';
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

export default function TripsScreen() {
  const { data: trips, isLoading, isError } = useTodayTrips();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Trips</Text>
        {!isLoading && !isError && (
          <Text style={styles.subtitle}>{trips?.length ?? 0} trips today</Text>
        )}
      </View>

      {isLoading && <LoadingSpinner fullScreen />}

      {isError && (
        <EmptyState title="Could not load trips" description="Check your connection and try again" />
      )}

      {!isLoading && !isError && (
        <FlatList
          data={trips ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState title="No trips today" description="No trips are scheduled for today" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/trips/${item.id}` as never)} activeOpacity={0.85}>
              <Card style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.route}>{(item as any)?.route?.name ?? item.routeId}</Text>
                    <Text style={styles.direction}>{item.direction}</Text>
                  </View>
                  <Badge
                    label={item.status}
                    variant={tripStatusVariant(item.status)}
                    size="sm"
                  />
                  {item.status === 'COMPLETED' && (
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/(app)/ratings/ride?tripId=${item.id}` as never);
                      }}
                    >
                      <Text style={styles.rateBtnText}>★ Rate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing[1] },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  route: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  direction: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  rateBtn: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.md, backgroundColor: '#FEF3C7' },
  rateBtnText: { fontSize: fontSizes.xs, color: '#B45309', fontWeight: fontWeights.semibold },
});

import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button } from '@saarthi/ui';
import { useRoutes } from '@saarthi/api-client';
import { router } from 'expo-router';

export default function RoutesScreen() {
  const { data: routes, isLoading } = useRoutes();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Button title="+ Add Route" size="sm" variant="outline" onPress={() => router.push('/(app)/routes/new' as never)} />
      </View>
      <FlatList
        data={routes ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No routes configured</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(app)/routes/${item.id}` as never)} activeOpacity={0.85}>
          <Card style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.routeName}>{item.name}</Text>
              <Badge label={item.status} variant="active" size="sm" />
            </View>
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{item.stops?.length ?? 0}</Text>
                <Text style={styles.metaLabel}>Stops</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{item._count?.students ?? 0}</Text>
                <Text style={styles.metaLabel}>Students</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{item.direction}</Text>
                <Text style={styles.metaLabel}>Direction</Text>
              </View>
            </View>
            {item.stops?.length > 0 && (
              <Text style={styles.stops}>
                📍 {item.stops.map((rs: any) => rs.stop.name).join(' → ')}
              </Text>
            )}
          </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing[4], paddingBottom: 0 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  routeName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  meta: { flexDirection: 'row', gap: spacing[4], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { alignItems: 'center' },
  metaValue: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: '#7C3AED' },
  metaLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  stops: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing[3] },
  empty: { alignItems: 'center', padding: spacing[8] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
});

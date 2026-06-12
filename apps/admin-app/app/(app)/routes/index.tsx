import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';

const MOCK_ROUTES = [
  { id: 'r1', name: 'Route A', direction: 'PICKUP', stops: 4, students: 22, vehicle: 'HR26-DL-9900', status: 'ACTIVE' },
  { id: 'r2', name: 'Route B', direction: 'PICKUP', stops: 5, students: 20, vehicle: 'HR26-DL-9901', status: 'ACTIVE' },
  { id: 'r3', name: 'Route C', direction: 'DROP', stops: 3, students: 25, vehicle: 'HR26-DL-9902', status: 'ACTIVE' },
];

export default function RoutesScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_ROUTES}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.routeName}>{item.name}</Text>
              <Badge label={item.status} variant="active" size="sm" />
            </View>
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{item.stops}</Text>
                <Text style={styles.metaLabel}>Stops</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{item.students}</Text>
                <Text style={styles.metaLabel}>Students</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{item.direction}</Text>
                <Text style={styles.metaLabel}>Direction</Text>
              </View>
            </View>
            <Text style={styles.vehicle}>🚌 {item.vehicle}</Text>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  routeName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  meta: { flexDirection: 'row', gap: spacing[4], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { alignItems: 'center' },
  metaValue: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: '#7C3AED' },
  metaLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  vehicle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing[3] },
});

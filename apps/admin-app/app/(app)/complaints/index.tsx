import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, Card, Badge } from '@saarthi/ui';

const MOCK_COMPLAINTS = [
  { id: 'c1', category: 'TIMING', description: 'Bus arrived 20 mins late', status: 'RECEIVED', date: 'Jun 8', severity: 'MEDIUM', student: 'Arjun Sharma' },
  { id: 'c2', category: 'BEHAVIOUR', description: 'Driver was rude to children', status: 'IN_PROGRESS', date: 'Jun 5', severity: 'HIGH', student: 'Priya Gupta' },
  { id: 'c3', category: 'SAFETY', description: 'Bus was over-speeding near school gate', status: 'CLOSED', date: 'Jun 2', severity: 'HIGH', student: 'Rohan Verma' },
];

const STATUS_V: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'default',
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: colors.error, MEDIUM: colors.warning, LOW: colors.info,
};

export default function AdminComplaintsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_COMPLAINTS}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85}>
            <Card style={[styles.card, { borderLeftColor: SEVERITY_COLORS[item.severity], borderLeftWidth: 4 }]}>
              <View style={styles.cardTop}>
                <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
                <Badge label={item.status.replace('_', ' ')} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
              </View>
              <Text style={styles.desc}>{item.description}</Text>
              <View style={styles.footer}>
                <Text style={styles.student}>👤 {item.student}</Text>
                <Text style={styles.date}>{item.date}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  category: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[3] },
  student: { fontSize: fontSizes.xs, color: colors.textMuted },
  date: { fontSize: fontSizes.xs, color: colors.textMuted },
});

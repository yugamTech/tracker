import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, Card, Badge } from '@saarthi/ui';

const MOCK_INVOICES = [
  { id: 'i1', student: 'Arjun Sharma', month: 'June 2024', amount: 3500, status: 'DUE' },
  { id: 'i2', student: 'Priya Gupta', month: 'June 2024', amount: 3500, status: 'PAID' },
  { id: 'i3', student: 'Rohan Verma', month: 'June 2024', amount: 3500, status: 'OVERDUE' },
  { id: 'i4', student: 'Ananya Singh', month: 'June 2024', amount: 3500, status: 'PAID' },
];

const TOTAL = MOCK_INVOICES.reduce((s, i) => s + i.amount, 0);
const COLLECTED = MOCK_INVOICES.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);

const STATUS_V: Record<string, 'success' | 'warning' | 'error'> = {
  PAID: 'success', DUE: 'warning', OVERDUE: 'error',
};

export default function AdminPaymentsScreen() {
  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>₹{TOTAL.toLocaleString('en-IN')}</Text>
          <Text style={styles.summaryLabel}>Total Billed</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>₹{COLLECTED.toLocaleString('en-IN')}</Text>
          <Text style={styles.summaryLabel}>Collected</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.error }]}>₹{(TOTAL - COLLECTED).toLocaleString('en-IN')}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      <FlatList
        data={MOCK_INVOICES}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.student}>{item.student}</Text>
                <Text style={styles.month}>{item.month}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
                <Badge label={item.status} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  summary: {
    flexDirection: 'row', backgroundColor: colors.white,
    padding: spacing[5], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: spacing[1] },
  summaryValue: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  summaryLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  divider: { width: 1, backgroundColor: colors.border, marginVertical: spacing[2] },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  student: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  month: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: spacing[2] },
  amount: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
});

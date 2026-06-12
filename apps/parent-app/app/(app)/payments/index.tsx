import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button } from '@saarthi/ui';

const MOCK_INVOICES = [
  { id: 'inv1', invoiceNo: 'INV-2024-001', month: 'June 2024', amount: 3500, status: 'DUE', dueDate: 'Jun 15' },
  { id: 'inv2', invoiceNo: 'INV-2024-002', month: 'May 2024', amount: 3500, status: 'PAID', dueDate: 'May 15' },
  { id: 'inv3', invoiceNo: 'INV-2024-003', month: 'Apr 2024', amount: 3500, status: 'PAID', dueDate: 'Apr 15' },
];

const STATUS_V: Record<string, 'warning' | 'success' | 'error'> = {
  DUE: 'warning', PAID: 'success', OVERDUE: 'error',
};

export default function PaymentsScreen() {
  const due = MOCK_INVOICES.filter((i) => i.status === 'DUE');
  const totalDue = due.reduce((s, i) => s + i.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Transport fee management</Text>
      </View>

      {totalDue > 0 && (
        <View style={styles.dueBanner}>
          <View>
            <Text style={styles.dueLabel}>Amount Due</Text>
            <Text style={styles.dueAmount}>₹{totalDue.toLocaleString('en-IN')}</Text>
          </View>
          <Button title="Pay Now" size="sm" onPress={() => {}} />
        </View>
      )}

      <FlatList
        data={MOCK_INVOICES}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.month}>{item.month}</Text>
                <Text style={styles.invoiceNo}>{item.invoiceNo}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: spacing[2] }}>
                <Text style={styles.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
                <Badge label={item.status} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
              </View>
            </View>
            {item.status !== 'PAID' && (
              <Button title="Pay ₹3,500" variant="outline" size="sm" onPress={() => {}} style={{ marginTop: spacing[3] }} />
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  dueBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    margin: spacing[4], padding: spacing[4], borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  dueLabel: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.7)' },
  dueAmount: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.white },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  month: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  invoiceNo: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
});

import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSizes, fontWeights, Card, Badge } from '@saarthi/ui';
import { useMyInvoices } from '@saarthi/api-client';

const STATUS_V: Record<string, 'success' | 'warning' | 'error'> = {
  PAID: 'success', DUE: 'warning', OVERDUE: 'error',
};

export default function AdminPaymentsScreen() {
  const { data: invoices = [], isLoading } = useMyInvoices();

  const totalPaise = invoices.reduce((s, i) => s + (i.amountPaise ?? 0), 0);
  const collectedPaise = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + (i.amountPaise ?? 0), 0);
  const pendingPaise = totalPaise - collectedPaise;

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{fmt(totalPaise)}</Text>
          <Text style={styles.summaryLabel}>Total Billed</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{fmt(collectedPaise)}</Text>
          <Text style={styles.summaryLabel}>Collected</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.error }]}>{fmt(pendingPaise)}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      {invoices.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3] }}>
          <Text style={{ fontSize: fontSizes.lg, color: colors.textSecondary, textAlign: 'center' }}>
            No invoices yet.
          </Text>
          <Text style={{ fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing[8] }}>
            Payment gateway configuration and invoice generation will be available in Phase 5.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.student}>{(item as any).student?.name ?? 'Student'}</Text>
                  <Text style={styles.month}>{(item as any).month ?? `INV-${item.id.slice(-6)}`}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.amount}>{fmt(item.amountPaise ?? 0)}</Text>
                  <Badge label={item.status} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
                </View>
              </View>
            </Card>
          )}
        />
      )}
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

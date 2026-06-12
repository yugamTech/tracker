import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';

type MismatchType = 'AMOUNT_MISMATCH' | 'DUPLICATE' | 'MISSING_PAYMENT' | 'EXCESS';

const MOCK_MISMATCHES = [
  { id: 'r1', type: 'AMOUNT_MISMATCH' as MismatchType, studentName: 'Arjun Sharma', invoiceId: 'INV-2024-0231', expected: 4200, received: 4000, gateway: 'Cashfree', time: 'Today 09:14 AM', resolved: false },
  { id: 'r2', type: 'DUPLICATE' as MismatchType, studentName: 'Riya Gupta', invoiceId: 'INV-2024-0218', expected: 3800, received: 7600, gateway: 'Cashfree', time: 'Today 08:52 AM', resolved: false },
  { id: 'r3', type: 'MISSING_PAYMENT' as MismatchType, studentName: 'Rohan Yadav', invoiceId: 'INV-2024-0209', expected: 4200, received: 0, gateway: 'Cashfree', time: 'Yesterday', resolved: false },
  { id: 'r4', type: 'AMOUNT_MISMATCH' as MismatchType, studentName: 'Priya Singh', invoiceId: 'INV-2024-0198', expected: 3600, received: 3500, gateway: 'HDFC', time: 'Jun 10', resolved: true },
  { id: 'r5', type: 'EXCESS' as MismatchType, studentName: 'Kiran Mehta', invoiceId: 'INV-2024-0187', expected: 4200, received: 4500, gateway: 'Cashfree', time: 'Jun 9', resolved: true },
];

const TYPE_LABELS: Record<MismatchType, string> = {
  AMOUNT_MISMATCH: 'Amount mismatch',
  DUPLICATE: 'Duplicate payment',
  MISSING_PAYMENT: 'Missing payment',
  EXCESS: 'Excess payment',
};

const TYPE_COLORS: Record<MismatchType, string> = {
  AMOUNT_MISMATCH: '#F59E0B',
  DUPLICATE: '#EF4444',
  MISSING_PAYMENT: '#7C3AED',
  EXCESS: '#0EA5E9',
};

export default function ReconciliationScreen() {
  const [items, setItems] = useState(MOCK_MISMATCHES);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const filtered = items.filter((i) =>
    filter === 'all' ? true : filter === 'open' ? !i.resolved : i.resolved
  );

  const resolve = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: true } : i)));

  const openCount = items.filter((i) => !i.resolved).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: colors.error }]}>{openCount}</Text>
          <Text style={styles.summaryLabel}>Open</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: colors.success }]}>{items.filter((i) => i.resolved).length}</Text>
          <Text style={styles.summaryLabel}>Resolved</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>{items.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.tab, filter === f && styles.tabActive]}>
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={[styles.card, item.resolved && styles.cardResolved]}>
            <View style={styles.cardHeader}>
              <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] + '20' }]}>
                <Text style={[styles.typeText, { color: TYPE_COLORS[item.type] }]}>{TYPE_LABELS[item.type]}</Text>
              </View>
              <Text style={styles.time}>{item.time}</Text>
            </View>

            <Text style={styles.studentName}>{item.studentName}</Text>
            <Text style={styles.invoiceId}>{item.invoiceId} · {item.gateway}</Text>

            <View style={styles.amounts}>
              <View style={styles.amountCol}>
                <Text style={styles.amountLabel}>Expected</Text>
                <Text style={styles.amountVal}>₹{item.expected.toLocaleString()}</Text>
              </View>
              <Text style={styles.vs}>vs</Text>
              <View style={styles.amountCol}>
                <Text style={styles.amountLabel}>Received</Text>
                <Text style={[styles.amountVal, { color: item.received !== item.expected ? colors.error : colors.success }]}>
                  ₹{item.received.toLocaleString()}
                </Text>
              </View>
              <View style={styles.amountCol}>
                <Text style={styles.amountLabel}>Diff</Text>
                <Text style={[styles.amountVal, { color: colors.error }]}>
                  ₹{Math.abs(item.received - item.expected).toLocaleString()}
                </Text>
              </View>
            </View>

            {!item.resolved && (
              <TouchableOpacity style={styles.resolveBtn} onPress={() => resolve(item.id)}>
                <Text style={styles.resolveBtnText}>Mark Resolved</Text>
              </TouchableOpacity>
            )}
            {item.resolved && <Text style={styles.resolvedTag}>✓ Resolved</Text>}
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={styles.emptyText}>No {filter} mismatches</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  summary: {
    flexDirection: 'row', backgroundColor: colors.white,
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center', gap: spacing[1] },
  summaryVal: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold },
  summaryLabel: { fontSize: fontSizes.xs, color: colors.textSecondary },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  tabText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  tabTextActive: { color: '#7C3AED', fontWeight: fontWeights.semibold },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardResolved: { opacity: 0.65 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  typeBadge: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.md },
  typeText: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold },
  time: { fontSize: fontSizes.xs, color: colors.textMuted },
  studentName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  invoiceId: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: spacing[3] },
  amounts: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], backgroundColor: colors.gray50, padding: spacing[3], borderRadius: radius.lg },
  amountCol: { alignItems: 'center', flex: 1 },
  amountLabel: { fontSize: fontSizes.xs, color: colors.textMuted },
  amountVal: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  vs: { fontSize: fontSizes.xs, color: colors.textMuted },
  resolveBtn: {
    marginTop: spacing[3], alignSelf: 'flex-end',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: '#7C3AED', borderRadius: radius.lg,
  },
  resolveBtnText: { fontSize: fontSizes.sm, color: colors.white, fontWeight: fontWeights.semibold },
  resolvedTag: { fontSize: fontSizes.sm, color: colors.success, fontWeight: fontWeights.semibold, marginTop: spacing[3], textAlign: 'right' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
});

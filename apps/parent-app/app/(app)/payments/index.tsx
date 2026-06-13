import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button } from '@saarthi/ui';
import { useMyInvoices } from '@saarthi/api-client';

const STATUS_V: Record<string, 'warning' | 'success' | 'error'> = {
  DUE: 'warning', PAID: 'success', OVERDUE: 'error',
};

export default function PaymentsScreen() {
  const { data: invoices = [], isLoading } = useMyInvoices();

  const due = invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE');
  const totalDue = due.reduce((s, i) => s + (i.amountPaise ?? 0) / 100, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Transport fee management</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <>
          {totalDue > 0 && (
            <View style={styles.dueBanner}>
              <View>
                <Text style={styles.dueLabel}>Amount Due</Text>
                <Text style={styles.dueAmount}>₹{totalDue.toLocaleString('en-IN')}</Text>
              </View>
              <Button
                title="Pay Now"
                size="sm"
                onPress={() => due[0] && router.push(`/(app)/payments/pay/${due[0].id}` as never)}
              />
            </View>
          )}

          <FlatList
            data={invoices}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ color: colors.textSecondary }}>No invoices yet.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.cardRow}>
                  <View>
                    <Text style={styles.month}>{(item as any).month ?? item.id.slice(-6)}</Text>
                    <Text style={styles.invoiceNo}>{(item as any).invoiceNo ?? `INV-${item.id.slice(-6)}`}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing[2] }}>
                    <Text style={styles.amount}>₹{((item.amountPaise ?? 0) / 100).toLocaleString('en-IN')}</Text>
                    <Badge label={item.status} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
                  </View>
                </View>
                {item.status !== 'PAID' && (
                  <Button
                    title={`Pay ₹${((item.amountPaise ?? 0) / 100).toLocaleString('en-IN')}`}
                    variant="outline"
                    size="sm"
                    onPress={() => router.push(`/(app)/payments/pay/${item.id}` as never)}
                    style={{ marginTop: spacing[3] }}
                  />
                )}
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

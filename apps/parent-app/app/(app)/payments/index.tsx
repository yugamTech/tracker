import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing, radius, shadows,
  AppHeader, Card, Badge, Button, Skeleton, EmptyState,
} from '@yaanam/ui';
import { useMyInvoices } from '@yaanam/api-client';
import type { BadgeVariant } from '@yaanam/ui';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  DUE: 'warning', PAID: 'success', OVERDUE: 'error',
};

const rupees = (paise?: number) => `₹${((paise ?? 0) / 100).toLocaleString('en-IN')}`;

export default function PaymentsScreen() {
  const { data: invoices = [], isLoading } = useMyInvoices();

  const due = invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE');
  const totalDue = due.reduce((s, i) => s + (i.amountPaise ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        title="Payments"
        right={
          <Button title="History" variant="ghost" size="sm" onPress={() => router.push('/(app)/payments/history' as never)} />
        }
      />

      {isLoading ? (
        <View style={styles.list}>
          <Skeleton width="100%" height={88} radius="xl" />
          {[0, 1].map((i) => (
            <Card key={i} shadow="sm">
              <Skeleton width="40%" height={16} />
              <Skeleton width="25%" height={13} style={{ marginTop: spacing[2] }} />
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            totalDue > 0 ? (
              <View style={styles.dueBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dueLabel}>Total amount due</Text>
                  <Text style={styles.dueAmount}>{rupees(totalDue)}</Text>
                </View>
                <Button
                  title="Pay now"
                  variant="secondary"
                  size="sm"
                  onPress={() => due[0] && router.push(`/(app)/payments/pay/${due[0].id}` as never)}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<Text style={{ fontSize: 40 }}>🧾</Text>}
                title="No invoices yet"
                description="Your transport fee invoices will appear here"
              />
            </View>
          }
          renderItem={({ item }) => {
            const paid = item.status === 'PAID';
            return (
              <Card shadow="sm">
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.month}>{(item as any).month ?? `Invoice ${item.id.slice(-6)}`}</Text>
                    <Text style={styles.invoiceNo}>{(item as any).invoiceNo ?? `INV-${item.id.slice(-6)}`}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amount}>{rupees(item.amountPaise)}</Text>
                    <Badge label={item.status} variant={STATUS_VARIANT[item.status] ?? 'default'} size="sm" />
                  </View>
                </View>
                {!paid && (
                  <Button
                    title={`Pay ${rupees(item.amountPaise)}`}
                    variant="outline"
                    size="sm"
                    fullWidth
                    onPress={() => router.push(`/(app)/payments/pay/${item.id}` as never)}
                    style={{ marginTop: spacing[3] }}
                  />
                )}
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  dueBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[5], borderRadius: radius.xl, backgroundColor: colors.primary,
    marginBottom: spacing[1], ...shadows.md,
  },
  dueLabel: { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.75)' },
  dueAmount: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.white, marginTop: 2, letterSpacing: letterSpacing.tight },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  month: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  invoiceNo: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  amountCol: { alignItems: 'flex-end', gap: spacing[2] },
  amount: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  emptyWrap: { flex: 1, minHeight: 360 },
});

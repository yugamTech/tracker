import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button, useToast } from '@yaanam/ui';
import { useInvoiceById } from '@yaanam/api-client';

const STATUS_V: Record<string, 'warning' | 'success' | 'error'> = {
  DUE: 'warning', PAID: 'success', OVERDUE: 'error',
};

export default function PayScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, isError } = useInvoiceById(invoiceId ?? '');
  const toast = useToast();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError || !invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pay Invoice</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Invoice not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const amountRupees = (invoice.amountPaise ?? 0) / 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pay Invoice</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Invoice</Text>
            <Text style={styles.value}>{(invoice as any).invoiceNo ?? `INV-${invoice.id.slice(-6)}`}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Amount</Text>
            <Text style={[styles.value, styles.amount]}>₹{amountRupees.toLocaleString('en-IN')}</Text>
          </View>
          {(invoice as any).dueDate && (
            <View style={styles.cardRow}>
              <Text style={styles.label}>Due Date</Text>
              <Text style={styles.value}>
                {new Date((invoice as any).dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}
          <View style={[styles.cardRow, { marginTop: spacing[2] }]}>
            <Text style={styles.label}>Status</Text>
            <Badge label={invoice.status} variant={STATUS_V[invoice.status] ?? 'default'} size="sm" />
          </View>
        </Card>

        {invoice.status === 'PAID' ? (
          <View style={styles.paidBanner}>
            <Text style={styles.paidText}>This invoice has already been paid.</Text>
          </View>
        ) : (
          <View style={styles.gatewayNotice}>
            <Text style={styles.gatewayTitle}>Online payment coming soon</Text>
            <Text style={styles.gatewayBody}>
              Payment gateway integration (Cashfree/HDFC) will be available in the next update. Please contact your school for alternative payment methods.
            </Text>
          </View>
        )}

        <Button
          title={invoice.status === 'PAID' ? 'Back to Payments' : 'Payment Coming Soon'}
          onPress={() => invoice.status === 'PAID' ? router.back() : toast.info('Payment gateway will be available in the next update.', 'Coming soon')}
          variant={invoice.status === 'PAID' ? 'primary' : 'outline'}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  content: { padding: spacing[4], gap: spacing[4] },
  card: {},
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  label: { fontSize: fontSizes.sm, color: colors.textSecondary },
  value: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  amount: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  paidBanner: {
    backgroundColor: '#ECFDF5', borderRadius: radius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  paidText: { fontSize: fontSizes.sm, color: '#065F46', textAlign: 'center', fontWeight: fontWeights.medium },
  gatewayNotice: {
    backgroundColor: colors.gray100, borderRadius: radius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: colors.border, gap: spacing[2],
  },
  gatewayTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  gatewayBody: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
});

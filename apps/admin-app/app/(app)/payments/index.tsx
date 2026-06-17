import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colors, spacing, fontSizes, fontWeights,
  Card, Badge, Skeleton, EmptyState,
} from '@saarthi/ui';
import type { BadgeVariant } from '@saarthi/ui';
import { useMyInvoices } from '@saarthi/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { StatCard, GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const STATUS_V: Record<string, BadgeVariant> = {
  PAID: 'success', DUE: 'warning', OVERDUE: 'error',
};

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

export default function AdminPaymentsScreen() {
  const { data: invoices = [], isLoading } = useMyInvoices();
  const { isDesktop, gridColumns } = useResponsive();

  const totalPaise = invoices.reduce((s, i) => s + (i.amountPaise ?? 0), 0);
  const collectedPaise = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + (i.amountPaise ?? 0), 0);
  const pendingPaise = totalPaise - collectedPaise;

  return (
    <AdminScreen
      title="Payments"
      subtitle="Fee collection"
      subnav={<SubNav segments={SUBNAV.payments} value="overview" />}
    >
      <View style={styles.root}>
        <View style={[styles.kpiRow, isDesktop ? styles.kpiRowDesktop : styles.kpiRowPhone]}>
          <View style={isDesktop ? styles.cellDesktop : styles.cellPhoneFull}>
            <StatCard label="Total Billed" value={isLoading ? '—' : fmt(totalPaise)} icon="▣" tone="neutral" />
          </View>
          <View style={isDesktop ? styles.cellDesktop : styles.cellPhoneHalf}>
            <StatCard label="Collected" value={isLoading ? '—' : fmt(collectedPaise)} icon="✓" tone="success" />
          </View>
          <View style={isDesktop ? styles.cellDesktop : styles.cellPhoneHalf}>
            <StatCard label="Pending" value={isLoading ? '—' : fmt(pendingPaise)} icon="⏳" tone={pendingPaise > 0 ? 'error' : 'neutral'} />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="50%" height={15} />
                <Skeleton width="30%" height={13} style={{ marginTop: 10 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={invoices}
            columns={gridColumns}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>💳</Text>}
                  title="No invoices yet"
                  description="Payment gateway configuration and invoice generation arrive in Phase 5."
                />
              </View>
            }
            renderItem={(item) => (
              <Card shadow="sm">
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.student} numberOfLines={1}>{(item as any).student?.name ?? 'Student'}</Text>
                    <Text style={styles.month} numberOfLines={1}>{(item as any).month ?? `INV-${item.id.slice(-6)}`}</Text>
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
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kpiRow: { padding: spacing[4], paddingBottom: 0 },
  kpiRowDesktop: { flexDirection: 'row', gap: spacing[3] },
  kpiRowPhone: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  cellDesktop: { flex: 1 },
  cellPhoneFull: { width: '100%' },
  cellPhoneHalf: { width: '48%' },

  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 300, flexGrow: 1 },
  listContent: { paddingTop: spacing[4] },
  emptyWrap: { flex: 1, minHeight: 320 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  student: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  month: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: spacing[2] },
  amount: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
});

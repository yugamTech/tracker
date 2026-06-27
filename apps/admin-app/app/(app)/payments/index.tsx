import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, Skeleton, EmptyState, IconSplat, Icon,
} from '@yaanam/ui';
import type { BadgeVariant } from '@yaanam/ui';
import { useMyInvoices } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { StatCard, GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

const HUE = colors.pay;

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
            <StatCard label="Total Billed" value={isLoading ? '—' : fmt(totalPaise)} icon="₹" tone="neutral" />
          </View>
          <View style={isDesktop ? styles.cellDesktop : styles.cellPhoneHalf}>
            <StatCard label="Collected" value={isLoading ? '—' : fmt(collectedPaise)} icon="✓" tone="success" />
          </View>
          <View style={isDesktop ? styles.cellDesktop : styles.cellPhoneHalf}>
            <StatCard label="Pending" value={isLoading ? '—' : fmt(pendingPaise)} icon="!" tone={pendingPaise > 0 ? 'error' : 'neutral'} />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2].map((i) => (
              <Card key={i} shadow="sm" radius={22} style={styles.skeletonCard}>
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
                  icon={<IconSplat shape="b1" splatColor={colors.payBg} spot="card" size={64} />}
                  title="No invoices yet"
                  description="Payment gateway configuration and invoice generation arrive in Phase 5."
                />
              </View>
            }
            renderItem={(item) => (
              <Card shadow="sm" radius={22} style={styles.card}>
                <View style={styles.cardTop}>
                  <IconSplat shape="b1" splatColor={colors.payBg} spot="card" size={40} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.student} numberOfLines={1}>{(item as any).student?.name ?? 'Student'}</Text>
                    <Text style={styles.month} numberOfLines={1}>{(item as any).month ?? `INV-${item.id.slice(-6)}`}</Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.amount}>{fmt(item.amountPaise ?? 0)}</Text>
                    <Badge label={item.status} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
                  </View>
                </View>
                {item.status === 'OVERDUE' ? (
                  <View style={styles.overdueBanner}>
                    <Icon name="alert" size={14} color={colors.crit} />
                    <Text style={styles.overdueText}>Payment overdue</Text>
                  </View>
                ) : null}
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

  card: { gap: spacing[2] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardInfo: { flex: 1, minWidth: 0 },
  student: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.base, fontWeight: fontWeights.extrabold, color: colors.ink },
  month: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: spacing[1] },
  amount: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: HUE },
  overdueBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.critBg, borderRadius: 12,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  overdueText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.crit, fontWeight: fontWeights.semibold },
});

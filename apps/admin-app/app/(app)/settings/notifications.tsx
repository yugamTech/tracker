import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, fontWeights, Badge, EmptyState } from '@yaanam/ui';
import { useMyNotifications } from '@yaanam/api-client';
import type { Notification } from '@yaanam/types';

// Admin calls the same endpoint; the backend scopes to tenantId for admin roles.
type ApiNotification = Notification & { readAt: string | null };

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  PENDING: 'warning',
  SENT: 'info',
  DELIVERED: 'success',
  FAILED: 'default',
};

const CHANNEL_COLORS: Record<string, string> = {
  PUSH: '#0EA5E9',
  SMS: '#10B981',
  WHATSAPP: '#25D366',
};

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationAuditScreen() {
  const { data, isLoading } = useMyNotifications();
  const items = (data ?? []) as ApiNotification[];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {items.length === 0 ? (
        <EmptyState title="No notifications yet" description="Notifications sent to this tenant will appear here" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.chips}>
                  <View style={[styles.channelChip, { backgroundColor: CHANNEL_COLORS[item.channel] ?? colors.gray400 }]}>
                    <Text style={styles.channelText}>{item.channel}</Text>
                  </View>
                  <Badge
                    label={item.status}
                    variant={STATUS_VARIANT[item.status] ?? 'default'}
                    size="sm"
                  />
                </View>
                <Text style={styles.ts}>{formatTs(item.createdAt)}</Text>
              </View>
              <Text style={styles.eventType}>{item.eventType.replace(/_/g, ' ')}</Text>
              <Text style={styles.recipient} numberOfLines={1}>
                Recipient: {item.recipientId}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  list: { paddingVertical: spacing[2] },
  row: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  chips: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  channelChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  channelText: { fontSize: fontSizes.xs, color: colors.white, fontWeight: fontWeights.semibold },
  ts: { fontSize: fontSizes.xs, color: colors.textMuted },
  eventType: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  recipient: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.border },
});

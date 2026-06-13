import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, EmptyState } from '@saarthi/ui';
import { useMyNotifications, useMarkRead, useMarkAllRead } from '@saarthi/api-client';
import type { Notification } from '@saarthi/types';

// Backend includes readAt on the row; types package doesn't declare it yet.
type ApiNotification = Notification & { readAt: string | null };

const CATEGORY_COLORS: Record<string, string> = {
  TRIP_START: '#0EA5E9',
  TRIP_END: '#0EA5E9',
  BOARDING: '#10B981',
  ALIGHTING: '#EF4444',
  PICKUP_CANCELLED: '#F59E0B',
  COMPLAINT_UPDATE: '#F59E0B',
  PAYMENT_DUE: '#7C3AED',
  PAYMENT_SUCCESS: '#10B981',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export default function NotificationCenterScreen() {
  const { data, isLoading } = useMyNotifications();
  const items = (data ?? []) as ApiNotification[];
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();

  const unreadCount = items.filter((n) => !n.readAt).length;

  const handlePress = (item: ApiNotification) => {
    if (!item.readAt) markRead(item.id);
    const deepLink = item.variables?.deepLink;
    if (deepLink) router.push(deepLink as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllRead()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isRead = !!item.readAt;
            return (
              <TouchableOpacity
                onPress={() => handlePress(item)}
                activeOpacity={0.85}
                style={[styles.item, !isRead && styles.itemUnread]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: CATEGORY_COLORS[item.eventType] ?? colors.gray400 },
                  ]}
                />
                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <Text style={[styles.itemTitle, !isRead && styles.bold]}>
                      {item.eventType.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.itemText} numberOfLines={2}>
                    {item.variables?.body ?? item.eventType}
                  </Text>
                </View>
                {!isRead && <View style={styles.unreadBadge} />}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[5],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { paddingRight: spacing[3] },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  title: { flex: 1, fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  markAll: { fontSize: fontSizes.sm, color: colors.primary },
  list: { paddingVertical: spacing[2] },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[4],
    backgroundColor: colors.white,
    gap: spacing[3],
  },
  itemUnread: { backgroundColor: '#F0F4FF' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  itemBody: { flex: 1 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[1] },
  itemTitle: { flex: 1, fontSize: fontSizes.sm, color: colors.textPrimary, marginRight: spacing[2] },
  bold: { fontWeight: fontWeights.semibold },
  itemTime: { fontSize: fontSizes.xs, color: colors.textMuted },
  itemText: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  unreadBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  separator: { height: 1, backgroundColor: colors.border },
});

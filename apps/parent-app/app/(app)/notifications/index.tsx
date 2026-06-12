import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Badge } from '@saarthi/ui';

const MOCK_NOTIFICATIONS = [
  { id: 'n1', title: 'Bus approaching your stop', body: 'Route A bus is ~3 min away. Arjun should be ready.', time: '07:34 AM', read: false, category: 'TRACKING', deep: '/(app)/track/trip-today-001' },
  { id: 'n2', title: 'Arjun boarded the bus', body: 'Arjun Sharma boarded at DLF Phase 2 at 07:18 AM.', time: '07:18 AM', read: false, category: 'ATTENDANCE', deep: null },
  { id: 'n3', title: 'Trip completed', body: 'Route A morning pickup completed. 22/22 riders boarded.', time: 'Yesterday', read: true, category: 'TRACKING', deep: null },
  { id: 'n4', title: 'Complaint resolved', body: 'Your complaint #C-004 has been resolved. Please rate the experience.', time: 'Yesterday', read: true, category: 'COMPLAINT', deep: '/(app)/complaints/complaint-004' },
  { id: 'n5', title: 'Invoice due', body: 'June fee invoice of ₹4,200 is due on 15 Jun.', time: '2 days ago', read: true, category: 'PAYMENT', deep: '/(app)/payments' },
  { id: 'n6', title: 'Bus signal lost', body: 'Temporary signal interruption on Route A. Tracking may be delayed.', time: '3 days ago', read: true, category: 'ALERT', deep: null },
];

const CATEGORY_COLORS: Record<string, string> = {
  TRACKING: '#0EA5E9',
  ATTENDANCE: '#10B981',
  COMPLAINT: '#F59E0B',
  PAYMENT: '#7C3AED',
  ALERT: '#EF4444',
};

export default function NotificationCenterScreen() {
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);

  const markRead = (id: string) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const handlePress = (item: typeof items[number]) => {
    markRead(item.id);
    if (item.deep) router.push(item.deep as never);
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handlePress(item)}
            activeOpacity={0.85}
            style={[styles.item, !item.read && styles.itemUnread]}
          >
            <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[item.category] ?? colors.gray400 }]} />
            <View style={styles.itemBody}>
              <View style={styles.itemTop}>
                <Text style={[styles.itemTitle, !item.read && styles.bold]}>{item.title}</Text>
                <Text style={styles.itemTime}>{item.time}</Text>
              </View>
              <Text style={styles.itemText} numberOfLines={2}>{item.body}</Text>
            </View>
            {!item.read && <View style={styles.unreadBadge} />}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  back: { paddingRight: spacing[3] },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  title: { flex: 1, fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  markAll: { fontSize: fontSizes.sm, color: colors.primary },
  list: { paddingVertical: spacing[2] },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', padding: spacing[4],
    backgroundColor: colors.white, gap: spacing[3],
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

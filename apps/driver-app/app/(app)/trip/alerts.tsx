import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';

const MOCK_ALERTS = [
  { id: 'a1', parentName: 'Meena Sharma', child: 'Arjun Sharma', message: 'Cancel pickup today — Arjun is absent', time: '07:12 AM', icon: '🚫', read: false },
  { id: 'a2', parentName: 'Rakesh Gupta', child: 'Riya Gupta', message: 'Running 5 minutes late — please wait', time: '07:08 AM', icon: '⏳', read: false },
  { id: 'a3', parentName: 'Sunita Yadav', child: 'Rohan Yadav', message: 'We are at the stop', time: '06:58 AM', icon: '📍', read: true },
];

export default function InTripAlertsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  const markRead = (id: string) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));

  const unread = alerts.filter((a) => !a.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Parent Alerts</Text>
          {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>}
        </View>
        <View style={{ width: 60 }} />
      </View>

      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🔔</Text>
          <Text style={styles.emptyText}>No alerts from parents</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => markRead(item.id)} activeOpacity={0.85}>
              <Card style={[styles.card, !item.read && styles.cardUnread]}>
                <View style={styles.cardRow}>
                  <Text style={styles.icon}>{item.icon}</Text>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={styles.childName}>{item.child}</Text>
                      <Text style={styles.time}>{item.time}</Text>
                    </View>
                    <Text style={styles.parent}>{item.parentName}</Text>
                    <Text style={[styles.message, !item.read && styles.messageBold]}>{item.message}</Text>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
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
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium, width: 60 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  badge: {
    backgroundColor: colors.error, borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 11, color: colors.white, fontWeight: fontWeights.bold },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardUnread: { borderLeftWidth: 4, borderLeftColor: '#0EA5E9' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  icon: { fontSize: 28 },
  cardBody: { flex: 1, gap: spacing[1] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  childName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  time: { fontSize: fontSizes.xs, color: colors.textMuted },
  parent: { fontSize: fontSizes.xs, color: colors.textSecondary },
  message: { fontSize: fontSizes.sm, color: colors.textPrimary, marginTop: spacing[1] },
  messageBold: { fontWeight: fontWeights.semibold },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0EA5E9', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  emptyText: { fontSize: fontSizes.base, color: colors.textSecondary },
});

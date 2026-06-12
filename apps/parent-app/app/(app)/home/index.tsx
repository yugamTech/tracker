import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, StatusDot } from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';

// Mock data
const MOCK_CHILDREN = [
  {
    id: 'student-001',
    name: 'Arjun Sharma',
    class: 'Grade 4-B',
    busNumber: 'HR26-DL-9900',
    route: 'Route A — Sector 18',
    tripId: 'trip-today-001',
    status: 'IN_PROGRESS' as const,
    etaMinutes: 8,
    lastStop: 'DLF Phase 2',
    boardStatus: 'BOARDED' as const,
  },
];

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  STARTED: 'Started',
  IN_PROGRESS: 'Live',
  COMPLETED: 'Completed',
};

export default function HomeScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const person = useAuthStore((s) => s.person);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.name}>{person?.name ?? 'Parent'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Live Banner */}
        <View style={styles.liveBanner}>
          <StatusDot variant="live" size={10} />
          <Text style={styles.liveBannerText}>1 trip is live right now</Text>
        </View>

        {/* Children cards */}
        <Text style={styles.sectionTitle}>Your Children</Text>

        {MOCK_CHILDREN.map((child) => (
          <TouchableOpacity
            key={child.id}
            onPress={() => router.push(`/(app)/track/${child.tripId}` as never)}
            activeOpacity={0.85}
          >
            <Card style={styles.childCard}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childInitial}>{child.name[0]}</Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childClass}>{child.class}</Text>
                </View>
                <Badge
                  label={child.boardStatus === 'BOARDED' ? 'Boarded ✓' : 'Not Boarded'}
                  variant={child.boardStatus === 'BOARDED' ? 'boarded' : 'not_boarded'}
                  size="sm"
                />
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Trip info */}
              <View style={styles.tripInfo}>
                <View style={styles.tripRow}>
                  <Text style={styles.tripLabel}>🚌 Bus</Text>
                  <Text style={styles.tripValue}>{child.busNumber}</Text>
                </View>
                <View style={styles.tripRow}>
                  <Text style={styles.tripLabel}>📍 Last stop</Text>
                  <Text style={styles.tripValue}>{child.lastStop}</Text>
                </View>
                {child.status === 'IN_PROGRESS' && (
                  <View style={styles.etaBanner}>
                    <StatusDot variant="live" size={8} />
                    <Text style={styles.etaText}>
                      Arriving in ~{child.etaMinutes} min
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.trackBtn}>
                <Text style={styles.trackBtnText}>Track Live →</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {[
            { icon: '📋', label: 'Past Trips', onPress: () => router.push('/(app)/trips' as never) },
            { icon: '💬', label: 'Raise Issue', onPress: () => router.push('/(app)/complaints/new' as never) },
            { icon: '💳', label: 'Pay Fees', onPress: () => router.push('/(app)/payments' as never) },
            { icon: '📞', label: 'Contact', onPress: () => {} },
          ].map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickAction} onPress={a.onPress}>
              <Text style={{ fontSize: 28 }}>{a.icon}</Text>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    backgroundColor: colors.white,
  },
  greeting: { fontSize: fontSizes.sm, color: colors.textSecondary },
  name: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  notifBtn: { padding: spacing[2] },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#EEF2FF',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
  },
  liveBannerText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  sectionTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
  childCard: { marginHorizontal: spacing[4], marginBottom: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childInitial: { fontSize: fontSizes.lg, color: colors.white, fontWeight: fontWeights.bold },
  childInfo: { flex: 1 },
  childName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  childClass: { fontSize: fontSizes.sm, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[3] },
  tripInfo: { gap: spacing[2] },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tripLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  tripValue: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  etaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#D1FAE5',
    padding: spacing[2],
    borderRadius: radius.md,
    marginTop: spacing[1],
  },
  etaText: { fontSize: fontSizes.sm, color: colors.success, fontWeight: fontWeights.semibold },
  trackBtn: { alignItems: 'flex-end', marginTop: spacing[3] },
  trackBtnText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  quickActions: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: fontWeights.medium, textAlign: 'center' },
});

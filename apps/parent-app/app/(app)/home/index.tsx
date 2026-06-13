import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, StatusDot } from '@saarthi/ui';
import { useAuthStore } from '../../../store/auth.store';
import { useMyStudents, useTodayTrips } from '@saarthi/api-client';

export default function HomeScreen() {
  const person = useAuthStore((s) => s.person);
  const { data: students, isLoading, refetch, isRefetching } = useMyStudents();
  const { data: todayTrips } = useTodayTrips();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.name}>{person?.name ?? 'Parent'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(app)/notifications' as never)}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {/* Children cards */}
        {!isLoading && (
          <>
            <Text style={styles.sectionTitle}>Your Children</Text>

            {students?.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No children linked to your account</Text>
              </View>
            )}

            {students?.map((child) => {
              const activeTrip = todayTrips?.find(
                (t) =>
                  t.routeId === child.routeId &&
                  (t.status === 'STARTED' || t.status === 'IN_PROGRESS' || t.status === 'SCHEDULED'),
              );
              return (
              <TouchableOpacity
                key={child.id}
                onPress={() => {
                  if (activeTrip) {
                    router.push(`/(app)/track/${activeTrip.id}` as never);
                  } else {
                    router.push('/(app)/trips' as never);
                  }
                }}
                activeOpacity={0.85}
              >
                <Card style={styles.childCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.childAvatar}>
                      <Text style={styles.childInitial}>{child.name[0]}</Text>
                    </View>
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>{child.name}</Text>
                      {child.regId && <Text style={styles.childClass}>{child.regId}</Text>}
                    </View>
                    <Badge
                      label={activeTrip ? 'Live ●' : 'No trip'}
                      variant={activeTrip ? 'active' : 'inactive'}
                      size="sm"
                    />
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.tripInfo}>
                    {child.route && (
                      <View style={styles.tripRow}>
                        <Text style={styles.tripLabel}>🛣 Route</Text>
                        <Text style={styles.tripValue}>{child.route.name}</Text>
                      </View>
                    )}
                    {child.stop && (
                      <View style={styles.tripRow}>
                        <Text style={styles.tripLabel}>📍 Stop</Text>
                        <Text style={styles.tripValue}>{child.stop.name}</Text>
                      </View>
                    )}
                    {child.ageGroup && (
                      <View style={styles.tripRow}>
                        <Text style={styles.tripLabel}>🕐 Pickup</Text>
                        <Text style={styles.tripValue}>{child.ageGroup.pickupTime}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.trackBtn}>
                    <Text style={styles.trackBtnText}>Track Live →</Text>
                  </View>
                </Card>
              </TouchableOpacity>
              );
            })}
          </>
        )}

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
  loader: { padding: spacing[8], alignItems: 'center' },
  sectionTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
  emptyBox: { margin: spacing[5], padding: spacing[5], backgroundColor: colors.white, borderRadius: radius.xl, alignItems: 'center' },
  emptyText: { fontSize: fontSizes.sm, color: colors.textSecondary },
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

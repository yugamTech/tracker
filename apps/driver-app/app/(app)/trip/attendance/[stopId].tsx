import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, radius,
  Card, Button, Avatar, Skeleton, EmptyState, AppHeader, AnimatedPressable, ScreenContainer,
} from '@saarthi/ui';
import { useRoster, useMarkAttendance } from '@saarthi/api-client';
import type { RosterRider } from '@saarthi/api-client';

export default function AttendanceScreen() {
  const { stopId, tripId } = useLocalSearchParams<{ stopId: string; tripId: string }>();
  const { data: rosterData, isLoading, isError } = useRoster(tripId);
  const markAttendance = useMarkAttendance();

  const stopRoster = rosterData?.stops.find((s) => s.stopId === stopId);
  const riders: RosterRider[] = stopRoster?.riders ?? [];

  const getStatus = (rider: RosterRider): 'BOARDED' | 'NOT_BOARDED' | 'EXPECTED' | 'CANCELLED' => {
    if (rider.boardStatus === 'BOARDED') return 'BOARDED';
    if (rider.boardStatus === 'NOT_BOARDED') return 'NOT_BOARDED';
    if (rider.boardStatus === 'CANCELLED') return 'CANCELLED';
    return 'EXPECTED';
  };

  // Boarding goes through the per-child photo screen (capture → board with the
  // photo attached, or board without one). Marking absent persists immediately.
  const handleBoard = (rider: RosterRider) => {
    router.push(
      `/(app)/trip/attendance/photo?stopId=${stopId}&tripId=${tripId}` +
        `&studentId=${rider.studentId}&studentName=${encodeURIComponent(rider.studentName)}` as never,
    );
  };

  const handleAbsent = (rider: RosterRider) => {
    markAttendance.mutate(
      { tripId, studentId: rider.studentId, type: 'NOT_BOARDED' },
      {
        onError: (e: any) =>
          Alert.alert(
            'Could not mark absent',
            e?.response?.data?.message ?? e?.message ?? 'Please try again.',
          ),
      },
    );
  };

  const markedCount = riders.filter((r) => {
    const s = getStatus(r);
    return s === 'BOARDED' || s === 'NOT_BOARDED';
  }).length;
  const allMarked = riders.length > 0 && markedCount === riders.length;

  if (isLoading) {
    return (
      <ScreenContainer bg={colors.backgroundMuted}>
        <AppHeader title="Stop Attendance" subtitle="Loading roster…" onBack={() => router.back()} />
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <View style={styles.cardRow}>
                <Skeleton width={40} height={40} circle />
                <Skeleton width="50%" height={16} />
              </View>
            </Card>
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer bg={colors.backgroundMuted}>
        <AppHeader title="Stop Attendance" onBack={() => router.back()} />
        <EmptyState title="Could not load roster" description="Check your connection and try again" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg={colors.backgroundMuted}>
      <AppHeader
        title={stopRoster?.stopName ?? 'Stop Attendance'}
        subtitle={`${markedCount}/${riders.length} marked`}
        onBack={() => router.back()}
      />

      <FlatList
        data={riders}
        keyExtractor={(r) => r.studentId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState title="No riders at this stop" description="No students are expected at this stop" />
        }
        renderItem={({ item }) => {
          const status = getStatus(item);
          return (
            <Card shadow="sm">
              <View style={styles.cardRow}>
                {status === 'BOARDED' && item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.thumb} />
                ) : (
                  <Avatar name={item.studentName} size={40} />
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{item.studentName}</Text>
                  {status === 'CANCELLED' && <Text style={styles.cancelled}>Pickup cancelled</Text>}
                  {status === 'BOARDED' && (
                    <Text style={styles.boardedHint}>{item.photoUrl ? 'Boarded · photo' : 'Boarded'}</Text>
                  )}
                  {status === 'NOT_BOARDED' && <Text style={styles.absentHint}>Absent</Text>}
                </View>
                {status !== 'CANCELLED' && (
                  <View style={styles.btns}>
                    <AnimatedPressable
                      scaleTo={0.9}
                      style={[styles.markBtn, status === 'BOARDED' && styles.boardedActive]}
                      onPress={() => handleBoard(item)}
                      disabled={markAttendance.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${item.studentName} boarded`}
                    >
                      <Text style={[styles.markGlyph, status === 'BOARDED' && styles.boardedGlyph]}>✓</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      scaleTo={0.9}
                      style={[styles.markBtn, status === 'NOT_BOARDED' && styles.absentActive]}
                      onPress={() => handleAbsent(item)}
                      disabled={markAttendance.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${item.studentName} absent`}
                    >
                      <Text style={[styles.markGlyph, status === 'NOT_BOARDED' && styles.absentGlyph]}>✕</Text>
                    </AnimatedPressable>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />

      <View style={styles.footer}>
        <Button
          title={allMarked ? 'Confirm Attendance' : `Done (${riders.length - markedCount} unmarked)`}
          onPress={() => router.back()}
          fullWidth
          size="lg"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.gray100 },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  info: { flex: 1 },
  name: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  cancelled: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  boardedHint: { fontSize: fontSizes.xs, color: colors.success, marginTop: 2, fontWeight: fontWeights.medium },
  absentHint: { fontSize: fontSizes.xs, color: colors.error, marginTop: 2, fontWeight: fontWeights.medium },
  btns: { flexDirection: 'row', gap: spacing[2] },
  markBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.border,
  },
  boardedActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  absentActive: { backgroundColor: colors.errorBg, borderColor: colors.error },
  markGlyph: { fontSize: 20, color: colors.textMuted, fontWeight: fontWeights.bold },
  boardedGlyph: { color: colors.success },
  absentGlyph: { color: colors.error },
  footer: {
    padding: spacing[4], backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});

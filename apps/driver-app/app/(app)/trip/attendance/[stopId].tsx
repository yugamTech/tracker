import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Button, LoadingSpinner, EmptyState } from '@saarthi/ui';
import { useRoster, useMarkAttendance } from '@saarthi/api-client';
import type { RosterRider } from '@saarthi/api-client';

export default function AttendanceScreen() {
  const { stopId, tripId } = useLocalSearchParams<{ stopId: string; tripId: string }>();
  const { data: rosterData, isLoading, isError } = useRoster(tripId);
  const markAttendance = useMarkAttendance();

  // Local override map: studentId → 'BOARDED' | 'NOT_BOARDED' for optimistic UI on NOT_BOARDED
  const [localOverrides, setLocalOverrides] = useState<Record<string, 'BOARDED' | 'NOT_BOARDED'>>({});

  const stopRoster = rosterData?.stops.find((s) => s.stopId === stopId);
  const riders: RosterRider[] = stopRoster?.riders ?? [];

  const getStatus = (rider: RosterRider): 'BOARDED' | 'NOT_BOARDED' | 'EXPECTED' | 'CANCELLED' => {
    if (localOverrides[rider.studentId]) return localOverrides[rider.studentId];
    if (rider.boardStatus === 'BOARDED') return 'BOARDED';
    if (rider.boardStatus === 'NOT_BOARDED') return 'NOT_BOARDED';
    if (rider.boardStatus === 'CANCELLED') return 'CANCELLED';
    return 'EXPECTED';
  };

  const handleMark = (rider: RosterRider, type: 'BOARDED' | 'NOT_BOARDED') => {
    if (type === 'BOARDED') {
      markAttendance.mutate({ tripId, studentId: rider.studentId, type: 'BOARDED' });
    } else {
      // NOT_BOARDED is local-only until Phase 4 adds the endpoint
      setLocalOverrides((prev) => ({ ...prev, [rider.studentId]: 'NOT_BOARDED' }));
    }
  };

  const markedCount = riders.filter((r) => {
    const s = getStatus(r);
    return s === 'BOARDED' || s === 'NOT_BOARDED';
  }).length;
  const allMarked = riders.length > 0 && markedCount === riders.length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Stop Attendance</Text>
            <Text style={styles.sub}>Loading roster…</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>
        <LoadingSpinner fullScreen />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Stop Attendance</Text>
          <View style={{ width: 60 }} />
        </View>
        <EmptyState title="Could not load roster" description="Check your connection and try again" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Stop Attendance</Text>
          <Text style={styles.sub}>
            {stopRoster?.stopName ?? stopId} · {markedCount}/{riders.length} marked
          </Text>
        </View>
        <TouchableOpacity
          style={styles.photoBtn}
          onPress={() => router.push(`/(app)/trip/attendance/photo?stopId=${stopId}&tripId=${tripId}` as never)}
        >
          <Text style={{ fontSize: 20 }}>📷</Text>
          <Text style={styles.photoBtnText}>Photo</Text>
        </TouchableOpacity>
      </View>

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
            <Card style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.studentName[0]}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.studentName}</Text>
                  {status === 'CANCELLED' && (
                    <Text style={styles.cancelled}>Pickup cancelled</Text>
                  )}
                </View>
                {status !== 'CANCELLED' && (
                  <View style={styles.btns}>
                    <TouchableOpacity
                      style={[styles.markBtn, status === 'BOARDED' && styles.boardedActive]}
                      onPress={() => handleMark(item, 'BOARDED')}
                      disabled={markAttendance.isPending}
                    >
                      <Text style={[styles.markText, status === 'BOARDED' && styles.markTextActive]}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.markBtn, status === 'NOT_BOARDED' && styles.absentActive]}
                      onPress={() => handleMark(item, 'NOT_BOARDED')}
                    >
                      <Text style={[styles.markText, status === 'NOT_BOARDED' && styles.markTextActive]}>✗</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />

      <View style={styles.footer}>
        <Button
          title={allMarked ? 'Confirm Attendance' : `Mark all (${riders.length - markedCount} remaining)`}
          onPress={() => router.back()}
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
    padding: spacing[4], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },
  photoBtn: { alignItems: 'center', gap: 2 },
  photoBtnText: { fontSize: fontSizes.xs, color: colors.textSecondary },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: fontWeights.bold, fontSize: fontSizes.base },
  info: { flex: 1 },
  name: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  cancelled: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  btns: { flexDirection: 'row', gap: spacing[2] },
  markBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.border,
  },
  boardedActive: { backgroundColor: '#D1FAE5', borderColor: colors.success },
  absentActive: { backgroundColor: '#FEE2E2', borderColor: colors.error },
  markText: { fontSize: 18, color: colors.textSecondary },
  markTextActive: { fontWeight: fontWeights.bold },
  footer: { padding: spacing[4], backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
});

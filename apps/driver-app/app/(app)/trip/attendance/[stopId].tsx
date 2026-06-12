import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Button } from '@saarthi/ui';

const MOCK_ROSTER = [
  { id: 'r1', name: 'Arjun Sharma', class: 'Grade 4-B', status: null as 'BOARDED' | 'NOT_BOARDED' | null },
  { id: 'r2', name: 'Riya Gupta', class: 'Grade 3-A', status: null as 'BOARDED' | 'NOT_BOARDED' | null },
  { id: 'r3', name: 'Rohan Yadav', class: 'Grade 5-C', status: null as 'BOARDED' | 'NOT_BOARDED' | null },
  { id: 'r4', name: 'Priya Singh', class: 'Grade 2-B', status: null as 'BOARDED' | 'NOT_BOARDED' | null },
];

export default function AttendanceScreen() {
  const { stopId, tripId } = useLocalSearchParams<{ stopId: string; tripId: string }>();
  const [roster, setRoster] = useState(MOCK_ROSTER);

  const mark = (id: string, status: 'BOARDED' | 'NOT_BOARDED') =>
    setRoster((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  const marked = roster.filter((r) => r.status !== null).length;
  const allMarked = marked === roster.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Stop Attendance</Text>
          <Text style={styles.sub}>Stop: {stopId} · {marked}/{roster.length} marked</Text>
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
        data={roster}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.class}>{item.class}</Text>
              </View>
              <View style={styles.btns}>
                <TouchableOpacity
                  style={[styles.markBtn, item.status === 'BOARDED' && styles.boardedActive]}
                  onPress={() => mark(item.id, 'BOARDED')}
                >
                  <Text style={[styles.markText, item.status === 'BOARDED' && styles.markTextActive]}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.markBtn, item.status === 'NOT_BOARDED' && styles.absentActive]}
                  onPress={() => mark(item.id, 'NOT_BOARDED')}
                >
                  <Text style={[styles.markText, item.status === 'NOT_BOARDED' && styles.markTextActive]}>✗</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
      />

      <View style={styles.footer}>
        <Button
          title={allMarked ? 'Confirm Attendance' : `Mark all (${roster.length - marked} remaining)`}
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
  class: { fontSize: fontSizes.xs, color: colors.textSecondary },
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

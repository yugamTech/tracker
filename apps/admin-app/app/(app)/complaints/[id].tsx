import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';
import { useComplaintById, useUpdateComplaintStatus } from '@saarthi/api-client';

const STATUS_FLOW = ['RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
type ComplaintStatus = typeof STATUS_FLOW[number];

const STATUS_V: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'default',
};

const EVENT_COLORS: Record<string, string> = {
  RECEIVED: colors.gray400,
  IN_PROGRESS: '#F59E0B',
  RESOLVED: '#10B981',
  ESCALATED: '#EF4444',
  CLOSED: colors.gray400,
};

export default function AdminComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: complaint, isLoading, isError } = useComplaintById(id ?? '');
  const { mutate: updateStatus, isPending } = useUpdateComplaintStatus();

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !complaint) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Complaint</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Complaint not found.</Text>
        </View>
      </View>
    );
  }

  const events = (complaint as any).events ?? [];
  const student = (complaint as any).student;
  const currentIdx = STATUS_FLOW.indexOf(complaint.status as ComplaintStatus);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1]
    : null;

  const handleStatusChange = (toStatus: string) => {
    Alert.alert(
      'Update Status',
      `Move to ${toStatus.replace('_', ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () =>
            updateStatus(
              { id: complaint.id, status: toStatus },
              {
                onError: () => Alert.alert('Error', 'Failed to update status. Please try again.'),
              },
            ),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Complaint #{id?.slice(-4) ?? 'Detail'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info card */}
        <Card>
          <View style={styles.row}>
            <Text style={styles.category}>{complaint.category.replace('_', ' ')}</Text>
            <Badge label={complaint.status.replace('_', ' ')} variant={STATUS_V[complaint.status] ?? 'default'} size="sm" />
          </View>
          <Text style={styles.description}>{complaint.description ?? '—'}</Text>
          {student && (
            <Text style={styles.meta}>Student: {student.name ?? student.id}</Text>
          )}
          <Text style={styles.meta}>
            Filed: {new Date(complaint.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Card>

        {/* Status transition controls */}
        <Card>
          <Text style={styles.sectionLabel}>Update Status</Text>
          <View style={styles.statusButtons}>
            {STATUS_FLOW.filter((s) => s !== complaint.status).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  s === nextStatus && styles.statusBtnPrimary,
                  isPending && styles.statusBtnDisabled,
                ]}
                onPress={() => handleStatusChange(s)}
                disabled={isPending}
              >
                <Text style={[styles.statusBtnText, s === nextStatus && styles.statusBtnTextPrimary]}>
                  {s.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Event log */}
        {events.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Event Log</Text>
            <View style={styles.timeline}>
              {events.map((ev: any, idx: number) => (
                <View key={ev.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: EVENT_COLORS[ev.toStatus] ?? colors.gray400 }]} />
                    {idx < events.length - 1 && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineType}>{ev.toStatus.replace('_', ' ')}</Text>
                    {ev.note ? <Text style={styles.timelineNote}>{ev.note}</Text> : null}
                    <Text style={styles.timelineTime}>
                      {new Date(ev.ts ?? ev.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5], backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  content: { padding: spacing[4], gap: spacing[4] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  category: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  description: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22 },
  meta: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2] },
  sectionLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statusBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  statusBtnPrimary: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  statusBtnDisabled: { opacity: 0.5 },
  statusBtnText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  statusBtnTextPrimary: { color: colors.primary, fontWeight: fontWeights.semibold },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: spacing[3] },
  timelineLine: { alignItems: 'center', width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  timelineBody: { flex: 1, paddingBottom: spacing[4], gap: 2 },
  timelineType: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.textSecondary, textTransform: 'uppercase' },
  timelineNote: { fontSize: fontSizes.sm, color: colors.textPrimary },
  timelineTime: { fontSize: fontSizes.xs, color: colors.textMuted },
});

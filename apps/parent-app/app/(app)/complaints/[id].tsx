import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge, Button } from '@saarthi/ui';

const MOCK_COMPLAINT = {
  id: 'complaint-004',
  category: 'Late Arrival',
  description: 'Bus was 25 minutes late on June 10th morning pickup. No notification was sent.',
  status: 'RESOLVED',
  createdAt: 'Jun 10, 08:15 AM',
  resolvedAt: 'Jun 11, 02:30 PM',
  assignedTo: 'Transport Coordinator',
  events: [
    { id: 'ev1', type: 'CREATED', note: 'Complaint submitted', time: 'Jun 10, 08:15 AM' },
    { id: 'ev2', type: 'ASSIGNED', note: 'Assigned to Transport Coordinator', time: 'Jun 10, 09:00 AM' },
    { id: 'ev3', type: 'IN_PROGRESS', note: 'Investigating route delay', time: 'Jun 10, 11:30 AM' },
    { id: 'ev4', type: 'RESOLVED', note: 'Route timing has been adjusted. Apologies for the delay.', time: 'Jun 11, 02:30 PM' },
  ],
};

const EVENT_COLORS: Record<string, string> = {
  CREATED: colors.gray400,
  ASSIGNED: '#0EA5E9',
  IN_PROGRESS: '#F59E0B',
  RESOLVED: '#10B981',
  ESCALATED: '#EF4444',
};

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const complaint = MOCK_COMPLAINT;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Complaint #{id?.slice(-4) ?? 'Detail'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status card */}
        <Card>
          <View style={styles.statusRow}>
            <Text style={styles.category}>{complaint.category}</Text>
            <Text style={[styles.status, { color: complaint.status === 'RESOLVED' ? colors.success : colors.warning }]}>
              {complaint.status}
            </Text>
          </View>
          <Text style={styles.description}>{complaint.description}</Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>Filed: {complaint.createdAt}</Text>
            {complaint.resolvedAt && <Text style={styles.metaText}>Resolved: {complaint.resolvedAt}</Text>}
          </View>
        </Card>

        {/* Resolution timeline */}
        <Text style={styles.sectionTitle}>Resolution Timeline</Text>
        <View style={styles.timeline}>
          {complaint.events.map((ev, idx) => (
            <View key={ev.id} style={styles.timelineItem}>
              <View style={styles.timelineLine}>
                <View style={[styles.timelineDot, { backgroundColor: EVENT_COLORS[ev.type] ?? colors.gray400 }]} />
                {idx < complaint.events.length - 1 && <View style={styles.timelineConnector} />}
              </View>
              <View style={styles.timelineBody}>
                <Text style={styles.timelineType}>{ev.type.replace('_', ' ')}</Text>
                <Text style={styles.timelineNote}>{ev.note}</Text>
                <Text style={styles.timelineTime}>{ev.time}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Rate resolution CTA */}
        {complaint.status === 'RESOLVED' && (
          <View style={styles.ratingCta}>
            <Text style={styles.ratingCtaText}>How was the resolution?</Text>
            <Button
              title="Rate Resolution"
              onPress={() => router.push(`/(app)/ratings/resolution/${id ?? complaint.id}` as never)}
              size="lg"
              fullWidth
            />
          </View>
        )}
      </ScrollView>
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
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  content: { padding: spacing[4], gap: spacing[4] },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
  category: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  status: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold },
  description: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22 },
  meta: { marginTop: spacing[3], gap: spacing[1] },
  metaText: { fontSize: fontSizes.xs, color: colors.textMuted },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: spacing[3] },
  timelineLine: { alignItems: 'center', width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  timelineBody: { flex: 1, paddingBottom: spacing[4], gap: 2 },
  timelineType: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.textSecondary, textTransform: 'uppercase' },
  timelineNote: { fontSize: fontSizes.sm, color: colors.textPrimary },
  timelineTime: { fontSize: fontSizes.xs, color: colors.textMuted },
  ratingCta: {
    backgroundColor: '#F0F4FF', borderRadius: radius.xl, padding: spacing[5],
    gap: spacing[3], borderWidth: 1, borderColor: '#C7D2FE',
  },
  ratingCtaText: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, textAlign: 'center' },
});

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Button, Skeleton, EmptyState, AppHeader } from '@saarthi/ui';
import { useComplaintById } from '@saarthi/api-client';
import { goBackTo } from '../../../lib/nav';

const EVENT_COLORS: Record<string, string> = {
  RECEIVED: colors.gray400,
  ASSIGNED: '#0EA5E9',
  IN_PROGRESS: '#F59E0B',
  RESOLVED: '#10B981',
  ESCALATED: '#EF4444',
  CLOSED: colors.gray400,
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  RECEIVED: colors.warning,
  IN_PROGRESS: '#F59E0B',
  RESOLVED: colors.success,
  CLOSED: colors.textMuted,
};

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: complaint, isLoading, isError } = useComplaintById(id ?? '');
  const back = () => goBackTo('complaints/[id]');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title="Complaint" onBack={back} />
        <View style={styles.content}>
          <Card>
            <Skeleton width="45%" height={16} />
            <Skeleton width="100%" height={40} style={{ marginTop: spacing[3] }} />
            <Skeleton width="60%" height={12} style={{ marginTop: spacing[3] }} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !complaint) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title="Complaint" onBack={back} />
        <EmptyState title="Complaint not found" description="This complaint could not be loaded." />
      </SafeAreaView>
    );
  }

  const events = (complaint as any).events ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title={`Complaint #${id?.slice(-4) ?? ''}`} onBack={back} />

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.statusRow}>
            <Text style={styles.category}>{complaint.category.replace('_', ' ')}</Text>
            <Text style={[styles.status, { color: STATUS_TEXT_COLORS[complaint.status] ?? colors.textSecondary }]}>
              {complaint.status.replace('_', ' ')}
            </Text>
          </View>
          <Text style={styles.description}>{complaint.description ?? '—'}</Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>
              Filed: {new Date(complaint.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </Card>

        {events.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Resolution Timeline</Text>
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
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
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
    backgroundColor: colors.primaryBg, borderRadius: radius.xl, padding: spacing[5],
    gap: spacing[3], borderWidth: 1, borderColor: '#C7D2FE',
  },
  ratingCtaText: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, textAlign: 'center' },
});

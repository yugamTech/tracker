import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing,
  AppHeader, Card, Badge, Button, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import { useMyComplaints } from '@saarthi/api-client';
import type { BadgeVariant } from '@saarthi/ui';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  RECEIVED: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'default',
};

export default function ComplaintsScreen() {
  const { data: complaints = [], isLoading } = useMyComplaints();

  const newButton = (
    <Button title="+ New" size="sm" onPress={() => router.push('/(app)/complaints/new' as never)} />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        title="Help"
        subtitle={!isLoading ? `${complaints.length} ${complaints.length === 1 ? 'issue' : 'issues'}` : undefined}
        right={newButton}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} shadow="sm">
              <Skeleton width="40%" height={14} />
              <Skeleton width="90%" height={13} style={{ marginTop: spacing[3] }} />
              <Skeleton width="25%" height={11} style={{ marginTop: spacing[3] }} />
            </Card>
          ))}
        </View>
      ) : complaints.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Text style={{ fontSize: 40 }}>💬</Text>}
            title="No issues raised"
            description="Raise an issue if something needs attention"
            action={<Button title="Raise an issue" onPress={() => router.push('/(app)/complaints/new' as never)} />}
          />
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => router.push(`/(app)/complaints/${item.id}` as never)}
              scaleTo={0.985}
            >
              <Card shadow="sm">
                <View style={styles.cardTop}>
                  <Text style={styles.category}>{item.category.replace(/_/g, ' ')}</Text>
                  <Badge label={item.status.replace(/_/g, ' ')} variant={STATUS_VARIANT[item.status] ?? 'default'} size="sm" />
                </View>
                <Text style={styles.desc} numberOfLines={2}>{item.description ?? '—'}</Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </Card>
            </AnimatedPressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2] },
  category: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary, letterSpacing: letterSpacing.tight, textTransform: 'capitalize' },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  date: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2] },
  emptyWrap: { flex: 1, minHeight: 360 },
});

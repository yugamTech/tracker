import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Card, Badge } from '@saarthi/ui';
import { useAllComplaints } from '@saarthi/api-client';

const STATUS_V: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'default',
};

export default function AdminComplaintsScreen() {
  const { data: complaints = [], isLoading } = useAllComplaints();

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={complaints}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: colors.textSecondary }}>No complaints yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/(app)/complaints/${item.id}` as never)}>
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
                <Badge label={item.status.replace('_', ' ')} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
              </View>
              <Text style={styles.desc}>{item.description ?? '—'}</Text>
              <View style={styles.footer}>
                <Text style={styles.student}>
                  {(item as any).student ? `👤 ${(item as any).student.name ?? ''}` : ''}
                </Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  category: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[3] },
  student: { fontSize: fontSizes.xs, color: colors.textMuted },
  date: { fontSize: fontSizes.xs, color: colors.textMuted },
});

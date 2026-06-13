import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Card, Badge, Button, EmptyState } from '@saarthi/ui';
import { useMyComplaints } from '@saarthi/api-client';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  RECEIVED: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'default',
};

export default function ComplaintsScreen() {
  const { data: complaints = [], isLoading } = useMyComplaints();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Complaints</Text>
          <Text style={styles.subtitle}>{complaints.length} total</Text>
        </View>
        <Button title="+ New" size="sm" onPress={() => router.push('/(app)/complaints/new' as never)} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No complaints yet"
          description="Raise an issue if something needs attention"
          action={<Button title="Raise Issue" onPress={() => router.push('/(app)/complaints/new' as never)} />}
        />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/complaints/${item.id}` as never)} activeOpacity={0.85}>
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
                  <Badge label={item.status.replace('_', ' ')} variant={STATUS_COLORS[item.status] ?? 'default'} size="sm" />
                </View>
                <Text style={styles.desc}>{item.description ?? '—'}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  category: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  date: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing[2] },
});

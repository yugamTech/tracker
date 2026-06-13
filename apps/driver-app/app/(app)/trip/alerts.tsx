import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, EmptyState } from '@saarthi/ui';
import { useDriverMessages } from '@saarthi/api-client';
import type { DriverMessage } from '@saarthi/api-client';

const MESSAGE_LABELS: Record<string, string> = {
  RUNNING_LATE: 'Running 2–3 min late to the stop',
  NOT_COMING_TODAY: 'Child is not coming today',
  PLEASE_WAIT: 'Please wait at the stop',
  DIFFERENT_STOP: 'Child is at a different stop today',
};

const MESSAGE_ICONS: Record<string, string> = {
  RUNNING_LATE: '⏳',
  NOT_COMING_TODAY: '🚫',
  PLEASE_WAIT: '🙏',
  DIFFERENT_STOP: '📍',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function InTripAlertsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: messages, isLoading } = useDriverMessages(tripId ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Parent Alerts</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !messages?.length ? (
        <EmptyState
          title="No messages"
          description="Parent messages will appear here during the trip"
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m: DriverMessage) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: DriverMessage }) => (
            <View style={styles.card}>
              <Text style={styles.icon}>{MESSAGE_ICONS[item.messageKey] ?? '💬'}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.sender}>{item.sender?.name ?? 'Parent'}</Text>
                <Text style={styles.message}>
                  {MESSAGE_LABELS[item.messageKey] ?? item.messageKey}
                </Text>
              </View>
              <Text style={styles.time}>{formatTime(item.sentAt)}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[5],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  list: { paddingVertical: spacing[2] },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.white,
  },
  icon: { fontSize: 28, marginTop: 2 },
  cardBody: { flex: 1 },
  sender: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  message: { fontSize: fontSizes.base, color: colors.textPrimary, lineHeight: 22 },
  time: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 4 },
  separator: { height: 1, backgroundColor: colors.border },
});

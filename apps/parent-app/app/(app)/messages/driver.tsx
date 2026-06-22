import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, useToast } from '@saarthi/ui';
import { useSendDriverMessage } from '@saarthi/api-client';

const MESSAGE_OPTIONS = [
  { key: 'RUNNING_LATE', icon: '⏳', label: 'Running late to stop', description: 'Running 2–3 min late to the stop' },
  { key: 'NOT_COMING_TODAY', icon: '🚫', label: 'Not coming today', description: 'Child is not coming today' },
  { key: 'PLEASE_WAIT', icon: '🙏', label: 'Please wait', description: 'Please wait at the stop' },
  { key: 'DIFFERENT_STOP', icon: '📍', label: 'Different stop', description: 'Child is at a different stop today' },
] as const;

type MessageKey = (typeof MESSAGE_OPTIONS)[number]['key'];

const COOLDOWN_MS = 30_000;

export default function MessageDriverScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { mutate: send, isPending, variables: pendingVars } = useSendDriverMessage();
  const toast = useToast();

  // Per-key cooldown: key → timestamp when cooldown expires
  const [cooldowns, setCooldowns] = useState<Partial<Record<MessageKey, number>>>({});
  const [now, setNow] = useState(Date.now());

  // Tick every second to re-render cooldown countdowns.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback(
    (key: MessageKey) => {
      if (!tripId) return;
      send(
        { tripId, messageKey: key },
        {
          onSuccess: () => {
            setCooldowns((prev) => ({ ...prev, [key]: Date.now() + COOLDOWN_MS }));
            toast.success('Message sent to the driver.');
          },
          onError: (e: any) =>
            toast.error(e?.response?.data?.message ?? 'Could not send message. Please try again.'),
        },
      );
    },
    [tripId, send],
  );

  const isCooling = (key: MessageKey) => {
    const exp = cooldowns[key];
    return exp !== undefined && now < exp;
  };

  const secsLeft = (key: MessageKey) => {
    const exp = cooldowns[key];
    return exp ? Math.ceil((exp - now) / 1000) : 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.back}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Message Driver</Text>
        <View style={{ width: 32 }} />
      </View>
      <Text style={styles.hint}>Tap a message to send it to the driver</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {MESSAGE_OPTIONS.map((opt) => {
          const sending =
            isPending &&
            (pendingVars as { messageKey: string } | undefined)?.messageKey === opt.key;
          const cooling = isCooling(opt.key);
          const disabled = sending || cooling;

          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.card, disabled && styles.cardDisabled]}
              activeOpacity={0.8}
              disabled={disabled}
              onPress={() => handleSend(opt.key)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityHint={opt.description}
              accessibilityState={{ disabled }}
            >
              <Text style={styles.icon}>{opt.icon}</Text>
              <View style={styles.cardBody}>
                <Text style={[styles.cardLabel, disabled && styles.textMuted]}>{opt.label}</Text>
                <Text style={[styles.cardDesc, disabled && styles.textMuted]}>{opt.description}</Text>
              </View>
              {sending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : cooling ? (
                <Text style={styles.cooldown}>Wait {secsLeft(opt.key)}s</Text>
              ) : (
                <Text style={styles.sendArrow}>Send →</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 20, color: colors.textSecondary, width: 32 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.gray50,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDisabled: { opacity: 0.55 },
  icon: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardLabel: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  cardDesc: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  textMuted: { color: colors.textMuted },
  sendArrow: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  cooldown: { fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.medium },
});

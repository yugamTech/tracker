import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button } from '@saarthi/ui';

const MESSAGE_CATEGORIES = [
  {
    category: 'Pickup',
    messages: [
      { id: 'm1', icon: '🚫', text: 'Cancel pickup today — Arjun is absent' },
      { id: 'm2', icon: '⏳', text: 'Running 5 minutes late — please wait' },
      { id: 'm3', icon: '📍', text: 'We are at the stop' },
    ],
  },
  {
    category: 'Drop-off',
    messages: [
      { id: 'm4', icon: '🏠', text: 'Different drop point today — please call' },
      { id: 'm5', icon: '👨‍👩‍👧', text: 'Guardian will collect at school gate' },
    ],
  },
  {
    category: 'Emergency',
    messages: [
      { id: 'm6', icon: '🆘', text: 'Please call me urgently' },
      { id: 'm7', icon: '🏥', text: 'Medical emergency — stop the bus' },
    ],
  },
];

export default function MessageDriverScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.success}>
          <Text style={{ fontSize: 56 }}>📤</Text>
          <Text style={styles.successTitle}>Message sent</Text>
          <Text style={styles.successSub}>The driver will see your message on their screen.</Text>
          <Button title="Done" onPress={() => router.back()} fullWidth size="lg" style={{ marginTop: spacing[6] }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Message Driver</Text>
        <View style={{ width: 32 }} />
      </View>
      <Text style={styles.hint}>Select a quick message to send to the driver</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {MESSAGE_CATEGORIES.map((cat) => (
          <View key={cat.category} style={styles.section}>
            <Text style={styles.category}>{cat.category}</Text>
            {cat.messages.map((msg) => (
              <TouchableOpacity
                key={msg.id}
                style={styles.msgCard}
                activeOpacity={0.85}
                onPress={() => setSent(msg.text)}
              >
                <Text style={styles.msgIcon}>{msg.icon}</Text>
                <Text style={styles.msgText}>{msg.text}</Text>
                <Text style={styles.send}>Send →</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: 20, color: colors.textSecondary, width: 32 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  list: { padding: spacing[4], gap: spacing[4] },
  section: { gap: spacing[2] },
  category: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  msgCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.gray50, borderRadius: radius.xl,
    padding: spacing[4], borderWidth: 1, borderColor: colors.border,
  },
  msgIcon: { fontSize: 24 },
  msgText: { flex: 1, fontSize: fontSizes.base, color: colors.textPrimary },
  send: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.semibold },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  successTitle: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing[4] },
  successSub: { fontSize: fontSizes.base, color: colors.textSecondary, marginTop: spacing[2], textAlign: 'center' },
});

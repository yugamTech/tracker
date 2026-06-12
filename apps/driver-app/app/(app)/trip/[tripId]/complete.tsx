import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Button } from '@saarthi/ui';

export default function TripCompleteScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Trip Complete!</Text>
        <Text style={styles.subtitle}>Great job. All stops covered successfully.</Text>

        <View style={styles.stats}>
          {[
            { label: 'Total Riders', value: '22' },
            { label: 'Boarded', value: '20' },
            { label: 'Not Boarded', value: '2' },
            { label: 'Duration', value: '48 min' },
          ].map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Button
          title="Back to Home"
          onPress={() => router.replace('/(app)/home')}
          fullWidth
          size="lg"
          style={{ marginTop: spacing[6] }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[4] },
  emoji: { fontSize: 72 },
  title: { fontSize: fontSizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center', marginTop: spacing[4] },
  statItem: {
    width: '44%', padding: spacing[4], borderRadius: 16,
    backgroundColor: colors.gray50, alignItems: 'center', gap: spacing[1],
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.primary },
  statLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
});

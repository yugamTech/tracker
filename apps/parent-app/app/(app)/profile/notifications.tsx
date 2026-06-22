import React from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights } from '@saarthi/ui';
import { useNotificationPreferences, useUpdatePreferences } from '@saarthi/api-client';

const PREF_ROWS = [
  { category: 'TRIP_START', label: 'Trip started', description: 'When the bus begins its route' },
  { category: 'TRIP_END', label: 'Trip completed', description: 'When the bus finishes its route' },
  { category: 'BOARDING', label: 'Child boarded', description: 'When your child gets on the bus' },
  { category: 'COMPLAINT_UPDATE', label: 'Complaint updates', description: 'When your complaint status changes' },
  { category: 'PAYMENT_DUE', label: 'Payment reminders', description: 'When a fee invoice is due' },
];

export default function NotificationPrefsScreen() {
  const { data: prefs = [], isLoading } = useNotificationPreferences();
  const { mutate: updatePrefs } = useUpdatePreferences();

  const getPush = (category: string) => {
    const row = prefs.find((p) => p.category === category);
    return row ? row.push : true; // default on if no pref row
  };

  const handleToggle = (category: string, push: boolean) => {
    updatePrefs([{ category, push }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notification Preferences</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionLabel}>PUSH NOTIFICATIONS</Text>
          {PREF_ROWS.map((row, i) => (
            <View
              key={row.category}
              style={[styles.row, i < PREF_ROWS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowDesc}>{row.description}</Text>
              </View>
              <Switch
                value={getPush(row.category)}
                onValueChange={(v) => handleToggle(row.category, v)}
                trackColor={{ false: colors.gray200, true: colors.primary }}
                thumbColor={colors.white}
                accessibilityLabel={`${row.label} push notifications`}
              />
            </View>
          ))}

          <Text style={[styles.sectionLabel, { marginTop: spacing[6] }]}>SMS & WHATSAPP</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
            <Text style={styles.comingSoonDesc}>
              SMS and WhatsApp alerts will be available once template approvals are complete.
            </Text>
          </View>
        </ScrollView>
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
    padding: spacing[4],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium, width: 60 },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  list: { paddingVertical: spacing[4] },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.white,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, paddingRight: spacing[4] },
  rowLabel: { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.textPrimary },
  rowDesc: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2 },
  comingSoon: {
    backgroundColor: colors.white,
    marginHorizontal: spacing[4],
    borderRadius: 10,
    padding: spacing[4],
  },
  comingSoonText: { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.textMuted },
  comingSoonDesc: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing[1] },
});

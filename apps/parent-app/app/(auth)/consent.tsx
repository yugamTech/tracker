import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, Button } from '@yaanam/ui';

export default function ConsentScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacy Consent</Text>
      <Text style={styles.subtitle}>As required under DPDP Act 2023</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data We Collect</Text>
          <Text style={styles.body}>
            • Your child's real-time location during school trips{'\n'}
            • Boarding and alighting timestamps{'\n'}
            • Your phone number for OTP verification{'\n'}
            • Device tokens for push notifications
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Use It</Text>
          <Text style={styles.body}>
            • To show you live bus location on the map{'\n'}
            • To send you boarding/alighting alerts{'\n'}
            • To generate attendance records for the school{'\n'}
            • We never sell your data to third parties
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.body}>
            • Access your data anytime from Profile{'\n'}
            • Request deletion via Settings → Privacy{'\n'}
            • Withdraw consent (account will be deactivated)
          </Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="I Agree & Continue" onPress={() => router.replace('/(app)/child-select' as never)} fullWidth size="lg" />
        <Button title="Decline" variant="ghost" onPress={() => router.back()} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing[6] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing[8] },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing[4] },
  scroll: { flex: 1 },
  section: { marginBottom: spacing[6] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: spacing[2] },
  body: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22 },
  actions: { gap: spacing[2], paddingTop: spacing[4] },
});

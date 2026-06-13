import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState } from '@saarthi/ui';

export default function ComplaintKpiScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        title="Complaint analytics coming soon"
        description="SLA health, by-driver/route breakdowns, and resolution ratings are being built in a later phase"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
});

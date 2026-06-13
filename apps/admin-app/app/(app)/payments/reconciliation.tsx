import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState } from '@saarthi/ui';

export default function ReconciliationScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        title="Payment reconciliation coming soon"
        description="Gateway mismatch queue and reconciliation tools are being built in Phase 5"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
});

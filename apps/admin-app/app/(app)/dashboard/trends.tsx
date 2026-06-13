import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState } from '@saarthi/ui';

export default function TrendsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        title="Trend charts coming soon"
        description="7-day boarding rate, on-time trips, and collection % charts are being built in Phase 6"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
});

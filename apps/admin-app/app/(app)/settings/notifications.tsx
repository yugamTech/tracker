import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, EmptyState } from '@saarthi/ui';

export default function NotificationSettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        title="Notification audit coming soon"
        description="Authority numbers, alert configuration, and delivery audit are being built in Phase 4"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
});

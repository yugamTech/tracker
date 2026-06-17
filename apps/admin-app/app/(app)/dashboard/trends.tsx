import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, EmptyState } from '@saarthi/ui';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { SUBNAV } from '../../../lib/nav';

export default function TrendsScreen() {
  return (
    <AdminScreen
      title="Dashboard"
      subtitle="Trends & analytics"
      subnav={<SubNav segments={SUBNAV.dashboard} value="trends" />}
    >
      <View style={styles.body}>
        <EmptyState
          icon={<View style={styles.icon}><Text style={styles.iconGlyph}>📈</Text></View>}
          title="Trend charts coming soon"
          description="7-day boarding rate, on-time trips, and collection % will appear here in Phase 6."
        />
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  icon: {
    width: 64, height: 64, borderRadius: radius.xl,
    backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  iconGlyph: { fontSize: 30 },
});

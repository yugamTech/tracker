import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, fontWeights } from '@saarthi/ui';

export default function FleetMapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <Text style={{ fontSize: 72 }}>🗺️</Text>
        <Text style={styles.title}>Live Fleet Map</Text>
        <Text style={styles.sub}>3 buses currently active</Text>
        <View style={styles.busCards}>
          {[
            { bus: 'HR26-DL-9900', route: 'Route A', lat: 28.5678, lng: 77.3234 },
            { bus: 'HR26-DL-9901', route: 'Route B', lat: 28.4923, lng: 77.0893 },
            { bus: 'HR26-DL-9902', route: 'Route C', lat: 28.5123, lng: 77.2134 },
          ].map((b) => (
            <View key={b.bus} style={styles.busCard}>
              <Text style={styles.busIcon}>🚌</Text>
              <View>
                <Text style={styles.busNum}>{b.bus}</Text>
                <Text style={styles.busRoute}>{b.route}</Text>
                <Text style={styles.busCords}>{b.lat.toFixed(3)}, {b.lng.toFixed(3)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  mapArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.primary },
  sub: { fontSize: fontSizes.sm, color: colors.textSecondary },
  busCards: { width: '100%', padding: spacing[4], gap: spacing[3] },
  busCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.white, padding: spacing[4],
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  busIcon: { fontSize: 32 },
  busNum: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  busRoute: { fontSize: fontSizes.sm, color: colors.textSecondary },
  busCords: { fontSize: fontSizes.xs, color: colors.textMuted },
});

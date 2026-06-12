import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function VehicleDetailScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vehicle Detail</Text>
      <Text style={styles.id}>Vehicle: {vehicleId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  id: { fontSize: 13, color: '#888', marginTop: 8 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip Detail</Text>
      <Text style={styles.sub}>Stops · timing · attendance</Text>
      <Text style={styles.id}>Trip: {tripId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', marginTop: 4 },
  id: { fontSize: 13, color: '#888', marginTop: 8 },
});

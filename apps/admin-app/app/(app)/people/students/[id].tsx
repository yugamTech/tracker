import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student Detail</Text>
      <Text style={styles.sub}>Guardians · route · fee status</Text>
      <Text style={styles.id}>Student: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', marginTop: 4 },
  id: { fontSize: 13, color: '#888', marginTop: 8 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NewStudentScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Student</Text>
      <Text style={styles.sub}>Single-record student creation</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', marginTop: 4 },
});

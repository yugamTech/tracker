import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StaffScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff</Text>
      <Text style={styles.sub}>Drivers · conductors · admins</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', marginTop: 4 },
});

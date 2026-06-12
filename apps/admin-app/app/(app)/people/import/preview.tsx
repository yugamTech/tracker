import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ImportPreviewScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Preview</Text>
      <Text style={styles.sub}>Dry-run: X to create · Y errors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', marginTop: 4 },
});

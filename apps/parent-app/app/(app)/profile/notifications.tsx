import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NotificationPrefsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Preferences</Text>
      <Text style={styles.sub}>Per-category push · SMS · WhatsApp settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', marginTop: 4 },
});

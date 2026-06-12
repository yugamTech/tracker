import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';

const MOCK_TRIPS = [
  { id: 't1', date: 'Today, Jun 9', direction: 'PICKUP', status: 'COMPLETED', route: 'Route A', boardStatus: 'BOARDED' },
  { id: 't2', date: 'Yesterday, Jun 8', direction: 'DROP', status: 'COMPLETED', route: 'Route A', boardStatus: 'BOARDED' },
  { id: 't3', date: 'Jun 7', direction: 'PICKUP', status: 'COMPLETED', route: 'Route A', boardStatus: 'NOT_BOARDED' },
  { id: 't4', date: 'Jun 6', direction: 'DROP', status: 'COMPLETED', route: 'Route A', boardStatus: 'BOARDED' },
];

export default function TripsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <Text style={styles.subtitle}>Last 30 days</Text>
      </View>
      <FlatList
        data={MOCK_TRIPS}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => {}} activeOpacity={0.85}>
            <Card style={styles.card}>
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.date}>{item.date}</Text>
                  <Text style={styles.route}>{item.route} • {item.direction}</Text>
                </View>
                <Badge
                  label={item.boardStatus === 'BOARDED' ? 'Boarded' : 'Absent'}
                  variant={item.boardStatus === 'BOARDED' ? 'boarded' : 'not_boarded'}
                  size="sm"
                />
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { padding: spacing[5], backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing[1] },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  route: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button } from '@saarthi/ui';

const CATEGORIES = [
  { id: 'TIMING', label: 'Timing', icon: '⏰' },
  { id: 'BEHAVIOUR', label: 'Behaviour', icon: '🚨' },
  { id: 'SAFETY', label: 'Safety', icon: '⚠️' },
  { id: 'VEHICLE_CONDITION', label: 'Vehicle', icon: '🔧' },
  { id: 'ROUTE_ISSUE', label: 'Route', icon: '🗺️' },
  { id: 'OTHER', label: 'Other', icon: '💬' },
];

export default function NewComplaintScreen() {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!category) { Alert.alert('Select a category'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Complaint Raised', 'We\'ll review and get back to you within 24 hours.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }, 800);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Raise Complaint</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>What's the issue?</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.categoryBtn, category === c.id && styles.categoryBtnActive]}
              onPress={() => setCategory(c.id)}
            >
              <Text style={{ fontSize: 28 }}>{c.icon}</Text>
              <Text style={[styles.categoryLabel, category === c.id && styles.categoryLabelActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened..."
          placeholderTextColor={colors.gray400}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Button title="Submit Complaint" onPress={handleSubmit} loading={loading} fullWidth size="lg" style={{ marginTop: spacing[4] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  content: { padding: spacing[5], gap: spacing[4] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  categoryBtn: {
    width: '30%', padding: spacing[4], borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', gap: spacing[2],
  },
  categoryBtnActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  categoryLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textAlign: 'center' },
  categoryLabelActive: { color: colors.primary, fontWeight: fontWeights.semibold },
  textarea: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing[4], fontSize: fontSizes.base, color: colors.textPrimary,
    minHeight: 100, backgroundColor: colors.gray50,
  },
});

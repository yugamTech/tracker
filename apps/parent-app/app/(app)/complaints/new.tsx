import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, useToast } from '@saarthi/ui';
import { useCreateComplaint, useFilteredTrips } from '@saarthi/api-client';

const CATEGORIES = [
  { id: 'TIMING', label: 'Timing', icon: '⏰' },
  { id: 'BEHAVIOUR', label: 'Behaviour', icon: '🚨' },
  { id: 'SAFETY', label: 'Safety', icon: '⚠️' },
  { id: 'VEHICLE_CONDITION', label: 'Vehicle', icon: '🔧' },
  { id: 'ROUTE_ISSUE', label: 'Route', icon: '🗺️' },
  { id: 'OTHER', label: 'Other', icon: '💬' },
];

/** Recent trips a parent can attach a complaint to. Newest-first, capped so the
 *  picker stays a short scroll; COMPLETED trips are included on purpose. */
const RECENT_TRIP_LIMIT = 15;

export default function NewComplaintScreen() {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  const toast = useToast();
  const { mutate: createComplaint, isPending } = useCreateComplaint();
  // The parent's own scoped trips (all statuses, newest-first) — lets them point
  // the complaint at a specific ride, including ones that already COMPLETED.
  const { data: trips = [], isLoading: tripsLoading } = useFilteredTrips({});
  const recentTrips = (trips as any[]).slice(0, RECENT_TRIP_LIMIT);

  const handleSubmit = () => {
    if (!category) { toast.error('Please select a category'); return; }
    createComplaint(
      { category: category as never, description: description || undefined, tripId: tripId ?? undefined },
      {
        onSuccess: () => {
          toast.success("We'll review and get back to you within 24 hours.", 'Complaint raised');
          router.back();
        },
        onError: () => {
          toast.error('Failed to submit complaint. Please try again.');
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Raise Complaint</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>What's the issue?</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.categoryBtn, category === c.id && styles.categoryBtnActive]}
              onPress={() => setCategory(c.id)}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityState={{ selected: category === c.id }}
            >
              <Text style={{ fontSize: 28 }}>{c.icon}</Text>
              <Text style={[styles.categoryLabel, category === c.id && styles.categoryLabelActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Which trip? (optional)</Text>
        {tripsLoading ? (
          <Text style={styles.tripHint}>Loading your recent trips…</Text>
        ) : recentTrips.length === 0 ? (
          <Text style={styles.tripHint}>No recent trips to attach. You can still file a general complaint.</Text>
        ) : (
          <View style={styles.tripList}>
            {recentTrips.map((t) => {
              const selected = tripId === t.id;
              const routeName = t.route?.name ?? 'Trip';
              const when = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              const dir = t.direction === 'PICKUP' ? 'Pickup' : 'Drop';
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tripRow, selected && styles.tripRowActive]}
                  onPress={() => setTripId(selected ? null : t.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${routeName}, ${when}, ${dir}`}
                  accessibilityState={{ selected }}
                >
                  <View style={styles.tripInfo}>
                    <Text style={[styles.tripRoute, selected && styles.tripRouteActive]} numberOfLines={1}>
                      {routeName}
                    </Text>
                    <Text style={styles.tripMeta}>{when} · {dir}{t.status === 'COMPLETED' ? ' · Completed' : ''}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioActive]}>
                    {selected ? <Text style={styles.radioDot}>✓</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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

        <Button title="Submit Complaint" onPress={handleSubmit} loading={isPending} fullWidth size="lg" style={{ marginTop: spacing[4] }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  tripHint: { fontSize: fontSizes.sm, color: colors.textSecondary },
  tripList: { gap: spacing[2] },
  tripRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  tripRowActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  tripInfo: { flex: 1 },
  tripRoute: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  tripRouteActive: { color: colors.primary },
  tripMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  radioDot: { color: colors.white, fontSize: 12, fontWeight: fontWeights.bold },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button } from '@saarthi/ui';

const STARS = [1, 2, 3, 4, 5];
const TAGS = ['On time', 'Driver was polite', 'Safe driving', 'Bus was clean', 'Good communication'];

export default function RideRatingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [rating, setRating] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag: string) =>
    setSelected((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.success}>
          <Text style={{ fontSize: 56 }}>🙏</Text>
          <Text style={styles.successTitle}>Thanks for rating!</Text>
          <Text style={styles.successSub}>Your feedback helps us improve.</Text>
          <Button title="Back to Home" onPress={() => router.replace('/(app)/home')} fullWidth size="lg" style={{ marginTop: spacing[6] }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={{ fontSize: 48, textAlign: 'center' }}>🚌</Text>
        <Text style={styles.title}>How was the ride?</Text>
        <Text style={styles.sub}>Trip {tripId ?? 'completed'} · Arjun Sharma</Text>

        <View style={styles.stars}>
          {STARS.map((s) => (
            <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
              <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && <Text style={styles.ratingLabel}>{['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}</Text>}

        {rating >= 4 && (
          <View style={styles.tags}>
            <Text style={styles.tagsTitle}>What went well?</Text>
            <View style={styles.tagRow}>
              {TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tag, selected.includes(tag) && styles.tagSelected]}
                >
                  <Text style={[styles.tagText, selected.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Button
          title="Submit Rating"
          onPress={() => setSubmitted(true)}
          fullWidth
          size="lg"
          disabled={rating === 0}
          style={{ marginTop: spacing[6] }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { alignItems: 'flex-end', padding: spacing[4] },
  skip: { padding: spacing[2] },
  skipText: { fontSize: fontSizes.sm, color: colors.textMuted },
  body: { flex: 1, padding: spacing[6], gap: spacing[4] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  star: { fontSize: 44, color: colors.gray200 },
  starActive: { color: '#F59E0B' },
  ratingLabel: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, color: colors.textPrimary, textAlign: 'center' },
  tags: { gap: spacing[3] },
  tagsTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tag: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tagSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  tagTextSelected: { color: colors.white, fontWeight: fontWeights.medium },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  successTitle: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing[4] },
  successSub: { fontSize: fontSizes.base, color: colors.textSecondary, marginTop: spacing[2] },
});

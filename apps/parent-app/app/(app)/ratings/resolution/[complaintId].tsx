import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button, useToast } from '@yaanam/ui';
import { useSubmitResolutionRating } from '@yaanam/api-client';

const STARS = [1, 2, 3, 4, 5];

export default function ResolutionRatingScreen() {
  const { complaintId } = useLocalSearchParams<{ complaintId: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  // Explicit satisfied/not — kept separate from the star count, since it drives
  // whether the complaint closes or is reopened + escalated.
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState<null | boolean>(null);
  const toast = useToast();
  const { mutate: submitRating, isPending } = useSubmitResolutionRating();

  const handleSubmit = () => {
    if (rating === 0 || satisfied === null || !complaintId) return;
    submitRating(
      { complaintId, rating, satisfied, comment: comment.trim() || undefined },
      {
        onSuccess: () => setSubmitted(satisfied),
        onError: () => toast.error('Could not submit your feedback. Please try again.'),
      },
    );
  };

  if (submitted !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.success}>
          <Text style={{ fontSize: 56 }}>{submitted ? '✅' : '🛟'}</Text>
          <Text style={styles.successTitle}>
            {submitted ? 'Feedback submitted' : "We've escalated this"}
          </Text>
          <Text style={styles.successSub}>
            {submitted
              ? 'Thank you for helping us serve you better.'
              : "Sorry this wasn't resolved. We've reopened your complaint and notified our team to follow up."}
          </Text>
          <Button title="View Complaints" onPress={() => router.replace('/(app)/complaints')} fullWidth size="lg" style={{ marginTop: spacing[6] }} />
        </View>
      </SafeAreaView>
    );
  }

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
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 48, textAlign: 'center' }}>💬</Text>
        <Text style={styles.title}>Rate the resolution</Text>
        <Text style={styles.sub}>Complaint #{complaintId?.slice(-4) ?? ''} has been resolved</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>How satisfied are you with how your complaint was handled?</Text>
          <View style={styles.stars}>
            {STARS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setRating(s)}
                activeOpacity={0.7}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${s} ${s === 1 ? 'star' : 'stars'}`}
                accessibilityState={{ selected: s <= rating }}
              >
                <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {['', 'Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'][rating]}
            </Text>
          )}
        </View>

        {/* Explicit satisfied / not-satisfied — the close vs reopen decision. */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Did this resolve your concern?</Text>
          <View style={styles.choices}>
            <TouchableOpacity
              style={[styles.choice, satisfied === true && styles.choiceYes]}
              onPress={() => setSatisfied(true)}
              accessibilityRole="button"
              accessibilityLabel="Yes, satisfied"
              accessibilityState={{ selected: satisfied === true }}
            >
              <Text style={[styles.choiceText, satisfied === true && styles.choiceTextActive]}>👍  Yes, resolved</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choice, satisfied === false && styles.choiceNo]}
              onPress={() => setSatisfied(false)}
              accessibilityRole="button"
              accessibilityLabel="No, not resolved"
              accessibilityState={{ selected: satisfied === false }}
            >
              <Text style={[styles.choiceText, satisfied === false && styles.choiceTextActive]}>👎  Not resolved</Text>
            </TouchableOpacity>
          </View>
          {satisfied === false && (
            <Text style={styles.escalateHint}>
              We'll reopen this complaint and escalate it to our team for further action.
            </Text>
          )}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Optional comments (what could be improved?)"
          placeholderTextColor={colors.textMuted}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Button
          title="Submit Feedback"
          onPress={handleSubmit}
          loading={isPending}
          fullWidth
          size="lg"
          disabled={rating === 0 || satisfied === null}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.white },
  header: { padding: spacing[5] },
  back: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: fontWeights.medium },
  body: { padding: spacing[6], gap: spacing[5] },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.gray50, borderRadius: radius.xl,
    padding: spacing[5], gap: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  cardLabel: { fontSize: fontSizes.base, color: colors.textPrimary, lineHeight: 22 },
  stars: { flexDirection: 'row', gap: spacing[3] },
  star: { fontSize: 40, color: colors.gray200 },
  starActive: { color: '#F59E0B' },
  ratingLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  choices: { flexDirection: 'row', gap: spacing[3] },
  choice: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  choiceYes: { borderColor: colors.success, backgroundColor: '#ECFDF5' },
  choiceNo: { borderColor: colors.error, backgroundColor: '#FEF2F2' },
  choiceText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  choiceTextActive: { color: colors.textPrimary, fontWeight: fontWeights.semibold },
  escalateHint: { fontSize: fontSizes.xs, color: colors.error, lineHeight: 18 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing[4], fontSize: fontSizes.base, color: colors.textPrimary,
    backgroundColor: colors.white, minHeight: 100,
  },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  successTitle: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing[4] },
  successSub: { fontSize: fontSizes.base, color: colors.textSecondary, marginTop: spacing[2], textAlign: 'center' },
});

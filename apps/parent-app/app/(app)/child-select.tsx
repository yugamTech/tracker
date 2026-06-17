import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, letterSpacing,
  Avatar, Card, Skeleton, EmptyState, AnimatedPressable, Button,
} from '@saarthi/ui';
import { useMyStudents } from '@saarthi/api-client';
import { useAuthStore } from '../../store/auth.store';
import { useChildStore } from '../../store/child.store';

/**
 * Netflix-style profile picker. Post-login landing: single-child accounts skip
 * straight to home, multi-child accounts pick whose day they're tracking. Also
 * reached from home's "Switch child" control. Faded in via the tab navigator's
 * `animation: 'fade'` for the profile-switch feel.
 */
export default function ChildSelectScreen() {
  const person = useAuthStore((s) => s.person);
  const setActiveChild = useChildStore((s) => s.setActiveChild);
  const { data: students, isLoading, isError, refetch } = useMyStudents();

  // Resolve trivial cases without ever showing the picker.
  useEffect(() => {
    if (!students) return;
    if (students.length === 1) {
      setActiveChild(students[0].id);
      router.replace('/(app)/home' as never);
    } else if (students.length === 0) {
      // Nothing to choose — home owns the empty state.
      router.replace('/(app)/home' as never);
    }
  }, [students, setActiveChild]);

  const choose = (id: string) => {
    setActiveChild(id);
    router.replace('/(app)/home' as never);
  };

  const firstName = person?.name?.split(' ')[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{firstName ? `HI, ${firstName.toUpperCase()}` : 'WELCOME'}</Text>
        <Text style={styles.title}>Who are you tracking?</Text>
        <Text style={styles.subtitle}>Choose a child to see their route, stop and live ride.</Text>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1].map((i) => (
            <Card key={i} style={styles.skeletonCard} shadow="sm">
              <Skeleton width={64} height={64} circle />
              <View style={{ flex: 1, gap: spacing[2] }}>
                <Skeleton width="55%" height={18} />
                <Skeleton width="80%" height={13} />
                <Skeleton width="45%" height={13} />
              </View>
            </Card>
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          title="Could not load profiles"
          description="Check your connection and try again"
          action={<Button title="Retry" variant="outline" onPress={() => refetch()} />}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {students?.map((child) => (
            <AnimatedPressable
              key={child.id}
              onPress={() => choose(child.id)}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={`Select ${child.name}`}
            >
              <Card style={styles.card} shadow="md">
                <Avatar name={child.name} size={64} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{child.name}</Text>
                  {child.route?.name ? (
                    <Text style={styles.metaRow} numberOfLines={1}>🛣  {child.route.name}</Text>
                  ) : null}
                  {child.stop?.name ? (
                    <Text style={styles.metaRow} numberOfLines={1}>📍  {child.stop.name}</Text>
                  ) : (
                    <Text style={styles.metaMuted}>No stop assigned</Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Card>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  intro: { paddingHorizontal: spacing[5], paddingTop: spacing[6], paddingBottom: spacing[2] },
  eyebrow: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.primary,
    letterSpacing: letterSpacing.wider, marginBottom: spacing[2],
  },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.extrabold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  subtitle: { fontSize: fontSizes.base, color: colors.textSecondary, marginTop: spacing[2], lineHeight: 22 },
  list: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  info: { flex: 1, gap: 3 },
  name: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  metaRow: { fontSize: fontSizes.sm, color: colors.textSecondary },
  metaMuted: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },
  chevron: { fontSize: 30, lineHeight: 30, color: colors.textMuted, fontWeight: fontWeights.medium },
});

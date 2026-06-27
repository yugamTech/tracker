import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, SegmentedControl, useToast,
} from '@yaanam/ui';
import type { FeatureFlagState } from '@yaanam/api-client';
import { useMyTenant, useUpdateMyTenant } from '@yaanam/api-client';
import { FEATURE_FLAGS, resolveFlag } from '../../../lib/settings';
import { ActionButton } from '../../../components/forms';

const HUE = colors.sun;

const SEGMENTS = [
  { label: 'Off', value: 'off' },
  { label: 'WIP', value: 'wip' },
  { label: 'On', value: 'on' },
];

/**
 * Feature Flags (PRD-00 §5.3) — per-tenant on/off/WIP toggles for non-core
 * features. State is persisted on the tenant (featureFlags JSON). These are
 * advisory today (the apps read them to show/hide a feature); the backend does
 * not yet hard-gate on them — noted so behaviour isn't over-assumed.
 */
export default function FeatureFlagsScreen() {
  const { data: tenant, isLoading } = useMyTenant();
  const updateTenant = useUpdateMyTenant();
  const toast = useToast();

  const [draft, setDraft] = useState<Record<string, FeatureFlagState>>({});

  useEffect(() => {
    if (tenant) {
      const next: Record<string, FeatureFlagState> = {};
      for (const f of FEATURE_FLAGS) next[f.key] = resolveFlag(tenant.featureFlags, f.key);
      setDraft(next);
    }
  }, [tenant]);

  const dirty = useMemo(() => {
    if (!tenant) return false;
    return FEATURE_FLAGS.some((f) => draft[f.key] !== resolveFlag(tenant.featureFlags, f.key));
  }, [draft, tenant]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
  }
  if (!tenant) {
    return <View style={styles.loader}><Text style={styles.errorText}>Could not load your school</Text></View>;
  }

  const handleSave = () => {
    updateTenant.mutate(
      { featureFlags: draft },
      {
        onSuccess: () => { toast.success('Feature flags saved'); router.back(); },
        onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Failed to save'),
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>
        Turn optional features on or off for your school.{' '}
        <Text style={styles.wip}>WIP</Text> keeps a feature visible but flagged as work-in-progress.
      </Text>

      {FEATURE_FLAGS.map((f) => (
        <Card key={f.key} shadow="sm" radius={22} style={styles.flagCard}>
          <View style={styles.flagHead}>
            <Text style={styles.flagLabel}>{f.label}</Text>
            <StateDot state={draft[f.key]} />
          </View>
          <Text style={styles.flagDesc}>{f.description}</Text>
          <SegmentedControl
            segments={SEGMENTS}
            value={draft[f.key] ?? 'on'}
            onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v as FeatureFlagState }))}
          />
        </Card>
      ))}

      <ActionButton
        title={dirty ? 'Save changes' : 'No changes'}
        hue={HUE}
        onPress={handleSave}
        loading={updateTenant.isPending}
        disabled={!dirty}
        fullWidth
      />
    </ScrollView>
  );
}

function StateDot({ state }: { state?: FeatureFlagState }) {
  const color = state === 'on' ? colors.ok : state === 'wip' ? colors.warn : colors.ink3;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.base, color: colors.crit },

  intro: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 20 },
  wip: { fontFamily: fontFamilies.displayHeavy, fontWeight: fontWeights.extrabold, color: colors.warn },

  flagCard: { gap: spacing[2] },
  flagHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  flagLabel: { flex: 1, fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  flagDesc: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 18 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

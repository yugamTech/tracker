import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights,
  Card, Button, Chip, TextField, useToast, AnimatedPressable,
} from '@yaanam/ui';
import { useMyTenant, useUpdateMyTenant } from '@yaanam/api-client';
import { TIMEZONE_OPTIONS, LOCALE_OPTIONS, BRAND_COLOR_PRESETS } from '../../../lib/settings';

/**
 * School Profile (PRD-01) — edit the tenant's display name, timezone, locale and
 * branding. Branding (primary colour + tagline) is persisted now and applied to
 * live theming in a later phase; the swatch is a preview of the saved value.
 */
export default function SchoolProfileScreen() {
  const { data: tenant, isLoading } = useMyTenant();
  const updateTenant = useUpdateMyTenant();
  const toast = useToast();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    if (tenant) {
      setName(tenant.name ?? '');
      setTimezone(tenant.timezone ?? 'Asia/Kolkata');
      setLocale(tenant.locale ?? 'en');
      setPrimaryColor(tenant.brandingConfig?.primaryColor ?? BRAND_COLOR_PRESETS[0]);
      setTagline(tenant.brandingConfig?.tagline ?? '');
    }
  }, [tenant]);

  if (isLoading) {
    return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!tenant) {
    return <View style={styles.loader}><Text style={styles.errorText}>Could not load your school</Text></View>;
  }

  const handleSave = () => {
    if (!name.trim()) { toast.error('School name is required'); return; }
    updateTenant.mutate(
      {
        name: name.trim(),
        timezone,
        locale,
        brandingConfig: { primaryColor, tagline: tagline.trim() || undefined },
      },
      {
        onSuccess: () => { toast.success('School profile updated'); router.back(); },
        onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Failed to save'),
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Identity preview */}
      <Card style={styles.headerCard}>
        <View style={[styles.brandChip, { backgroundColor: primaryColor || colors.primary }]}>
          <Text style={styles.brandGlyph}>🏫</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{name || 'Your school'}</Text>
          {tagline ? <Text style={styles.headerTagline} numberOfLines={1}>{tagline}</Text> : null}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TextField
          label="Display name"
          required
          value={name}
          onChangeText={setName}
          placeholder="e.g. Greenwood International School"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Timezone</Text>
        <View style={styles.chipWrap}>
          {TIMEZONE_OPTIONS.map((tz) => (
            <Chip key={tz} label={tz} selected={timezone === tz} onPress={() => setTimezone(tz)} size="sm" />
          ))}
        </View>

        <Text style={styles.label}>Language</Text>
        <View style={styles.chipWrap}>
          {LOCALE_OPTIONS.map((l) => (
            <Chip key={l.value} label={l.label} selected={locale === l.value} onPress={() => setLocale(l.value)} size="sm" />
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Branding</Text>
        <Text style={styles.hint}>
          Saved now and applied to the apps’ theme in a later phase.
        </Text>

        <Text style={styles.label}>Primary colour</Text>
        <View style={styles.swatchRow}>
          {BRAND_COLOR_PRESETS.map((c) => (
            <AnimatedPressable key={c} scaleTo={0.9} onPress={() => setPrimaryColor(c)}>
              <View style={[styles.swatch, { backgroundColor: c }, primaryColor === c && styles.swatchActive]}>
                {primaryColor === c ? <Text style={styles.swatchCheck}>✓</Text> : null}
              </View>
            </AnimatedPressable>
          ))}
        </View>

        <TextField
          label="Tagline"
          value={tagline}
          onChangeText={setTagline}
          placeholder="Optional — e.g. Safe rides, every day"
          hint="Shown under the school name."
        />
      </Card>

      <Button
        title="Save changes"
        onPress={handleSave}
        loading={updateTenant.isPending}
        fullWidth
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSizes.base, color: colors.error },

  headerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  brandChip: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  brandGlyph: { fontSize: 26 },
  headerName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  headerTagline: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },

  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 18, marginTop: -spacing[1] },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  swatch: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.textPrimary },
  swatchCheck: { color: colors.white, fontSize: fontSizes.base, fontWeight: fontWeights.bold },

  saveBtn: { marginTop: spacing[1] },
});

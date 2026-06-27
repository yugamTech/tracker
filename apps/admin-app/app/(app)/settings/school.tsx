import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Chip, TextField, useToast, AnimatedPressable, IconSplat, Icon,
} from '@yaanam/ui';
import { useMyTenant, useUpdateMyTenant } from '@yaanam/api-client';
import { TIMEZONE_OPTIONS, LOCALE_OPTIONS, BRAND_COLOR_PRESETS } from '../../../lib/settings';
import { GroupCard, Field, ActionButton } from '../../../components/forms';

const HUE = colors.sun;

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
    return <View style={styles.loader}><ActivityIndicator color={HUE} /></View>;
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
      <View style={styles.headerCard}>
        <IconSplat shape="b2" splatColor={colors.sunBg} spot="cog" size={52} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{name || 'Your school'}</Text>
          {tagline ? <Text style={styles.headerTagline} numberOfLines={1}>{tagline}</Text> : null}
        </View>
        <View style={[styles.colorDot, { backgroundColor: primaryColor || HUE }]} />
      </View>

      <GroupCard title="Profile" spot="cog" hue={HUE}>
        <Field label="Display name" required>
          <TextField
            label=""
            value={name}
            onChangeText={setName}
            placeholder="e.g. Greenwood International School"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Timezone">
          <View style={styles.chipWrap}>
            {TIMEZONE_OPTIONS.map((tz) => (
              <Chip key={tz} label={tz} selected={timezone === tz} onPress={() => setTimezone(tz)} size="sm" />
            ))}
          </View>
        </Field>

        <Field label="Language">
          <View style={styles.chipWrap}>
            {LOCALE_OPTIONS.map((l) => (
              <Chip key={l.value} label={l.label} selected={locale === l.value} onPress={() => setLocale(l.value)} size="sm" />
            ))}
          </View>
        </Field>
      </GroupCard>

      <GroupCard title="Branding" icon="type" hue={HUE}>
        <Text style={styles.hint}>Saved now and applied to the apps' theme in a later phase.</Text>

        <Field label="Primary colour">
          <View style={styles.swatchRow}>
            {BRAND_COLOR_PRESETS.map((c) => (
              <AnimatedPressable key={c} scaleTo={0.9} onPress={() => setPrimaryColor(c)} accessibilityRole="button">
                <View style={[styles.swatch, { backgroundColor: c }, primaryColor === c && styles.swatchActive]}>
                  {primaryColor === c ? <Icon name="check" size={16} color={colors.white} /> : null}
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </Field>

        <Field label="Tagline">
          <TextField
            label=""
            value={tagline}
            onChangeText={setTagline}
            placeholder="Optional — e.g. Safe rides, every day"
            hint="Shown under the school name."
          />
        </Field>
      </GroupCard>

      <ActionButton title="Save changes" hue={HUE} onPress={handleSave} loading={updateTenant.isPending} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.base, color: colors.crit },

  headerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  headerTagline: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  colorDot: { width: 24, height: 24, borderRadius: 12 },

  hint: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, lineHeight: 19 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.ink },
});

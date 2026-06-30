import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Chip, TextField, useToast, AnimatedPressable, IconSplat, Icon,
} from '@yaanam/ui';
import { useMyTenant, useUpdateMyTenant } from '@yaanam/api-client';
import type { UpdateTenantDto } from '@yaanam/api-client';
import { TIMEZONE_OPTIONS, LOCALE_OPTIONS, BRAND_COLOR_PRESETS } from '../../../lib/settings';
import { GroupCard, Field, FormInput, ActionButton } from '../../../components/forms';

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
  const [schoolName, setSchoolName] = useState('');
  const [schoolLat, setSchoolLat] = useState('');
  const [schoolLng, setSchoolLng] = useState('');

  useEffect(() => {
    if (tenant) {
      setName(tenant.name ?? '');
      setTimezone(tenant.timezone ?? 'Asia/Kolkata');
      setLocale(tenant.locale ?? 'en');
      setPrimaryColor(tenant.brandingConfig?.primaryColor ?? BRAND_COLOR_PRESETS[0]);
      setTagline(tenant.brandingConfig?.tagline ?? '');
      setSchoolName(tenant.schoolName ?? '');
      setSchoolLat(tenant.schoolLat != null ? String(tenant.schoolLat) : '');
      setSchoolLng(tenant.schoolLng != null ? String(tenant.schoolLng) : '');
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

    // School coordinates are optional, but a pin needs BOTH lat and lng. Validate
    // ranges client-side (the backend re-checks) so a bad pin never reaches save.
    const latStr = schoolLat.trim();
    const lngStr = schoolLng.trim();
    if ((latStr === '') !== (lngStr === '')) {
      toast.error('Enter both latitude and longitude, or leave both blank'); return;
    }
    const payload: UpdateTenantDto = {
      name: name.trim(),
      timezone,
      locale,
      brandingConfig: { primaryColor, tagline: tagline.trim() || undefined },
      schoolName: schoolName.trim() || undefined,
    };
    if (latStr !== '' && lngStr !== '') {
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) { toast.error('Latitude must be between -90 and 90'); return; }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) { toast.error('Longitude must be between -180 and 180'); return; }
      payload.schoolLat = lat;
      payload.schoolLng = lng;
    }

    updateTenant.mutate(payload, {
      onSuccess: () => { toast.success('School profile updated'); router.back(); },
      onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Failed to save'),
    });
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

      <GroupCard title="School location" spot="route" hue={HUE}>
        <Text style={styles.hint}>
          The campus pin used as the school end of every trip — the destination for a pickup, the origin for a drop.
          Set it once here; an individual trip can still override it. A map pin picker comes later.
        </Text>

        <Field label="Location name" hint="Optional — shown as the destination/origin label on the map.">
          <FormInput
            hue={HUE}
            value={schoolName}
            onChangeText={setSchoolName}
            placeholder="e.g. Greenwood Campus — Main Gate"
            autoCapitalize="words"
          />
        </Field>

        <View style={styles.coordRow}>
          <Field label="Latitude" hint="-90 … 90" style={styles.coordField}>
            <FormInput
              hue={HUE}
              value={schoolLat}
              onChangeText={setSchoolLat}
              placeholder="12.9716"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="Longitude" hint="-180 … 180" style={styles.coordField}>
            <FormInput
              hue={HUE}
              value={schoolLng}
              onChangeText={setSchoolLng}
              placeholder="77.5946"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
        </View>
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

  coordRow: { flexDirection: 'row', gap: spacing[3] },
  coordField: { flex: 1 },
});

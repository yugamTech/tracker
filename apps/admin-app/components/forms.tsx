import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  type StyleProp, type ViewStyle, type TextStyle, type TextInputProps,
} from 'react-native';
import {
  colors, spacing, radius, fontWeights, fontFamilies,
  Card, AnimatedPressable, Icon, IconSplat, type IconName, type SpotIconName,
} from '@yaanam/ui';

/**
 * Shared presentation primitives for the redesigned admin detail & data-entry
 * screens — the grouped-card, coloured section label, rounded input, pill picker,
 * action button and live seat meter from `docs/design/admin-design-reference.html`.
 * These are pure presentation; screens keep all their own data/handlers.
 */

const PEOPLE = colors.people;

// ── Grouped section card (the reference's `.cardb`) ───────────────────────────
export function GroupCard({
  title, icon, spot, hue = PEOPLE, children, style,
}: {
  title?: string;
  icon?: IconName;
  spot?: SpotIconName;
  hue?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card shadow="sm" radius={22} style={[styles.group, style]}>
      {title ? (
        <View style={styles.groupHead}>
          {icon || spot ? (
            <View style={[styles.groupIcon, { backgroundColor: `${hue}1A` }]}>
              {spot ? <IconSplat shape="b1" splatColor="transparent" spot={spot} size={24} /> : <Icon name={icon!} size={17} color={hue} />}
            </View>
          ) : null}
          <Text style={[styles.groupTitle, { color: hue }]}>{title.toUpperCase()}</Text>
        </View>
      ) : null}
      {children}
    </Card>
  );
}

// ── Standalone coloured section label (the reference's `.secnote`) ─────────────
export function SectionLabel({
  children, icon, spot, hue = PEOPLE, style,
}: {
  children: React.ReactNode;
  icon?: IconName;
  spot?: SpotIconName;
  hue?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.secnote, style]}>
      {spot ? <IconSplat shape="b1" splatColor="transparent" spot={spot} size={22} /> : icon ? <Icon name={icon} size={16} color={hue} /> : null}
      <Text style={[styles.secnoteText, { color: hue }]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>
    </View>
  );
}

// ── Field wrapper: label (+ required *) over a control, with optional hint ─────
export function Field({
  label, required, hint, children, style,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}{required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ── Read-only value (detail screens, non-editing state) ───────────────────────
export function ReadValue({ value }: { value?: string | null }) {
  return <Text style={styles.readValue}>{value || '—'}</Text>;
}

// ── Rounded text input (the reference's `.inp`, with a hue focus border) ───────
export function FormInput({
  hue = PEOPLE, style, editable = true, multiline, ...rest
}: TextInputProps & { hue?: string; style?: StyleProp<TextStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      editable={editable}
      multiline={multiline}
      placeholderTextColor={colors.ink3}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        focused && { borderColor: hue },
        !editable && styles.inputDisabled,
        style,
      ]}
    />
  );
}

// ── Pill picker (the reference's `.pickrow` / `.pick`) ─────────────────────────
export interface PillOption<T extends string> {
  label: string;
  value: T;
  disabled?: boolean;
}
export function PillPicker<T extends string>({
  options, value, onChange, hue = colors.route,
}: {
  options: PillOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  hue?: string;
}) {
  return (
    <View style={styles.pickrow}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <AnimatedPressable
            key={o.value}
            scaleTo={0.96}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel, disabled: o.disabled }}
            style={[
              styles.pick,
              sel && { backgroundColor: hue, borderColor: hue },
              o.disabled && styles.pickDisabled,
            ]}
          >
            <Text style={[styles.pickText, sel && styles.pickTextSel]}>{o.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

// ── Action button (solid / outline / danger / ghost), rounded-display ─────────
export function ActionButton({
  title, tone = 'solid', hue = PEOPLE, icon, onPress, loading, disabled, fullWidth, style,
}: {
  title: string;
  tone?: 'solid' | 'outline' | 'danger' | 'ghost';
  hue?: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const solid = tone === 'solid';
  const danger = tone === 'danger';
  const textColor = solid ? colors.white : danger ? colors.crit : tone === 'ghost' ? colors.ink2 : colors.ink;
  return (
    <AnimatedPressable
      scaleTo={0.97}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      style={[
        styles.btn,
        fullWidth && styles.btnFull,
        solid ? { backgroundColor: hue, borderColor: hue, ...shadowFor(hue) }
          : danger ? styles.btnDanger
          : tone === 'ghost' ? styles.btnGhost
          : styles.btnOutline,
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={solid ? colors.white : colors.ink2} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Icon name={icon} size={17} color={textColor} /> : null}
          <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

function shadowFor(_hue: string) {
  return { shadowColor: '#16203B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 4 };
}

// ── Compact header pill action (lists' "+ Add") ───────────────────────────────
export function AddButton({ label = 'Add', hue = PEOPLE, onPress }: { label?: string; hue?: string; onPress: () => void }) {
  return (
    <AnimatedPressable
      scaleTo={0.95}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.addBtn, { backgroundColor: hue }]}
    >
      <Icon name="plus" size={16} color={colors.white} />
      <Text style={styles.addBtnText}>{label}</Text>
    </AnimatedPressable>
  );
}

// ── Live seat-capacity meter (the reference's `.capbar`) ──────────────────────
export function SeatMeter({
  used, capacity, hue = colors.route,
}: {
  used: number;
  capacity: number | null | undefined;
  hue?: string;
}) {
  if (capacity == null) return null;
  const ratio = capacity > 0 ? Math.min(1, used / capacity) : 0;
  const free = capacity - used;
  const full = free <= 0;
  const tight = !full && free <= Math.max(2, Math.round(capacity * 0.1));
  const fillColor = full ? colors.crit : tight ? colors.warn : colors.ok;
  const hintColor = full ? colors.crit : tight ? colors.warningDark : colors.successDark;
  const hintIcon: IconName = full ? 'alert' : 'checkc';
  const hintText = full
    ? `Bus is full (${used}/${capacity})`
    : `${free} seat${free === 1 ? '' : 's'} free on this bus`;
  return (
    <View style={[styles.capbar, { backgroundColor: `${hue}1A` }]}>
      <View style={styles.capRow}>
        <IconSplat shape="b4" splatColor={colors.white} spot="bus" size={34} />
        <View style={styles.capTrack}>
          <View style={[styles.capFill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]} />
        </View>
        <Text style={[styles.capCount, { color: hue }]}>{used} / {capacity}</Text>
      </View>
      <View style={styles.capHint}>
        <Icon name={hintIcon} size={14} color={hintColor} />
        <Text style={[styles.capHintText, { color: hintColor }]}>{hintText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[3] },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] + 2 },
  groupIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: 12.5, fontWeight: fontWeights.extrabold, letterSpacing: 0.5 },

  secnote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  secnoteText: { fontFamily: fontFamilies.displayHeavy, fontSize: 13, fontWeight: fontWeights.extrabold, letterSpacing: 0.5 },

  field: { gap: 8 },
  label: { fontFamily: fontFamilies.displayHeavy, fontSize: 13.5, fontWeight: fontWeights.extrabold, color: colors.ink },
  req: { color: colors.crit },
  fieldHint: { fontFamily: fontFamilies.bodySemibold, fontSize: 12.5, color: colors.ink3, lineHeight: 17 },
  readValue: { fontFamily: fontFamilies.bodySemibold, fontSize: 15, color: colors.ink, paddingVertical: 2 },

  input: {
    backgroundColor: colors.white, borderWidth: 1.8, borderColor: colors.hairlineStrong,
    borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fontFamilies.body, fontSize: 15, color: colors.ink,
  },
  inputMultiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: colors.gray50, color: colors.ink2, borderColor: colors.hairline },

  pickrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: {
    paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.full,
    borderWidth: 1.8, borderColor: colors.hairlineStrong, backgroundColor: colors.white,
  },
  pickDisabled: { opacity: 0.45 },
  pickText: { fontFamily: fontFamilies.display, fontSize: 13.5, fontWeight: fontWeights.bold, color: colors.ink2 },
  pickTextSel: { color: colors.white },

  btn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.8, borderColor: 'transparent' },
  btnFull: { alignSelf: 'stretch' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnOutline: { backgroundColor: colors.white, borderColor: colors.hairlineStrong },
  btnDanger: { backgroundColor: colors.critBg, borderColor: 'transparent' },
  btnGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: fontFamilies.displayHeavy, fontSize: 15, fontWeight: fontWeights.extrabold },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.full },
  addBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: 13.5, fontWeight: fontWeights.extrabold, color: colors.white },

  capbar: { borderRadius: 15, padding: 11, marginTop: 4, gap: 8 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  capTrack: { flex: 1, height: 8, backgroundColor: '#FFFFFFCC', borderRadius: 99, overflow: 'hidden' },
  capFill: { height: '100%', borderRadius: 99 },
  capCount: { fontFamily: fontFamilies.displayHeavy, fontSize: 12.5, fontWeight: fontWeights.extrabold },
  capHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  capHintText: { fontFamily: fontFamilies.bodySemibold, fontSize: 12, fontWeight: fontWeights.semibold },
});

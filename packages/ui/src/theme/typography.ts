import { Platform } from 'react-native';

export const fontFamilies = {
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'Roboto-Bold', default: 'System' }),
  mono: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),

  // ── Rounded redesign face (admin) ───────────────────────────────────────────
  // Matches the approved mockup's SF Pro Rounded (display) + Avenir (body) feel:
  // QUICKSAND for `display`/`displayHeavy` (the mockup's own rounded-display web
  // fallback) over NUNITO for the `body*` prose weights — both soft, rounded and
  // elegant. These resolve to the per-weight families the admin app registers via
  // expo-font at root. Apps that don't load them fall back gracefully to the
  // system face (the existing look), since RN ignores an unregistered fontFamily.
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_500Medium',
  bodySemibold: 'Nunito_600SemiBold',
  display: 'Quicksand_700Bold',
  displayHeavy: 'Quicksand_700Bold',
};

/**
 * The weight-named families the admin app must register via expo-font. The app
 * imports the actual font modules from @expo-google-fonts/{quicksand,nunito} and
 * maps them under these exact keys; the global Text shim in the admin root also
 * treats these as the "ours" set when resolving the iOS family-vs-weight rule.
 */
export const roundedFontKeys = [
  'Quicksand_700Bold',
  'Nunito_400Regular',
  'Nunito_500Medium',
  'Nunito_600SemiBold',
  'Nunito_700Bold',
] as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const lineHeights = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.75,
};

export const fontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

/** Tracking presets — tighten large display text, open up small caps/labels. */
export const letterSpacing = {
  tighter: -0.5,
  tight: -0.2,
  normal: 0,
  wide: 0.4,
  wider: 0.8,
  widest: 1.2,
};

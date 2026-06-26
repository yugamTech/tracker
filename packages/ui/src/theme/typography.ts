import { Platform } from 'react-native';

export const fontFamilies = {
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'Roboto-Bold', default: 'System' }),
  mono: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),

  // ── Poppins (admin redesign) ────────────────────────────────────────────────
  // A warm rounded face: `display`/`displayHeavy` for headings & emphasis, the
  // `body*` weights for prose. These resolve to the per-weight families that
  // @expo-google-fonts/poppins registers; the admin app loads them at root. Apps
  // that don't load Poppins fall back gracefully to the system face (the existing
  // look), since RN ignores an unregistered fontFamily.
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  bodySemibold: 'Poppins_600SemiBold',
  display: 'Poppins_700Bold',
  displayHeavy: 'Poppins_800ExtraBold',
};

/**
 * Names of the Poppins weights the admin app must register via expo-font, keyed
 * to match {@link fontFamilies}. The app imports the actual font modules from
 * `@expo-google-fonts/poppins` and maps them under these exact keys.
 */
export const poppinsFontKeys = [
  'Poppins_400Regular',
  'Poppins_500Medium',
  'Poppins_600SemiBold',
  'Poppins_700Bold',
  'Poppins_800ExtraBold',
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

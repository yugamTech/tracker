import { Platform } from 'react-native';

export const fontFamilies = {
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'Roboto-Bold', default: 'System' }),
  mono: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
};

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

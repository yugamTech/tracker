export const colors = {
  // Brand
  primary: '#4F46E5',      // Indigo 600
  primaryLight: '#818CF8', // Indigo 400
  primaryDark: '#3730A3',  // Indigo 800

  secondary: '#0EA5E9',    // Sky 500
  secondaryLight: '#38BDF8',
  secondaryDark: '#0369A1',

  accent: '#F59E0B',       // Amber 500
  accentLight: '#FCD34D',
  accentDark: '#B45309',

  success: '#10B981',      // Emerald 500
  successLight: '#6EE7B7',
  successBg: '#D1FAE5',

  warning: '#F59E0B',
  warningLight: '#FDE68A',
  warningBg: '#FEF3C7',

  error: '#EF4444',        // Red 500
  errorLight: '#FCA5A5',
  errorBg: '#FEE2E2',

  info: '#3B82F6',         // Blue 500
  infoBg: '#DBEAFE',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Dark mode surfaces
  surface: '#1E1E2E',
  surfaceCard: '#2A2A3E',
  surfaceMuted: '#16162A',

  // Semantic
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderFocus: '#4F46E5',

  // Status chips
  statusBoarded: '#10B981',
  statusNotBoarded: '#EF4444',
  statusExpected: '#F59E0B',
  statusCancelled: '#6B7280',

  // Transparent
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
} as const;

export type ColorKey = keyof typeof colors;

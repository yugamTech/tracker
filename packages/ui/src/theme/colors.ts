/**
 * Yaanam color system.
 *
 * Calm, modern, trustworthy — a cool slate neutral ramp with a single indigo
 * primary, a teal accent, and a full set of semantic colors. Every key that
 * existed before is preserved (apps depend on them); values are refined and new
 * tokens are added. Values are literal hex strings (no sibling references) so
 * the object stays a flat, tree-shakeable const.
 */
export const colors = {
  // ── Brand ──────────────────────────────────────────────────────────────
  primary: '#4F46E5',      // Indigo 600
  primaryLight: '#818CF8', // Indigo 400
  primaryDark: '#3730A3',  // Indigo 800
  primaryBg: '#EEF2FF',    // Indigo 50  — tinted surface for primary

  secondary: '#0284C7',    // Sky 600
  secondaryLight: '#38BDF8',
  secondaryDark: '#075985',
  secondaryBg: '#E0F2FE',

  accent: '#0D9488',       // Teal 600 — calm, modern highlight
  accentLight: '#5EEAD4',  // Teal 300
  accentDark: '#0F766E',   // Teal 700
  accentBg: '#CCFBF1',     // Teal 100

  // ── Semantic ───────────────────────────────────────────────────────────
  success: '#059669',      // Emerald 600
  successLight: '#6EE7B7',
  successDark: '#047857',
  successBg: '#D1FAE5',

  warning: '#D97706',      // Amber 600
  warningLight: '#FDE68A',
  warningDark: '#B45309',
  warningBg: '#FEF3C7',

  error: '#DC2626',        // Red 600
  errorLight: '#FCA5A5',
  errorDark: '#B91C1C',
  errorBg: '#FEE2E2',

  info: '#2563EB',         // Blue 600
  infoLight: '#93C5FD',
  infoDark: '#1D4ED8',
  infoBg: '#DBEAFE',

  // ── Neutral ramp (cool slate) ────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // ── Light-mode surfaces ──────────────────────────────────────────────────
  background: '#FFFFFF',
  backgroundMuted: '#F8FAFC',  // app canvas behind cards
  backgroundElevated: '#FFFFFF',

  // ── Dark-mode surfaces ───────────────────────────────────────────────────
  surface: '#0F172A',
  surfaceCard: '#1E293B',
  surfaceMuted: '#020617',

  // ── Text ───────────────────────────────────────────────────────────────
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textDisabled: '#CBD5E1',
  textLink: '#4F46E5',
  textInverse: '#FFFFFF',

  // ── Borders ──────────────────────────────────────────────────────────────
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  borderStrong: '#CBD5E1',
  borderFocus: '#4F46E5',

  // ── Status chips ───────────────────────────────────────────────────────
  statusBoarded: '#059669',
  statusNotBoarded: '#DC2626',
  statusExpected: '#D97706',
  statusCancelled: '#64748B',

  // ── Transparent overlays ──────────────────────────────────────────────────
  overlay: 'rgba(15, 23, 42, 0.55)',
  overlayLight: 'rgba(15, 23, 42, 0.2)',
  overlayStrong: 'rgba(15, 23, 42, 0.85)', // opaque slate scrim for pills/labels on maps
  scrim: 'rgba(0, 0, 0, 0.3)',             // neutral darkening scrim (e.g. map footer gradient)

  // ── Live-tracking accents ──────────────────────────────────────────────────
  // Fixed colors that always sit on the dark map canvas (`surface`), so they do
  // not follow the light/dark text ramp — they read on a dark surface by design.
  trackingLive: '#22C55E', // bright GPS-live / completed-stop green
  trackingBus: '#FACC15',  // bus marker amber-yellow

  // ── Admin redesign — per-domain hues ────────────────────────────────────────
  // One hue per app area, so colour teaches the app. Each pairs a strong tone
  // with a soft tinted background. (Additive — existing keys are untouched.)
  trip: '#4F46E5',   tripBg: '#ECEBFF',   // indigo  — trips
  people: '#0D9488', peopleBg: '#D5F4EF', // teal    — people
  route: '#0284C7',  routeBg: '#D9EFFC',  // sky     — routes
  fleet: '#7C3AED',  fleetBg: '#EFE5FF',  // violet  — live fleet
  talk: '#DB2777',   talkBg: '#FCE2F0',   // pink    — complaints
  pay: '#059669',    payBg: '#D6F5E6',    // emerald — payments
  sun: '#EA8C00',    sunBg: '#FDEFD3',    // amber   — settings

  // ── Admin redesign — severity ───────────────────────────────────────────────
  crit: '#E11D48', critBg: '#FFE4EA', // rose  — critical
  warn: '#EA8C00', warnBg: '#FDEFD3', // amber — needs attention
  ok: '#059669',   okBg: '#D6F5E6',   // green — resolved / healthy

  // ── Admin redesign — refined neutrals (warm slate) ──────────────────────────
  ground: '#F4F6FB',          // app canvas
  ink: '#16203B',             // primary text
  ink2: '#52607A',            // secondary text
  ink3: '#9AA6BE',            // tertiary / muted text
  hairline: '#E7EBF3',        // border
  hairlineStrong: '#D4DAE8',  // strong border
} as const;

export type ColorKey = keyof typeof colors;

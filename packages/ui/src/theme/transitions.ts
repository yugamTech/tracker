/**
 * Shared expo-router `Stack` animation presets so every app navigates with the
 * same motion language. Spread into `Stack.screenOptions` (or a per-screen
 * `options`). Typed via `as const` (no expo-router dependency in this package)
 * — the literal string unions are assignable to the native-stack option types.
 *
 * @example
 *   import { transitions } from '@saarthi/ui';
 *   <Stack screenOptions={{ headerShown: false, ...transitions.slideFromRight }} />
 *   <Stack.Screen name="filters" options={transitions.modalSlideUp} />
 */

/** Default forward push — content slides in from the right. */
export const slideFromRight = {
  animation: 'slide_from_right',
  animationDuration: 280,
  gestureEnabled: true,
} as const;

/** Soft cross-fade — good for tab roots and auth ↔ app handoffs. */
export const fade = {
  animation: 'fade',
  animationDuration: 220,
} as const;

/** Modal presentation — panel slides up from the bottom, swipe-to-dismiss. */
export const modalSlideUp = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
  animationDuration: 320,
  gestureEnabled: true,
} as const;

/** No animation — instant swap (e.g. replacing the root after login). */
export const none = {
  animation: 'none',
} as const;

export const transitions = {
  slideFromRight,
  fade,
  modalSlideUp,
  none,
} as const;

import React, { useEffect } from 'react';
import RNModule, { StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@yaanam/api-client';
import { ToastProvider, ErrorBoundary } from '@yaanam/ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';

// Keep the native splash up until the rounded fonts register (or definitively
// fail), so the first frame already paints in the redesign's typeface.
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Global rounded-font application ──────────────────────────────────────────
// RN doesn't cascade fontFamily, so without a global default every <Text> that
// doesn't set a family leaks to the system face. The previous `Text.render`
// monkeypatch never ran: on RN 0.81 the babel preset compiles Text to a plain
// function component (no `.render`), and React 19 ignores function `defaultProps`.
//
// What DOES work: JSX compiles `<Text>` to `jsx(reactNative.Text, …)` — a live
// member access on the react-native module object — and that `Text` is exposed
// via a *configurable* getter. So we redefine the getter once to return a themed
// wrapper, and EVERY `<Text>` across screens, @yaanam/ui and libraries flows
// through it from this single point, with no per-screen edits.
const BASE_BODY = 'Nunito_400Regular';

// A bare <Text style={{fontWeight:'600'}}> should still read as semibold — map a
// requested weight to the matching loaded Nunito body family.
const BODY_BY_WEIGHT: Record<string, string> = {
  '100': BASE_BODY, '200': BASE_BODY, '300': BASE_BODY, '400': BASE_BODY, normal: BASE_BODY,
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold', bold: 'Nunito_700Bold', '800': 'Nunito_700Bold', '900': 'Nunito_700Bold',
};

// The weight-named families we register. When a style already names one of these,
// the weight is baked into the family — so we DROP any explicit fontWeight to
// avoid the iOS "weight-named family + fontWeight" pitfall (faux-bold / wrong face).
const OUR_FAMILIES = new Set<string>([
  BASE_BODY, 'Nunito_500Medium', 'Nunito_600SemiBold', 'Nunito_700Bold', 'Quicksand_700Bold',
]);

// Only true once the fonts are actually registered. Until then — and on the
// error path — we never force an unregistered family (which renders blank on
// iOS); text falls back to the system face instead.
let fontsReady = false;

const RN_ANY = RNModule as unknown as {
  __roundedOriginalText?: React.ComponentType<any>;
  __roundedTextPatched?: boolean;
};
// Capture the real Text exactly once, so Fast-Refresh re-evals never wrap a wrapper.
const OriginalText: React.ComponentType<any> = RN_ANY.__roundedOriginalText ?? RNModule.Text;

function ThemedText(props: any) {
  const { style, ...rest } = props;
  if (!fontsReady) return <OriginalText style={style} {...rest} />;

  const flat = (StyleSheet.flatten(style as StyleProp<TextStyle>) ?? {}) as TextStyle;
  const family = typeof flat.fontFamily === 'string' ? flat.fontFamily : undefined;
  let next: TextStyle = flat;

  if (family) {
    // An explicit family. If it's one of ours, strip the now-redundant weight.
    if (OUR_FAMILIES.has(family)) {
      next = { ...flat };
      delete (next as { fontWeight?: unknown }).fontWeight;
    }
    // Otherwise (e.g. an intentional monospace) leave it exactly as authored.
  } else {
    // No family — apply the rounded body face at the requested weight.
    const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
    next = { ...flat, fontFamily: BODY_BY_WEIGHT[w] ?? BASE_BODY };
    delete (next as { fontWeight?: unknown }).fontWeight;
  }

  return <OriginalText style={next} {...rest} />;
}
ThemedText.displayName = 'Text';

if (!RN_ANY.__roundedTextPatched) {
  try {
    RN_ANY.__roundedOriginalText = OriginalText;
    Object.defineProperty(RNModule, 'Text', {
      configurable: true,
      enumerable: true,
      get() { return ThemedText; },
    });
    RN_ANY.__roundedTextPatched = true;
  } catch {
    // If the platform ever disallows the override, fall back to system text
    // rather than crashing — every Text still renders, just unthemed.
  }
}

export default function RootLayout() {
  // The map keys become the registered fontFamily names — these match the
  // `fontFamilies.*` tokens in @yaanam/ui (Quicksand_700Bold = display, the
  // Nunito_* weights = body).
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      // Surface registration failures explicitly — the app still runs (system face).
      console.error('[fonts] rounded fonts failed to register:', fontError);
    } else if (fontsLoaded) {
      console.log('[fonts] rounded fonts registered (Quicksand + Nunito)');
    }
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Enable the global font only once the families are actually registered (never
  // on the error path — that would blank iOS text against a missing family).
  if (fontsLoaded) fontsReady = true;

  // Graceful fallback: render once fonts load OR if loading errors (text then
  // falls back to the system face rather than blocking the app).
  if (!fontsLoaded && !fontError) return null;

  // NOTE: do NOT navigate (router.replace) from here on first render — the root
  // navigator isn't mounted yet. Auth gating is done declaratively in app/index.tsx.
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
          </ToastProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

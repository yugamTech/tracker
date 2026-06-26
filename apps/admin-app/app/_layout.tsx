import React, { useEffect } from 'react';
import { Text as RNText } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@yaanam/api-client';
import { ToastProvider, ErrorBoundary } from '@yaanam/ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

// Keep the native splash up until Poppins is registered (or definitively fails),
// so the first frame already paints in the redesign's typeface.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Make Poppins the BASE font for every <Text> in the admin app. RN doesn't cascade
// fontFamily, so without this only the components that explicitly set a family use
// Poppins and the rest leak the system face. We patch Text.render to prepend the
// base family (each Text's own style still wins, so explicit weights are kept).
// Guarded by `poppinsReady`: if the fonts fail to load we never force an
// unregistered family (which renders blank on iOS) — text falls back to system.
let poppinsReady = false;
{
  type StyledEl = React.ReactElement<{ style?: unknown }>;
  const TextBase = RNText as unknown as {
    render?: (...args: unknown[]) => StyledEl | null;
    __poppinsPatched?: boolean;
  };
  const baseRender = TextBase.render;
  if (typeof baseRender === 'function' && !TextBase.__poppinsPatched) {
    TextBase.__poppinsPatched = true;
    TextBase.render = function patchedTextRender(...args: unknown[]) {
      const el = baseRender.apply(this, args);
      if (!poppinsReady || !el) return el;
      return React.cloneElement(el, {
        style: [{ fontFamily: 'Poppins_400Regular' }, el.props.style],
      });
    };
  }
}

export default function RootLayout() {
  // The map keys become the registered fontFamily names — these match the
  // `fontFamilies.*` tokens in @yaanam/ui (e.g. 'Poppins_700Bold' = display).
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Enable the Poppins base-font patch only once the family is actually registered
  // (never on the error path — that would blank iOS text against a missing family).
  if (fontsLoaded) poppinsReady = true;

  // Graceful fallback: render once fonts load OR if loading errors (components
  // then fall back to the system face rather than blocking the app).
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

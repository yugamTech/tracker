import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn as REFadeIn, useReducedMotion } from 'react-native-reanimated';

interface FadeInProps {
  children: React.ReactNode;
  /** Delay before the fade starts, in ms. Default 0. */
  delay?: number;
  /** Fade duration in ms. Default 220. */
  duration?: number;
  /** Skip the animation entirely (renders children in a plain view). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades its children in on mount — the standard loading→loaded crossfade. Runs
 * on the UI thread via reanimated's layout animations. Honours the OS
 * reduce-motion setting: when on, content appears instantly.
 */
export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 220,
  disabled = false,
  style,
}) => {
  const reduceMotion = useReducedMotion();

  if (disabled || reduceMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View style={style} entering={REFadeIn.duration(duration).delay(delay)}>
      {children}
    </Animated.View>
  );
};

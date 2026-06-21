import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  useReducedMotion,
} from 'react-native-reanimated';

/** The edge the content slides in *from*. */
export type SlideDirection = 'bottom' | 'top' | 'left' | 'right';

const BUILDERS = {
  bottom: FadeInDown, // starts below, rises into place
  top: FadeInUp, // starts above, settles down
  left: FadeInLeft,
  right: FadeInRight,
} as const;

interface SlideInProps {
  children: React.ReactNode;
  /** Edge to slide in from. Default 'bottom'. */
  from?: SlideDirection;
  /** Delay before the entrance starts, in ms. Default 0. */
  delay?: number;
  /** Entrance duration in ms. Default 240. */
  duration?: number;
  /** Skip the animation entirely (renders children in a plain view). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Slides + fades its children in on mount (a ~25px travel paired with a fade).
 * Runs on the UI thread via reanimated. Honours the OS reduce-motion setting:
 * when on, content appears instantly. Use {@link Stagger} to cascade a list.
 */
export const SlideIn: React.FC<SlideInProps> = ({
  children,
  from = 'bottom',
  delay = 0,
  duration = 240,
  disabled = false,
  style,
}) => {
  const reduceMotion = useReducedMotion();

  if (disabled || reduceMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View style={style} entering={BUILDERS[from].duration(duration).delay(delay)}>
      {children}
    </Animated.View>
  );
};

import React, { useRef } from 'react';
import {
  Animated,
  Pressable as RNPressable,
  type PressableProps,
  type GestureResponderEvent,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. Default 0.97. Use 1 to disable. */
  scaleTo?: number;
  /** Opacity applied while pressed. Default 1 (no opacity change). */
  pressedOpacity?: number;
}

/**
 * The standard tap target across all three apps: a subtle scale-down (and
 * optional fade) on press, driven on the native thread. Drop-in for `Pressable`
 * / `TouchableOpacity` wherever consistent tap feedback is wanted. Pass
 * `accessibilityRole`/`accessibilityLabel` through for interactive targets.
 *
 * @example
 * <AnimatedPressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open">
 *   <Card>{children}</Card>
 * </AnimatedPressable>
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  scaleTo = 0.97,
  pressedOpacity = 1,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  // When the OS reduce-motion setting is on, hold the scale at 1 so taps don't move.
  const reduceMotion = useReducedMotion();

  const animateTo = (toScale: number, toOpacity: number) => {
    if (reduceMotion) toScale = 1;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: toScale,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    animateTo(scaleTo, pressedOpacity);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    animateTo(1, 1);
    onPressOut?.(e);
  };

  return (
    <RNPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>
        {children}
      </Animated.View>
    </RNPressable>
  );
};

/** Alias — `Pressable` from @saarthi/ui is the animated variant by convention. */
export const Pressable = AnimatedPressable;

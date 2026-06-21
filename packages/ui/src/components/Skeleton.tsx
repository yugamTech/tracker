import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { radius as radiusTokens } from '../theme/spacing';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Corner radius token, or a raw number. Default 'md'. */
  radius?: keyof typeof radiusTokens | number;
  /** Render as a circle of `width` × `width`. */
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Loading placeholder with a gentle pulsing shimmer (opacity loop, native
 * driver). Compose several to mock out a screen's layout while data loads.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  radius = 'md',
  circle = false,
  style,
}) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const resolvedRadius = circle
    ? radiusTokens.full
    : typeof radius === 'number'
      ? radius
      : radiusTokens[radius];

  const size = circle
    ? { width, height: width, borderRadius: radiusTokens.full }
    : { width, height, borderRadius: resolvedRadius };

  return <Animated.View style={[styles.base, size, { opacity: pulse }, style]} />;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.gray200,
  },
});

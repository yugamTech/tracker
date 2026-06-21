import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';

export interface Segment<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  /** Currently selected value. */
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

const TRACK_PADDING = 3;

/**
 * iOS-style segmented control with an animated sliding thumb. Generic over the
 * segment value type so callers keep their string-literal unions. Each segment
 * is a 44pt `button` exposing its selected state.
 *
 * @example
 * <SegmentedControl
 *   segments={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }]}
 *   value={filter}
 *   onChange={setFilter}
 * />
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const count = Math.max(segments.length, 1);
  const segWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / count : 0;
  const activeIndex = Math.max(0, segments.findIndex((s) => s.value === value));

  useEffect(() => {
    if (segWidth === 0) return;
    Animated.spring(translateX, {
      toValue: activeIndex * segWidth,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  }, [activeIndex, segWidth, translateX]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={[styles.track, style]} onLayout={onTrackLayout}>
      {segWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { width: segWidth, transform: [{ translateX }] },
          ]}
        />
      ) : null}
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            style={styles.segment}
            onPress={() => onChange(seg.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.label, active ? styles.labelActive : styles.labelInactive]}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    padding: TRACK_PADDING,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    ...shadows.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing[2],
    minHeight: 38, // segment + 2× track padding ≈ 44pt touch target
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  labelActive: { color: colors.textPrimary },
  labelInactive: { color: colors.textSecondary },
});

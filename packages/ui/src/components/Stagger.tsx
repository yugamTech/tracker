import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SlideIn, type SlideDirection } from './SlideIn';

export interface StaggerProps {
  children: React.ReactNode;
  /** Edge each child slides in from. Default 'bottom'. */
  from?: SlideDirection;
  /** Gap between consecutive child entrances, in ms. Default 55. */
  interval?: number;
  /** Delay before the first child enters, in ms. Default 0. */
  initialDelay?: number;
  /** Per-child entrance duration in ms. Default 240. */
  duration?: number;
  /**
   * Cap on how many items keep increasing the stagger delay. Past this the delay
   * holds steady so long lists don't wait seconds for the last card. Default 8.
   */
  maxStagger?: number;
  /** Skip the animation entirely (renders children as-is). */
  disabled?: boolean;
  /** Style applied to each child's wrapper — keep it layout-neutral. */
  itemStyle?: StyleProp<ViewStyle>;
}

/**
 * Cascades a list of children in on mount, each entering a touch after the last.
 * Best for vertically-stacked, full-width cards; for a FlatList, apply
 * {@link SlideIn} per item with an index-derived delay instead. Honours
 * reduce-motion (handled inside {@link SlideIn}).
 */
export const Stagger: React.FC<StaggerProps> = ({
  children,
  from = 'bottom',
  interval = 55,
  initialDelay = 0,
  duration = 240,
  maxStagger = 8,
  disabled = false,
  itemStyle,
}) => {
  return (
    <>
      {React.Children.map(children, (child, i) => {
        if (child == null || child === false) return child;
        return (
          <SlideIn
            from={from}
            duration={duration}
            disabled={disabled}
            delay={initialDelay + Math.min(i, maxStagger) * interval}
            style={itemStyle}
          >
            {child}
          </SlideIn>
        );
      })}
    </>
  );
};

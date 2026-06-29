import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Irregular hand-painted "brush splat" shapes, ported from the admin design reference (b1–b5). */
export type SplatShape = 'b1' | 'b2' | 'b3' | 'b4' | 'b5';

const SPLAT_PATHS: Record<SplatShape, string> = {
  b1: 'M54 7c16-2 33 5 39 21 5 13 14 21 11 35-3 14-20 15-31 24-12 9-26 10-39 2C21 82 23 64 17 50 12 36 5 24 16 16 27 8 43 8 54 7z',
  b2: 'M63 6c14 6 18 23 27 34 8 11 2 27-8 36-11 9-29 5-43 7-14 2-29-7-29-22C10 56 23 50 24 38 25 24 20 8 36 5c10-2 18 0 27 1z',
  b3: 'M45 5c19-3 31 12 47 17 13 4 8 24 4 37-4 13-21 15-32 25-12 11-29 4-34-10C26 61 12 56 11 42 10 27 9 12 25 8c7-1 13-2 20-3z',
  b4: 'M60 8c14 4 17 21 27 30 10 9 9 26-2 36-10 9-27 8-40 12-13 4-28-3-31-17C11 56 21 47 19 34 17 20 24 6 39 6c7 0 14 1 21 2z',
  b5: 'M48 6c18-4 29 11 44 15 13 4 11 22 8 35-3 14-19 18-29 28-11 11-28 6-34-7C30 60 14 58 12 44 10 29 6 14 22 9c8-2 18-2 26-3z',
};

export interface SplatProps {
  /** Which brush shape to paint. Default `'b1'`. */
  shape?: SplatShape;
  /** Fill colour of the blob (its tint). */
  color: string;
  /** Square size in points. Default `50`. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single tintable brush-blob — the organic background the redesigned icons sit
 * on. Pair with {@link IconSplat} for the icon-on-splat composition the reference
 * uses everywhere.
 */
export const Splat: React.FC<SplatProps> = ({ shape = 'b1', color, size = 50, style }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Path d={SPLAT_PATHS[shape]} fill={color} />
  </Svg>
);

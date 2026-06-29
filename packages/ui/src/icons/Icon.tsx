import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors } from '../theme/colors';

/**
 * Duotone line icons ported from the admin design reference. Each glyph is a
 * stack of layers in a 24×24 viewBox, drawn from a single `color`:
 *   • `f`  — soft fill layer (the colour at 20% opacity)
 *   • `fs` — solid fill accent (full opacity)
 *   • `s`  — the stroke outline (rounded caps/joins)
 * Pass a domain/severity hue as `color` to tint the whole icon.
 */
export type IconName =
  | 'bus' | 'alert' | 'clock' | 'search' | 'users' | 'route' | 'grid' | 'chat'
  | 'card' | 'cog' | 'check' | 'checkc' | 'x' | 'phone' | 'wifi' | 'pin'
  | 'spark' | 'flag' | 'type' | 'move'
  | 'power' | 'plus' | 'chevron' | 'edit' | 'trash' | 'mail' | 'calendar';

type Layer = 'f' | 's' | 'fs';
type Part =
  | { k: 'path'; d: string; l: Layer }
  | { k: 'circle'; cx: number; cy: number; r: number; l: Layer }
  | { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number; l: Layer }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; l: Layer };

const p = (d: string, l: Layer = 's'): Part => ({ k: 'path', d, l });
const c = (cx: number, cy: number, r: number, l: Layer = 's'): Part => ({ k: 'circle', cx, cy, r, l });
const r = (x: number, y: number, w: number, h: number, rx: number, l: Layer = 's'): Part => ({ k: 'rect', x, y, w, h, rx, l });

const ICONS: Record<IconName, Part[]> = {
  bus: [
    r(3.5, 5, 17, 11.5, 3, 'f'),
    r(3.5, 4.5, 17, 13, 3, 's'),
    p('M4 11h16'),
    p('M7.5 17.5v2M16.5 17.5v2'),
    c(7.6, 14, 1.1, 'fs'),
    c(16.4, 14, 1.1, 'fs'),
  ],
  alert: [
    p('M12 4 3 19h18L12 4z', 'f'),
    p('M12 3.5 2.6 19.5h18.8L12 3.5z'),
    p('M12 10v4.2'),
    c(12, 17.4, 1, 'fs'),
  ],
  clock: [
    c(12, 12, 8.5, 'f'),
    c(12, 12, 8.5, 's'),
    p('M12 7.2v5l3.2 2'),
  ],
  search: [
    c(11, 11, 6.6, 'f'),
    c(11, 11, 6.6, 's'),
    p('m20 20-3.6-3.6'),
  ],
  users: [
    c(9, 8, 3.6, 'f'),
    c(9, 8, 3.6, 's'),
    p('M2.6 20c0-3.6 3.1-5.4 6.4-5.4s6.4 1.8 6.4 5.4'),
    p('M16.4 5.2a3.5 3.5 0 0 1 0 6.4M17.6 15.2c2.6.5 4.2 2 4.2 4.8'),
  ],
  route: [
    c(6, 18.5, 3, 'f'),
    c(18, 5.5, 3, 'f'),
    c(6, 18.5, 2.6, 's'),
    c(18, 5.5, 2.6, 's'),
    p('M8.4 18.5H14a3.5 3.5 0 0 0 0-7H9.8a3.5 3.5 0 0 1 0-7h1.8'),
  ],
  grid: [
    r(3, 3, 8, 8, 2.4, 'f'),
    r(3, 3, 8, 8, 2.4, 's'),
    r(13, 3, 8, 8, 2.4, 's'),
    r(3, 13, 8, 8, 2.4, 's'),
    r(13, 13, 8, 8, 2.4, 'f'),
    r(13, 13, 8, 8, 2.4, 's'),
  ],
  chat: [
    p('M21 12a8 8 0 0 1-11.6 7.1L4.5 20.5l1.4-4.9A8 8 0 1 1 21 12z', 'f'),
    p('M21 12a8 8 0 0 1-11.6 7.1L4.5 20.5l1.4-4.9A8 8 0 1 1 21 12z', 's'),
    p('M9 11h6M9 14h4'),
  ],
  card: [
    r(3, 5.5, 18, 13, 3.2, 'f'),
    r(3, 5.5, 18, 13, 3.2, 's'),
    p('M3 10h18'),
    p('M6.5 14.5h4'),
  ],
  cog: [
    c(12, 12, 8.4, 'f'),
    p('M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z'),
    p('M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4'),
  ],
  check: [
    p('M20 6.5 9.5 17 4 11.5'),
  ],
  checkc: [
    c(12, 12, 9, 'f'),
    c(12, 12, 9, 's'),
    p('m8 12 2.7 2.7L16 9.3'),
  ],
  x: [
    c(12, 12, 9, 'f'),
    c(12, 12, 9, 's'),
    p('m9 9 6 6M15 9l-6 6'),
  ],
  phone: [
    p('M5 4h4l2 5-2.6 1.6a11 11 0 0 0 5 5L15 13l5 2v2.2A1.8 1.8 0 0 1 18 19 14.5 14.5 0 0 1 5 6 1.8 1.8 0 0 1 5 4z', 'f'),
    p('M5 4h4l2 5-2.6 1.6a11 11 0 0 0 5 5L15 13l5 2v2.2A1.8 1.8 0 0 1 18 19 14.5 14.5 0 0 1 5 6 1.8 1.8 0 0 1 5 4z', 's'),
  ],
  wifi: [
    p('M2.5 8.6a16 16 0 0 1 19 0M5.5 12.3a11 11 0 0 1 13 0M8.7 15.9a6 6 0 0 1 6.6 0M3 3l18 18'),
    c(12, 19.2, 1.1, 'fs'),
  ],
  pin: [
    p('M12 21s7-6.5 7-11.2A7 7 0 1 0 5 9.8C5 14.5 12 21 12 21z', 'f'),
    p('M12 21s7-6.5 7-11.2A7 7 0 1 0 5 9.8C5 14.5 12 21 12 21z', 's'),
    c(12, 9.8, 2.5, 's'),
  ],
  spark: [
    p('M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z', 'f'),
    p('M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z', 's'),
  ],
  flag: [
    p('M5.5 4h11l-1.8 4 1.8 4h-11z', 'f'),
    p('M5.5 21V3.5M5.5 4h11l-1.8 4 1.8 4h-11'),
  ],
  type: [
    p('M5 5h14v3H5z', 'f'),
    p('M5 6.5h14M12 6.5V19M9 19h6'),
  ],
  move: [
    p('M12 3v18M3 12h18'),
    p('m8 7 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4'),
  ],
  power: [
    c(12, 12, 8.4, 'f'),
    p('M16.95 7.05a7 7 0 1 1-9.9 0'),
    p('M12 3v6.2'),
  ],
  plus: [
    c(12, 12, 9, 'f'),
    p('M12 7.2v9.6M7.2 12h9.6'),
  ],
  chevron: [
    p('m9.5 6 6 6-6 6'),
  ],
  edit: [
    p('M4 16.4 15 5.4l3.6 3.6L7.6 20H4z', 'f'),
    p('M4 16.4 15 5.4l3.6 3.6L7.6 20H4v-3.6z'),
    p('M13.2 7.2 16.8 10.8'),
  ],
  trash: [
    p('M6.5 8h11l-1 11.5a1.6 1.6 0 0 1-1.6 1.5H9.1a1.6 1.6 0 0 1-1.6-1.5L6.5 8z', 'f'),
    p('M6.5 8h11l-1 11.5a1.6 1.6 0 0 1-1.6 1.5H9.1a1.6 1.6 0 0 1-1.6-1.5L6.5 8z'),
    p('M4 8h16M9.2 8V5.5h5.6V8M10.2 11.5v6M13.8 11.5v6'),
  ],
  mail: [
    r(3, 5, 18, 14, 3.2, 'f'),
    r(3, 5, 18, 14, 3.2, 's'),
    p('m4 7.5 8 5.5 8-5.5'),
  ],
  calendar: [
    r(3.5, 5, 17, 15, 3.2, 'f'),
    r(3.5, 5, 17, 15, 3.2, 's'),
    p('M3.5 9.6h17M8 3.4v3M16 3.4v3'),
  ],
};

export interface IconProps {
  name: IconName;
  /** Square size in points. Default `22`. */
  size?: number;
  /** Tint applied across all layers. Default theme text colour. */
  color?: string;
  /** Stroke weight in viewBox units. Default `1.7`. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

function renderPart(part: Part, index: number, color: string, strokeWidth: number) {
  const fillLayer = part.l === 'f' ? { fill: color, fillOpacity: 0.2, stroke: 'none' as const } : undefined;
  const fsLayer = part.l === 'fs' ? { fill: color, stroke: 'none' as const } : undefined;
  const strokeLayer =
    part.l === 's'
      ? {
          fill: 'none' as const,
          stroke: color,
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        }
      : undefined;
  const common = { ...(fillLayer ?? {}), ...(fsLayer ?? {}), ...(strokeLayer ?? {}) };

  switch (part.k) {
    case 'path':
      return <Path key={index} d={part.d} {...common} />;
    case 'circle':
      return <Circle key={index} cx={part.cx} cy={part.cy} r={part.r} {...common} />;
    case 'rect':
      return <Rect key={index} x={part.x} y={part.y} width={part.w} height={part.h} rx={part.rx} {...common} />;
    case 'line':
      return <Line key={index} x1={part.x1} y1={part.y1} x2={part.x2} y2={part.y2} {...common} />;
  }
}

/**
 * Duotone line icon. One `<Icon name="alert" color={colors.warn} size={22} />`
 * draws every layer of the named glyph in a single tint.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = colors.textPrimary,
  strokeWidth = 1.7,
  style,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    {ICONS[name].map((part, i) => renderPart(part, i, color, strokeWidth))}
  </Svg>
);

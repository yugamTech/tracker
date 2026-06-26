import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

/**
 * Multi-colour "spot" icons ported from the admin design reference — detailed,
 * Blinkit/Zomato-style glyphs with their colours baked in (they ignore tint).
 * `m-bus` is the yellow school bus; `m-abandoned` / `m-signal` / `m-overdue` /
 * `m-started` are the trip status marks.
 */
export type SpotIconName =
  | 'grid' | 'users' | 'route' | 'cog' | 'bus' | 'chat' | 'card' | 'trip'
  | 'abandoned' | 'signal' | 'overdue' | 'started';

const SPOTS: Record<SpotIconName, React.ReactNode> = {
  grid: (
    <>
      <Rect x={3} y={3} width={8} height={8} rx={2.6} fill="#4F46E5" />
      <Rect x={13} y={3} width={8} height={8} rx={2.6} fill="#8B5CF6" />
      <Rect x={3} y={13} width={8} height={8} rx={2.6} fill="#0EA5E9" />
      <Rect x={13} y={13} width={8} height={8} rx={2.6} fill="#14B8A6" />
    </>
  ),
  users: (
    <>
      <Circle cx={16.2} cy={8.6} r={3.1} fill="#8B5CF6" />
      <Path d="M10.5 20.5c0-3.3 2.7-4.9 5.7-4.9s5.7 1.6 5.7 4.9z" fill="#8B5CF6" opacity={0.9} />
      <Circle cx={8.3} cy={8} r={3.7} fill="#0D9488" />
      <Path d="M1.8 20.5c0-3.8 2.9-5.7 6.5-5.7s6.5 1.9 6.5 5.7z" fill="#0D9488" />
      <Circle cx={7} cy={7.4} r={0.9} fill="#fff" />
    </>
  ),
  route: (
    <>
      <Path
        d="M7.5 19H14a3.6 3.6 0 0 0 0-7.2H9.4a3.4 3.4 0 0 1 0-6.8H12"
        fill="none"
        stroke="#0EA5E9"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeDasharray={[0.1, 4.2]}
      />
      <Circle cx={6.6} cy={19} r={3} fill="#10B981" />
      <Circle cx={6.6} cy={19} r={1.1} fill="#fff" />
      <Path
        d="M17.8 2.6c2.1 0 3.8 1.7 3.8 3.8 0 2.6-3.8 5.8-3.8 5.8s-3.8-3.2-3.8-5.8c0-2.1 1.7-3.8 3.8-3.8z"
        fill="#EF4444"
      />
      <Circle cx={17.8} cy={6.3} r={1.4} fill="#fff" />
    </>
  ),
  cog: (
    <>
      <Rect x={2.5} y={5} width={19} height={3.1} rx={1.55} fill="#E2E8F0" />
      <Circle cx={9} cy={6.55} r={2.8} fill="#F59E0B" />
      <Rect x={2.5} y={10.45} width={19} height={3.1} rx={1.55} fill="#E2E8F0" />
      <Circle cx={15.5} cy={12} r={2.8} fill="#FB7185" />
      <Rect x={2.5} y={15.9} width={19} height={3.1} rx={1.55} fill="#E2E8F0" />
      <Circle cx={7} cy={17.45} r={2.8} fill="#A78BFA" />
    </>
  ),
  bus: (
    <>
      <Rect x={3} y={4.5} width={18} height={12} rx={3.2} fill="#FACC15" />
      <Rect x={4.6} y={6.8} width={14.8} height={4.4} rx={1.6} fill="#BAE6FD" />
      <Line x1={12} y1={6.8} x2={12} y2={11.2} stroke="#CA8A04" strokeWidth={1.3} />
      <Rect x={4.6} y={13} width={3.2} height={1.9} rx={0.9} fill="#EF4444" />
      <Rect x={16.2} y={13} width={3.2} height={1.9} rx={0.9} fill="#EF4444" />
      <Circle cx={7.6} cy={17.6} r={2.1} fill="#334155" />
      <Circle cx={16.4} cy={17.6} r={2.1} fill="#334155" />
      <Circle cx={7.6} cy={17.6} r={0.8} fill="#fff" />
      <Circle cx={16.4} cy={17.6} r={0.8} fill="#fff" />
    </>
  ),
  chat: (
    <>
      <Path d="M21 11.4a8 8 0 0 1-11.7 7.1L4.4 20l1.4-4.8A8 8 0 1 1 21 11.4z" fill="#EC4899" />
      <Circle cx={8.8} cy={11.4} r={1.25} fill="#fff" />
      <Circle cx={12.8} cy={11.4} r={1.25} fill="#fff" />
      <Circle cx={16.8} cy={11.4} r={1.25} fill="#fff" />
      <Path d="M18.7 2.3l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" fill="#FBBF24" />
    </>
  ),
  card: (
    <>
      <Rect x={2.5} y={5} width={19} height={13.5} rx={3.2} fill="#10B981" />
      <Rect x={2.5} y={8.2} width={19} height={2.8} fill="#065F46" />
      <Rect x={5} y={13.4} width={4.8} height={3.2} rx={1} fill="#FBBF24" />
      <Path
        d="M15.6 13a3.4 3.4 0 0 1 0 3.6M17.8 12a5.4 5.4 0 0 1 0 5.6"
        fill="none"
        stroke="#D1FAE5"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </>
  ),
  trip: (
    <>
      <Rect x={3} y={5.5} width={18} height={15} rx={3.4} fill="#C7D2FE" />
      <Path d="M3 8.7C3 6.9 4.4 5.5 6.2 5.5h11.6C19.6 5.5 21 6.9 21 8.7H3z" fill="#4F46E5" />
      <Rect x={6.8} y={3} width={2.4} height={4.6} rx={1.2} fill="#3730A3" />
      <Rect x={14.8} y={3} width={2.4} height={4.6} rx={1.2} fill="#3730A3" />
      <Circle cx={8} cy={13} r={1.35} fill="#14B8A6" />
      <Circle cx={12} cy={13} r={1.35} fill="#F59E0B" />
      <Circle cx={16} cy={13} r={1.35} fill="#EC4899" />
      <Path
        d="M7.2 17.1l1.9 1.9 3.5-3.5"
        stroke="#10B981"
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  abandoned: (
    <>
      <Circle cx={10.5} cy={12.5} r={7.5} fill="#FEF3C7" />
      <Circle cx={10.5} cy={12.5} r={7.5} fill="none" stroke="#F59E0B" strokeWidth={1.8} />
      <Path
        d="M10.5 8v4.6l3 1.8"
        stroke="#B45309"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={18.6} cy={6} r={4.7} fill="#EF4444" />
      <Path d="M17 4.4l3.2 3.2M20.2 4.4l-3.2 3.2" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
    </>
  ),
  signal: (
    <>
      <Path d="M4 9a12 12 0 0 1 16 0" stroke="#CBD5E1" strokeWidth={1.9} fill="none" strokeLinecap="round" />
      <Path d="M6.6 12.1a8 8 0 0 1 10.8 0" stroke="#94A3B8" strokeWidth={1.9} fill="none" strokeLinecap="round" />
      <Path d="M9.2 15.2a4 4 0 0 1 5.6 0" stroke="#94A3B8" strokeWidth={1.9} fill="none" strokeLinecap="round" />
      <Circle cx={12} cy={18.4} r={1.45} fill="#64748B" />
      <Path d="M3.5 3.5l17 17" stroke="#EF4444" strokeWidth={2.3} strokeLinecap="round" />
    </>
  ),
  overdue: (
    <>
      <Circle cx={11.5} cy={12.5} r={7.6} fill="#FEF3C7" />
      <Circle cx={11.5} cy={12.5} r={7.6} fill="none" stroke="#F59E0B" strokeWidth={1.8} />
      <Path
        d="M11.5 7.8v5l3.4 2.1"
        stroke="#B45309"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={19} cy={6.4} r={3.5} fill="#FB923C" />
      <Path d="M19 4.9v1.7" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={19} cy={8.2} r={0.75} fill="#fff" />
    </>
  ),
  started: (
    <>
      <Circle cx={12} cy={12} r={9} fill="#D1FAE5" />
      <Circle cx={12} cy={12} r={9} fill="none" stroke="#10B981" strokeWidth={1.7} />
      <Path d="M10 8.4l6.2 3.6L10 15.6z" fill="#059669" />
    </>
  ),
};

export interface SpotIconProps {
  name: SpotIconName;
  /** Square size in points. Default `25`. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Multi-colour spot icon — `<SpotIcon name="abandoned" size={28} />`. */
export const SpotIcon: React.FC<SpotIconProps> = ({ name, size = 25, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    {SPOTS[name]}
  </Svg>
);

import React from 'react';
import { router } from 'expo-router';
import { SegmentedControl } from '@yaanam/ui';
import type { SubNavSegment } from '../lib/nav';

interface SubNavProps {
  segments: SubNavSegment[];
  /** The active segment value for the screen currently showing this control. */
  value: string;
}

/**
 * Section sub-navigation. A SegmentedControl that routes between a primary
 * screen and its secondary screens (kept as hidden routes). Uses `replace` so
 * switching tabs within a section never grows the back stack.
 */
export function SubNav({ segments, value }: SubNavProps) {
  return (
    <SegmentedControl
      segments={segments.map((s) => ({ label: s.label, value: s.value }))}
      value={value}
      onChange={(next) => {
        if (next === value) return;
        const target = segments.find((s) => s.value === next);
        if (target) router.replace(target.href as never);
      }}
    />
  );
}

import { useWindowDimensions } from 'react-native';

/**
 * Single breakpoint source for the admin app. Everything that adapts between the
 * phone and desktop form factors reads from here so the layout switches in one
 * place rather than each screen inventing its own threshold.
 *
 *  - phone    : < 768   — single column, collapsible drawer
 *  - desktop  : ≥ 768   — persistent sidebar, comfortable max-width content
 *  - wide     : ≥ 1280  — denser multi-column lists (3-up grids, side panels)
 */
export const BREAKPOINTS = {
  desktop: 768,
  wide: 1280,
} as const;

/** Comfortable reading width for the content column on large screens. */
export const CONTENT_MAX_WIDTH = 1160;

export interface Responsive {
  width: number;
  isPhone: boolean;
  isDesktop: boolean;
  isWide: boolean;
  /** Sensible column count for card grids at the current width. */
  gridColumns: number;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isWide = width >= BREAKPOINTS.wide;
  return {
    width,
    isPhone: !isDesktop,
    isDesktop,
    isWide,
    gridColumns: isWide ? 3 : isDesktop ? 2 : 1,
  };
}

/**
 * @yaanam/ui — shared design system for the Yaanam apps (admin, parent, driver).
 *
 * Exports are grouped by role: Layout, Buttons & pressables, Forms & inputs,
 * Data display, Feedback & overlays, Maps, Animation, and Theme tokens. Every
 * component ships its prop types; import them when you need to extend a wrapper.
 */

// ── Layout & containers ────────────────────────────────────────────────────
export { ScreenContainer } from './components/ScreenContainer';
export type { ScreenContainerProps } from './components/ScreenContainer';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { AppHeader, HEADER_HEIGHT } from './components/AppHeader';
export type { AppHeaderProps } from './components/AppHeader';

export { SectionHeader } from './components/SectionHeader';
export type { SectionHeaderProps } from './components/SectionHeader';

export { Divider } from './components/Divider';
export type { DividerProps } from './components/Divider';

export { Sheet } from './components/Sheet';
export type { SheetProps } from './components/Sheet';

// ── Buttons & pressables ─────────────────────────────────────────────────────
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { AnimatedPressable, Pressable } from './components/Pressable';
export type { AnimatedPressableProps } from './components/Pressable';

export { Chip } from './components/Chip';
export type { ChipProps } from './components/Chip';

export { SegmentedControl } from './components/SegmentedControl';
export type { SegmentedControlProps, Segment } from './components/SegmentedControl';

// ── Forms & inputs ───────────────────────────────────────────────────────────
export { FormField } from './components/FormField';
export type { FormFieldProps } from './components/FormField';

export { TextField } from './components/TextField';
export type { TextFieldProps } from './components/TextField';

export { OtpInput } from './components/OtpInput';
export type { OtpInputProps } from './components/OtpInput';

// ── Data display ─────────────────────────────────────────────────────────────
export { Badge } from './components/Badge';
export type { BadgeProps, BadgeVariant } from './components/Badge';

export { Avatar } from './components/Avatar';
export type { AvatarProps } from './components/Avatar';

export { StatusDot } from './components/StatusDot';
export type { StatusDotProps, StatusDotVariant } from './components/StatusDot';

export { StatTile } from './components/StatTile';
export type { StatTileProps, StatTone } from './components/StatTile';

export { ListItem } from './components/ListItem';
export type { ListItemProps } from './components/ListItem';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

// ── Feedback & overlays ──────────────────────────────────────────────────────
export { LoadingSpinner } from './components/LoadingSpinner';
export type { LoadingSpinnerProps } from './components/LoadingSpinner';

export { Skeleton } from './components/Skeleton';
export type { SkeletonProps } from './components/Skeleton';

export { ConfirmDialog } from './components/ConfirmDialog';
export type { ConfirmDialogProps } from './components/ConfirmDialog';

export { ToastProvider, useToast } from './components/Toast';
export type { ToastProviderProps, ToastApi, ToastOptions, ToastVariant } from './components/Toast';

export { ErrorBoundary } from './components/ErrorBoundary';
export type { ErrorBoundaryProps } from './components/ErrorBoundary';

// ── Maps ─────────────────────────────────────────────────────────────────────
export { MockBusMap } from './components/MockBusMap';
export type { MockBusMapStop, MockBusMapProps } from './components/MockBusMap';

export { LiveBusMap } from './components/LiveBusMap';
export type { LiveBusMapStop, LiveBusMapProps } from './components/LiveBusMap';

// ── Animation primitives ─────────────────────────────────────────────────────
export { FadeIn } from './components/FadeIn';
export type { FadeInProps } from './components/FadeIn';

export { SlideIn } from './components/SlideIn';
export type { SlideInProps, SlideDirection } from './components/SlideIn';

export { Stagger } from './components/Stagger';
export type { StaggerProps } from './components/Stagger';

// ── Theme tokens ─────────────────────────────────────────────────────────────
export { colors } from './theme/colors';
export type { ColorKey } from './theme/colors';
export { fontFamilies, fontSizes, fontWeights, lineHeights, letterSpacing } from './theme/typography';
export { spacing, radius, shadows } from './theme/spacing';
export { transitions, slideFromRight, fade, modalSlideUp, none } from './theme/transitions';

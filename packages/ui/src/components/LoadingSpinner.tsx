import React, { forwardRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes } from '../theme/typography';
import { spacing } from '../theme/spacing';

export interface LoadingSpinnerProps {
  /** Spinner size. Default `'large'`. */
  size?: 'small' | 'large';
  /** Spinner color. Default `colors.primary`. */
  color?: string;
  /** Optional caption shown under the spinner. */
  label?: string;
  /** Fill the available space and center (full-screen loading). Default `false`. */
  fullScreen?: boolean;
}

/**
 * Centered activity indicator with an optional label. Set `fullScreen` to
 * occupy the whole screen while a route loads.
 *
 * @example
 * if (isLoading) return <LoadingSpinner fullScreen label="Loading trips…" />;
 */
export const LoadingSpinner = forwardRef<React.ComponentRef<typeof View>, LoadingSpinnerProps>(
  ({ size = 'large', color = colors.primary, label, fullScreen = false }, ref) => {
    return (
      <View
        ref={ref}
        style={[styles.container, fullScreen && styles.fullScreen]}
        accessibilityRole="progressbar"
        accessibilityLabel={label ?? 'Loading'}
      >
        <ActivityIndicator size={size} color={color} />
        {label && <Text style={styles.label}>{label}</Text>}
      </View>
    );
  },
);

LoadingSpinner.displayName = 'LoadingSpinner';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  fullScreen: {
    flex: 1,
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
});

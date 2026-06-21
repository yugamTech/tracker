import React, { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export type StatusDotVariant = 'live' | 'offline' | 'reconnecting' | 'idle';

export interface StatusDotProps {
  /** Connection/liveness state. Default `'idle'`. */
  variant?: StatusDotVariant;
  /** Diameter in points. Default `10`. */
  size?: number;
}

const dotColors: Record<StatusDotVariant, string> = {
  live:         colors.success,
  offline:      colors.gray400,
  reconnecting: colors.warning,
  idle:         colors.info,
};

const LABELS: Record<StatusDotVariant, string> = {
  live: 'Live',
  offline: 'Offline',
  reconnecting: 'Reconnecting',
  idle: 'Idle',
};

/**
 * Tiny colored status indicator — pair it with a label or use it as a leading
 * slot in a {@link ListItem}. The variant is exposed to screen readers.
 *
 * @example
 * <StatusDot variant="live" />
 */
export const StatusDot = forwardRef<React.ComponentRef<typeof View>, StatusDotProps>(
  ({ variant = 'idle', size = 10 }, ref) => {
    return (
      <View
        ref={ref}
        accessibilityRole="image"
        accessibilityLabel={LABELS[variant]}
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColors[variant],
          },
        ]}
      />
    );
  },
);

StatusDot.displayName = 'StatusDot';

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
});

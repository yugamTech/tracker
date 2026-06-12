import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export type StatusDotVariant = 'live' | 'offline' | 'reconnecting' | 'idle';

interface StatusDotProps {
  variant?: StatusDotVariant;
  size?: number;
}

const dotColors: Record<StatusDotVariant, string> = {
  live:         colors.success,
  offline:      colors.gray400,
  reconnecting: colors.warning,
  idle:         colors.info,
};

export const StatusDot: React.FC<StatusDotProps> = ({
  variant = 'idle',
  size = 10,
}) => {
  return (
    <View
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
};

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
});

import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  label?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = colors.primary,
  label,
  fullScreen = false,
}) => {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size={size} color={color} />
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
};

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

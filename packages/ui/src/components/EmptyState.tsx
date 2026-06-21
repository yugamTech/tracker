import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { spacing } from '../theme/spacing';

export interface EmptyStateProps {
  title: string;
  /** Supporting copy under the title. */
  description?: string;
  /** Leading illustration or icon. */
  icon?: React.ReactNode;
  /** Call-to-action (e.g. a {@link Button}) shown below the copy. */
  action?: React.ReactNode;
}

/**
 * Centered placeholder for empty lists, zero-results, and "nothing here yet"
 * states: icon, title, description and an optional action.
 *
 * @example
 * <EmptyState
 *   icon={<Text style={{ fontSize: 32 }}>🚌</Text>}
 *   title="No trips today"
 *   description="Scheduled trips will appear here."
 *   action={<Button title="Refresh" onPress={refetch} />}
 * />
 */
export const EmptyState = forwardRef<React.ComponentRef<typeof View>, EmptyStateProps>(
  ({ title, description, icon, action }, ref) => {
    return (
      <View ref={ref} style={styles.container}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        {action && <View style={styles.action}>{action}</View>}
      </View>
    );
  },
);

EmptyState.displayName = 'EmptyState';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[3],
  },
  icon: {
    marginBottom: spacing[2],
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: spacing[2],
  },
});

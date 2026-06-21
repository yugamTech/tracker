import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { spacing } from '../theme/spacing';

export interface FormFieldProps {
  /** Field label rendered above the control. */
  label?: string;
  /** Append a red required marker (`*`) to the label. Default `false`. */
  required?: boolean;
  /** Muted helper text shown below the label, above the control. */
  hint?: string;
  /** Error message shown below the control. Takes visual priority over `hint`. */
  error?: string;
  /** The control — a `TextInput`, picker, chip row, switch, etc. */
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Labelled form-row scaffold: `label` (+ optional required marker), an optional
 * `hint`, the control itself, and an `error` line. Wrap any control to get the
 * standard label/hint/error layout — {@link TextField} builds on it for inputs.
 *
 * @example
 * <FormField label="Role" required error={roleError}>
 *   <SegmentedControl segments={roles} value={role} onChange={setRole} />
 * </FormField>
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  hint,
  error,
  children,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },
  required: {
    color: colors.error,
    fontWeight: fontWeights.semibold,
  },
  hint: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: -spacing[1],
  },
  error: {
    fontSize: fontSizes.sm,
    color: colors.error,
    fontWeight: fontWeights.medium,
  },
});

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { FormField } from './FormField';

export interface TextFieldProps extends TextInputProps {
  /** Field label rendered above the input. */
  label?: string;
  /** Append a red required marker (`*`) to the label. Default `false`. */
  required?: boolean;
  /** Muted helper text below the label. */
  hint?: string;
  /** Error message below the input; also turns the border red. */
  error?: string;
  /** Adornment rendered inside the input box, before the text (e.g. a `+91` prefix). */
  left?: React.ReactNode;
  /** Adornment rendered inside the input box, after the text (e.g. a clear button). */
  right?: React.ReactNode;
  /** Style for the outer `FormField` wrapper. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The standard labelled text input across the apps: label, hint, error, and a
 * bordered box that highlights on focus and turns red on error. Built on
 * {@link FormField}, forwards its ref to the underlying `TextInput` (so callers
 * can chain focus), and clears the 44pt touch target.
 *
 * @example
 * <TextField
 *   label="Full name"
 *   required
 *   value={name}
 *   onChangeText={setName}
 *   placeholder="e.g. Ramesh Kumar"
 *   error={nameError}
 * />
 */
export const TextField = forwardRef<React.ComponentRef<typeof TextInput>, TextFieldProps>(
  (
    {
      label,
      required = false,
      hint,
      error,
      left,
      right,
      containerStyle,
      style,
      onFocus,
      onBlur,
      editable = true,
      accessibilityLabel,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);

    return (
      <FormField label={label} required={required} hint={hint} error={error} style={containerStyle}>
        <View
          style={[
            styles.box,
            focused && styles.boxFocused,
            !!error && styles.boxError,
            !editable && styles.boxDisabled,
          ]}
        >
          {left ? <View style={styles.adornment}>{left}</View> : null}
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={colors.textMuted}
            editable={editable}
            accessibilityLabel={accessibilityLabel ?? label}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
          {right ? <View style={styles.adornment}>{right}</View> : null}
        </View>
      </FormField>
    );
  },
);

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44, // a11y: minimum touch target
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
  },
  boxFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.background,
  },
  boxError: {
    borderColor: colors.error,
  },
  boxDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  adornment: {
    justifyContent: 'center',
  },
});

import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';

export interface OtpInputProps {
  /** Number of digit boxes. Default `6`. */
  length?: number;
  /** Fired once every box is filled, with the joined code. */
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

/**
 * Segmented one-time-code entry: auto-advances on input, backspaces to the
 * previous box, and fires `onComplete` once full. Each box is 48×56 (clears the
 * 44pt target) and labelled "Digit N of M" for screen readers.
 *
 * @example
 * <OtpInput length={6} onComplete={(code) => verify(code)} disabled={isVerifying} />
 */
export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  onComplete,
  disabled = false,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (newOtp.every((v) => v !== '')) {
      onComplete(newOtp.join(''));
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {Array(length)
        .fill(0)
        .map((_, i) => (
          <TextInput
            key={i}
            ref={(ref) => {
              inputs.current[i] = ref;
            }}
            style={[styles.input, otp[i] ? styles.inputFilled : styles.inputEmpty]}
            value={otp[i]}
            onChangeText={(t) => handleChange(t.slice(-1), i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textContentType="oneTimeCode"
            editable={!disabled}
            autoFocus={i === 0}
            accessibilityLabel={`Digit ${i + 1} of ${length}`}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'center',
  },
  input: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  inputEmpty: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundMuted,
  },
  inputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
});

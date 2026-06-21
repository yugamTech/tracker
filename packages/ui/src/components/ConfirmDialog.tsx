import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Animated,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';
import { Button } from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  /** Bold heading. */
  title: string;
  /** Supporting body copy. */
  message?: string;
  /** Confirm button label. Default `'Confirm'`. */
  confirmLabel?: string;
  /** Cancel button label. Default `'Cancel'`. */
  cancelLabel?: string;
  /** Style the confirm action as destructive (red). Default `false`. */
  destructive?: boolean;
  /** Show a spinner on the confirm button and block it. Default `false`. */
  loading?: boolean;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the user cancels or taps the backdrop. */
  onCancel: () => void;
}

/**
 * Centered, controlled confirmation dialog — the in-app replacement for a
 * blocking `Alert.alert(..., [{cancel}, {confirm}])`. Fades + scales in over a
 * scrim (honours reduce-motion); the backdrop and Cancel both call `onCancel`.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <ConfirmDialog
 *   visible={open}
 *   title="Log out?"
 *   message="You'll need to sign in again."
 *   confirmLabel="Log out"
 *   destructive
 *   onConfirm={() => { setOpen(false); logout(); }}
 *   onCancel={() => setOpen(false)}
 * />
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [visible, progress, reduceMotion]);

  const scale = reduceMotion
    ? 1
    : progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>
        <Animated.View
          style={[styles.card, { opacity: progress, transform: [{ scale }] }]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              variant="ghost"
              onPress={onCancel}
              disabled={loading}
              style={styles.action}
            />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.action}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    padding: spacing[5],
    gap: spacing[2],
    ...shadows.xl,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    letterSpacing: letterSpacing.tight,
  },
  message: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  action: {
    flex: 1,
  },
});

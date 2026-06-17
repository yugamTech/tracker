import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Animated,
  Pressable,
  StyleSheet,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights, letterSpacing } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title shown in the sheet header. */
  title?: string;
  /** Show the drag-handle grabber. Default true. */
  showHandle?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

/**
 * Bottom sheet built on RN `Modal` + `Animated` (no gesture-handler dep). The
 * panel slides up from the bottom over a fading scrim; tapping the scrim closes.
 */
export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  children,
  title,
  showHandle = true,
  contentStyle,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 2,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdrop]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing[4], transform: [{ translateY }] },
            contentStyle,
          ]}
        >
          {showHandle ? <View style={styles.handle} /> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
    ...shadows.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray300,
    marginBottom: spacing[3],
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    letterSpacing: letterSpacing.tight,
    marginBottom: spacing[3],
  },
});

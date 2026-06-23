import React, { useRef, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors,
  spacing,
  radius,
  fontSizes,
  fontWeights,
  AppHeader,
  AnimatedPressable,
} from '@yaanam/ui';
import { useResponsive, CONTENT_MAX_WIDTH } from '../hooks/useResponsive';
import { MenuButton } from './MenuButton';

interface AdminScreenProps {
  title: string;
  subtitle?: string;
  /** Trailing header content — action buttons, etc. */
  headerRight?: React.ReactNode;
  /** Section sub-navigation (typically a <SubNav/>), shown under the header. */
  subnav?: React.ReactNode;
  /** When set, the header shows a back affordance instead of the menu button. */
  onBack?: () => void;
  /** Constrain the content column on desktop. Defaults to a comfortable width. */
  maxWidth?: number;
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * The shared scaffold for every primary/section screen. One component tree
 * across form factors: on phone it stacks header → subnav → single-column
 * content with a menu button; on desktop the persistent sidebar supplies
 * navigation, the menu button drops away, and content is centered within a
 * comfortable max-width.
 */
export function AdminScreen({
  title,
  subtitle,
  headerRight,
  subnav,
  onBack,
  maxWidth = CONTENT_MAX_WIDTH,
  bg = colors.backgroundMuted,
  contentStyle,
  children,
}: AdminScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPhone, isDesktop } = useResponsive();

  const slideAnim = useRef(new Animated.Value(subnav ? 14 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(subnav ? 0 : 1)).current;

  // Re-run the slide-in every time this screen gains focus (fixes the
  // "animation only works once" issue caused by Drawer caching screens).
  useFocusEffect(
    useCallback(() => {
      if (!subnav) return;
      slideAnim.setValue(14);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 210, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 210, useNativeDriver: true }),
      ]).start();
    }, [!!subnav]),
  );

  const centered: StyleProp<ViewStyle> = isDesktop
    ? { width: '100%', maxWidth, alignSelf: 'center' }
    : undefined;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <AppHeader
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        left={!onBack && isPhone ? <MenuButton /> : undefined}
        right={headerRight}
      />

      {subnav ? (
        <View style={styles.subnavWrap}>
          {/* Full-width on phone; a comfortably-sized, centered control on desktop. */}
          <View style={[styles.subnavInner, isDesktop && styles.subnavInnerDesktop]}>{subnav}</View>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.content,
          contentStyle,
          subnav ? { opacity: fadeAnim, transform: [{ translateX: slideAnim }] } : null,
        ]}
      >
        <View style={[styles.contentInner, centered]}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subnavWrap: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  subnavInner: { width: '100%' },
  subnavInnerDesktop: { maxWidth: 520, alignSelf: 'center' },
  content: { flex: 1 },
  contentInner: { flex: 1, width: '100%' },
});

/**
 * Standard pill action used in the header right slot (e.g. "+ Schedule").
 * Filled by default; `tone="subtle"` for secondary actions.
 */
export function HeaderAction({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'subtle' | 'danger';
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      scaleTo={0.95}
      accessibilityRole="button"
      style={[
        actionStyles.base,
        tone === 'primary' && actionStyles.primary,
        tone === 'subtle' && actionStyles.subtle,
        tone === 'danger' && actionStyles.danger,
      ]}
    >
      <Text
        style={[
          actionStyles.label,
          tone === 'primary' && actionStyles.labelPrimary,
          tone === 'subtle' && actionStyles.labelSubtle,
          tone === 'danger' && actionStyles.labelDanger,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const actionStyles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  subtle: { backgroundColor: colors.background, borderColor: colors.border },
  danger: { backgroundColor: colors.errorBg, borderColor: colors.errorBg },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  labelPrimary: { color: colors.textInverse },
  labelSubtle: { color: colors.textSecondary },
  labelDanger: { color: colors.error },
});

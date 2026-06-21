import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { radius, spacing, shadows } from '../theme/spacing';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'neutral';

export interface ToastOptions {
  /** Main line of text. */
  message: string;
  /** Optional bold heading above the message. */
  title?: string;
  /** Semantic color + icon. Default `'neutral'`. */
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. `0` keeps it until tapped. Defaults: 3500 (5000 for errors). */
  duration?: number;
}

export interface ToastApi {
  /** Show a toast. Pass a string for a quick neutral message, or full options. Returns its id. */
  show: (opts: ToastOptions | string) => string;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  /** Dismiss a specific toast by id. */
  dismiss: (id: string) => void;
  /** Dismiss every visible toast. */
  dismissAll: () => void;
}

interface ToastItem extends Required<Omit<ToastOptions, 'title'>> {
  id: string;
  title?: string;
}

const DEFAULT_DURATION = 3500;
const ERROR_DURATION = 5000;
/** Most toasts visible at once; older ones drop off the top of the stack. */
const MAX_VISIBLE = 3;

const VARIANT: Record<ToastVariant, { accent: string; tint: string; glyph: string }> = {
  success: { accent: colors.success, tint: colors.successBg, glyph: '✓' },
  error:   { accent: colors.error,   tint: colors.errorBg,   glyph: '✕' },
  warning: { accent: colors.warning, tint: colors.warningBg, glyph: '!' },
  info:    { accent: colors.info,    tint: colors.infoBg,    glyph: 'i' },
  neutral: { accent: colors.gray500, tint: colors.gray100,   glyph: '•' },
};

const ToastContext = createContext<ToastApi | null>(null);

export interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * Mounts the toast host. Wrap the app root (around the navigator) so any screen
 * can call {@link useToast}. Renders a safe-area-aware stack of toasts pinned to
 * the top, above all content.
 *
 * @example
 * // app/_layout.tsx
 * <ToastProvider>
 *   <Stack screenOptions={{ headerShown: false }} />
 * </ToastProvider>
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
  }, []);

  const show = useCallback(
    (opts: ToastOptions | string) => {
      const normalized: ToastOptions = typeof opts === 'string' ? { message: opts } : opts;
      const variant = normalized.variant ?? 'neutral';
      const duration =
        normalized.duration ?? (variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION);
      const id = `toast-${(counter.current += 1)}`;
      const item: ToastItem = { id, message: normalized.message, title: normalized.title, variant, duration };

      setToasts((prev) => [...prev, item].slice(-MAX_VISIBLE));

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, title) => show({ message, title, variant: 'success' }),
      error: (message, title) => show({ message, title, variant: 'error' }),
      info: (message, title) => show({ message, title, variant: 'info' }),
      warning: (message, title) => show({ message, title, variant: 'warning' }),
      dismiss,
      dismissAll,
    }),
    [show, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

/**
 * Access the toast API. Must be called under a {@link ToastProvider}.
 *
 * @example
 * const toast = useToast();
 * toast.success('Staff member added');
 * toast.error('Failed to save');
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>.');
  }
  return ctx;
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[styles.viewport, { top: insets.top + spacing[2] }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const reduceMotion = useReducedMotion();
  const v = VARIANT[toast.variant];

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.duration(220)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(160)}
      style={styles.cardWrap}
    >
      <Pressable
        onPress={() => onDismiss(toast.id)}
        style={[styles.card, { borderLeftColor: v.accent }]}
        accessibilityRole="alert"
        accessibilityLabel={toast.title ? `${toast.title}. ${toast.message}` : toast.message}
        accessibilityLiveRegion="polite"
        accessibilityHint="Double tap to dismiss"
      >
        <View style={[styles.iconWrap, { backgroundColor: v.tint }]}>
          <Text style={[styles.icon, { color: v.accent }]}>{v.glyph}</Text>
        </View>
        <View style={styles.body}>
          {toast.title ? <Text style={styles.title} numberOfLines={1}>{toast.title}</Text> : null}
          <Text style={styles.message} numberOfLines={3}>{toast.message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    gap: spacing[2],
    zIndex: 9999,
    elevation: 9999,
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 44,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    ...shadows.lg,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  message: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});

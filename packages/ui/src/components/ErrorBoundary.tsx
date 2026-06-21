import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fontWeights } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom recovery UI. Receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Called after a crash is caught — wire to a crash reporter (Sentry, etc.). */
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level crash net. A render-time throw anywhere below this boundary shows a
 * recovery screen instead of an unmounted white screen — the failure mode that
 * is otherwise invisible in a release build (no dev red-box, no Fast Refresh).
 *
 * Must be a class component: only the class lifecycle exposes
 * `getDerivedStateFromError` / `componentDidCatch`. The fallback uses bare RN
 * primitives + theme tokens so it can't itself depend on a context that crashed.
 *
 * @example
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Surfaces in `adb logcat` / device logs in a release build.
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.description}>
            The app hit an unexpected error. You can try again — if it keeps
            happening, fully close and reopen the app.
          </Text>
          {__DEV__ ? (
            <Text style={styles.devError} numberOfLines={8}>
              {error.message}
            </Text>
          ) : null}
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[3],
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing[2],
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  devError: {
    fontSize: fontSizes.xs,
    color: colors.error,
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing[3],
    marginTop: spacing[2],
    alignSelf: 'stretch',
  },
  button: {
    marginTop: spacing[4],
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
});

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { fontFamilies, fontSizes, fontWeights } from '../theme/typography';

export interface MockBusMapStop {
  id: string;
  name: string;
}

export interface MockBusMapProps {
  stops: MockBusMapStop[];
  currentIdx?: number; // driven externally (e.g. from socket); if omitted, self-animates
  live?: boolean;
  routeName?: string;
  /** Height of the map area. Default 180. */
  height?: number;
}

/**
 * Mock live map placeholder. Renders a stop timeline with an animated bus
 * marker that moves along the route. Does NOT require react-native-maps or a
 * dev build — this is intentionally a stub until the real map phase ships.
 */
export function MockBusMap({ stops, currentIdx, live = false, routeName, height = 180 }: MockBusMapProps) {
  // Self-animate when no external currentIdx is provided.
  const [mockIdx, setMockIdx] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const activeIdx = currentIdx ?? mockIdx;

  // Self-advancing mock: steps through stops every ~3 seconds.
  useEffect(() => {
    if (currentIdx !== undefined || stops.length < 2) return;
    const t = setInterval(() => {
      setMockIdx((i) => (i + 1) % stops.length);
    }, 3000);
    return () => clearInterval(t);
  }, [currentIdx, stops.length]);

  // Pulse animation on the active marker when live.
  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulseAnim]);

  const nextStop = stops[activeIdx];
  const prevStop = activeIdx > 0 ? stops[activeIdx - 1] : null;

  return (
    <View style={[styles.container, { height }]}>
      {/* Top info bar */}
      <View style={styles.infoBar}>
        <View style={styles.livePill}>
          <View style={[styles.liveDot, live && styles.liveDotActive]} />
          <Text style={[styles.liveText, live && styles.liveTextActive]}>{live ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
        {routeName && <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>}
        <Text style={styles.busIcon}>🚌</Text>
      </View>

      {/* Stop timeline */}
      {stops.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeline}
        >
          {stops.map((stop, idx) => {
            const isDone = idx < activeIdx;
            const isActive = idx === activeIdx;
            return (
              <View key={stop.id} style={styles.stopNode}>
                {/* Connector line before this stop */}
                {idx > 0 && (
                  <View style={[styles.connector, isDone || isActive ? styles.connectorDone : styles.connectorPending]} />
                )}
                {/* Stop dot */}
                <View style={styles.dotWrap}>
                  {isActive ? (
                    <Animated.View style={[styles.busMarker, { transform: [{ scale: pulseAnim }] }]}>
                      <Text style={styles.busEmoji}>🚌</Text>
                    </Animated.View>
                  ) : (
                    <View style={[styles.stopDot, isDone ? styles.stopDotDone : styles.stopDotPending]} />
                  )}
                </View>
                <Text style={[styles.stopLabel, isActive && styles.stopLabelActive]} numberOfLines={2}>
                  {stop.name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyText}>No stops on this route</Text>
        </View>
      )}

      {/* Current/next stop label */}
      {nextStop && (
        <View style={styles.footer}>
          {prevStop && <Text style={styles.footerSub}>From {prevStop.name}</Text>}
          <Text style={styles.footerMain}>→ {nextStop.name}</Text>
          <Text style={styles.footerBadge}>
            {activeIdx + 1}/{stops.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
  },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray600 },
  liveDotActive: { backgroundColor: colors.trackingLive },
  liveText: { fontSize: fontSizes.xs, color: colors.gray500, fontWeight: fontWeights.bold, letterSpacing: 1 },
  liveTextActive: { color: colors.trackingLive },
  routeName: { flex: 1, fontSize: fontSizes.sm, color: colors.gray300, fontWeight: fontWeights.medium },
  busIcon: { fontSize: fontSizes.lg },
  timeline: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  stopNode: { alignItems: 'center', width: 80, position: 'relative' },
  connector: {
    position: 'absolute', top: 16, left: -40, right: 40, height: 3,
    zIndex: 0,
  },
  connectorDone: { backgroundColor: colors.trackingLive },
  connectorPending: { backgroundColor: colors.gray700 },
  dotWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  busMarker: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  busEmoji: { fontSize: fontSizes.xl },
  stopDot: { width: 12, height: 12, borderRadius: 6 },
  stopDotDone: { backgroundColor: colors.trackingLive },
  stopDotPending: { backgroundColor: colors.gray600 },
  stopLabel: {
    fontSize: 9, color: colors.gray500, textAlign: 'center',
    marginTop: spacing[1], width: 72,
  },
  stopLabelActive: { color: colors.white, fontWeight: fontWeights.semibold },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
    backgroundColor: colors.scrim,
  },
  footerSub: { fontSize: fontSizes.xs, color: colors.gray500 },
  footerMain: { flex: 1, fontSize: fontSizes.sm, color: colors.white, fontWeight: fontWeights.semibold },
  footerBadge: { fontSize: fontSizes.xs, color: colors.gray400, fontFamily: fontFamilies.mono },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: fontSizes.sm, color: colors.gray500 },
});

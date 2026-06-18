import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  StatusDot, MockBusMap, LiveBusMap, Card, Skeleton, EmptyState, AnimatedPressable,
} from '@saarthi/ui';
import { useFleet, useFleetSocket } from '@saarthi/api-client';
import { AdminScreen, HeaderAction } from '../../../components/AdminScreen';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';

interface Bus {
  tripId: string;
  routeName: string;
  vehicleReg: string | null;
  driverName: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  updatedAt: number | null;
  stops: { id: string; name: string; lat?: number; lng?: number }[];
  direction?: string;
}

export default function FleetMapScreen() {
  const { data: fleet, isLoading } = useFleet();
  const { gridColumns } = useResponsive();
  const [buses, setBuses] = useState<Record<string, Bus>>({});

  // Seed from the REST snapshot.
  useEffect(() => {
    if (!fleet) return;
    setBuses((prev) => {
      const next = { ...prev };
      for (const f of fleet) {
        next[f.tripId] = {
          tripId: f.tripId,
          routeName: f.routeName,
          vehicleReg: f.vehicleReg,
          driverName: f.driverName,
          status: f.status,
          direction: f.direction,
          lat: f.latest?.lat ?? null,
          lng: f.latest?.lng ?? null,
          speed: f.latest?.speed ?? null,
          updatedAt: f.latest ? Date.parse(f.latest.serverTs) : null,
          stops: f.stops ?? [],
        };
      }
      return next;
    });
  }, [fleet]);

  // Live deltas across the whole tenant fleet.
  useFleetSocket(true, {
    onLocation: (d) => {
      setBuses((prev) => ({
        ...prev,
        [d.tripId]: {
          ...(prev[d.tripId] ?? {
            tripId: d.tripId,
            routeName: 'Active trip',
            vehicleReg: null,
            driverName: null,
            status: 'IN_PROGRESS',
            stops: [],
          }),
          lat: d.lat,
          lng: d.lng,
          speed: d.speed ?? null,
          updatedAt: Date.now(),
        } as Bus,
      }));
    },
    onStatus: (d) => {
      setBuses((prev) => {
        if (!prev[d.tripId]) return prev;
        if (['COMPLETED', 'CANCELLED', 'ABORTED'].includes(d.status)) {
          const next = { ...prev };
          delete next[d.tripId];
          return next;
        }
        return { ...prev, [d.tripId]: { ...prev[d.tripId], status: d.status } };
      });
    },
  });

  const list = Object.values(buses);
  const now = Date.now();
  const liveCount = list.filter((b) => b.updatedAt != null && now - b.updatedAt < 30000).length;

  return (
    <AdminScreen
      title="Live Fleet"
      subtitle={`${list.length} bus${list.length === 1 ? '' : 'es'} active · ${liveCount} live`}
      headerRight={<HeaderAction label="⚠ Exceptions" tone="subtle" onPress={() => router.push('/(app)/fleet/exceptions' as never)} />}
    >
      {isLoading && list.length === 0 ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} padding={0} style={styles.skeletonCard}>
              <Skeleton width="100%" height={140} radius={0} />
              <View style={styles.skeletonStrip}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <GridList
          data={list}
          columns={gridColumns}
          keyExtractor={(b) => b.tripId}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<Text style={{ fontSize: 44 }}>🚍</Text>}
                title="No active trips right now"
                description="Start a trip to see live buses track here."
              />
            </View>
          }
          renderItem={(b) => {
            const fresh = b.updatedAt != null && now - b.updatedAt < 30000;
            // The fleet snapshot carries stop coords; socket-only buses (no snapshot
            // yet) don't, so fall back to the timeline placeholder until they do.
            const geoStops = b.stops.filter(
              (s): s is { id: string; name: string; lat: number; lng: number } => s.lat != null && s.lng != null,
            );
            return (
              <AnimatedPressable scaleTo={0.99} onPress={() => router.push(`/(app)/fleet/${b.tripId}` as never)}>
                <Card padding={0} shadow="sm" style={styles.busCard}>
                  {geoStops.length > 0 ? (
                    <LiveBusMap
                      stops={geoStops}
                      busLat={b.lat}
                      busLng={b.lng}
                      routeName={b.routeName}
                      height={140}
                    />
                  ) : (
                    <MockBusMap stops={b.stops} live={fresh} routeName={b.routeName} height={140} />
                  )}
                  <View style={styles.infoStrip}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busNum} numberOfLines={1}>{b.vehicleReg ?? b.routeName}</Text>
                      <Text style={styles.busRoute} numberOfLines={1}>{b.routeName} · {b.direction ?? b.status}</Text>
                      {b.driverName ? <Text style={styles.driverLine} numberOfLines={1}>🧑‍✈️ {b.driverName}</Text> : null}
                      <Text style={styles.busCords} numberOfLines={1}>
                        {b.lat != null ? `${b.lat.toFixed(4)}, ${b.lng!.toFixed(4)}` : 'Awaiting GPS…'}
                        {b.speed != null ? `  ·  ${Math.round(b.speed * 3.6)} km/h` : ''}
                      </Text>
                    </View>
                    <View style={styles.liveTag}>
                      <StatusDot variant={fresh ? 'live' : 'offline'} size={8} />
                      <Text style={[styles.liveTagText, !fresh && styles.liveTagStale]}>{fresh ? 'LIVE' : 'STALE'}</Text>
                    </View>
                  </View>
                </Card>
              </AnimatedPressable>
            );
          }}
        />
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 280, overflow: 'hidden' },
  skeletonStrip: { padding: spacing[4] },

  emptyWrap: { flex: 1, minHeight: 360 },

  busCard: { overflow: 'hidden' },
  infoStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[4], paddingTop: spacing[3] },
  busNum: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  busRoute: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  driverLine: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  busCords: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 3 },
  liveTag: { alignItems: 'center', gap: 2, paddingTop: 2 },
  liveTagText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold, letterSpacing: letterSpacing.wide },
  liveTagStale: { color: colors.textMuted },
});

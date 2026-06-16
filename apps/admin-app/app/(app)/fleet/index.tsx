import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, StatusDot, MockBusMap } from '@saarthi/ui';
import { useFleet, useFleetSocket } from '@saarthi/api-client';

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
  stops: { id: string; name: string }[];
  direction?: string;
}

export default function FleetMapScreen() {
  const { data: fleet } = useFleet();
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

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Live Fleet</Text>
        <Text style={styles.sub}>{list.length} bus{list.length === 1 ? '' : 'es'} active</Text>
      </View>
      <ScrollView contentContainerStyle={styles.busCards}>
        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🚍</Text>
            <Text style={styles.emptyText}>No active trips right now</Text>
            <Text style={styles.emptySub}>Start a trip to see live buses here.</Text>
          </View>
        )}
        {list.map((b) => {
          const fresh = b.updatedAt != null && now - b.updatedAt < 30000;
          return (
            <TouchableOpacity
              key={b.tripId}
              style={styles.busCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/(app)/fleet/${b.tripId}` as never)}
            >
              {/* Mock map for this bus */}
              <MockBusMap
                stops={b.stops}
                live={fresh}
                routeName={b.routeName}
                height={140}
              />

              {/* Info strip below the map */}
              <View style={styles.infoStrip}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.busNum}>{b.vehicleReg ?? b.routeName}</Text>
                  <Text style={styles.busRoute}>
                    {b.routeName} · {b.direction ?? b.status}
                  </Text>
                  {b.driverName && (
                    <Text style={styles.driverLine}>🧑‍✈️ {b.driverName}</Text>
                  )}
                  <Text style={styles.busCords}>
                    {b.lat != null
                      ? `${b.lat.toFixed(4)}, ${b.lng!.toFixed(4)}`
                      : 'Awaiting GPS…'}
                    {b.speed != null ? `  ·  ${Math.round(b.speed * 3.6)} km/h` : ''}
                  </Text>
                </View>
                <View style={styles.liveTag}>
                  <StatusDot variant={fresh ? 'live' : 'offline'} size={8} />
                  <Text style={[styles.liveTagText, !fresh && styles.liveTagStale]}>
                    {fresh ? 'LIVE' : 'STALE'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  headerBar: { padding: spacing[4], paddingBottom: spacing[2] },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.primary },
  sub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  busCards: { padding: spacing[4], paddingTop: spacing[2], gap: spacing[4] },
  empty: { alignItems: 'center', gap: spacing[2], paddingTop: spacing[8] },
  emptyText: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  emptySub: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing[6] },
  busCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    paddingTop: spacing[3],
  },
  busNum: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  busRoute: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  driverLine: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 1 },
  busCords: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 3 },
  liveTag: { alignItems: 'center', gap: 2, paddingTop: 2 },
  liveTagText: { fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.bold },
  liveTagStale: { color: colors.textMuted },
});

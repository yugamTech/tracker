import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

// MapLibre requires a native dev build — it won't be present in Expo Go.
// Catch the TurboModule error so the rest of the app keeps working.
let MapView: any = null;
let Camera: any = null;
let Marker: any = null;
let maplibreAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('@maplibre/maplibre-react-native');
  MapView = m.Map;
  Camera = m.Camera;
  Marker = m.Marker;
  maplibreAvailable = true;
} catch {
  // Running in Expo Go — native module not linked yet.
}
type MapProps = any;
type CameraRef = any;
type LngLat = [number, number];
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontSizes, fontWeights } from '../theme/typography';

export interface LiveBusMapStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface LiveBusMapProps {
  stops: LiveBusMapStop[];
  /** Live bus position. When it changes the bus marker tweens to the new spot. */
  busLat?: number | null;
  busLng?: number | null;
  /** Optional destination (school) marker. */
  schoolLat?: number;
  schoolLng?: number;
  /** Height of the map. Default 200. */
  height?: number;
  routeName?: string;
}

/**
 * Open-source raster style backed by OpenStreetMap tiles — no API key, no token.
 * Passed straight to MapLibre as an inline style spec.
 */
const OSM_STYLE: MapProps['mapStyle'] = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const FALLBACK_CENTER: LngLat = [78.4867, 17.385]; // Hyderabad — used when there are no points yet.
const BOUNDS_PADDING = 48;

/** Smallest [west, south, east, north] box enclosing every point, or null if none. */
function boundsOf(points: LngLat[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let west = points[0][0], east = points[0][0], south = points[0][1], north = points[0][1];
  for (const [lng, lat] of points) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

/**
 * Tweens a [lng, lat] toward each new target so the bus glides between pings
 * instead of teleporting. Returns the current interpolated coordinate.
 */
function useSmoothLngLat(target: LngLat | null): LngLat | null {
  const [coord, setCoord] = useState<LngLat | null>(target);
  const fromRef = useRef<LngLat | null>(target);
  const anim = useRef(new Animated.Value(1)).current;

  const tLng = target?.[0];
  const tLat = target?.[1];
  useEffect(() => {
    if (tLng == null || tLat == null) {
      fromRef.current = null;
      setCoord(null);
      return;
    }
    const to: LngLat = [tLng, tLat];
    const from = fromRef.current;
    // First fix (or re-appearing): snap, don't animate from nowhere.
    if (!from) {
      fromRef.current = to;
      setCoord(to);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value }) => {
      setCoord([from[0] + (to[0] - from[0]) * value, from[1] + (to[1] - from[1]) * value]);
    });
    Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }).start(({ finished }) => {
      if (finished) fromRef.current = to;
    });
    return () => anim.removeListener(id);
  }, [tLng, tLat, anim]);

  return coord;
}

export function LiveBusMap({
  stops,
  busLat,
  busLng,
  schoolLat,
  schoolLng,
  height = 200,
  routeName,
}: LiveBusMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);
  const fittedRef = useRef(false);

  const hasBus = busLat != null && busLng != null;
  const busTarget: LngLat | null = hasBus ? [busLng!, busLat!] : null;
  const busCoord = useSmoothLngLat(busTarget);

  const hasSchool = schoolLat != null && schoolLng != null;

  // Fit the camera to every known point once, on first load.
  useEffect(() => {
    if (!ready || fittedRef.current) return;
    const points: LngLat[] = stops.map((s) => [s.lng, s.lat]);
    if (hasBus) points.push([busLng!, busLat!]);
    if (hasSchool) points.push([schoolLng!, schoolLat!]);

    const box = boundsOf(points);
    if (!box) {
      cameraRef.current?.setStop({ center: FALLBACK_CENTER, zoom: 11, duration: 0 });
    } else if (box[0] === box[2] && box[1] === box[3]) {
      // Single point — bounds would be degenerate, so center + zoom instead.
      cameraRef.current?.setStop({ center: [box[0], box[1]], zoom: 14, duration: 0 });
    } else {
      cameraRef.current?.fitBounds(box, {
        padding: { top: BOUNDS_PADDING, right: BOUNDS_PADDING, bottom: BOUNDS_PADDING, left: BOUNDS_PADDING },
        duration: 0,
      });
    }
    fittedRef.current = true;
  }, [ready, stops, hasBus, busLat, busLng, hasSchool, schoolLat, schoolLng]);

  // Graceful fallback for Expo Go / environments without the native build.
  if (!maplibreAvailable) {
    return (
      <View style={[styles.container, styles.fallback, { height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>Map available in dev build</Text>
        {routeName ? <Text style={styles.fallbackSub}>{routeName}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={OSM_STYLE}
        logo={false}
        compass={false}
        attribution
        onDidFinishLoadingMap={() => setReady(true)}
      >
        <Camera ref={cameraRef} />

        {stops.map((s) => (
          <Marker key={s.id} id={`stop-${s.id}`} lngLat={[s.lng, s.lat]}>
            <View style={styles.stopDot} />
          </Marker>
        ))}

        {hasSchool && (
          <Marker id="school" lngLat={[schoolLng!, schoolLat!]} anchor="bottom">
            <Text style={styles.schoolPin}>🏫</Text>
          </Marker>
        )}

        {busCoord && (
          <Marker id="bus" lngLat={busCoord}>
            <View style={styles.busMarker}>
              <Text style={styles.busEmoji}>🚌</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Lightweight overlay header for route name + live state. */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.livePill}>
          <View style={[styles.liveDot, hasBus && styles.liveDotActive]} />
          <Text style={[styles.liveText, hasBus && styles.liveTextActive]}>{hasBus ? 'LIVE' : 'NO GPS'}</Text>
        </View>
        {routeName ? (
          <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.overlayStrong,
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray500 },
  liveDotActive: { backgroundColor: colors.trackingLive },
  liveText: { fontSize: fontSizes.xs, color: colors.gray400, fontWeight: fontWeights.bold, letterSpacing: 1 },
  liveTextActive: { color: colors.trackingLive },
  routeName: {
    flex: 1, fontSize: fontSizes.xs, color: colors.white, fontWeight: fontWeights.semibold,
    backgroundColor: colors.overlayStrong,
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
    overflow: 'hidden',
  },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  fallbackIcon: { fontSize: 32 },
  fallbackText: { fontSize: fontSizes.sm, color: colors.gray400, fontWeight: fontWeights.semibold },
  fallbackSub: { fontSize: fontSizes.xs, color: colors.gray500 },

  stopDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white,
  },
  schoolPin: { fontSize: 26 },
  busMarker: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.trackingBus,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
    shadowColor: colors.black, shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  busEmoji: { fontSize: fontSizes.md },
});

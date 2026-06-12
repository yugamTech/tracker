import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Button } from '@saarthi/ui';

export default function AttendancePhotoScreen() {
  const { stopId, tripId } = useLocalSearchParams<{ stopId: string; tripId: string }>();
  const [captured, setCaptured] = useState(false);
  const [uploading, setUploading] = useState(false);

  const simulateCapture = () => setCaptured(true);

  const handleConfirm = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      router.back();
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Photo</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.sub}>Stop: {stopId ?? 'Unknown'}</Text>

      {!captured ? (
        <View style={styles.cameraBox}>
          <Text style={{ fontSize: 72 }}>📷</Text>
          <Text style={styles.cameraHint}>Frame all students at this stop</Text>
          <TouchableOpacity style={styles.shutterBtn} onPress={simulateCapture} activeOpacity={0.8}>
            <View style={styles.shutterOuter}>
              <View style={styles.shutterInner} />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.previewBox}>
          <Text style={{ fontSize: 72 }}>🖼️</Text>
          <Text style={styles.previewHint}>Photo captured</Text>
          <Text style={styles.previewSub}>Review before confirming</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setCaptured(false)}>
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <Button
              title={uploading ? 'Uploading…' : 'Confirm & Upload'}
              onPress={handleConfirm}
              loading={uploading}
              size="lg"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5],
  },
  back: { fontSize: 20, color: colors.white, width: 32 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.white },
  sub: { fontSize: fontSizes.sm, color: '#aaa', textAlign: 'center', marginBottom: spacing[2] },
  cameraBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111', margin: spacing[4], borderRadius: radius.xl, gap: spacing[4],
  },
  cameraHint: { fontSize: fontSizes.sm, color: '#aaa' },
  shutterBtn: { position: 'absolute', bottom: spacing[8] },
  shutterOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.white,
  },
  previewBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a1a', margin: spacing[4], borderRadius: radius.xl, gap: spacing[3],
    padding: spacing[6],
  },
  previewHint: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, color: colors.white },
  previewSub: { fontSize: fontSizes.sm, color: '#aaa' },
  actions: { flexDirection: 'row', gap: spacing[3], width: '100%', marginTop: spacing[4] },
  retakeBtn: {
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  retakeText: { fontSize: fontSizes.base, color: colors.white },
});

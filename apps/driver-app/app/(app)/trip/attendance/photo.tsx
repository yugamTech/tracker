import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, fontSizes, fontWeights, radius, Button, useToast } from '@yaanam/ui';
import { attendanceApi, useMarkAttendance } from '@yaanam/api-client';

type Shot = { uri: string; base64: string };

/**
 * Per-child boarding photo. Reached when the driver marks one student BOARDED:
 * capture → preview → retake, then either board WITH the photo (uploaded first,
 * its returned URL attached to that student's attendance record) or board
 * WITHOUT a photo. The photo is for exactly this child at the boarding moment —
 * never a stop-wide group shot.
 */
export default function AttendancePhotoScreen() {
  const { tripId, studentId, studentName } = useLocalSearchParams<{
    stopId: string;
    tripId: string;
    studentId: string;
    studentName?: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);

  const markAttendance = useMarkAttendance();
  const toast = useToast();

  const name = studentName || 'this student';

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    try {
      setBusy(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64) setShot({ uri: photo.uri, base64: photo.base64 });
    } catch {
      toast.error('Could not capture the photo. Please try again.', 'Camera error');
    } finally {
      setBusy(false);
    }
  };

  const board = async (withPhoto: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      let photoUrl: string | undefined;
      if (withPhoto && shot) {
        const filename = `${tripId}-${studentId}-${Date.now()}.jpg`;
        const { url } = await attendanceApi.uploadPhoto(filename, shot.base64, 'image/jpeg');
        photoUrl = url;
      }
      await markAttendance.mutateAsync({ tripId, studentId, type: 'BOARDED', photoUrl });
      router.back();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Please try again.', 'Could not board');
    } finally {
      setBusy(false);
    }
  };

  const close = () => router.back();

  // ── Permission gate ───────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.white} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Header name={name} onClose={close} />
        <View style={styles.permissionBox}>
          <Text style={{ fontSize: 64 }}>📷</Text>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionSub}>
            Allow the camera to take a boarding photo, or board {name} without one.
          </Text>
          <View style={styles.permissionActions}>
            <Button title="Allow camera" onPress={requestPermission} size="lg" fullWidth />
            <TouchableOpacity
              onPress={() => board(false)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Board without photo"
            >
              <Text style={styles.skipText}>{busy ? 'Boarding…' : 'Board without photo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header name={name} onClose={close} />

      {!shot ? (
        <>
          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          </View>
          <Text style={styles.hint}>Take a quick photo of {name} as they board</Text>
          <View style={styles.captureRow}>
            <TouchableOpacity
              onPress={() => board(false)}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Board without photo"
            >
              <Text style={styles.skipText}>Board without photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shutterBtn}
              onPress={capture}
              activeOpacity={0.8}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Take boarding photo of ${name}`}
            >
              <View style={styles.shutterOuter}>
                <View style={styles.shutterInner} />
              </View>
            </TouchableOpacity>
            <View style={{ width: 120 }} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.cameraBox}>
            <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
          <Text style={styles.hint}>Boarding photo for {name}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setShot(null)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
            >
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <Button
              title={busy ? 'Boarding…' : 'Confirm & Board'}
              onPress={() => board(true)}
              loading={busy}
              size="lg"
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Header({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <Text style={styles.back}>✕</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>Boarding photo</Text>
        <Text style={styles.sub} numberOfLines={1}>{name}</Text>
      </View>
      <View style={{ width: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[5] },
  back: { fontSize: 20, color: colors.white, width: 32 },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.white },
  sub: { fontSize: fontSizes.sm, color: '#aaa', marginTop: 2 },
  cameraBox: {
    flex: 1, margin: spacing[4], borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#111',
  },
  hint: { fontSize: fontSizes.sm, color: '#aaa', textAlign: 'center', marginBottom: spacing[3] },
  captureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingBottom: spacing[6],
  },
  shutterBtn: {},
  shutterOuter: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
  skipText: { fontSize: fontSizes.sm, color: '#bbb', width: 120 },
  actions: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  retakeBtn: {
    paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  retakeText: { fontSize: fontSizes.base, color: colors.white },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  permissionTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.white },
  permissionSub: { fontSize: fontSizes.sm, color: '#aaa', textAlign: 'center' },
  permissionActions: { width: '100%', gap: spacing[4], marginTop: spacing[4], alignItems: 'center' },
});

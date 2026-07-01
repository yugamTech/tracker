import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, fontSizes, fontWeights, radius, Button, useToast } from '@yaanam/ui';
import {
  useTodayTrips, useSubmitDailyCheck, useDailyChecks,
  checkWindowInfo, formatTripTime, attendanceApi,
} from '@yaanam/api-client';

type Shot = { uri: string; base64: string };

/** Today's calendar day in IST (`YYYY-MM-DD`) — matches the daily-checks list filter. */
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

const CHECKS = [
  { id: 'tyres', label: 'Tyres inflated properly', icon: '🛞' },
  { id: 'lights', label: 'All lights functional', icon: '💡' },
  { id: 'brakes', label: 'Brakes working', icon: '🔴' },
  { id: 'firstaid', label: 'First aid kit present', icon: '🧰' },
  { id: 'horn', label: 'Horn working', icon: '📯' },
  { id: 'mirrors', label: 'Mirrors adjusted', icon: '🪟' },
];

export default function VehicleCheckScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  // Optional bus-condition photos — captured inline, uploaded on submit.
  const [photos, setPhotos] = useState<Shot[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // When opened from the pre-trip flow, the trip + vehicle arrive as params.
  // Opened standalone (from home), we fall back to the driver's assigned vehicle.
  const params = useLocalSearchParams<{ tripId?: string; vehicleId?: string }>();
  const fromTrip = !!params.tripId;

  // The driver's assigned vehicle for today comes from their (scoped) trips.
  const { data: trips } = useTodayTrips();
  const submitCheck = useSubmitDailyCheck();
  const toast = useToast();

  // Resolve the trip this check is for: the explicit param trip if given, else
  // the driver's first trip with an assigned vehicle today.
  const tripWithVehicle = (trips ?? []).find((t) => !!t.vehicleId);
  const trip = params.tripId
    ? (trips ?? []).find((t) => t.id === params.tripId) ?? tripWithVehicle
    : tripWithVehicle;
  const vehicleId = params.vehicleId ?? trip?.vehicleId;
  const tripId = params.tripId ?? trip?.id;

  // FIX C — has this trip/vehicle already been checked today? Match on tripId
  // (definitive once linked) or vehicleId + same IST day.
  const { data: checks } = useDailyChecks({ vehicleId, date: istToday() });
  const existingCheck = (checks ?? []).find(
    (c) => (!!tripId && c.tripId === tripId) || (!!vehicleId && c.vehicleId === vehicleId),
  );

  // FIX B — a check may only be submitted within 2h before scheduledStart.
  const window = checkWindowInfo(trip);

  const toggle = (id: string) => setChecked((s) => ({ ...s, [id]: !s[id] }));
  const allDone = CHECKS.every((c) => checked[c.id]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        toast.error('Allow camera access to add a bus photo, or submit without one.', 'Camera access needed');
        return;
      }
    }
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64) setPhotos((p) => [...p, { uri: photo.uri, base64: photo.base64! }]);
    } catch {
      toast.error('Could not capture the photo. Please try again.', 'Camera error');
    } finally {
      setCameraOpen(false);
    }
  };

  const removePhoto = (uri: string) => setPhotos((p) => p.filter((s) => s.uri !== uri));

  const handleSubmit = async () => {
    if (!allDone) { toast.error('Complete all checks first'); return; }
    if (!window.canSubmit) { toast.error(window.reason ?? 'Check not yet available.', 'Too early'); return; }
    if (!vehicleId) {
      toast.error('You have no trip with an assigned vehicle today, so this check can’t be linked to a bus.', 'No vehicle assigned');
      return;
    }
    // Persist the full checklist result (every item true/false), not just toggles.
    const items = CHECKS.reduce<Record<string, boolean>>((acc, c) => {
      acc[c.id] = !!checked[c.id];
      return acc;
    }, {});

    // Upload any bus-condition photos first (reuses the shared /attendance/photo
    // upload path); their returned URLs ride along in the check payload.
    let photoUrls: string[] | undefined;
    if (photos.length) {
      try {
        setUploading(true);
        photoUrls = [];
        for (let i = 0; i < photos.length; i++) {
          const filename = `daily-checks/${vehicleId}-${tripId ?? 'novehicletrip'}-${i}-${Date.now()}.jpg`;
          const { url } = await attendanceApi.uploadPhoto(filename, photos[i].base64, 'image/jpeg');
          photoUrls.push(url);
        }
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'Could not upload the bus photos. Please try again.', 'Upload failed');
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    submitCheck.mutate(
      { vehicleId, tripId, items, note: note.trim() || undefined, photoUrls },
      {
        onSuccess: () => {
          toast.success('Vehicle check submitted.', 'Check complete');
          // From the pre-trip flow, return to that screen so its query
          // re-fetches and "Start Trip" unlocks; otherwise go back.
          if (fromTrip) {
            router.replace(`/(app)/trip/${params.tripId}` as never);
          } else {
            router.back();
          }
        },
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to submit check'),
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Vehicle Check</Text>
        <View style={{ width: 40 }} />
      </View>

      {existingCheck ? (
        // FIX C — already checked: show the result read-only, no resubmit.
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.doneBanner}>
            <Text style={styles.doneTitle}>
              Checked at {formatTripTime(existingCheck.createdAt)} ✓
            </Text>
            <Text style={styles.doneSub}>This vehicle has already been checked for this trip.</Text>
          </View>
          {CHECKS.map((c) => {
            const ok = existingCheck.items?.[c.id];
            return (
              <View key={c.id} style={styles.checkItem}>
                <Text style={{ fontSize: 28 }}>{c.icon}</Text>
                <Text style={styles.checkLabel}>{c.label}</Text>
                <Text style={[styles.resultMark, { color: ok ? colors.success : colors.error }]}>
                  {ok ? '✓' : '✗'}
                </Text>
              </View>
            );
          })}
          {!!existingCheck.note && (
            <>
              <Text style={styles.label}>Note</Text>
              <Text style={styles.noteReadonly}>{existingCheck.note}</Text>
            </>
          )}
          {existingCheck.photoUrls?.length > 0 && (
            <>
              <Text style={styles.label}>Bus condition photos</Text>
              <View style={styles.photoRow}>
                {existingCheck.photoUrls.map((url) => (
                  <View key={url} style={styles.photoThumb}>
                    <Image source={{ uri: url }} style={styles.photoImg} resizeMode="cover" />
                  </View>
                ))}
              </View>
            </>
          )}
          <Button
            title="Back"
            variant="outline"
            onPress={() => router.back()}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[4] }}
          />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>Complete daily pre-trip checklist</Text>
          {CHECKS.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.checkItem}
              onPress={() => toggle(c.id)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!checked[c.id] }}
              accessibilityLabel={c.label}
            >
              <Text style={{ fontSize: 28 }}>{c.icon}</Text>
              <Text style={styles.checkLabel}>{c.label}</Text>
              <View style={[styles.checkbox, checked[c.id] && styles.checkboxChecked]}>
                {checked[c.id] && <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>✓</Text>}
              </View>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Anything to flag? e.g. low tyre pressure on rear-left"
            placeholderTextColor={colors.gray400}
            multiline
          />

          <Text style={styles.label}>Bus condition photos (optional)</Text>
          <View style={styles.photoRow}>
            {photos.map((p) => (
              <View key={p.uri} style={styles.photoThumb}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removePhoto(p.uri)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <Text style={styles.photoRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.photoAdd}
              onPress={openCamera}
              accessibilityRole="button"
              accessibilityLabel="Add bus photo"
            >
              <Text style={{ fontSize: 22 }}>📷</Text>
              <Text style={styles.photoAddText}>Add</Text>
            </TouchableOpacity>
          </View>

          {!vehicleId && (
            <Text style={styles.warn}>No trip with an assigned vehicle today — submit will be disabled.</Text>
          )}
          {vehicleId && !window.canSubmit && (
            <Text style={styles.warn}>{window.reason}</Text>
          )}

          <Button
            title={
              uploading
                ? 'Uploading photos…'
                : !window.canSubmit && window.opensAt
                  ? `Available from ${formatTripTime(window.opensAt)}`
                  : allDone
                    ? '✅ Submit Check'
                    : `${Object.values(checked).filter(Boolean).length}/${CHECKS.length} Done`
            }
            onPress={handleSubmit}
            loading={submitCheck.isPending || uploading}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[4] }}
            disabled={!allDone || !vehicleId || !window.canSubmit || uploading}
          />
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Inline capture — opens over the form; one shot appended per confirm. */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <SafeAreaView style={styles.cameraModal}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setCameraOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close camera">
              <Text style={styles.cameraClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Bus condition photo</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.cameraBox}>
            {cameraOpen && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />}
          </View>
          <View style={styles.cameraCaptureRow}>
            <TouchableOpacity
              style={styles.shutterBtn}
              onPress={capture}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Take bus photo"
            >
              <View style={styles.shutterOuter}><View style={styles.shutterInner} /></View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { fontSize: fontSizes.sm, color: '#0EA5E9', fontWeight: fontWeights.medium },
  title: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  content: { padding: spacing[5], gap: spacing[3] },
  subtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing[2] },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  checkLabel: { flex: 1, fontSize: fontSizes.base, color: colors.textPrimary },
  checkbox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textSecondary, marginTop: spacing[2] },
  noteInput: {
    backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing[3], fontSize: fontSizes.base, color: colors.textPrimary, minHeight: 64, textAlignVertical: 'top',
  },
  warn: { fontSize: fontSizes.xs, color: colors.error, marginTop: spacing[1] },
  doneBanner: {
    padding: spacing[4], borderRadius: radius.lg,
    backgroundColor: colors.successBg, marginBottom: spacing[2],
  },
  doneTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.success },
  doneSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing[1] },
  resultMark: { fontSize: 20, fontWeight: '700' },
  noteReadonly: {
    backgroundColor: colors.gray50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing[3], fontSize: fontSizes.base, color: colors.textPrimary,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  photoThumb: { width: 72, height: 72, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.gray100 },
  photoImg: { width: 72, height: 72 },
  photoRemove: {
    position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  photoAdd: {
    width: 72, height: 72, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50,
  },
  photoAddText: { fontSize: fontSizes.xs, color: colors.textSecondary },
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4] },
  cameraClose: { fontSize: 20, color: colors.white },
  cameraTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.white },
  cameraBox: { flex: 1, margin: spacing[4], borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#111' },
  cameraCaptureRow: { alignItems: 'center', paddingBottom: spacing[6] },
  shutterBtn: {},
  shutterOuter: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
});

import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { onboardingApi, type ImportEntityType, type PickedFile } from '@saarthi/api-client';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** ArrayBuffer → base64. Self-contained (RN has neither btoa nor Buffer). */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

/**
 * Download the .xlsx template for an entity type and hand it to the user:
 * a real file download on web, the OS share sheet on native.
 */
export async function downloadTemplate(type: ImportEntityType): Promise<void> {
  const buffer = await onboardingApi.downloadTemplate(type);
  const filename = `${type}-template.xlsx`;

  if (Platform.OS === 'web') {
    const blob = new Blob([buffer], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, dialogTitle: filename });
  }
}

/** Pick a spreadsheet. Returns null if the user cancels. */
export async function pickSpreadsheet(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      XLSX_MIME,
      'application/vnd.ms-excel',
      '.xlsx',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];

  // On web the picker exposes the real File for direct multipart upload.
  const webFile = (asset as { file?: Blob }).file;
  return {
    uri: asset.uri,
    name: asset.name ?? 'import.xlsx',
    mimeType: asset.mimeType ?? XLSX_MIME,
    blob: Platform.OS === 'web' ? webFile : undefined,
  };
}

/** Download the per-row error report as a CSV the admin can fix against. */
export async function downloadErrorReport(
  type: ImportEntityType,
  errors: { row: number; field: string; message: string }[],
): Promise<void> {
  const header = 'row,field,message\n';
  const body = errors
    .map((e) => `${e.row},${e.field},"${String(e.message).replace(/"/g, '""')}"`)
    .join('\n');
  const csv = header + body;
  const filename = `${type}-import-errors.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename });
  }
}

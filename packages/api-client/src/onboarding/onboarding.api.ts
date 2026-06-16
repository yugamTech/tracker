import { apiClient } from '../axios';

// Bulk Excel import (PRD-01 FR-16–21).

export type ImportEntityType =
  | 'students'
  | 'staff'
  | 'vehicles'
  | 'routes_stops'
  | 'age_groups';

export interface ColumnSpec {
  key: string;
  required: boolean;
  hint: string;
  example: string;
}

export interface EntityTemplate {
  type: ImportEntityType;
  label: string;
  description: string;
  columns: ColumnSpec[];
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  type: ImportEntityType;
  totalRows: number;
  willCreate: number;
  willUpdate: number;
  errors: RowError[];
}

export interface CommitResult extends ValidationResult {
  batchId: string;
  status: 'COMMITTED' | 'FAILED';
  createdCount: number;
  updatedCount: number;
  errorCount: number;
}

/**
 * A picked file. On native, expo-document-picker gives a `uri` and React Native
 * FormData uploads the { uri, name, type } shape. On web, the picker exposes the
 * real `File`/Blob in `blob`, which must be appended directly. We support both.
 */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  blob?: Blob;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function fileFormData(file: PickedFile): FormData {
  const form = new FormData();
  if (file.blob) {
    form.append('file', file.blob, file.name);
  } else {
    // React Native FormData accepts the { uri, name, type } shape.
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || XLSX_MIME,
    } as unknown as Blob);
  }
  return form;
}

export const onboardingApi = {
  listTemplates: async (): Promise<EntityTemplate[]> => {
    const { data } = await apiClient.get('/onboarding/templates');
    return data.data;
  },

  /** Download the .xlsx template as raw bytes (caller saves/shares it). */
  downloadTemplate: async (type: ImportEntityType): Promise<ArrayBuffer> => {
    const { data } = await apiClient.get('/onboarding/template', {
      params: { type },
      responseType: 'arraybuffer',
    });
    return data as ArrayBuffer;
  },

  validate: async (type: ImportEntityType, file: PickedFile): Promise<ValidationResult> => {
    const { data } = await apiClient.post('/onboarding/validate', fileFormData(file), {
      params: { type },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  commit: async (type: ImportEntityType, file: PickedFile): Promise<CommitResult> => {
    const { data } = await apiClient.post('/onboarding/commit', fileFormData(file), {
      params: { type },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
};

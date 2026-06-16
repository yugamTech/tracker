import { create } from 'zustand';
import type {
  ImportEntityType,
  PickedFile,
  ValidationResult,
  CommitResult,
} from '@saarthi/api-client';

/**
 * Shared state for the bulk-import wizard, which spans three routes
 * (import → preview → result). expo-router can't carry the validation result /
 * picked file through URL params, so the wizard keeps it here.
 */
interface ImportState {
  type: ImportEntityType | null;
  file: PickedFile | null;
  validation: ValidationResult | null;
  result: CommitResult | null;
  set: (patch: Partial<Omit<ImportState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  type: null,
  file: null,
  validation: null,
  result: null,
  set: (patch) => set(patch),
  reset: () => set({ type: null, file: null, validation: null, result: null }),
}));

import { create } from 'zustand';

/** Per-day outcome of a "+ Schedule" batch (one trip is created per selected day). */
export interface ScheduleDayResult {
  /** `YYYY-MM-DD` day key. */
  key: string;
  ok: boolean;
  /** Failure reason when `ok` is false. */
  message?: string;
}

/**
 * Hands the post-submit summary from the scheduler form to its result screen.
 * The form must never be left in a terminal "done" state (the Drawer keeps it
 * mounted), so on success it stows the tally here and navigates away — the
 * result lives on its own route, not as an in-form overlay.
 */
interface ScheduleResultState {
  results: ScheduleDayResult[];
  set: (results: ScheduleDayResult[]) => void;
  reset: () => void;
}

export const useScheduleResultStore = create<ScheduleResultState>((set) => ({
  results: [],
  set: (results) => set({ results }),
  reset: () => set({ results: [] }),
}));

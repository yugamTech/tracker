import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateShiftInput } from '@yaanam/types';
import { shiftsApi } from './shifts.api';

export const shiftKeys = {
  all: ['shifts'] as const,
};

/**
 * Shifts (AgeGroups) hit the same `/age-groups` endpoint as the legacy
 * `useAgeGroups` student-form picker, so every mutation invalidates BOTH caches —
 * the Shifts screen AND the student-creation age-group list stay in sync.
 */
const AGE_GROUP_KEY = ['identity', 'age-groups'] as const;

export const useShifts = () => useQuery({ queryKey: shiftKeys.all, queryFn: shiftsApi.list });

export const useCreateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shiftsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
      qc.invalidateQueries({ queryKey: AGE_GROUP_KEY });
    },
  });
};

export const useUpdateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & UpdateShiftInput) => shiftsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
      qc.invalidateQueries({ queryKey: AGE_GROUP_KEY });
    },
  });
};

export const useDeleteShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shiftsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
      qc.invalidateQueries({ queryKey: AGE_GROUP_KEY });
    },
  });
};

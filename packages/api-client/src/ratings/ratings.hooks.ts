import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResolutionRatingInput } from '@yaanam/types';
import { ratingsApi } from './ratings.api';
import { complaintKeys } from '../complaints/complaints.hooks';

// Submit the resolution rating, then refresh the complaint detail + lists so the
// parent sees the new status and the admin queue reflects the reopen/escalation.
export const useSubmitResolutionRating = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ complaintId, ...dto }: { complaintId: string } & ResolutionRatingInput) =>
      ratingsApi.submitResolutionRating(complaintId, dto),
    onSuccess: (_, { complaintId }) => {
      qc.invalidateQueries({ queryKey: complaintKeys.detail(complaintId) });
      qc.invalidateQueries({ queryKey: complaintKeys.all });
      qc.invalidateQueries({ queryKey: ['complaints', 'all'] });
    },
  });
};

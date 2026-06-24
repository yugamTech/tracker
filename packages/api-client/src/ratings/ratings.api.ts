import { apiClient } from '../axios';
import type { Complaint, ResolutionRating, ResolutionRatingInput } from '@yaanam/types';

export type { ResolutionRating, ResolutionRatingInput } from '@yaanam/types';

export const ratingsApi = {
  // Submit the parent's satisfaction step for a RESOLVED complaint. Returns the
  // updated complaint (now PARENT_RATING if satisfied, REOPENED if not).
  submitResolutionRating: async (
    complaintId: string,
    dto: ResolutionRatingInput,
  ): Promise<Complaint> => {
    const { data } = await apiClient.post(`/ratings/resolution/${complaintId}`, dto);
    return data.data as Complaint;
  },
};

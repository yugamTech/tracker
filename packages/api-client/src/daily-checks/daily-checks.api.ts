import { apiClient } from '../axios';

export interface DailyCheck {
  id: string;
  tenantId: string;
  tripId: string | null;
  vehicleId: string;
  submittedById: string;
  items: Record<string, boolean>;
  note: string | null;
  photoUrls: string[];
  createdAt: string;
}

export interface SubmitDailyCheckDto {
  vehicleId: string;
  tripId?: string;
  items: Record<string, boolean>;
  note?: string;
  photoUrls?: string[];
}

/** Curated, parent-facing bus-condition photo record (last 30 days). */
export interface BusConditionPhotos {
  id: string;
  createdAt: string;
  note: string | null;
  photoUrls: string[];
}

export const dailyChecksApi = {
  submit: async (dto: SubmitDailyCheckDto): Promise<DailyCheck> => {
    const { data } = await apiClient.post('/daily-checks', dto);
    return data.data;
  },

  list: async (params?: { vehicleId?: string; date?: string }): Promise<DailyCheck[]> => {
    const { data } = await apiClient.get('/daily-checks', { params });
    return data.data;
  },

  /** Bus-condition photos for the vehicle on a parent's child's trip (guardian-scoped). */
  busPhotos: async (tripId: string): Promise<BusConditionPhotos[]> => {
    const { data } = await apiClient.get(`/daily-checks/trip/${tripId}/bus-photos`);
    return data.data;
  },
};

import { apiClient } from '../axios';

export interface DailyCheck {
  id: string;
  tenantId: string;
  tripId: string | null;
  vehicleId: string;
  submittedById: string;
  items: Record<string, boolean>;
  note: string | null;
  createdAt: string;
}

export interface SubmitDailyCheckDto {
  vehicleId: string;
  tripId?: string;
  items: Record<string, boolean>;
  note?: string;
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
};

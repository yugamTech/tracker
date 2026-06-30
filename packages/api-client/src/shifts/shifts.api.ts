import { apiClient } from '../axios';
import type { Shift, CreateShiftInput, UpdateShiftInput } from '@yaanam/types';

/**
 * Shifts CRUD — backed by the `/age-groups` endpoints (an AgeGroup IS the shift).
 * Surfaced in the admin app as "Shifts".
 */
export const shiftsApi = {
  list: async (): Promise<Shift[]> => {
    const { data } = await apiClient.get('/age-groups');
    return data.data as Shift[];
  },

  create: async (dto: CreateShiftInput): Promise<Shift> => {
    const { data } = await apiClient.post('/age-groups', dto);
    return data.data as Shift;
  },

  update: async (id: string, dto: UpdateShiftInput): Promise<Shift> => {
    const { data } = await apiClient.patch(`/age-groups/${id}`, dto);
    return data.data as Shift;
  },

  /** Hard-delete a shift (server returns 409 if any student still belongs to it). */
  remove: async (id: string): Promise<{ id: string; deleted: boolean }> => {
    const { data } = await apiClient.delete(`/age-groups/${id}`);
    return data.data as { id: string; deleted: boolean };
  },
};

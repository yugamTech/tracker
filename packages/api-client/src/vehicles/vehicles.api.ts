import { apiClient } from '../axios';

export interface Vehicle {
  id: string;
  tenantId: string;
  regNumber: string;
  capacity: number;
  type?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  assignments: Array<{
    id: string;
    effectiveFrom: string;
    effectiveTo?: string;
    membership: {
      id: string;
      role: string;
      person: { id: string; name: string; phone: string };
    };
  }>;
}

export const vehiclesApi = {
  list: async (): Promise<Vehicle[]> => {
    const { data } = await apiClient.get('/vehicles');
    return data.data;
  },

  getById: async (id: string): Promise<Vehicle> => {
    const { data } = await apiClient.get(`/vehicles/${id}`);
    return data.data;
  },

  create: async (dto: { regNumber: string; capacity: number; type?: string }): Promise<Vehicle> => {
    const { data } = await apiClient.post('/vehicles', dto);
    return data.data;
  },

  update: async (id: string, dto: Partial<{ regNumber: string; capacity: number; type: string; status: string }>): Promise<Vehicle> => {
    const { data } = await apiClient.patch(`/vehicles/${id}`, dto);
    return data.data;
  },

  deactivate: async (id: string): Promise<Vehicle> => {
    const { data } = await apiClient.post(`/vehicles/${id}/deactivate`);
    return data.data;
  },
};

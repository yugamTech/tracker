import { apiClient } from '../axios';

export interface Stop {
  id: string;
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceRadius?: number;
}

export interface Route {
  id: string;
  tenantId: string;
  name: string;
  direction: 'PICKUP' | 'DROP';
  status: 'ACTIVE' | 'INACTIVE';
  stops: Array<{ sequence: number; stop: Stop }>;
  _count?: { students: number };
}

export const routesApi = {
  list: async (): Promise<Route[]> => {
    const { data } = await apiClient.get('/routes');
    return data.data;
  },

  getById: async (id: string): Promise<Route> => {
    const { data } = await apiClient.get(`/routes/${id}`);
    return data.data;
  },

  create: async (dto: { name: string; direction: 'PICKUP' | 'DROP' }): Promise<Route> => {
    const { data } = await apiClient.post('/routes', dto);
    return data.data;
  },

  update: async (id: string, dto: Partial<{ name: string; status: string }>): Promise<Route> => {
    const { data } = await apiClient.patch(`/routes/${id}`, dto);
    return data.data;
  },

  addStop: async (routeId: string, dto: { stopId: string; sequence: number }) => {
    const { data } = await apiClient.post(`/routes/${routeId}/stops`, dto);
    return data.data;
  },

  removeStop: async (routeId: string, stopId: string) => {
    const { data } = await apiClient.delete(`/routes/${routeId}/stops/${stopId}`);
    return data.data;
  },
};

export const stopsApi = {
  list: async (): Promise<Stop[]> => {
    const { data } = await apiClient.get('/stops');
    return data.data;
  },

  create: async (dto: { name: string; lat: number; lng: number; geofenceRadius?: number }): Promise<Stop> => {
    const { data } = await apiClient.post('/stops', dto);
    return data.data;
  },

  update: async (id: string, dto: Partial<{ name: string; lat: number; lng: number; geofenceRadius: number }>): Promise<Stop> => {
    const { data } = await apiClient.patch(`/stops/${id}`, dto);
    return data.data;
  },
};

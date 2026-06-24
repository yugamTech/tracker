import { apiClient } from '../axios';

/** Hard-delete eligibility for a record (embedded in detail payloads). */
export interface DeleteEligibility {
  canDelete: boolean;
  reason: string | null;
}

export interface Stop {
  id: string;
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceRadius?: number;
}

/** A student as embedded in a route detail payload (subset used by the UI). */
export interface RouteStudent {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  stopId?: string | null;
  stop?: Stop | null;
}

export interface Route {
  id: string;
  tenantId: string;
  name: string;
  direction: 'PICKUP' | 'DROP';
  status: 'ACTIVE' | 'INACTIVE';
  stops: Array<{ sequence: number; stop: Stop }>;
  _count?: { students: number };
  /** ACTIVE students pinned to a stop on this route — the roster a trip would carry (list payload). */
  eligibleRiderCount?: number;
  /** Full student list (route detail payload only). */
  students?: RouteStudent[];
  /** Hard-delete eligibility (route detail payload only). */
  deletable?: DeleteEligibility;
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

  deactivate: async (id: string): Promise<Route> => {
    const { data } = await apiClient.post(`/routes/${id}/deactivate`);
    return data.data;
  },

  reactivate: async (id: string): Promise<Route> => {
    const { data } = await apiClient.post(`/routes/${id}/reactivate`);
    return data.data;
  },

  /** Permanent hard-delete (only when the route has no trip history). */
  remove: async (id: string): Promise<{ id: string; deleted: boolean }> => {
    const { data } = await apiClient.delete(`/routes/${id}`);
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

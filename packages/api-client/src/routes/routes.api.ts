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

/** Designated bus embedded in route payloads (subset used by the UI). */
export interface RouteVehicle {
  id: string;
  regNumber: string;
  capacity: number;
  type?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
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
  /** Designated bus for this route (null when none set). */
  vehicleId?: string | null;
  vehicle?: RouteVehicle | null;
  /** ACTIVE students assigned to the route (seats taken on the designated bus). */
  seatsUsed?: number;
  /** Designated bus capacity, or null when no bus is set. */
  capacity?: number | null;
  /** Full student list (route detail payload only). */
  students?: RouteStudent[];
  /** Hard-delete eligibility (route detail payload only). */
  deletable?: DeleteEligibility;
}

/** A contactable person in the emergency directory (driver/conductor). */
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

/** A staff member (typically a teacher) assigned to ride a route. */
export interface EmergencyTeacher {
  membershipId: string;
  name: string;
  phone: string;
  role: string;
}

/** One route's "who's aboard" entry in the emergency directory (fleet-integrity §3). */
export interface EmergencyRouteEntry {
  routeId: string;
  routeName: string;
  direction: 'PICKUP' | 'DROP';
  status: 'ACTIVE' | 'INACTIVE';
  vehicle: RouteVehicle | null;
  seatsUsed: number;
  capacity: number | null;
  /** Driver(s) on this route from today's / live trips. */
  drivers: EmergencyContact[];
  /** Conductor(s) on this route from today's / live trips. */
  conductors: EmergencyContact[];
  /** Teachers / staff assigned to this route (RouteStaff). */
  teachers: EmergencyTeacher[];
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

  update: async (id: string, dto: Partial<{ name: string; status: string; vehicleId: string }>): Promise<Route> => {
    const { data } = await apiClient.patch(`/routes/${id}`, dto);
    return data.data;
  },

  /** Emergency "who's on which bus/route" directory (admin/manager only). */
  emergencyDirectory: async (): Promise<EmergencyRouteEntry[]> => {
    const { data } = await apiClient.get('/routes/emergency');
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

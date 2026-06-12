import { apiClient } from '../axios';

export interface Person {
  id: string;
  phone: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface Membership {
  id: string;
  tenantId: string;
  tenantName: string;
  role: string;
}

export interface Student {
  id: string;
  name: string;
  regId?: string;
  status: string;
  ageGroupId: string;
  routeId?: string;
  stopId?: string;
  tenantId: string;
  ageGroup?: { id: string; name: string; pickupTime: string; dropTime: string };
  stop?: { id: string; name: string; lat: number; lng: number };
  route?: { id: string; name: string; direction: string };
}

export interface Member {
  id: string;
  role: string;
  status: string;
  personId: string;
  tenantId: string;
  person: Person;
  vehicleAssignments?: Array<{
    id: string;
    vehicle: { id: string; regNumber: string };
  }>;
}

export const identityApi = {
  getMe: async (): Promise<Person & { memberships: Membership[] }> => {
    const { data } = await apiClient.get('/persons/me');
    return data.data;
  },

  updateMe: async (dto: Partial<{ name: string; email: string; avatarUrl: string }>): Promise<Person> => {
    const { data } = await apiClient.patch('/persons/me', dto);
    return data.data;
  },

  getMyStudents: async (): Promise<Student[]> => {
    const { data } = await apiClient.get('/students/my');
    return data.data;
  },

  listStudents: async (): Promise<Student[]> => {
    const { data } = await apiClient.get('/students');
    return data.data;
  },

  getStudentById: async (id: string): Promise<Student> => {
    const { data } = await apiClient.get(`/students/${id}`);
    return data.data;
  },

  createStudent: async (dto: {
    name: string;
    regId?: string;
    ageGroupId: string;
    routeId?: string;
    stopId?: string;
  }): Promise<Student> => {
    const { data } = await apiClient.post('/students', dto);
    return data.data;
  },

  updateStudent: async (id: string, dto: Partial<{
    name: string;
    regId: string;
    ageGroupId: string;
    routeId: string;
    stopId: string;
    status: string;
  }>): Promise<Student> => {
    const { data } = await apiClient.patch(`/students/${id}`, dto);
    return data.data;
  },

  listMembers: async (role?: string): Promise<Member[]> => {
    const { data } = await apiClient.get('/members', { params: role ? { role } : undefined });
    return data.data;
  },

  getMemberById: async (id: string): Promise<Member> => {
    const { data } = await apiClient.get(`/members/${id}`);
    return data.data;
  },

  listAgeGroups: async () => {
    const { data } = await apiClient.get('/age-groups');
    return data.data as Array<{ id: string; name: string; pickupTime: string; dropTime: string; _count: { students: number } }>;
  },

  getMyTenant: async () => {
    const { data } = await apiClient.get('/tenants/me');
    return data.data as { id: string; name: string; timezone: string; locale: string };
  },
};

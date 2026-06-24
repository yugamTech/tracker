import { apiClient } from '../axios';
import type { DeleteEligibility } from '../routes/routes.api';

export type { DeleteEligibility };

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
  guardianships?: Array<{
    id: string;
    relation: string;
    isPrimary?: boolean;
    person: { id: string; name: string; phone: string; email?: string };
  }>;
  /** Hard-delete eligibility (student detail payload only). */
  deletable?: DeleteEligibility;
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
  /** Hard-delete eligibility (member detail payload only). */
  deletable?: DeleteEligibility;
}

export interface ParentStudent {
  id: string;
  name: string;
  status: string;
  regId?: string;
}

export interface Parent {
  id: string;
  role: string;
  status: string;
  personId: string;
  tenantId: string;
  person: Person & {
    guardianships: Array<{
      id: string;
      relation: string;
      student: ParentStudent;
    }>;
  };
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
    parentName?: string;
    parentPhone?: string;
    relation?: string;
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

  deactivateStudent: async (id: string): Promise<Student> => {
    const { data } = await apiClient.post(`/students/${id}/deactivate`);
    return data.data;
  },

  reactivateStudent: async (id: string): Promise<Student> => {
    const { data } = await apiClient.post(`/students/${id}/reactivate`);
    return data.data;
  },

  /** Permanent hard-delete (only when the student has no operational history). */
  deleteStudent: async (id: string): Promise<{ id: string; deleted: boolean }> => {
    const { data } = await apiClient.delete(`/students/${id}`);
    return data.data;
  },

  listMembers: async (role?: string, includeInactive?: boolean): Promise<Member[]> => {
    const params: Record<string, string> = {};
    if (role) params.role = role;
    if (includeInactive) params.includeInactive = 'true';
    const { data } = await apiClient.get('/members', {
      params: Object.keys(params).length ? params : undefined,
    });
    return data.data;
  },

  getMemberById: async (id: string): Promise<Member> => {
    const { data } = await apiClient.get(`/members/${id}`);
    return data.data;
  },

  createMember: async (dto: {
    name: string;
    phone: string;
    role: string;
    email?: string;
  }): Promise<Member> => {
    const { data } = await apiClient.post('/members', dto);
    return data.data;
  },

  updateMember: async (id: string, dto: Partial<{
    name: string;
    email: string;
    role: string;
  }>): Promise<Member> => {
    const { data } = await apiClient.patch(`/members/${id}`, dto);
    return data.data;
  },

  deactivateMember: async (id: string): Promise<Member> => {
    const { data } = await apiClient.post(`/members/${id}/deactivate`);
    return data.data;
  },

  reactivateMember: async (id: string): Promise<Member> => {
    const { data } = await apiClient.post(`/members/${id}/reactivate`);
    return data.data;
  },

  /** Permanent hard-delete (only when the staff member has no run-trip history). */
  deleteMember: async (id: string): Promise<{ id: string; deleted: boolean; personDeleted: boolean }> => {
    const { data } = await apiClient.delete(`/members/${id}`);
    return data.data;
  },

  listParents: async (includeInactive?: boolean): Promise<Parent[]> => {
    const params: Record<string, string> = {};
    if (includeInactive) params.includeInactive = 'true';
    const { data } = await apiClient.get('/members/parents', {
      params: Object.keys(params).length ? params : undefined,
    });
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

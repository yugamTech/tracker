import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { identityApi } from './identity.api';

export const identityKeys = {
  me: ['identity', 'me'] as const,
  myStudents: ['identity', 'students', 'my'] as const,
  students: (tenantId?: string) => ['identity', 'students', tenantId] as const,
  student: (id: string) => ['identity', 'students', id] as const,
  members: (role?: string) => ['identity', 'members', role] as const,
  member: (id: string) => ['identity', 'members', id] as const,
  ageGroups: ['identity', 'age-groups'] as const,
  tenant: ['identity', 'tenant'] as const,
};

export const useMe = () =>
  useQuery({ queryKey: identityKeys.me, queryFn: identityApi.getMe });

export const useUpdateMe = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Parameters<typeof identityApi.updateMe>[0]) => identityApi.updateMe(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: identityKeys.me }),
  });
};

export const useMyStudents = () =>
  useQuery({ queryKey: identityKeys.myStudents, queryFn: identityApi.getMyStudents });

export const useStudents = () =>
  useQuery({ queryKey: identityKeys.students(), queryFn: identityApi.listStudents });

export const useStudentById = (id: string) =>
  useQuery({ queryKey: identityKeys.student(id), queryFn: () => identityApi.getStudentById(id), enabled: !!id });

export const useCreateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: identityApi.createStudent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'students'] }),
  });
};

export const useUpdateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Parameters<typeof identityApi.updateStudent>[1]) =>
      identityApi.updateStudent(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: identityKeys.student(id) });
      qc.invalidateQueries({ queryKey: ['identity', 'students'] });
    },
  });
};

export const useMembers = (role?: string) =>
  useQuery({ queryKey: identityKeys.members(role), queryFn: () => identityApi.listMembers(role) });

export const useMemberById = (id: string) =>
  useQuery({ queryKey: identityKeys.member(id), queryFn: () => identityApi.getMemberById(id), enabled: !!id });

export const useCreateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: identityApi.createMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'members'] }),
  });
};

export const useUpdateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Parameters<typeof identityApi.updateMember>[1]) =>
      identityApi.updateMember(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: identityKeys.member(id) });
      qc.invalidateQueries({ queryKey: ['identity', 'members'] });
    },
  });
};

export const useDeactivateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.deactivateMember(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: identityKeys.member(id) });
      qc.invalidateQueries({ queryKey: ['identity', 'members'] });
    },
  });
};

export const useAgeGroups = () =>
  useQuery({ queryKey: identityKeys.ageGroups, queryFn: identityApi.listAgeGroups });

export const useMyTenant = () =>
  useQuery({ queryKey: identityKeys.tenant, queryFn: identityApi.getMyTenant });

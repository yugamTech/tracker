import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { identityApi } from './identity.api';

export const identityKeys = {
  me: ['identity', 'me'] as const,
  myStudents: ['identity', 'students', 'my'] as const,
  students: (tenantId?: string) => ['identity', 'students', tenantId] as const,
  student: (id: string) => ['identity', 'students', id] as const,
  members: (role?: string, includeInactive?: boolean) =>
    ['identity', 'members', role, includeInactive ?? false] as const,
  member: (id: string) => ['identity', 'members', id] as const,
  parents: (includeInactive?: boolean) => ['identity', 'parents', includeInactive ?? false] as const,
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

export const useDeactivateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.deactivateStudent(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: identityKeys.student(id) });
      qc.invalidateQueries({ queryKey: ['identity', 'students'] });
    },
  });
};

export const useReactivateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.reactivateStudent(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: identityKeys.student(id) });
      qc.invalidateQueries({ queryKey: ['identity', 'students'] });
    },
  });
};

export const useDeleteStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.deleteStudent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'students'] }),
  });
};

export const useMembers = (role?: string, includeInactive?: boolean) =>
  useQuery({
    queryKey: identityKeys.members(role, includeInactive),
    queryFn: () => identityApi.listMembers(role, includeInactive),
  });

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

export const useReactivateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.reactivateMember(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: identityKeys.member(id) });
      qc.invalidateQueries({ queryKey: ['identity', 'members'] });
    },
  });
};

export const useDeleteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.deleteMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity', 'members'] }),
  });
};

export const useParents = (includeInactive?: boolean) =>
  useQuery({
    queryKey: identityKeys.parents(includeInactive),
    queryFn: () => identityApi.listParents(includeInactive),
  });

export const useAgeGroups = () =>
  useQuery({ queryKey: identityKeys.ageGroups, queryFn: identityApi.listAgeGroups });

export const useMyTenant = () =>
  useQuery({ queryKey: identityKeys.tenant, queryFn: identityApi.getMyTenant });

export const useUpdateMyTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Parameters<typeof identityApi.updateMyTenant>[0]) => identityApi.updateMyTenant(dto),
    onSuccess: (updated) => {
      // Seed the cache with the server's response so the Settings screens reflect
      // the saved state immediately, then revalidate.
      qc.setQueryData(identityKeys.tenant, updated);
      qc.invalidateQueries({ queryKey: identityKeys.tenant });
    },
  });
};

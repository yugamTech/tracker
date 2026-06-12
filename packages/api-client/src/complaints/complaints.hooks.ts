import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi, type CreateComplaintDto } from './complaints.api';

export const complaintKeys = {
  all: ['complaints'] as const,
  detail: (id: string) => ['complaints', id] as const,
};

export const useMyComplaints = () =>
  useQuery({
    queryKey: complaintKeys.all,
    queryFn: complaintsApi.getMyComplaints,
  });

export const useComplaintById = (id: string) =>
  useQuery({
    queryKey: complaintKeys.detail(id),
    queryFn: () => complaintsApi.getComplaintById(id),
    enabled: !!id,
  });

export const useCreateComplaint = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateComplaintDto) => complaintsApi.createComplaint(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: complaintKeys.all }),
  });
};

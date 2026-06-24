import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi, type CreateComplaintDto } from './complaints.api';

export const complaintKeys = {
  all: ['complaints'] as const,
  detail: (id: string) => ['complaints', id] as const,
  kpi: ['complaints', 'kpi'] as const,
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

export interface ComplaintFilters {
  status?: string;
  category?: string;
  routeId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useAllComplaints = (params?: ComplaintFilters) =>
  useQuery({
    queryKey: ['complaints', 'all', params],
    queryFn: () => complaintsApi.getAllComplaints(params),
  });

export const useComplaintKpi = () =>
  useQuery({ queryKey: complaintKeys.kpi, queryFn: complaintsApi.getKpi });

export const useUpdateComplaintStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note, override }: { id: string; status: string; note?: string; override?: boolean }) =>
      complaintsApi.updateComplaintStatus(id, status, note, override),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: complaintKeys.all });
      qc.invalidateQueries({ queryKey: ['complaints', 'all'] });
      qc.invalidateQueries({ queryKey: complaintKeys.detail(id) });
    },
  });
};

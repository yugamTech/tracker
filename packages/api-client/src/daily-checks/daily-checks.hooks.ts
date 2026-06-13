import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyChecksApi, type SubmitDailyCheckDto } from './daily-checks.api';

export const dailyCheckKeys = {
  all: ['daily-checks'] as const,
  list: (vehicleId?: string, date?: string) => ['daily-checks', vehicleId, date] as const,
};

export const useDailyChecks = (params?: { vehicleId?: string; date?: string }) =>
  useQuery({
    queryKey: dailyCheckKeys.list(params?.vehicleId, params?.date),
    queryFn: () => dailyChecksApi.list(params),
  });

export const useSubmitDailyCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitDailyCheckDto) => dailyChecksApi.submit(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyCheckKeys.all }),
  });
};

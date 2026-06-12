import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type RequestOtpDto, type VerifyOtpDto } from './auth.api';

export const authKeys = {
  memberships: ['auth', 'memberships'] as const,
};

export const useRequestOtp = () =>
  useMutation({
    mutationFn: (dto: RequestOtpDto) => authApi.requestOtp(dto),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: (dto: VerifyOtpDto) => authApi.verifyOtp(dto),
  });

export const useMemberships = (enabled = true) =>
  useQuery({
    queryKey: authKeys.memberships,
    queryFn: authApi.listMemberships,
    enabled,
  });

export const useSwitchContext = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => authApi.switchContext(membershipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.memberships }),
  });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  driverProfilesApi,
  type DriverProfileSelfDto,
  type DriverProfileAdminDto,
} from './driver-profiles.api';

export const driverProfileKeys = {
  all: ['driver-profiles'] as const,
  mine: () => [...driverProfileKeys.all, 'me'] as const,
  detail: (membershipId: string) => [...driverProfileKeys.all, membershipId] as const,
};

export const useMyDriverProfile = () =>
  useQuery({
    queryKey: driverProfileKeys.mine(),
    queryFn: driverProfilesApi.getMine,
  });

export const useUpdateMyDriverProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: DriverProfileSelfDto) => driverProfilesApi.updateMine(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: driverProfileKeys.mine() }),
  });
};

export const useDriverProfile = (membershipId: string) =>
  useQuery({
    queryKey: driverProfileKeys.detail(membershipId),
    queryFn: () => driverProfilesApi.getByMembership(membershipId),
    enabled: !!membershipId,
  });

export const useUpsertDriverProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, dto }: { membershipId: string; dto: DriverProfileAdminDto }) =>
      driverProfilesApi.upsert(membershipId, dto),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: driverProfileKeys.detail(vars.membershipId) });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from './vehicles.api';

export const vehicleKeys = {
  all: ['vehicles'] as const,
  vehicle: (id: string) => ['vehicles', id] as const,
};

export const useVehicles = () =>
  useQuery({ queryKey: vehicleKeys.all, queryFn: vehiclesApi.list });

export const useVehicleById = (id: string) =>
  useQuery({ queryKey: vehicleKeys.vehicle(id), queryFn: () => vehiclesApi.getById(id), enabled: !!id });

export const useCreateVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all }),
  });
};

export const useUpdateVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Parameters<typeof vehiclesApi.update>[1]) =>
      vehiclesApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: vehicleKeys.vehicle(id) });
      qc.invalidateQueries({ queryKey: vehicleKeys.all });
    },
  });
};

export const useDeactivateVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vehiclesApi.deactivate(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: vehicleKeys.vehicle(id) });
      qc.invalidateQueries({ queryKey: vehicleKeys.all });
    },
  });
};

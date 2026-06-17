import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routesApi, stopsApi } from './routes.api';

export const routeKeys = {
  all: ['routes'] as const,
  route: (id: string) => ['routes', id] as const,
  stops: ['stops'] as const,
};

export const useRoutes = () =>
  useQuery({ queryKey: routeKeys.all, queryFn: routesApi.list });

export const useRouteById = (id: string) =>
  useQuery({ queryKey: routeKeys.route(id), queryFn: () => routesApi.getById(id), enabled: !!id });

export const useCreateRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: routesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: routeKeys.all }),
  });
};

export const useUpdateRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Parameters<typeof routesApi.update>[1]) =>
      routesApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: routeKeys.route(id) });
      qc.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
};

export const useDeactivateRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => routesApi.deactivate(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: routeKeys.route(id) });
      qc.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
};

export const useReactivateRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => routesApi.reactivate(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: routeKeys.route(id) });
      qc.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
};

export const useStops = () =>
  useQuery({ queryKey: routeKeys.stops, queryFn: stopsApi.list });

export const useCreateStop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stopsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: routeKeys.stops }),
  });
};

export const useAddStop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, stopId, sequence }: { routeId: string; stopId: string; sequence: number }) =>
      routesApi.addStop(routeId, { stopId, sequence }),
    onSuccess: (_data, { routeId }) => {
      qc.invalidateQueries({ queryKey: routeKeys.route(routeId) });
      qc.invalidateQueries({ queryKey: routeKeys.all });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, type MarkAttendanceDto } from './attendance.api';

export const attendanceKeys = {
  trip: (tripId: string) => ['attendance', 'trip', tripId] as const,
};

export const useTripAttendance = (tripId: string) =>
  useQuery({
    queryKey: attendanceKeys.trip(tripId),
    queryFn: () => attendanceApi.getTripAttendance(tripId),
    enabled: !!tripId,
  });

export const useRoster = (tripId: string) =>
  useQuery({
    queryKey: [...attendanceKeys.trip(tripId), 'roster'],
    queryFn: () => attendanceApi.getRoster(tripId),
    enabled: !!tripId,
  });

export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: MarkAttendanceDto) => attendanceApi.markAttendance(dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.trip(variables.tripId) });
    },
  });
};

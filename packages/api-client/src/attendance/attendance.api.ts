import { apiClient } from '../axios';
import type { AttendanceEvent } from '@saarthi/types';

export interface MarkAttendanceDto {
  tripId: string;
  studentId: string;
  type: 'BOARDED' | 'ALIGHTED';
  photoUrl?: string;
}

export const attendanceApi = {
  markAttendance: async (dto: MarkAttendanceDto) => {
    const { data } = await apiClient.post('/attendance', dto);
    return data.data as AttendanceEvent;
  },

  getTripAttendance: async (tripId: string) => {
    const { data } = await apiClient.get(`/attendance/trip/${tripId}`);
    return data.data as AttendanceEvent[];
  },
};

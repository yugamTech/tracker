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

  getRoster: async (tripId: string) => {
    const { data } = await apiClient.get(`/attendance/trip/${tripId}/roster`);
    return data.data as RosterResponse;
  },

  uploadPhoto: async (filename: string, base64?: string, contentType = 'image/jpeg') => {
    const { data } = await apiClient.post('/attendance/photo', { filename, base64, contentType });
    return data.data as { url: string };
  },
};

export interface RosterGuardian {
  name: string;
  phone: string;
  relation: string;
  isPrimary: boolean;
}

export interface RosterRider {
  studentId: string;
  studentName: string;
  boardStatus: 'EXPECTED' | 'BOARDED' | 'NOT_BOARDED' | 'CANCELLED';
  photoUrl: string | null;
  lastEventType: 'BOARDED' | 'ALIGHTED' | null;
  lastEventTs: string | null;
  guardians: RosterGuardian[];
}

export interface RosterResponse {
  tripId: string;
  summary: { total: number; boarded: number; notBoarded: number; cancelled: number; expected: number };
  stops: { stopId: string; stopName: string; riders: RosterRider[] }[];
}

import { apiClient } from '../axios';
import type { Complaint } from '@saarthi/types';
import type { ComplaintCategory } from '@saarthi/types';

export interface CreateComplaintDto {
  studentId?: string;
  tripId?: string;
  category: ComplaintCategory;
  description?: string;
}

export const complaintsApi = {
  getMyComplaints: async () => {
    const { data } = await apiClient.get('/complaints');
    return data.data as Complaint[];
  },

  getComplaintById: async (id: string) => {
    const { data } = await apiClient.get(`/complaints/${id}`);
    return data.data as Complaint;
  },

  createComplaint: async (dto: CreateComplaintDto) => {
    const { data } = await apiClient.post('/complaints', dto);
    return data.data as Complaint;
  },

  getAllComplaints: async (params?: {
    status?: string;
    category?: string;
    routeId?: string;
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const { data } = await apiClient.get('/complaints/all', { params });
    return data.data as Complaint[];
  },

  updateComplaintStatus: async (id: string, status: string, note?: string) => {
    const { data } = await apiClient.patch(`/complaints/${id}/status`, { status, note });
    return data.data as Complaint;
  },
};

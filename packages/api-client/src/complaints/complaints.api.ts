import { apiClient } from '../axios';
import type { Complaint } from '@yaanam/types';
import type { ComplaintCategory } from '@yaanam/types';

export interface CreateComplaintDto {
  studentId?: string;
  tripId?: string;
  category: ComplaintCategory;
  description?: string;
}

/**
 * Computed service KPIs for the admin Complaints → KPIs screen (GET /complaints/kpi).
 * All counts/rates are derived live from complaint rows; rates are null when their
 * denominator is zero so the UI can degrade gracefully on an empty tenant.
 *
 * NOTE: the shape may grow as real complaint data lands (e.g. SLA breach counts) —
 * additive only, so existing readers keep working.
 */
export interface ComplaintKpi {
  total: number;
  /** In-flight: RECEIVED/IN_PROGRESS/COUNSELLING_CALL/ADMIN_CALL/VISIT/REOPENED. */
  open: number;
  /** Resolution delivered, not yet closed: RESOLVED/PARENT_RATING. */
  awaitingClosure: number;
  closed: number;
  /** closed / total, 0–1, or null when there are no complaints. */
  resolutionRate: number | null;
  /** Mean hours from createdAt → resolvedAt over resolved complaints, or null. */
  avgResolutionHours: number | null;
  byStatus: Array<{ status: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byRoute: Array<{ routeId: string | null; routeName: string; count: number }>;
  byDriver: Array<{ driverId: string | null; driverName: string; count: number }>;
  /** Parent resolution-satisfaction ratings (1–5) aggregate. */
  rating: { count: number; avg: number | null; satisfiedRate: number | null };
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

  updateComplaintStatus: async (id: string, status: string, note?: string, override?: boolean) => {
    const { data } = await apiClient.patch(`/complaints/${id}/status`, { status, note, override });
    return data.data as Complaint;
  },

  getKpi: async () => {
    const { data } = await apiClient.get('/complaints/kpi');
    return data.data as ComplaintKpi;
  },
};

import { apiClient } from '../axios';
import type { DriverProfile, PoliceVerificationStatus } from '@yaanam/types';

export type { DriverProfile } from '@yaanam/types';

/** Fields a driver may edit on their own KYC (no police-verification fields). */
export interface DriverProfileSelfDto {
  aadhaarNumber?: string;
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  photoUrl?: string;
}

/** Admin DTO — everything a driver can set, plus the police-verification outcome. */
export interface DriverProfileAdminDto extends DriverProfileSelfDto {
  policeVerificationStatus?: PoliceVerificationStatus;
  policeVerificationRef?: string;
}

export const driverProfilesApi = {
  getMine: async (): Promise<DriverProfile | null> => {
    const { data } = await apiClient.get('/driver-profiles/me');
    return data.data;
  },

  updateMine: async (dto: DriverProfileSelfDto): Promise<DriverProfile> => {
    const { data } = await apiClient.put('/driver-profiles/me', dto);
    return data.data;
  },

  getByMembership: async (membershipId: string): Promise<DriverProfile | null> => {
    const { data } = await apiClient.get(`/driver-profiles/${membershipId}`);
    return data.data;
  },

  upsert: async (membershipId: string, dto: DriverProfileAdminDto): Promise<DriverProfile> => {
    const { data } = await apiClient.put(`/driver-profiles/${membershipId}`, dto);
    return data.data;
  },
};

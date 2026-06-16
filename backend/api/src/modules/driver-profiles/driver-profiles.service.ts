import { Injectable, NotFoundException } from '@nestjs/common';
import { PoliceVerificationStatus, Role } from '@saarthi/types';
import { PrismaService } from '../../infra/database/prisma.service';

/** Fields a driver may edit on their own KYC. Police verification is admin-only. */
export interface DriverEditableProfile {
  aadhaarNumber?: string;
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  photoUrl?: string;
}

/** Admin may additionally set/clear the police-verification outcome. */
export interface AdminEditableProfile extends DriverEditableProfile {
  policeVerificationStatus?: PoliceVerificationStatus;
  policeVerificationRef?: string;
}

@Injectable()
export class DriverProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify a membership is a DRIVER in the caller's tenant before any read/write
   * (tenant isolation, NFR-05). A KYC record can never reference another school's
   * driver, and only DRIVER memberships carry one.
   */
  private async assertDriverMembership(membershipId: string, tenantId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId, role: Role.DRIVER },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('Driver not found in this school');
    }
  }

  /** Return a driver's KYC profile (null if not yet created). Tenant-scoped. */
  async find(membershipId: string, tenantId: string) {
    await this.assertDriverMembership(membershipId, tenantId);
    return this.prisma.driverProfile.findUnique({ where: { membershipId } });
  }

  /**
   * Create-or-update a driver's KYC. Idempotent on membershipId (1:1), so an admin
   * or the driver editing the same record never duplicates it. `data` is already
   * narrowed by the controller DTO — a self-editing driver can never pass the
   * police-verification fields.
   */
  async upsert(membershipId: string, tenantId: string, data: AdminEditableProfile) {
    await this.assertDriverMembership(membershipId, tenantId);
    return this.prisma.driverProfile.upsert({
      where: { membershipId },
      create: { membershipId, tenantId, ...data },
      update: data,
    });
  }
}

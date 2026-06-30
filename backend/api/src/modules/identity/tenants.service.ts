import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Patch the tenant's profile + settings. Only the supplied keys change.
   * `featureFlags`/`brandingConfig`/`bellTimings`/`alertNumbers` are JSON columns
   * — the caller (Settings screens) owns their shape; we persist as-is.
   */
  update(
    id: string,
    data: Partial<{
      name: string;
      timezone: string;
      locale: string;
      featureFlags: Record<string, string>;
      brandingConfig: Record<string, unknown>;
      bellTimings: Array<{ id?: string; label: string; time: string }>;
      alertNumbers: Array<{ id?: string; label: string; phone: string }>;
      schoolLat: number;
      schoolLng: number;
      schoolName: string;
    }>,
  ) {
    // The JSON columns are validated by the controller DTO; cast at the Prisma
    // boundary since arbitrary JSON values don't structurally match InputJsonValue.
    return this.prisma.tenant.update({ where: { id }, data: data as Prisma.TenantUpdateInput });
  }
}

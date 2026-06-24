import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantsService } from '../tenants.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { Role } from '@yaanam/types';

/** A single school-day bell entry. `time` is "HH:MM" (24h); the client validates the format. */
class BellTimingDto {
  @IsOptional() @IsString() id?: string;
  @IsString() label!: string;
  @IsString() time!: string;
}

/** A single emergency / alert contact. */
class AlertNumberDto {
  @IsOptional() @IsString() id?: string;
  @IsString() label!: string;
  @IsString() phone!: string;
}

class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() locale?: string;
  // Per-tenant feature toggles, keyed by feature id → 'on' | 'off' | 'wip'.
  @IsOptional() @IsObject() featureFlags?: Record<string, string>;
  // Branding (e.g. { primaryColor, tagline }). Stored as-is.
  @IsOptional() @IsObject() brandingConfig?: Record<string, unknown>;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BellTimingDto)
  bellTimings?: BellTimingDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlertNumberDto)
  alertNumbers?: AlertNumberDto[];
}

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  findMyTenant(@TenantId() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  // Editing school profile / settings is an admin action. A parent can read
  // their tenant (the GET above) but must never mutate it.
  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  updateMyTenant(@TenantId() tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(tenantId, dto);
  }
}

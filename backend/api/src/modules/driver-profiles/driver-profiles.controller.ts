import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsEnum, IsDateString, Matches, MinLength,
  registerDecorator, type ValidationOptions, type ValidationArguments,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { Role, PoliceVerificationStatus } from '@saarthi/types';
import type { ActiveMembership } from '@saarthi/types';
import { DriverProfilesService, type AdminEditableProfile } from './driver-profiles.service';

/** Validates that a `YYYY-MM-DD` value is a strictly future calendar date. */
function IsFutureDateString(opts?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDateString',
      target: object.constructor,
      propertyName,
      options: opts,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const today = new Date().toISOString().slice(0, 10);
          return value > today; // ISO date strings sort lexicographically.
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a future date (the licence has expired).`;
        },
      },
    });
  };
}

/** Fields a driver may edit on their OWN KYC — note: NO police-verification fields. */
class DriverProfileSelfDto {
  // Exactly 12 digits, with optional single spaces between groups (XXXX XXXX XXXX).
  @IsOptional()
  @Matches(/^(\d{4}\s?){2}\d{4}$|^\d{12}$/, { message: 'Aadhaar must be exactly 12 digits.' })
  aadhaarNumber?: string;

  @IsOptional() @IsString() @MinLength(10, { message: 'Address must be at least 10 characters.' })
  address?: string;

  // Indian DL: 2 letters + 2 digits + optional space + 11 digits (case-insensitive).
  @IsOptional()
  @Matches(/^[A-Za-z]{2}\d{2}\s?\d{11}$/, { message: 'Enter a valid DL, e.g. MH12 20231234567.' })
  licenseNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Licence expiry must be a real date (YYYY-MM-DD).' })
  @IsFutureDateString()
  licenseExpiry?: string;

  @IsOptional() @IsString() photoUrl?: string;
}

/** Admin DTO — everything a driver can set, plus the police-verification outcome. */
class DriverProfileAdminDto extends DriverProfileSelfDto {
  @IsOptional() @IsEnum(PoliceVerificationStatus) policeVerificationStatus?: PoliceVerificationStatus;
  @IsOptional() @IsString() policeVerificationRef?: string;
}

@ApiTags('driver-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('driver-profiles')
export class DriverProfilesController {
  constructor(private readonly service: DriverProfilesService) {}

  /** Driver views their own KYC (their active membership is the DRIVER one). */
  @Get('me')
  findMine(@ActiveMembershipDec() actor: ActiveMembership) {
    return this.service.find(actor.membershipId, actor.tenantId);
  }

  /** Driver edits their own KYC. Police-verification fields are not accepted here. */
  @Put('me')
  upsertMine(@ActiveMembershipDec() actor: ActiveMembership, @Body() dto: DriverProfileSelfDto) {
    return this.service.upsert(actor.membershipId, actor.tenantId, toData(dto));
  }

  /** Admin views any driver's KYC in their school. */
  @Get(':membershipId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  findOne(@TenantId() tenantId: string, @Param('membershipId') membershipId: string) {
    return this.service.find(membershipId, tenantId);
  }

  /** Admin creates/edits any driver's KYC in their school (incl. police verification). */
  @Put(':membershipId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  upsert(
    @TenantId() tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: DriverProfileAdminDto,
  ) {
    return this.service.upsert(membershipId, tenantId, toData(dto));
  }
}

/** Normalise the DTO into the service shape (ISO date string → Date). */
function toData(dto: DriverProfileAdminDto): AdminEditableProfile {
  return {
    ...dto,
    licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
  };
}

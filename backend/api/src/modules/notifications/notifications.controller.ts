import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PersonId } from '../../common/decorators/person-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { NotificationsService } from './notifications.service';
import type { ActiveMembership } from '@yaanam/types';

const ADMIN_ROLES = ['ADMIN', 'TRANSPORT_MANAGER', 'FOUNDER', 'SUPER_ADMIN'];

class RegisterDeviceTokenDto {
  @IsString() token!: string;
  @IsString() platform!: string;
}

class PreferenceUpdateDto {
  @IsString() category!: string;
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
}

class UpdatePreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceUpdateDto)
  updates!: PreferenceUpdateDto[];
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @PersonId() personId: string,
    @TenantId() tenantId: string,
    @ActiveMembershipDec() membership: ActiveMembership,
    @Query('page') page?: string,
  ) {
    const p = page ? Number(page) : 1;
    // Admin roles see all tenant notifications (delivery audit). Others see only their own.
    if (ADMIN_ROLES.includes(membership.role)) {
      return this.notificationsService.listForTenant(tenantId, p);
    }
    return this.notificationsService.listForPerson(personId, tenantId, p);
  }

  @Get('preferences')
  getPreferences(@PersonId() personId: string, @TenantId() tenantId: string) {
    return this.notificationsService.getPreferences(personId, tenantId);
  }

  @Put('preferences')
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @PersonId() personId: string,
    @TenantId() tenantId: string,
  ) {
    return this.notificationsService.updatePreferences(personId, tenantId, dto.updates);
  }

  @Post('device-token')
  registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @PersonId() personId: string,
  ) {
    return this.notificationsService.registerDeviceToken(
      personId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('device-token/:token')
  async removeDeviceToken(@Param('token') token: string) {
    await this.notificationsService.removeDeviceToken(token);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@PersonId() personId: string, @TenantId() tenantId: string) {
    await this.notificationsService.markAllRead(personId, tenantId);
    return { success: true };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notificationsService.markRead(id);
    return { success: true };
  }
}

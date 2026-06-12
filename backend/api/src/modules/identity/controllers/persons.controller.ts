import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PersonsService } from '../persons.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { PersonId } from '../../../common/decorators/person-id.decorator';
import { IsString, IsOptional } from 'class-validator';

class UpdateMeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() avatarUrl?: string;
}

@ApiTags('persons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.personsService.list(tenantId);
  }

  @Get('me')
  getMe(@PersonId() personId: string) {
    return this.personsService.findMe(personId);
  }

  @Patch('me')
  updateMe(@PersonId() personId: string, @Body() dto: UpdateMeDto) {
    return this.personsService.updateMe(personId, dto);
  }
}
